import {
  FunctionCallingConfigMode,
  createPartFromFunctionResponse,
  type FunctionDeclaration,
  type Part,
} from "@google/genai"
import { z } from "zod"

import { calculateConfidenceScore } from "@/lib/querylens/scoring"
import type {
  AgenticQueryExecutionResult,
  AgenticSchemaSnapshot,
} from "@/lib/querylens/server/agentic-types"
import { createGeminiChatSession } from "@/lib/querylens/server/gemini-client"
import type { QueryLensDataAccess } from "@/lib/querylens/server/repositories"
import type {
  ChartDatum,
  ChartSpec,
  ContextCollection,
  EvidenceItem,
  Phase1AnalysisResponse,
  QueryRun,
  RetrievalContext,
} from "@/lib/querylens/types"

const MAX_AGENTIC_STEPS = 5
const MAX_AGENTIC_QUERY_RUNS = 3
const MAX_QUERY_RESULT_ROWS = 12

const mongoCollectionSchema = z.enum([
  "complaints",
  "service_incidents",
  "risk_alerts",
  "rm_notes",
])

const postgresQuerySchema = z.object({
  title: z.string().min(1),
  reason: z.string().min(1),
  statement: z.string().min(1),
})

const mongodbQuerySchema = z.object({
  title: z.string().min(1),
  reason: z.string().min(1),
  collection: mongoCollectionSchema,
  pipeline: z.array(z.record(z.unknown())).min(1),
})

const finishAgenticResponseSchema = z.object({
  headline: z.string().min(1),
  summary: z.string().min(1),
  timeframe: z.string().min(1),
  comparisonBasis: z.string().min(1),
  activeScope: z.string().min(1),
  assumptions: z.array(z.string()).default([]),
  supportedFollowUps: z.array(z.string()).max(4).default([]),
  keyFindings: z
    .array(
      z.object({
        title: z.string().min(1),
        impactLabel: z.string().min(1),
        direction: z.enum(["negative", "positive"]),
        description: z.string().min(1),
      })
    )
    .min(1)
    .max(4),
  primaryQueryRunId: z.string().min(1),
  tableQueryRunId: z.string().optional(),
  chart: z
    .object({
      queryRunId: z.string().min(1),
      type: z.enum(["line", "bar", "pie"]),
      title: z.string().min(1),
      explanation: z.string().min(1),
      labelKey: z.string().min(1),
      valueKey: z.string().min(1),
    })
    .optional(),
})

const rejectAgenticResponseSchema = z.object({
  reason: z.string().min(1),
})

const agenticTools: FunctionDeclaration[] = [
  {
    name: "run_postgres_query",
    description:
      "Execute a single read-only SQL query against the approved QueryLens Postgres tables. Use only SELECT or WITH queries.",
    parametersJsonSchema: {
      type: "object",
      additionalProperties: false,
      required: ["title", "reason", "statement"],
      properties: {
        title: { type: "string" },
        reason: { type: "string" },
        statement: { type: "string" },
      },
    },
  },
  {
    name: "run_mongodb_pipeline",
    description:
      "Execute a read-only MongoDB aggregation pipeline against one approved QueryLens context collection.",
    parametersJsonSchema: {
      type: "object",
      additionalProperties: false,
      required: ["title", "reason", "collection", "pipeline"],
      properties: {
        title: { type: "string" },
        reason: { type: "string" },
        collection: {
          type: "string",
          enum: ["complaints", "service_incidents", "risk_alerts", "rm_notes"],
        },
        pipeline: {
          type: "array",
          items: {
            type: "object",
          },
        },
      },
    },
  },
  {
    name: "finish_agentic_response",
    description:
      "Return the final grounded answer after you have enough evidence. Use queryRunIds exactly as returned by the query tools.",
    parametersJsonSchema: {
      type: "object",
      additionalProperties: false,
      required: [
        "headline",
        "summary",
        "timeframe",
        "comparisonBasis",
        "activeScope",
        "keyFindings",
        "primaryQueryRunId",
      ],
      properties: {
        headline: { type: "string" },
        summary: { type: "string" },
        timeframe: { type: "string" },
        comparisonBasis: { type: "string" },
        activeScope: { type: "string" },
        assumptions: {
          type: "array",
          items: { type: "string" },
        },
        supportedFollowUps: {
          type: "array",
          items: { type: "string" },
        },
        keyFindings: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["title", "impactLabel", "direction", "description"],
            properties: {
              title: { type: "string" },
              impactLabel: { type: "string" },
              direction: {
                type: "string",
                enum: ["negative", "positive"],
              },
              description: { type: "string" },
            },
          },
        },
        primaryQueryRunId: { type: "string" },
        tableQueryRunId: { type: "string" },
        chart: {
          type: "object",
          additionalProperties: false,
          required: ["queryRunId", "type", "title", "explanation", "labelKey", "valueKey"],
          properties: {
            queryRunId: { type: "string" },
            type: { type: "string", enum: ["line", "bar", "pie"] },
            title: { type: "string" },
            explanation: { type: "string" },
            labelKey: { type: "string" },
            valueKey: { type: "string" },
          },
        },
      },
    },
  },
  {
    name: "reject_agentic_response",
    description:
      "Reject the request when the question is too ambiguous or cannot be answered safely from the approved QueryLens sources.",
    parametersJsonSchema: {
      type: "object",
      additionalProperties: false,
      required: ["reason"],
      properties: {
        reason: { type: "string" },
      },
    },
  },
]

interface StoredAgenticQueryRun {
  run: QueryRun
  result: AgenticQueryExecutionResult
}

interface ExecuteAgenticFallbackArgs {
  question: string
  dataAccess: QueryLensDataAccess
  retrievalContext: RetrievalContext
}

function formatRetrievalContext(retrievalContext: RetrievalContext) {
  const datasetMatches = retrievalContext.datasetMatches.length
    ? retrievalContext.datasetMatches
        .map((match, index) => `${index + 1}. ${match.title}: ${match.content}`)
        .join("\n")
    : "No dataset metadata matches were retrieved."
  const memoryMatches = retrievalContext.memoryMatches.length
    ? retrievalContext.memoryMatches
        .map((match, index) => `${index + 1}. ${match.title}: ${match.content}`)
        .join("\n")
    : "No prior conversation memory matches were retrieved."
  const recentMessages = retrievalContext.recentMessages.length
    ? retrievalContext.recentMessages
        .map((message) => `${message.role}: ${message.text}`)
        .join("\n")
    : "No recent conversation turns were available."

  return `Dataset context:\n${datasetMatches}\n\nConversation memory:\n${memoryMatches}\n\nRecent conversation:\n${recentMessages}`
}

function formatSchemaSnapshot(schema: AgenticSchemaSnapshot) {
  const postgres = schema.postgres
    .map(
      (table) =>
        `- ${table.name} (${table.rowCount} rows): ${table.description}. Columns: ${table.columns.join(", ")}`
    )
    .join("\n")
  const mongodb = schema.mongodb
    .map(
      (collection) =>
        `- ${collection.name} (${collection.rowCount} documents): ${collection.description}. Fields: ${collection.columns.join(", ")}`
    )
    .join("\n")

  return `Postgres tables:\n${postgres}\n\nMongoDB collections:\n${mongodb}`
}

function buildAgenticPrompt(args: {
  question: string
  retrievalContext: RetrievalContext
  schema: AgenticSchemaSnapshot
}) {
  return `
You are QueryLens' agentic fallback analyst for questions that do not fit the product's built-in discovery, what-changed, breakdown, or compare flows.

You must work only with the approved QueryLens data sources and only through the provided tools.

Rules:
- Use read-only queries only.
- Never reference tables or collections outside the provided schema snapshot.
- Prefer the smallest number of queries needed to answer the question well.
- You may query Postgres and MongoDB separately, but you must not invent a cross-database join.
- If the request is ambiguous or unsupported even after reviewing context, call reject_agentic_response.
- Once you have enough evidence, call finish_agentic_response.
- Use chart only when it is clearly helpful. Prefer line for time series, bar for ranked comparisons, and pie only for small composition views.
- When selecting chart keys, they must exist in the referenced query run rows and the valueKey must be numeric.
- Reuse queryRunIds exactly as returned by the query tools.
- Make the final summary slightly fuller than a one-line recap.
- The final summary should state the main conclusion and include at least one concrete supporting observation from the executed query results.
- Keep the final summary factual, compact, and grounded only in the returned rows.

Live schema snapshot:
${formatSchemaSnapshot(args.schema)}

Retrieved context:
${formatRetrievalContext(args.retrievalContext)}

User question:
${args.question}
`.trim()
}

export function validateReadOnlySql(statement: string) {
  const trimmed = statement.trim().replace(/;+\s*$/g, "")

  if (!trimmed) {
    throw new Error("SQL statement is empty.")
  }

  if (trimmed.includes(";")) {
    throw new Error("SQL must contain exactly one read-only statement.")
  }

  if (!/^(select|with)\b/i.test(trimmed)) {
    throw new Error("SQL must start with SELECT or WITH.")
  }

  if (
    /\b(insert|update|delete|drop|alter|truncate|create|grant|revoke|comment|copy|vacuum|analyze|refresh|merge|call|execute|prepare|deallocate|listen|notify|lock|set|reset|show)\b/i.test(
      trimmed
    )
  ) {
    throw new Error("SQL contains a disallowed keyword for read-only execution.")
  }

  if (/\bfor\s+(update|share|key\s+share|no\s+key\s+update)\b/i.test(trimmed)) {
    throw new Error("SQL row locking is not allowed.")
  }

  return trimmed
}

function hasForbiddenMongoOperator(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some((item) => hasForbiddenMongoOperator(item))
  }

  if (value && typeof value === "object") {
    return Object.entries(value).some(([key, nestedValue]) => {
      if (
        key === "$out" ||
        key === "$merge" ||
        key === "$function" ||
        key === "$accumulator" ||
        key === "$where" ||
        key === "$unionWith"
      ) {
        return true
      }

      return hasForbiddenMongoOperator(nestedValue)
    })
  }

  return false
}

export function validateMongoPipeline(pipeline: Record<string, unknown>[]) {
  if (!pipeline.length) {
    throw new Error("MongoDB pipeline is empty.")
  }

  for (const stage of pipeline) {
    if (!stage || typeof stage !== "object" || Array.isArray(stage)) {
      throw new Error("Each MongoDB stage must be an object.")
    }

    if (hasForbiddenMongoOperator(stage)) {
      throw new Error("MongoDB pipeline contains a disallowed stage or operator.")
    }
  }

  return pipeline
}

function buildDefaultFollowUps(question: string) {
  return [
    `Show the query behind "${question}"`,
    "Break this down by region",
    "Show the trend over time",
  ]
}

function buildAgenticFallbackResponse(
  reason: string,
  sourceMode: Phase1AnalysisResponse["sourceMode"],
  question: string
): Phase1AnalysisResponse {
  return {
    intent: "agentic_query",
    headline: "QueryLens could not complete that custom analysis safely",
    summary: reason,
    metric: "custom_query_result",
    timeframe: "Custom question",
    comparisonBasis: "Agentic fallback over approved live QueryLens sources",
    confidence: calculateConfidenceScore({
      evidenceCount: 0,
      driverCount: 0,
      hasCrossSourceEvidence: false,
      fallback: true,
    }),
    activeScope: "Custom analysis",
    drivers: [],
    evidence: [],
    assumptions: [
      "The agentic fallback stays within the approved live QueryLens Postgres and MongoDB sources.",
    ],
    supportedFollowUps: buildDefaultFollowUps(question),
    fallback: true,
    sourceMode,
  }
}

function buildChartSpecFromQueryRun(
  queryRun: StoredAgenticQueryRun,
  chartConfig: z.infer<typeof finishAgenticResponseSchema>["chart"]
): ChartSpec | undefined {
  if (!chartConfig) {
    return undefined
  }

  const rows = queryRun.result.rowset.rows
  if (!rows.length) {
    return undefined
  }

  const labelKey = chartConfig.labelKey
  const valueKey = chartConfig.valueKey

  const chartData = rows
    .map((row) => {
      const label = row[labelKey]
      const value = row[valueKey]

      if (
        typeof label !== "string" &&
        typeof label !== "number"
      ) {
        return undefined
      }

      if (typeof value !== "number") {
        return undefined
      }

      return {
        ...Object.fromEntries(
          Object.entries(row).map(([key, entryValue]) => [
            key,
            typeof entryValue === "boolean"
              ? String(entryValue)
              : (entryValue ?? undefined),
          ])
        ),
        [labelKey]: String(label),
        [valueKey]: value,
      } as ChartDatum
    })
    .filter((row): row is ChartDatum => Boolean(row))

  if (!chartData.length) {
    return undefined
  }

  if (chartConfig.type === "pie") {
    return {
      type: "pie",
      title: chartConfig.title,
      explanation: chartConfig.explanation,
      labelKey,
      valueKey,
      data: chartData.slice(0, 6),
    }
  }

  return {
    type: chartConfig.type,
    title: chartConfig.title,
    explanation: chartConfig.explanation,
    xKey: labelKey,
    yKey: valueKey,
    data: chartData,
  }
}

function buildEvidenceFromQueryRuns(
  queryRuns: StoredAgenticQueryRun[],
  timeframe: string,
  activeScope: string
): EvidenceItem[] {
  return queryRuns.map(({ run }) => ({
    sourceType: run.sourceType,
    sourceName: run.title,
    timeRange: timeframe,
    scope: activeScope,
    supportingFact: run.summary,
    queryTemplateId: run.id,
  }))
}

export async function executeAgenticFallback(
  args: ExecuteAgenticFallbackArgs
): Promise<Phase1AnalysisResponse> {
  const schema = await args.dataAccess.getAgenticSchemaSnapshot()
  const chat = createGeminiChatSession({
    temperature: 0,
    tools: [{ functionDeclarations: agenticTools }],
    toolConfig: {
      functionCallingConfig: {
        mode: FunctionCallingConfigMode.ANY,
        allowedFunctionNames: agenticTools
          .map((tool) => tool.name)
          .filter((name): name is string => Boolean(name)),
      },
    },
  })

  const queryRuns = new Map<string, StoredAgenticQueryRun>()

  let response = await chat.sendMessage({
    message: buildAgenticPrompt({
      question: args.question,
      retrievalContext: args.retrievalContext,
      schema,
    }),
  })

  for (let step = 0; step < MAX_AGENTIC_STEPS; step += 1) {
    const functionCalls = response.functionCalls ?? []

    if (!functionCalls.length) {
      return buildAgenticFallbackResponse(
        "Gemini did not return a valid tool action for that custom analysis.",
        args.dataAccess.sourceMode,
        args.question
      )
    }

    const functionResponses: Part[] = []

    for (const functionCall of functionCalls) {
      if (!functionCall.name) {
        continue
      }

      if (functionCall.name === "run_postgres_query") {
        if (queryRuns.size >= MAX_AGENTIC_QUERY_RUNS) {
          return buildAgenticFallbackResponse(
            "The agentic fallback hit its read-only query budget before it could finish safely.",
            args.dataAccess.sourceMode,
            args.question
          )
        }

        try {
          const parsedArgs = postgresQuerySchema.parse(functionCall.args)
          const statement = validateReadOnlySql(parsedArgs.statement)
          const execution = await args.dataAccess.executeReadOnlySql({
            statement,
            maxRows: MAX_QUERY_RESULT_ROWS,
          })
          const queryRunId = `query-run-${queryRuns.size + 1}`
          const queryRun: QueryRun = {
            id: queryRunId,
            title: parsedArgs.title,
            sourceType: "postgres",
            language: "sql",
            statement,
            status: "completed",
            rowCount: execution.rowset.totalRows,
            summary: `${parsedArgs.reason} ${execution.summary}`.trim(),
          }

          queryRuns.set(queryRunId, {
            run: queryRun,
            result: execution,
          })

          functionResponses.push(
            createPartFromFunctionResponse(
              functionCall.id ?? queryRunId,
              functionCall.name,
              {
                queryRunId,
                title: parsedArgs.title,
                sourceType: "postgres",
                language: "sql",
                statement,
                summary: execution.summary,
                rowCount: execution.rowset.totalRows,
                truncated: execution.rowset.truncated,
                columns: execution.rowset.columns,
                rows: execution.rowset.rows,
              }
            )
          )
        } catch (error) {
          functionResponses.push(
            createPartFromFunctionResponse(
              functionCall.id ?? `postgres-error-${step}`,
              functionCall.name,
              {
                error:
                  error instanceof Error
                    ? error.message
                    : "QueryLens could not execute that SQL safely.",
              }
            )
          )
        }

        continue
      }

      if (functionCall.name === "run_mongodb_pipeline") {
        if (queryRuns.size >= MAX_AGENTIC_QUERY_RUNS) {
          return buildAgenticFallbackResponse(
            "The agentic fallback hit its read-only query budget before it could finish safely.",
            args.dataAccess.sourceMode,
            args.question
          )
        }

        try {
          const parsedArgs = mongodbQuerySchema.parse(functionCall.args)
          const pipeline = validateMongoPipeline(parsedArgs.pipeline)
          const execution = await args.dataAccess.executeReadOnlyMongoPipeline({
            collection: parsedArgs.collection as ContextCollection,
            pipeline,
            maxRows: MAX_QUERY_RESULT_ROWS,
          })
          const queryRunId = `query-run-${queryRuns.size + 1}`
          const queryRun: QueryRun = {
            id: queryRunId,
            title: parsedArgs.title,
            sourceType: "mongodb",
            language: "mongodb",
            statement: `${parsedArgs.collection}.aggregate(${JSON.stringify(pipeline, null, 2)})`,
            status: "completed",
            rowCount: execution.rowset.totalRows,
            summary: `${parsedArgs.reason} ${execution.summary}`.trim(),
          }

          queryRuns.set(queryRunId, {
            run: queryRun,
            result: execution,
          })

          functionResponses.push(
            createPartFromFunctionResponse(
              functionCall.id ?? queryRunId,
              functionCall.name,
              {
                queryRunId,
                title: parsedArgs.title,
                sourceType: "mongodb",
                language: "mongodb",
                collection: parsedArgs.collection,
                summary: execution.summary,
                rowCount: execution.rowset.totalRows,
                truncated: execution.rowset.truncated,
                columns: execution.rowset.columns,
                rows: execution.rowset.rows,
              }
            )
          )
        } catch (error) {
          functionResponses.push(
            createPartFromFunctionResponse(
              functionCall.id ?? `mongo-error-${step}`,
              functionCall.name,
              {
                error:
                  error instanceof Error
                    ? error.message
                    : "QueryLens could not execute that MongoDB pipeline safely.",
              }
            )
          )
        }

        continue
      }

      if (functionCall.name === "reject_agentic_response") {
        const parsedArgs = rejectAgenticResponseSchema.safeParse(functionCall.args)

        return buildAgenticFallbackResponse(
          parsedArgs.success
            ? parsedArgs.data.reason
            : "The question was too ambiguous for a safe custom query.",
          args.dataAccess.sourceMode,
          args.question
        )
      }

      if (functionCall.name === "finish_agentic_response") {
        const parsedArgs = finishAgenticResponseSchema.safeParse(functionCall.args)

        if (!parsedArgs.success) {
          return buildAgenticFallbackResponse(
            "Gemini produced an invalid structured answer for that custom analysis.",
            args.dataAccess.sourceMode,
            args.question
          )
        }

        const primaryRun = queryRuns.get(parsedArgs.data.primaryQueryRunId)
        const tableRun = queryRuns.get(
          parsedArgs.data.tableQueryRunId ?? parsedArgs.data.primaryQueryRunId
        )
        const chartRun = parsedArgs.data.chart
          ? queryRuns.get(parsedArgs.data.chart.queryRunId)
          : undefined

        if (!primaryRun || !tableRun || (parsedArgs.data.chart && !chartRun)) {
          return buildAgenticFallbackResponse(
            "Gemini referenced a query run that was never completed.",
            args.dataAccess.sourceMode,
            args.question
          )
        }

        const orderedQueryRuns = Array.from(queryRuns.values())
        const confidence = calculateConfidenceScore({
          evidenceCount: orderedQueryRuns.length,
          driverCount: parsedArgs.data.keyFindings.length,
          hasCrossSourceEvidence:
            new Set(orderedQueryRuns.map((queryRun) => queryRun.run.sourceType)).size > 1,
        })

        return {
          intent: "agentic_query",
          headline: parsedArgs.data.headline,
          summary: parsedArgs.data.summary,
          metric: "custom_query_result",
          timeframe: parsedArgs.data.timeframe,
          comparisonBasis: parsedArgs.data.comparisonBasis,
          confidence,
          activeScope: parsedArgs.data.activeScope,
          drivers: parsedArgs.data.keyFindings.map((finding, index) => ({
            id: `agentic-finding-${index + 1}`,
            title: finding.title,
            impactLabel: finding.impactLabel,
            direction: finding.direction,
            description: finding.description,
          })),
          chartSpec:
            parsedArgs.data.chart && chartRun
              ? buildChartSpecFromQueryRun(chartRun, parsedArgs.data.chart)
              : undefined,
          evidence: buildEvidenceFromQueryRuns(
            orderedQueryRuns,
            parsedArgs.data.timeframe,
            parsedArgs.data.activeScope
          ),
          assumptions:
            parsedArgs.data.assumptions.length > 0
              ? parsedArgs.data.assumptions
              : [
                  "The answer is grounded only in the approved live QueryLens Postgres and MongoDB sources.",
                ],
          supportedFollowUps:
            parsedArgs.data.supportedFollowUps.length > 0
              ? parsedArgs.data.supportedFollowUps
              : buildDefaultFollowUps(args.question),
          resultTable: tableRun.result.rowset,
          queryRuns: orderedQueryRuns.map((queryRun) => queryRun.run),
          sourceMode: args.dataAccess.sourceMode,
        }
      }
    }

    if (!functionResponses.length) {
      return buildAgenticFallbackResponse(
        "Gemini did not return any executable custom-query action.",
        args.dataAccess.sourceMode,
        args.question
      )
    }

    response = await chat.sendMessage({
      message: functionResponses,
    })
  }

  return buildAgenticFallbackResponse(
    "The agentic fallback reached its step limit before it could finish safely.",
    args.dataAccess.sourceMode,
    args.question
  )
}
