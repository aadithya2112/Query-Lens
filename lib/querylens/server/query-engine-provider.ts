import { FunctionCallingConfigMode, type FunctionDeclaration } from "@google/genai"
import { z } from "zod"

import { getSampleDataset } from "@/lib/querylens/seed-data"
import {
  getDefaultDatasetId,
} from "@/lib/querylens/datasets"
import {
  canUseGemini,
  type QueryLensExecutionContext,
  requiresGeminiPlanning,
} from "@/lib/querylens/server/ai-config"
import { generateGeminiResponse } from "@/lib/querylens/server/gemini-client"
import {
  resolvePhase1Scope,
  resolvePhase1ScopeValue,
} from "@/lib/querylens/server/parser"
import {
  planDeterministicQuery,
  validateQueryPlan,
} from "@/lib/querylens/server/query-planner"
import { roundTo } from "@/lib/querylens/scoring"
import type {
  CompareSpec,
  ContextEvent,
  DiscoveryFocus,
  DriverItem,
  Phase1AnalysisResponse,
  QueryPlanResult,
  RetrievalContext,
  ScopeFilter,
  StructuredQueryPlan,
} from "@/lib/querylens/types"

export const DEFAULT_FLAGSHIP_QUESTION = "Why did SME cashflow health drop last week?"
export const SUPPORTED_QUERY_FOLLOW_UPS = [
  "Focus on the North West contribution to last week's drop",
  "Focus on hospitality SMEs last week",
  "What changed this week instead?",
] as const

const narrativeResponseSchema = z.object({
  headline: z.string().min(1),
  summary: z.string().min(1),
  supportedFollowUps: z
    .array(z.enum(SUPPORTED_QUERY_FOLLOW_UPS))
    .length(SUPPORTED_QUERY_FOLLOW_UPS.length),
})

const submitWhatChangedSchema = z.object({
  intent: z.literal("what_changed"),
  metric: z.literal("cashflow_health_score"),
  timeframe: z.enum(["this_week", "last_week"]),
  region: z.string().min(1).optional(),
  sector: z.string().min(1).optional(),
})

const submitBreakdownSchema = z.object({
  intent: z.literal("breakdown"),
  metric: z.literal("at_risk_account_count"),
  timeframe: z.enum(["this_week", "last_week"]),
  breakdownDimension: z.enum(["region", "sector", "region_sector"]),
  region: z.string().min(1).optional(),
  sector: z.string().min(1).optional(),
})

const submitCompareSchema = z.object({
  intent: z.literal("compare"),
  metric: z.literal("cashflow_health_score"),
  timeframe: z.enum(["this_week", "last_week"]),
  compareMode: z.enum(["timeframe", "peer"]),
  compareDimension: z.enum(["region", "sector"]).optional(),
  region: z.string().min(1).optional(),
  sector: z.string().min(1).optional(),
  leftEntity: z.string().min(1).optional(),
  rightEntity: z.string().min(1).optional(),
})

const submitDiscoverySchema = z.object({
  intent: z.literal("discovery"),
  metric: z.literal("dataset_catalog"),
  discoveryFocus: z
    .enum(["overview", "metrics", "sources", "dimensions", "time_coverage", "questions"])
    .optional(),
})

const submitQueryPlanSchema = z.discriminatedUnion("intent", [
  submitWhatChangedSchema,
  submitBreakdownSchema,
  submitCompareSchema,
  submitDiscoverySchema,
])

interface NarrativeInput {
  parsed: StructuredQueryPlan
  activeScopeLabel: string
  currentScore: number
  previousScore: number
  drivers: DriverItem[]
  contextEvents: ContextEvent[]
}

export interface QueryEngineProvider {
  planQuery: (
    question: string,
    scopeOverride?: ScopeFilter,
    retrievalContext?: RetrievalContext
  ) => Promise<QueryPlanResult>
  composeNarrative: (
    input: NarrativeInput
  ) => Promise<
    Pick<Phase1AnalysisResponse, "headline" | "summary" | "supportedFollowUps">
  >
}

function buildHeadline(activeScopeLabel: string, currentScore: number, previousScore: number) {
  const delta = roundTo(currentScore - previousScore)
  const direction = delta < 0 ? "fell" : "improved"
  return `${activeScopeLabel} cashflow health ${direction} ${Math.abs(delta).toFixed(1)} points`
}

function buildDeterministicNarrative({
  activeScopeLabel,
  currentScore,
  previousScore,
  drivers,
  contextEvents,
}: NarrativeInput) {
  const delta = roundTo(currentScore - previousScore)
  const worstDriver = drivers[0]
  const leadContext = contextEvents[0]
  const direction = delta < 0 ? "down" : "up"

  const summaryParts = [
    `${activeScopeLabel} moved ${direction} from ${previousScore.toFixed(1)} to ${currentScore.toFixed(1)} week over week.`,
  ]

  if (worstDriver) {
    summaryParts.push(worstDriver.description)
  }

  if (leadContext) {
    summaryParts.push(`${leadContext.summary} ${leadContext.detail}`)
  }

  return {
    headline: buildHeadline(activeScopeLabel, currentScore, previousScore),
    summary: summaryParts.join(" "),
    supportedFollowUps: [...SUPPORTED_QUERY_FOLLOW_UPS],
  }
}

function buildNarrativePrompt(input: NarrativeInput) {
  const deterministic = buildDeterministicNarrative(input)
  const driverLines = input.drivers.length
    ? input.drivers
        .map(
          (driver, index) =>
            `${index + 1}. ${driver.title} (${driver.impactLabel}, ${driver.direction}): ${driver.description}`
        )
        .join("\n")
    : "No ranked drivers were found."

  const contextLines = input.contextEvents.length
    ? input.contextEvents
        .map(
          (event, index) =>
            `${index + 1}. [${event.collection}] ${event.summary} ${event.detail}`
        )
        .join("\n")
    : "No corroborating context events were found."

  return `
You are writing the user-facing narrative for QueryLens, a trust-first analytics app.

Return JSON only and use only the facts below. Do not invent new metrics, timeframes, evidence, follow-up questions, or remediation advice.

Facts:
- Scope: ${input.activeScopeLabel}
- Metric: cashflow_health_score
- Timeframe: ${input.parsed.timeframe}
- Current score: ${input.currentScore.toFixed(1)}
- Previous score: ${input.previousScore.toFixed(1)}
- Default grounded headline: ${deterministic.headline}
- Allowed follow-ups: ${SUPPORTED_QUERY_FOLLOW_UPS.join(" | ")}

Drivers:
${driverLines}

Context:
${contextLines}

Write:
- a concise headline
- a 2-3 sentence summary grounded in the supplied drivers and context
- the full allowed follow-up list exactly as provided
`.trim()
}

const narrativeJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["headline", "summary", "supportedFollowUps"],
  properties: {
    headline: { type: "string" },
    summary: { type: "string" },
    supportedFollowUps: {
      type: "array",
      minItems: SUPPORTED_QUERY_FOLLOW_UPS.length,
      maxItems: SUPPORTED_QUERY_FOLLOW_UPS.length,
      items: {
        type: "string",
        enum: [...SUPPORTED_QUERY_FOLLOW_UPS],
      },
    },
  },
} as const

function buildGeminiRequiredFallback(
  reason = "QueryLens needs Gemini enabled to interpret interactive questions right now."
): QueryPlanResult {
  return {
    fallbackReason: reason,
    failureKind: "model_unavailable",
  }
}

function buildGuidedPlanningFailure(
  reason = "QueryLens could not safely interpret that question right now."
): QueryPlanResult {
  return {
    fallbackReason: reason,
    failureKind: "guided_failure",
  }
}

async function buildGeminiNarrative(input: NarrativeInput) {
  const result = await generateGeminiResponse({
    prompt: buildNarrativePrompt(input),
    responseJsonSchema: narrativeJsonSchema,
  })

  return narrativeResponseSchema.parse(result.json)
}

const plannerTools: FunctionDeclaration[] = [
  {
    name: "submit_analytics_query_plan",
    description:
      "Submit a supported QueryLens query plan for the current what-changed analytics flow.",
    parametersJsonSchema: {
      type: "object",
      additionalProperties: false,
      required: ["intent", "metric"],
      properties: {
        intent: {
          type: "string",
          enum: ["what_changed", "breakdown", "compare", "discovery"],
        },
        metric: {
          type: "string",
          enum: ["cashflow_health_score", "at_risk_account_count", "dataset_catalog"],
        },
        timeframe: {
          type: "string",
          enum: ["this_week", "last_week"],
        },
        breakdownDimension: {
          type: "string",
          enum: ["region", "sector", "region_sector"],
        },
        compareMode: {
          type: "string",
          enum: ["timeframe", "peer"],
        },
        compareDimension: {
          type: "string",
          enum: ["region", "sector"],
        },
        region: {
          type: "string",
        },
        sector: {
          type: "string",
        },
        leftEntity: {
          type: "string",
        },
        rightEntity: {
          type: "string",
        },
        discoveryFocus: {
          type: "string",
          enum: ["overview", "metrics", "sources", "dimensions", "time_coverage", "questions"],
        },
      },
    },
  },
  {
    name: "reject_analytics_query_plan",
    description:
      "Reject requests that are outside the supported QueryLens scope or too ambiguous to parse safely.",
    parametersJsonSchema: {
      type: "object",
      additionalProperties: false,
      required: ["reason"],
      properties: {
        reason: {
          type: "string",
        },
      },
    },
  },
]

function formatRetrievedContext(retrievalContext?: RetrievalContext) {
  if (!retrievalContext) {
    return "No retrieved context was available."
  }

  const datasetContext = retrievalContext.datasetMatches.length
    ? retrievalContext.datasetMatches
        .map((match, index) => `${index + 1}. ${match.title}: ${match.content}`)
        .join("\n")
    : "No dataset metadata matches were retrieved."
  const memoryContext = retrievalContext.memoryMatches.length
    ? retrievalContext.memoryMatches
        .map((match, index) => `${index + 1}. ${match.title}: ${match.content}`)
        .join("\n")
    : "No conversation memory matches were retrieved."
  const recentMessages = retrievalContext.recentMessages.length
    ? retrievalContext.recentMessages
        .map((message) => `${message.role}: ${message.text}`)
        .join("\n")
    : "No recent conversation turns were available."

  return `Dataset context:\n${datasetContext}\n\nConversation memory:\n${memoryContext}\n\nRecent conversation:\n${recentMessages}`
}

function buildPlannerPrompt(question: string, retrievalContext?: RetrievalContext) {
  return `
You are planning a QueryLens analytics query.

You must choose exactly one function call.

Supported product boundaries:
- intent: what changed
  - metric: cashflow_health_score
  - timeframe: this_week or last_week
- intent: breakdown
  - metric: at_risk_account_count
  - timeframe: this_week or last_week
  - breakdownDimension: region, sector, or region_sector
- intent: compare
  - metric: cashflow_health_score
  - timeframe: this_week or last_week
  - compareMode: timeframe or peer
  - compareDimension: region or sector for peer compare
- intent: discovery
  - metric: dataset_catalog
  - discoveryFocus: overview, metrics, sources, dimensions, time_coverage, or questions
- optional scope filters: region and sector
- supported regions: North West, London & South East, Midlands
- supported sectors: Hospitality, Retail, Professional Services

Use retrieved context to resolve references like "that", "there", "those metrics", or "that region".

Reject requests about unsupported metrics, unsupported time windows, uploads, or anything outside the current discovery, what-changed, breakdown, and compare flows.

Retrieved context:
${formatRetrievedContext(retrievalContext)}

Question:
${question}
`.trim()
}

function resolveScopeDimensions(scope: ScopeFilter) {
  if (scope.region && scope.sector) {
    return ["region", "sector"] as const
  }

  if (scope.region) {
    return ["region"] as const
  }

  if (scope.sector) {
    return ["sector"] as const
  }

  return ["portfolio"] as const
}

function resolveCompareSpec(args: {
  question: string
  data: z.infer<typeof submitCompareSchema>
  scopeOverride?: ScopeFilter
}): CompareSpec | undefined {
  if (args.data.compareMode === "timeframe") {
    const extractedScope = resolvePhase1Scope({
      region: args.data.region,
      sector: args.data.sector,
    })
    const overrideScope = resolvePhase1Scope(args.scopeOverride ?? {})

    if (
      (args.data.region && extractedScope.invalidRegion) ||
      (args.data.sector && extractedScope.invalidSector) ||
      overrideScope.invalidRegion ||
      overrideScope.invalidSector
    ) {
      return undefined
    }

    const scope = {
      ...extractedScope.scope,
      ...overrideScope.scope,
    }

    if (scope.region && scope.sector) {
      return undefined
    }

    const dataset = getSampleDataset()
    const scopeLabel = scope.region
      ? dataset.regions.find((region) => region.id === scope.region)?.name
      : scope.sector
        ? dataset.sectors.find((sector) => sector.id === scope.sector)?.name
        : undefined

    return {
      mode: "timeframe",
      leftTimeframe: "this_week",
      rightTimeframe: "last_week",
      leftScope: scope,
      rightScope: scope,
      leftLabel: scopeLabel ? `${scopeLabel} · This week` : "This week",
      rightLabel: scopeLabel ? `${scopeLabel} · Last week` : "Last week",
    }
  }

  if (
    !args.data.compareDimension ||
    !args.data.leftEntity ||
    !args.data.rightEntity ||
    args.scopeOverride?.region ||
    args.scopeOverride?.sector
  ) {
    return undefined
  }

  const dataset = getSampleDataset()
  const catalog =
    args.data.compareDimension === "region" ? dataset.regions : dataset.sectors
  const leftValue = resolvePhase1ScopeValue(args.data.leftEntity, catalog)
  const rightValue = resolvePhase1ScopeValue(args.data.rightEntity, catalog)

  if (!leftValue || !rightValue) {
    return undefined
  }

  const leftLabel =
    catalog.find((item) => item.id === leftValue)?.name ?? args.data.leftEntity
  const rightLabel =
    catalog.find((item) => item.id === rightValue)?.name ?? args.data.rightEntity

  return {
    mode: "peer",
    dimension: args.data.compareDimension,
    selectedTimeframe: args.data.timeframe,
    leftScope:
      args.data.compareDimension === "region"
        ? { region: leftValue }
        : { sector: leftValue },
    rightScope:
      args.data.compareDimension === "region"
        ? { region: rightValue }
        : { sector: rightValue },
    leftLabel,
    rightLabel,
  }
}

async function planQueryWithGemini(
  question: string,
  scopeOverride?: ScopeFilter,
  retrievalContext?: RetrievalContext
) {
  const result = await generateGeminiResponse({
    prompt: buildPlannerPrompt(question, retrievalContext),
    tools: [{ functionDeclarations: plannerTools }],
    toolConfig: {
      functionCallingConfig: {
        mode: FunctionCallingConfigMode.ANY,
        allowedFunctionNames: [
          "submit_analytics_query_plan",
          "reject_analytics_query_plan",
        ],
      },
    },
  })

  const call = result.functionCalls?.[0]

  if (!call?.name) {
    return undefined
  }

  if (call.name === "reject_analytics_query_plan") {
    const reason =
      typeof call.args?.reason === "string" && call.args.reason.trim()
        ? call.args.reason
        : undefined

    return {
      fallbackReason: reason,
      failureKind: "unsupported" as const,
    }
  }

  if (call.name !== "submit_analytics_query_plan") {
    return undefined
  }

  const parsedArgs = submitQueryPlanSchema.safeParse(call.args)

  if (!parsedArgs.success) {
    return undefined
  }

  if (parsedArgs.data.intent === "discovery") {
    const parsed = {
      datasetId: getDefaultDatasetId(),
      rawQuestion: question,
      intent: "discovery" as const,
      metricId: "dataset_catalog" as const,
      timeframe: "this_week" as const,
      scope: {},
      scopeDimensions: ["portfolio"] as StructuredQueryPlan["scopeDimensions"],
      comparisonWindow: {
        timeframe: "this_week" as const,
        comparisonBasis: "prior_period" as const,
      },
      discoveryFocus:
        parsedArgs.data.discoveryFocus as DiscoveryFocus | undefined,
    }

    const validated = validateQueryPlan(parsed)

    if (!validated.parsed) {
      return undefined
    }

    return {
      plan: validated.parsed,
      parsed: validated.parsed,
    }
  }

  const extractedScope = resolvePhase1Scope({
    region: parsedArgs.data.region,
    sector: parsedArgs.data.sector,
  })
  const overrideScope = resolvePhase1Scope(scopeOverride ?? {})

  if (
    (parsedArgs.data.region && extractedScope.invalidRegion) ||
    (parsedArgs.data.sector && extractedScope.invalidSector) ||
    overrideScope.invalidRegion ||
    overrideScope.invalidSector
  ) {
    return undefined
  }

  const scope = {
    ...extractedScope.scope,
    ...overrideScope.scope,
  }

  const parsed = (() => {
    if (parsedArgs.data.intent === "compare") {
      const compareSpec = resolveCompareSpec({
        question,
        data: parsedArgs.data,
        scopeOverride,
      })

      if (!compareSpec) {
        return undefined
      }

      return {
        datasetId: getDefaultDatasetId(),
        rawQuestion: question,
        intent: "compare" as const,
        metricId: "cashflow_health_score" as const,
        timeframe:
          compareSpec.mode === "timeframe"
            ? "this_week"
            : parsedArgs.data.timeframe,
        scope: compareSpec.mode === "timeframe" ? scope : {},
        scopeDimensions:
          compareSpec.mode === "timeframe"
            ? ([...resolveScopeDimensions(scope)] as StructuredQueryPlan["scopeDimensions"])
            : ([compareSpec.dimension ?? "portfolio"] as StructuredQueryPlan["scopeDimensions"]),
        comparisonWindow: {
          timeframe:
            compareSpec.mode === "timeframe"
              ? "this_week"
              : parsedArgs.data.timeframe,
          comparisonBasis: "prior_period" as const,
        },
        compareSpec,
      }
    }

    return {
      datasetId: getDefaultDatasetId(),
      rawQuestion: question,
      intent: parsedArgs.data.intent,
      metricId: parsedArgs.data.metric,
      timeframe: parsedArgs.data.timeframe,
      scope,
      scopeDimensions: [...resolveScopeDimensions(scope)] as StructuredQueryPlan["scopeDimensions"],
      comparisonWindow: {
        timeframe: parsedArgs.data.timeframe,
        comparisonBasis: "prior_period" as const,
      },
      breakdownDimension:
        parsedArgs.data.intent === "breakdown"
          ? parsedArgs.data.breakdownDimension
          : undefined,
    }
  })()

  if (!parsed) {
    return undefined
  }

  const validated = validateQueryPlan(parsed)

  if (!validated.parsed) {
    return undefined
  }

  return {
    plan: validated.parsed,
    parsed: validated.parsed,
  }
}

export const deterministicQueryEngineProvider: QueryEngineProvider = {
  planQuery: async (question, scopeOverride) =>
    planDeterministicQuery(question, scopeOverride),
  composeNarrative: async (input) => buildDeterministicNarrative(input),
}

export function getQueryEngineProvider(args: {
  executionContext: QueryLensExecutionContext
}): QueryEngineProvider {
  const geminiPlanningRequired = requiresGeminiPlanning(args.executionContext)
  const geminiAvailable = canUseGemini(args.executionContext)

  if (!geminiPlanningRequired) {
    return deterministicQueryEngineProvider
  }

  return {
    planQuery: async (question, scopeOverride, retrievalContext) => {
      if (!geminiAvailable) {
        return buildGeminiRequiredFallback()
      }

      try {
        const geminiResult = await Promise.race([
          planQueryWithGemini(question, scopeOverride, retrievalContext),
          new Promise<undefined>((resolve) => {
            setTimeout(() => resolve(undefined), 6_000)
          }),
        ])

        if (geminiResult?.parsed) {
          return geminiResult
        }

        if (geminiResult?.fallbackReason) {
          return geminiResult
        }

        return buildGuidedPlanningFailure(
          "QueryLens could not validate Gemini's interpretation for that request."
        )
      } catch {
        return buildGeminiRequiredFallback(
          "QueryLens could not reach Gemini to interpret that question right now."
        )
      }
    },
    composeNarrative: async (input) => {
      if (!geminiAvailable) {
        return buildDeterministicNarrative(input)
      }

      try {
        return await Promise.race([
          buildGeminiNarrative(input),
          new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error("Gemini narrative timed out.")), 6_000)
          }),
        ])
      } catch {
        return buildDeterministicNarrative(input)
      }
    },
  }
}
