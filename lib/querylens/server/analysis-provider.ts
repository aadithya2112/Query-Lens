import {
  FunctionCallingConfigMode,
  type FunctionDeclaration,
} from "@google/genai"
import { z } from "zod"

import {
  type QueryLensExecutionContext,
  shouldUseGemini,
} from "@/lib/querylens/server/ai-config"
import { generateGeminiResponse } from "@/lib/querylens/server/gemini-client"
import {
  parsePhase1Question,
  resolvePhase1Scope,
} from "@/lib/querylens/server/parser"
import { roundTo } from "@/lib/querylens/scoring"
import type {
  ContextEvent,
  DriverItem,
  ParsedPhase1Query,
  Phase1AnalysisResponse,
  ScopeFilter,
} from "@/lib/querylens/types"

export const DEFAULT_FLAGSHIP_QUESTION = "Why did SME cashflow health drop last week?"
export const PHASE1_SUPPORTED_FOLLOW_UPS = [
  "Focus on the North West contribution to last week's drop",
  "Focus on hospitality SMEs last week",
  "What changed this week instead?",
] as const

const narrativeResponseSchema = z.object({
  headline: z.string().min(1),
  summary: z.string().min(1),
  supportedFollowUps: z
    .array(z.enum(PHASE1_SUPPORTED_FOLLOW_UPS))
    .length(PHASE1_SUPPORTED_FOLLOW_UPS.length),
})

const submitPhase1QuerySchema = z.object({
  metric: z.literal("cashflow_health_score"),
  timeframe: z.enum(["this_week", "last_week"]),
  region: z.string().min(1).optional(),
  sector: z.string().min(1).optional(),
})

interface NarrativeInput {
  parsed: ParsedPhase1Query
  activeScopeLabel: string
  currentScore: number
  previousScore: number
  drivers: DriverItem[]
  contextEvents: ContextEvent[]
}

export interface Phase1Provider {
  parseQuestion: (
    question: string,
    scopeOverride?: ScopeFilter
  ) => Promise<ReturnType<typeof parsePhase1Question>>
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
    supportedFollowUps: [...PHASE1_SUPPORTED_FOLLOW_UPS],
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
- Allowed follow-ups: ${PHASE1_SUPPORTED_FOLLOW_UPS.join(" | ")}

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
      minItems: PHASE1_SUPPORTED_FOLLOW_UPS.length,
      maxItems: PHASE1_SUPPORTED_FOLLOW_UPS.length,
      items: {
        type: "string",
        enum: [...PHASE1_SUPPORTED_FOLLOW_UPS],
      },
    },
  },
} as const

async function buildGeminiNarrative(input: NarrativeInput) {
  const result = await generateGeminiResponse({
    prompt: buildNarrativePrompt(input),
    responseJsonSchema: narrativeJsonSchema,
  })

  return narrativeResponseSchema.parse(result.json)
}

const parserTools: FunctionDeclaration[] = [
  {
    name: "submit_phase1_query",
    description:
      "Submit a supported QueryLens phase-1 query for the cashflow health score.",
    parametersJsonSchema: {
      type: "object",
      additionalProperties: false,
      required: ["metric", "timeframe"],
      properties: {
        metric: {
          type: "string",
          enum: ["cashflow_health_score"],
        },
        timeframe: {
          type: "string",
          enum: ["this_week", "last_week"],
        },
        region: {
          type: "string",
        },
        sector: {
          type: "string",
        },
      },
    },
  },
  {
    name: "reject_phase1_query",
    description:
      "Reject requests that are outside the phase-1 QueryLens scope or too ambiguous to parse safely.",
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

function buildParserPrompt(question: string) {
  return `
You are parsing a QueryLens phase-1 question.

You must choose exactly one function call.

Supported product boundaries:
- intent: what changed
- metric: cashflow_health_score only
- timeframe: this_week or last_week only
- optional scope dimensions: region and sector
- supported regions: North West, London & South East, Midlands
- supported sectors: Hospitality, Retail, Professional Services

Reject requests about unsupported metrics, unsupported time windows, comparisons, briefings, uploads, or anything outside the phase-1 "what changed" flow.

Question:
${question}
`.trim()
}

async function parseQuestionWithGemini(
  question: string,
  scopeOverride?: ScopeFilter
) {
  const result = await generateGeminiResponse({
    prompt: buildParserPrompt(question),
    tools: [{ functionDeclarations: parserTools }],
    toolConfig: {
      functionCallingConfig: {
        mode: FunctionCallingConfigMode.ANY,
        allowedFunctionNames: ["submit_phase1_query", "reject_phase1_query"],
      },
    },
  })

  const call = result.functionCalls?.[0]

  if (!call?.name) {
    return undefined
  }

  if (call.name === "reject_phase1_query") {
    const reason =
      typeof call.args?.reason === "string" && call.args.reason.trim()
        ? call.args.reason
        : undefined

    return {
      fallbackReason: reason,
    }
  }

  if (call.name !== "submit_phase1_query") {
    return undefined
  }

  const parsedArgs = submitPhase1QuerySchema.safeParse(call.args)

  if (!parsedArgs.success) {
    return undefined
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

  return {
    parsed: {
      rawQuestion: question,
      intent: "what_changed" as const,
      metric: parsedArgs.data.metric,
      timeframe: parsedArgs.data.timeframe,
      scope: {
        ...extractedScope.scope,
        ...overrideScope.scope,
      },
    },
  }
}

export const deterministicPhase1Provider: Phase1Provider = {
  parseQuestion: async (question, scopeOverride) =>
    parsePhase1Question(question, scopeOverride),
  composeNarrative: async (input) => buildDeterministicNarrative(input),
}

export function getPhase1Provider(args: {
  executionContext: QueryLensExecutionContext
}): Phase1Provider {
  if (!shouldUseGemini(args.executionContext)) {
    return deterministicPhase1Provider
  }

  return {
    parseQuestion: async (question, scopeOverride) => {
      const deterministicResult = await deterministicPhase1Provider.parseQuestion(
        question,
        scopeOverride
      )

      try {
        const geminiResult = await Promise.race([
          parseQuestionWithGemini(question, scopeOverride),
          new Promise<undefined>((resolve) => {
            setTimeout(() => resolve(undefined), 6_000)
          }),
        ])

        if (geminiResult?.parsed) {
          return geminiResult
        }

        if (!deterministicResult.parsed && geminiResult?.fallbackReason) {
          return {
            fallbackReason: geminiResult.fallbackReason,
          }
        }
      } catch {
        return deterministicResult
      }

      return deterministicResult
    },
    composeNarrative: async (input) => {
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
