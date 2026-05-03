import { z } from "zod"

import {
  createAgentModelSession,
  type AgentFunctionResponse,
  type AgentToolDefinition,
} from "@/lib/querylens/server/agent-model-session"
import type {
  AgenticConnectedCsvSource,
  AgenticQueryExecutionResult,
  AgenticSourceCatalog,
} from "@/lib/querylens/server/agentic-types"
import type { QueryLensDataAccess } from "@/lib/querylens/server/repositories"
import type {
  ChartDatum,
  ChartSpec,
  ContextCollection,
  EvidenceItem,
  ExecutionTrace,
  ExecutionTraceEntry,
  Phase1AnalysisResponse,
  QueryRun,
  RetrievalContext,
  SourceAudit,
  SourceAuditEntry,
  TrustComponentScore,
  TrustLevel,
  TrustModel,
} from "@/lib/querylens/types"

const MAX_AGENTIC_STEPS = 8
const MAX_AGENTIC_QUERY_RUNS = 4
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

const inspectSourceSchemaSchema = z.object({
  sourceId: z.string().min(1),
  reason: z.string().min(1),
})

const uploadedCsvQuerySchema = z.object({
  datasetId: z.string().min(1),
  title: z.string().min(1),
  reason: z.string().min(1),
  intent: z.enum(["discovery", "aggregate", "group_by", "trend"]),
  metricId: z.string().optional(),
  dimensionId: z.string().optional(),
  aggregation: z.enum(["sum", "avg", "min", "max", "count"]).optional(),
})

const finishAgenticResponseSchema = z.object({
  headline: z.string().min(1),
  summary: z.string().min(1),
  timeframe: z.string().min(1),
  comparisonBasis: z.string().min(1),
  activeScope: z.string().min(1),
  assumptions: z.array(z.string()).default([]),
  uncertaintyNotes: z.array(z.string()).default([]),
  limitationNotes: z.array(z.string()).default([]),
  supportedFollowUps: z.array(z.string()).max(4).default([]),
  keyFindings: z
    .array(
      z.object({
        title: z.string().min(1),
        impactLabel: z.string().min(1),
        direction: z.enum(["negative", "positive"]),
        description: z.string().min(1),
      }),
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

const agenticTools: AgentToolDefinition[] = [
  {
    name: "list_available_sources",
    description:
      "List the approved read-only QueryLens sources that are available for this run.",
    parametersJsonSchema: {
      type: "object",
      additionalProperties: false,
      properties: {},
    },
  },
  {
    name: "inspect_source_schema",
    description:
      "Inspect the schema and semantic metadata for one approved source before querying it.",
    parametersJsonSchema: {
      type: "object",
      additionalProperties: false,
      required: ["sourceId", "reason"],
      properties: {
        sourceId: { type: "string" },
        reason: { type: "string" },
      },
    },
  },
  {
    name: "run_postgres_query",
    description:
      "Execute a single read-only SQL query against approved built-in QueryLens Postgres tables. Use only SELECT or WITH queries.",
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
      "Execute a read-only MongoDB aggregation pipeline against one approved built-in QueryLens context collection.",
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
    name: "run_uploaded_csv_query",
    description:
      "Execute a bounded semantic query against one active uploaded CSV dataset. This tool generates the SQL safely on your behalf.",
    parametersJsonSchema: {
      type: "object",
      additionalProperties: false,
      required: ["datasetId", "title", "reason", "intent"],
      properties: {
        datasetId: { type: "string" },
        title: { type: "string" },
        reason: { type: "string" },
        intent: {
          type: "string",
          enum: ["discovery", "aggregate", "group_by", "trend"],
        },
        metricId: { type: "string" },
        dimensionId: { type: "string" },
        aggregation: {
          type: "string",
          enum: ["sum", "avg", "min", "max", "count"],
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
        uncertaintyNotes: {
          type: "array",
          items: { type: "string" },
        },
        limitationNotes: {
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
      "Reject the request when it cannot be answered safely from separate bounded reads across the approved QueryLens sources.",
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

interface ExecuteBoundedMultiSourceAgentArgs {
  question: string
  dataAccess: QueryLensDataAccess
  retrievalContext: RetrievalContext
  sourceCatalog: AgenticSourceCatalog
  activeDatasetId?: string
  activeDatasetLabel?: string
  fallbackReason?: string
}

interface BuildFallbackArgs {
  reason: string
  question: string
  sourceMode: Phase1AnalysisResponse["sourceMode"]
  sourceCatalog: AgenticSourceCatalog
  inspectedSourceIds: Set<string>
  queryRuns: StoredAgenticQueryRun[]
  executionTrace: ExecutionTrace
  uncertaintyNotes?: string[]
  limitationNotes?: string[]
}

function quoteIdentifier(value: string) {
  return `"${value.replace(/"/g, "\"\"")}"`
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function sentenceCase(value: string) {
  if (!value) {
    return value
  }

  return value.charAt(0).toUpperCase() + value.slice(1)
}

function buildDefaultFollowUps(question: string) {
  return [
    `Show the queries behind "${question}"`,
    "Compare the source results side by side",
    "Which sources did you inspect first?",
  ]
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

function formatSourceCatalog(catalog: AgenticSourceCatalog) {
  const availableEntries = catalog.entries
    .map(
      (entry) =>
        `- ${entry.id} (${entry.sourceType}, ${entry.recordCount} records, ${entry.objectCount} objects): ${entry.description}`,
    )
    .join("\n")

  const postgres = catalog.schema.postgres.length
    ? catalog.schema.postgres
        .map(
          (table) =>
            `- ${table.name} (${table.rowCount} rows): ${table.description}. Columns: ${table.columns.join(", ")}`,
        )
        .join("\n")
    : "No approved built-in Postgres tables were registered."

  const mongodb = catalog.schema.mongodb.length
    ? catalog.schema.mongodb
        .map(
          (collection) =>
            `- ${collection.name} (${collection.rowCount} documents): ${collection.description}. Fields: ${collection.columns.join(", ")}`,
        )
        .join("\n")
    : "No approved built-in MongoDB collections were registered."

  const csvSources = catalog.schema.csv.length
    ? catalog.schema.csv
        .map((source) => {
          const metricLabels = source.metrics.map((metric) => metric.id).join(", ") || "none"
          const dimensionLabels =
            source.dimensions.map((dimension) => dimension.id).join(", ") || "none"
          return `- ${source.datasetId} (${source.rowCount} rows): ${source.label}. Table: ${source.tableName}. Columns: ${source.columns.join(", ")}. Metrics: ${metricLabels}. Dimensions: ${dimensionLabels}. Primary time field: ${source.primaryTimeField ?? "none"}.`
        })
        .join("\n")
    : "No active uploaded CSV datasets were available for querying."

  return `Available sources:\n${availableEntries}\n\nBuilt-in Postgres schema:\n${postgres}\n\nBuilt-in MongoDB schema:\n${mongodb}\n\nUploaded CSV datasets:\n${csvSources}`
}

function buildAgenticPrompt(args: {
  question: string
  retrievalContext: RetrievalContext
  sourceCatalog: AgenticSourceCatalog
  activeDatasetId?: string
  activeDatasetLabel?: string
  fallbackReason?: string
}) {
  return `
You are QueryLens' bounded multi-source analyst for questions that fall outside the current deterministic built-in or uploaded-CSV slices.

You must work only with the approved QueryLens sources and only through the provided tools.

Rules:
- Use read-only queries only.
- Never reference tables, collections, or datasets outside the provided source catalog.
- You may inspect or query built-in Postgres, built-in MongoDB, and active uploaded CSV datasets.
- Uploaded CSV datasets must be queried only through run_uploaded_csv_query.
- Keep cross-source work as separate bounded reads plus synthesis in the final answer.
- Never invent a cross-database join, cross-dataset join, or union across source families.
- Prefer the smallest number of queries needed to answer the question well.
- Inspect unfamiliar sources before querying them.
- If the request is ambiguous or unsupported even after inspection, call reject_agentic_response.
- Once you have enough evidence, call finish_agentic_response.
- Use chart only when it is clearly helpful. Prefer line for time series, bar for ranked comparisons, and pie only for small composition views.
- When selecting chart keys, they must exist in the referenced query run rows and the valueKey must be numeric.
- Reuse queryRunIds exactly as returned by the query tools.
- Keep the final summary factual, compact, and grounded only in the returned rows and documents.

Current workspace anchor:
- activeDatasetId: ${args.activeDatasetId ?? "sme_portfolio"}
- activeDatasetLabel: ${args.activeDatasetLabel ?? "SME portfolio"}
- deterministic handoff reason: ${args.fallbackReason ?? "The deterministic route declined the question and handed it to the bounded agent."}

Approved source catalog:
${formatSourceCatalog(args.sourceCatalog)}

Retrieved context:
${formatRetrievalContext(args.retrievalContext)}

User question:
${args.question}
  `.trim()
}

function extractCteNames(statement: string) {
  const names = new Set<string>()
  const ctePattern = /(?:with|,)\s*([a-zA-Z_][a-zA-Z0-9_]*)\s+as\b/gi

  let match = ctePattern.exec(statement)
  while (match) {
    names.add(match[1].toLowerCase())
    match = ctePattern.exec(statement)
  }

  return names
}

function normalizeIdentifier(value: string) {
  return value
    .trim()
    .replace(/^[("']+|[)"',]+$/g, "")
    .split(".")
    .at(-1)
    ?.replace(/^"+|"+$/g, "")
    .toLowerCase()
}

function extractReferencedTableNames(statement: string) {
  const names = new Set<string>()
  const tablePattern = /\b(?:from|join)\s+([a-zA-Z0-9_."-]+)/gi

  let match = tablePattern.exec(statement)
  while (match) {
    const normalized = normalizeIdentifier(match[1])
    if (normalized) {
      names.add(normalized)
    }
    match = tablePattern.exec(statement)
  }

  return names
}

export function validateReadOnlySql(statement: string, allowedTables?: readonly string[]) {
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
      trimmed,
    )
  ) {
    throw new Error("SQL contains a disallowed keyword for read-only execution.")
  }

  if (/\bfor\s+(update|share|key\s+share|no\s+key\s+update)\b/i.test(trimmed)) {
    throw new Error("SQL row locking is not allowed.")
  }

  if (allowedTables && allowedTables.length > 0) {
    const allowed = new Set(allowedTables.map((table) => table.toLowerCase()))
    const cteNames = extractCteNames(trimmed)
    const referencedTables = extractReferencedTableNames(trimmed)

    const disallowed = Array.from(referencedTables).find(
      (table) => !allowed.has(table) && !cteNames.has(table),
    )

    if (disallowed) {
      throw new Error(`SQL references a table that is not approved for this tool: ${disallowed}.`)
    }
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

function buildEmptyTrace(args: {
  question: string
  activeDatasetId?: string
  fallbackReason?: string
}): ExecutionTrace {
  const entries: ExecutionTraceEntry[] = [
    {
      id: "planning.agentic_entry",
      stage: "planning",
      status: "approved",
      message:
        "QueryLens entered the bounded multi-source agent after deterministic execution declined the request.",
      metadata: {
        datasetId: args.activeDatasetId ?? "sme_portfolio",
      },
    },
  ]

  if (args.fallbackReason) {
    entries.push({
      id: "planning.agentic_reason",
      stage: "planning",
      status: "approved",
      message: args.fallbackReason,
    })
  }

  return {
    planId: `agentic:${args.question}`,
    entries,
  }
}

function appendTrace(trace: ExecutionTrace, entry: ExecutionTraceEntry): ExecutionTrace {
  return {
    planId: trace.planId,
    entries: [...trace.entries, entry],
  }
}

function buildSourceAudit(args: {
  sourceCatalog: AgenticSourceCatalog
  inspectedSourceIds: Set<string>
  queryRuns: StoredAgenticQueryRun[]
}): SourceAudit {
  const sourceById = new Map<string, SourceAuditEntry>()
  args.sourceCatalog.entries.forEach((entry) => {
    sourceById.set(entry.id, {
      sourceId: entry.id,
      sourceType: entry.sourceType,
      label: entry.label,
      note: entry.description,
    })
  })

  const usedSourceIds = new Set(args.queryRuns.map((queryRun) => queryRun.run.sourceId))
  usedSourceIds.forEach((sourceId) => args.inspectedSourceIds.add(sourceId))

  const buildEntries = (
    sourceIds: Iterable<string>,
    note: (entry: SourceAuditEntry) => string,
  ): SourceAuditEntry[] => {
    const entries: SourceAuditEntry[] = []
    for (const sourceId of sourceIds) {
      const entry = sourceById.get(sourceId)
      if (!entry) {
        continue
      }

      entries.push({
        ...entry,
        note: note(entry),
      })
    }
    return entries
  }

  return {
    available: args.sourceCatalog.entries.map((entry) => ({
      sourceId: entry.id,
      sourceType: entry.sourceType,
      label: entry.label,
      note: entry.description,
    })),
    inspected: buildEntries(
      args.inspectedSourceIds,
      (entry) => `Schema or source metadata was inspected for ${entry.label}.`,
    ),
    used: buildEntries(
      usedSourceIds,
      (entry) => `Executed query results from ${entry.label} contributed to this answer.`,
    ),
  }
}

function createScore(score: number) {
  const normalizedScore = clamp(Math.round(score), 0, 100)

  return {
    score: normalizedScore,
    label:
      normalizedScore >= 85 ? ("high" as TrustLevel) : normalizedScore >= 60 ? ("medium" as TrustLevel) : ("low" as TrustLevel),
  }
}

function createComponent(score: number, reason: string): TrustComponentScore {
  return {
    ...createScore(score),
    reason,
  }
}

function buildTrustTrace(components: TrustModel["components"]) {
  return [
    {
      id: "trust.interpretation",
      component: "interpretation" as const,
      score: components.interpretation.score,
      label: components.interpretation.label,
      message: components.interpretation.reason,
    },
    {
      id: "trust.data_coverage",
      component: "dataCoverage" as const,
      score: components.dataCoverage.score,
      label: components.dataCoverage.label,
      message: components.dataCoverage.reason,
    },
    {
      id: "trust.source_corroboration",
      component: "sourceCorroboration" as const,
      score: components.sourceCorroboration.score,
      label: components.sourceCorroboration.label,
      message: components.sourceCorroboration.reason,
    },
    {
      id: "trust.execution",
      component: "execution" as const,
      score: components.execution.score,
      label: components.execution.label,
      message: components.execution.reason,
    },
  ]
}

function buildAgenticTrustModel(args: {
  response: Omit<Phase1AnalysisResponse, "confidence" | "trustArtifacts" | "trust">
  sourceAudit: SourceAudit
  queryRuns: StoredAgenticQueryRun[]
  executionTrace: ExecutionTrace
  uncertaintyNotes?: string[]
  limitationNotes?: string[]
}): TrustModel {
  const queryRuns = args.queryRuns
  const sourceTypes = new Set(queryRuns.map((queryRun) => queryRun.run.sourceType))
  const hasFailedStep = args.executionTrace.entries.some((entry) => entry.status === "failed")
  const isFallback = args.response.fallback === true
  const usedCsv = queryRuns.some((queryRun) => queryRun.run.sourceType === "csv")
  const hasTruncatedRun = queryRuns.some((queryRun) => queryRun.result.rowset.truncated)

  const interpretation = createComponent(
    isFallback ? 24 : 72,
    isFallback
      ? "The bounded agent could not finish a grounded answer safely."
      : "The question required the bounded multi-source agent after deterministic execution declined it.",
  )
  const dataCoverage = createComponent(
    isFallback
      ? 24
      : queryRuns.length === 0
        ? 36
        : hasTruncatedRun
          ? 78
          : 88,
    isFallback
      ? "The run stopped before it completed a grounded answer."
      : queryRuns.length === 0
        ? "No grounded query results were attached to the response."
        : hasTruncatedRun
          ? "Grounded query results were returned, but at least one result set was truncated to stay inside bounds."
          : "Grounded query results were attached for each source used in the final answer.",
  )
  const sourceCorroboration = createComponent(
    isFallback
      ? 24
      : sourceTypes.size > 1
        ? 88
        : sourceTypes.size === 1
          ? 68
          : 24,
    isFallback
      ? "Cross-source corroboration was not completed because the run fell back."
      : sourceTypes.size > 1
        ? "The answer synthesizes separate bounded reads from more than one approved source type."
        : sourceTypes.size === 1
          ? "The answer is grounded in one approved source type without cross-source corroboration."
          : "No approved source contributed executed results to the answer.",
  )
  const execution = createComponent(
    isFallback ? 24 : hasFailedStep ? 62 : queryRuns.length > 0 ? 88 : 40,
    isFallback
      ? "The execution path returned a guarded fallback instead of a completed answer."
      : hasFailedStep
        ? "The bounded execution path completed, but it encountered at least one recoverable tool failure along the way."
        : queryRuns.length > 0
          ? "All executed reads stayed inside the approved bounded tool surface."
          : "The execution path finished without a grounded query result.",
  )

  const components = {
    interpretation,
    dataCoverage,
    sourceCorroboration,
    execution,
  }
  const overall = createScore(
    interpretation.score * 0.2 +
      dataCoverage.score * 0.3 +
      sourceCorroboration.score * 0.25 +
      execution.score * 0.25,
  )

  const limitationNotes = [
    ...(args.limitationNotes ?? []),
    ...(usedCsv && sourceTypes.size > 1
      ? [
          "Cross-source synthesis compared separate bounded reads; QueryLens did not perform row-level joins across built-in and uploaded sources.",
        ]
      : []),
    ...(hasTruncatedRun
      ? ["At least one result set was truncated to stay inside the row limit."]
      : []),
  ]

  return {
    overall,
    components,
    trace: buildTrustTrace(components),
    howProduced: [
      "QueryLens routed the request into the bounded multi-source agent after deterministic execution declined it.",
      "The agent inspected only approved sources and executed only read-only built-in or semantic CSV tools.",
      isFallback
        ? "The run stopped before a fully grounded answer could be completed safely."
        : "The final answer was synthesized only from returned rows and documents.",
    ],
    uncertaintyNotes: [
      ...(args.uncertaintyNotes ?? []),
      ...(usedCsv
        ? [
            "Uploaded CSV semantics were inferred during onboarding and may be less governed than the built-in sample dataset.",
          ]
        : []),
    ],
    limitationNotes,
    sources: args.sourceAudit.used.map((entry) => ({
      sourceType: entry.sourceType,
      sourceName: entry.label,
      scope: args.response.activeScope,
      timeRange: args.response.timeframe,
      note: entry.note,
    })),
    observedFacts:
      queryRuns.length > 0
        ? queryRuns.slice(0, 3).map((queryRun) => sentenceCase(queryRun.run.summary))
        : [sentenceCase(args.response.summary)],
    inferredFindings:
      args.response.drivers.length > 0
        ? args.response.drivers.slice(0, 3).map((driver) => sentenceCase(driver.description))
        : [sentenceCase(args.response.headline)],
    assumptions: args.response.assumptions,
  }
}

function buildChartSpecFromQueryRun(
  queryRun: StoredAgenticQueryRun,
  chartConfig: z.infer<typeof finishAgenticResponseSchema>["chart"],
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

      if (typeof label !== "string" && typeof label !== "number") {
        return undefined
      }

      if (typeof value !== "number") {
        return undefined
      }

      return {
        ...Object.fromEntries(
          Object.entries(row).map(([key, entryValue]) => [
            key,
            typeof entryValue === "boolean" ? String(entryValue) : (entryValue ?? undefined),
          ]),
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
  activeScope: string,
): EvidenceItem[] {
  return queryRuns.map(({ run }) => ({
    sourceType: run.sourceType,
    sourceName: run.sourceLabel,
    timeRange: timeframe,
    scope: activeScope,
    supportingFact: run.summary,
    queryTemplateId: run.id,
  }))
}

function buildFallbackResponse(args: BuildFallbackArgs): Phase1AnalysisResponse {
  const sourceAudit = buildSourceAudit({
    sourceCatalog: args.sourceCatalog,
    inspectedSourceIds: args.inspectedSourceIds,
    queryRuns: args.queryRuns,
  })

  const responseSeed: Omit<Phase1AnalysisResponse, "confidence" | "trust" | "trustArtifacts"> = {
    intent: "agentic_query",
    headline: "QueryLens could not complete that bounded multi-source analysis safely",
    summary: args.reason,
    metric: "custom_query_result",
    timeframe: "Custom question",
    comparisonBasis: "Bounded multi-source analysis over approved QueryLens sources",
    activeScope: "Custom analysis",
    drivers: [],
    evidence: [],
    assumptions: [
      "The bounded agent stayed inside approved built-in sources and active uploaded CSV datasets.",
    ],
    supportedFollowUps: buildDefaultFollowUps(args.question),
    queryRuns: args.queryRuns.map((queryRun) => queryRun.run),
    sourceAudit,
    executionTrace: args.executionTrace,
    fallback: true,
    sourceMode: args.sourceMode,
  }

  const trust = buildAgenticTrustModel({
    response: responseSeed,
    sourceAudit,
    queryRuns: args.queryRuns,
    executionTrace: args.executionTrace,
    uncertaintyNotes: args.uncertaintyNotes,
    limitationNotes: [args.reason, ...(args.limitationNotes ?? [])],
  })

  return {
    ...responseSeed,
    confidence: trust.overall.score,
    trust,
  }
}

function buildPartialBudgetResponse(args: BuildFallbackArgs): Phase1AnalysisResponse {
  const orderedQueryRuns = args.queryRuns
  const sourceAudit = buildSourceAudit({
    sourceCatalog: args.sourceCatalog,
    inspectedSourceIds: args.inspectedSourceIds,
    queryRuns: orderedQueryRuns,
  })
  const tableRun = orderedQueryRuns
    .slice()
    .sort(
      (left, right) =>
        right.result.rowset.totalRows - left.result.rowset.totalRows,
    )[0]
  const sourceLabels = sourceAudit.used.map((source) => source.label)
  const summary = `${args.reason} QueryLens is returning a limited answer from the ${orderedQueryRuns.length} completed read-only ${orderedQueryRuns.length === 1 ? "query" : "queries"} instead of discarding the evidence. Treat this as a partial view based only on the attached results.`

  const responseSeed: Omit<Phase1AnalysisResponse, "confidence" | "trust" | "trustArtifacts"> = {
    intent: "agentic_query",
    headline: "QueryLens gathered partial evidence before reaching the read budget",
    summary,
    metric: "custom_query_result",
    timeframe: "Custom question",
    comparisonBasis: "Partial bounded multi-source analysis over approved QueryLens sources",
    activeScope: "Custom analysis",
    drivers: orderedQueryRuns.slice(0, 4).map((queryRun, index) => ({
      id: `partial-query-${index + 1}`,
      title: queryRun.run.title,
      impactLabel: `${queryRun.result.rowset.totalRows} rows`,
      direction: "positive",
      description: queryRun.run.summary,
    })),
    evidence: buildEvidenceFromQueryRuns(
      orderedQueryRuns,
      "Custom question",
      "Custom analysis",
    ),
    assumptions: [
      "This is a partial answer based only on completed bounded read-only queries.",
      "The bounded agent did not get another read after the query budget was reached.",
    ],
    supportedFollowUps: buildDefaultFollowUps(args.question),
    resultTable: tableRun?.result.rowset,
    queryRuns: orderedQueryRuns.map((queryRun) => queryRun.run),
    sourceAudit,
    executionTrace: args.executionTrace,
    sourceMode: args.sourceMode,
  }

  const trust = buildAgenticTrustModel({
    response: responseSeed,
    sourceAudit,
    queryRuns: orderedQueryRuns,
    executionTrace: args.executionTrace,
    uncertaintyNotes: [
      "The bounded agent did not complete a model-synthesized final answer before the read budget was reached.",
      ...(sourceLabels.length > 1
        ? []
        : ["Only one source family contributed completed reads to this partial answer."]),
      ...(args.uncertaintyNotes ?? []),
    ],
    limitationNotes: [
      args.reason,
      "Stopped after the allowed read-only query budget; the answer is based on completed reads only.",
      ...(args.limitationNotes ?? []),
    ],
  })

  return {
    ...responseSeed,
    confidence: Math.min(trust.overall.score, 72),
    trust: {
      ...trust,
      overall: {
        score: Math.min(trust.overall.score, 72),
        label: Math.min(trust.overall.score, 72) >= 60 ? "medium" : "low",
      },
    },
  }
}

function formatCsvQuerySummary(args: {
  source: AgenticConnectedCsvSource
  intent: z.infer<typeof uploadedCsvQuerySchema>["intent"]
  aggregation: "sum" | "avg" | "min" | "max" | "count"
  metricLabel?: string
  dimensionLabel?: string
  execution: AgenticQueryExecutionResult
}) {
  switch (args.intent) {
    case "discovery":
      return `${args.source.label} preview returned ${args.execution.rowset.totalRows} row${args.execution.rowset.totalRows === 1 ? "" : "s"} inside the bounded preview window.`
    case "aggregate":
      return `${args.aggregation.toUpperCase()} ${args.metricLabel?.toLowerCase() ?? "row count"} was computed for ${args.source.label}.`
    case "group_by":
      return `${args.metricLabel?.toLowerCase() ?? "row count"} was grouped by ${args.dimensionLabel?.toLowerCase() ?? "the selected dimension"} for ${args.source.label}.`
    case "trend":
      return `${args.metricLabel?.toLowerCase() ?? "row count"} was trended over ${args.source.primaryTimeField ?? "time"} for ${args.source.label}.`
  }
}

async function executeUploadedCsvQuery(args: {
  dataAccess: QueryLensDataAccess
  source: AgenticConnectedCsvSource
  request: z.infer<typeof uploadedCsvQuerySchema>
}): Promise<StoredAgenticQueryRun> {
  const aggregation = args.request.aggregation ?? "sum"
  const metric = args.request.metricId
    ? args.source.metrics.find((candidate) => candidate.id === args.request.metricId)
    : undefined
  const dimension = args.request.dimensionId
    ? args.source.dimensions.find((candidate) => candidate.id === args.request.dimensionId)
    : undefined
  const canUseCount = aggregation === "count"
  const metricColumn = metric?.id

  let statement = ""

  if (args.request.intent === "discovery") {
    statement = `SELECT * FROM ${quoteIdentifier(args.source.tableName)} LIMIT ${Math.max(MAX_QUERY_RESULT_ROWS + 1, 2)}`
  } else if (args.request.intent === "aggregate") {
    if (!metricColumn && !canUseCount) {
      throw new Error("CSV aggregate queries require a supported metricId or count aggregation.")
    }

    const expression = canUseCount
      ? "COUNT(*)::double precision"
      : `${aggregation.toUpperCase()}(${quoteIdentifier(metricColumn ?? "id")})::double precision`
    statement = `SELECT ${expression} AS value FROM ${quoteIdentifier(args.source.tableName)}`
  } else if (args.request.intent === "group_by") {
    if (!dimension) {
      throw new Error("CSV grouped queries require a supported dimensionId.")
    }

    const expression = canUseCount
      ? "COUNT(*)::double precision"
      : metricColumn
        ? `${aggregation.toUpperCase()}(${quoteIdentifier(metricColumn)})::double precision`
        : undefined

    if (!expression) {
      throw new Error("CSV grouped queries require a supported metricId or count aggregation.")
    }

    statement = `
      SELECT
        ${quoteIdentifier(dimension.id)} AS label,
        ${expression} AS value
      FROM ${quoteIdentifier(args.source.tableName)}
      GROUP BY 1
      ORDER BY 2 DESC NULLS LAST
      LIMIT ${Math.max(MAX_QUERY_RESULT_ROWS + 1, 2)}
    `.trim()
  } else {
    if (!args.source.primaryTimeField) {
      throw new Error("This uploaded dataset does not have a primary time field for trend analysis.")
    }

    const expression = canUseCount
      ? "COUNT(*)::double precision"
      : metricColumn
        ? `SUM(${quoteIdentifier(metricColumn)})::double precision`
        : undefined

    if (!expression) {
      throw new Error("CSV trend queries require a supported metricId or count aggregation.")
    }

    statement = `
      SELECT
        ${quoteIdentifier(args.source.primaryTimeField)} AS period,
        ${expression} AS value
      FROM ${quoteIdentifier(args.source.tableName)}
      WHERE ${quoteIdentifier(args.source.primaryTimeField)} IS NOT NULL
      GROUP BY 1
      ORDER BY 1 ASC
      LIMIT ${Math.max(MAX_QUERY_RESULT_ROWS + 1, 2)}
    `.trim()
  }

  const execution = await args.dataAccess.executeReadOnlySql({
    statement,
    maxRows: MAX_QUERY_RESULT_ROWS,
  })
  const summary = `${args.request.reason} ${formatCsvQuerySummary({
    source: args.source,
    intent: args.request.intent,
    aggregation,
    metricLabel: metric?.label,
    dimensionLabel: dimension?.label,
    execution,
  })}`.trim()

  return {
    run: {
      id: `query-run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: args.request.title,
      sourceId: args.source.id,
      sourceLabel: args.source.label,
      sourceType: "csv",
      language: "sql",
      statement,
      status: "completed",
      rowCount: execution.rowset.totalRows,
      summary,
    },
    result: execution,
  }
}

export async function executeBoundedMultiSourceAgent(
  args: ExecuteBoundedMultiSourceAgentArgs,
): Promise<Phase1AnalysisResponse> {
  const session = createAgentModelSession(agenticTools)
  const queryRuns = new Map<string, StoredAgenticQueryRun>()
  const inspectedSourceIds = new Set<string>()
  const sourceCatalogEntryById = new Map(
    args.sourceCatalog.entries.map((entry) => [entry.id, entry]),
  )
  const builtInPostgresSource = sourceCatalogEntryById.get("built_in_postgres")
  const builtInMongoSource = sourceCatalogEntryById.get("built_in_mongodb")
  const csvSourceById = new Map(
    args.sourceCatalog.schema.csv.map((source) => [source.datasetId, source]),
  )
  const allowedBuiltInTables = args.sourceCatalog.schema.postgres.map((table) => table.name)
  let executionTrace = buildEmptyTrace({
    question: args.question,
    activeDatasetId: args.activeDatasetId,
    fallbackReason: args.fallbackReason,
  })

  let turn = await session.sendPrompt(
    buildAgenticPrompt({
      question: args.question,
      retrievalContext: args.retrievalContext,
      sourceCatalog: args.sourceCatalog,
      activeDatasetId: args.activeDatasetId,
      activeDatasetLabel: args.activeDatasetLabel,
      fallbackReason: args.fallbackReason,
    }),
  )

  for (let step = 0; step < MAX_AGENTIC_STEPS; step += 1) {
    if (!turn.functionCalls.length) {
      executionTrace = appendTrace(executionTrace, {
        id: `tool_call.empty_${step + 1}`,
        stage: "tool_call",
        status: "failed",
        message:
          "The bounded agent did not return a valid tool action for the current step.",
      })

      return buildFallbackResponse({
        reason: "The bounded multi-source agent did not produce a valid executable action.",
        question: args.question,
        sourceMode: args.dataAccess.sourceMode,
        sourceCatalog: args.sourceCatalog,
        inspectedSourceIds,
        queryRuns: Array.from(queryRuns.values()),
        executionTrace,
      })
    }

    const functionResponses: AgentFunctionResponse[] = []

    for (const functionCall of turn.functionCalls) {
      executionTrace = appendTrace(executionTrace, {
        id: `tool_call.request.${step + 1}.${functionCall.name}.${functionCall.id}`,
        stage: "tool_call",
        status: "approved",
        message: `The bounded agent requested ${functionCall.name}.`,
      })

      if (functionCall.name === "list_available_sources") {
        functionResponses.push({
          callId: functionCall.id,
          name: functionCall.name,
          payload: {
            sources: args.sourceCatalog.entries,
          },
        })
        continue
      }

      if (functionCall.name === "inspect_source_schema") {
        try {
          const parsedArgs = inspectSourceSchemaSchema.parse(functionCall.args)
          const sourceEntry = sourceCatalogEntryById.get(parsedArgs.sourceId)
          if (!sourceEntry) {
            throw new Error(`Unknown sourceId: ${parsedArgs.sourceId}.`)
          }

          inspectedSourceIds.add(parsedArgs.sourceId)

          functionResponses.push({
            callId: functionCall.id,
            name: functionCall.name,
            payload:
              parsedArgs.sourceId === "built_in_postgres"
                ? {
                    source: sourceEntry,
                    schema: args.sourceCatalog.schema.postgres,
                  }
                : parsedArgs.sourceId === "built_in_mongodb"
                  ? {
                      source: sourceEntry,
                      schema: args.sourceCatalog.schema.mongodb,
                    }
                  : {
                      source: sourceEntry,
                      schema: csvSourceById.get(parsedArgs.sourceId),
                    },
          })
          executionTrace = appendTrace(executionTrace, {
            id: `tool_call.inspect.${parsedArgs.sourceId}.${functionCall.id}`,
            stage: "tool_call",
            status: "completed",
            message: `QueryLens inspected the schema for ${sourceEntry.label}.`,
            metadata: {
              sourceId: parsedArgs.sourceId,
            },
          })
        } catch (error) {
          executionTrace = appendTrace(executionTrace, {
            id: `tool_call.inspect_error.${step + 1}.${functionCall.id}`,
            stage: "tool_call",
            status: "failed",
            message:
              error instanceof Error ? error.message : "QueryLens could not inspect that source safely.",
          })
          functionResponses.push({
            callId: functionCall.id,
            name: functionCall.name,
            payload: {
              error:
                error instanceof Error
                  ? error.message
                  : "QueryLens could not inspect that source safely.",
            },
          })
        }
        continue
      }

      if (
        functionCall.name === "run_postgres_query" ||
        functionCall.name === "run_mongodb_pipeline" ||
        functionCall.name === "run_uploaded_csv_query"
      ) {
        if (queryRuns.size >= MAX_AGENTIC_QUERY_RUNS) {
          executionTrace = appendTrace(executionTrace, {
            id: `fallback.query_budget.${step + 1}`,
            stage: "fallback",
            status: "fallback",
            message:
              "The bounded multi-source agent hit its read-only query budget before it could finish safely.",
          })
          if (queryRuns.size > 0) {
            return buildPartialBudgetResponse({
              reason:
                "The bounded multi-source agent hit its read-only query budget before it could finish safely.",
              question: args.question,
              sourceMode: args.dataAccess.sourceMode,
              sourceCatalog: args.sourceCatalog,
              inspectedSourceIds,
              queryRuns: Array.from(queryRuns.values()),
              executionTrace,
            })
          }

          return buildFallbackResponse({
            reason:
              "The bounded multi-source agent hit its read-only query budget before it could finish safely.",
            question: args.question,
            sourceMode: args.dataAccess.sourceMode,
            sourceCatalog: args.sourceCatalog,
            inspectedSourceIds,
            queryRuns: Array.from(queryRuns.values()),
            executionTrace,
          })
        }
      }

      if (functionCall.name === "run_postgres_query") {
        try {
          const parsedArgs = postgresQuerySchema.parse(functionCall.args)
          const statement = validateReadOnlySql(parsedArgs.statement, allowedBuiltInTables)
          const execution = await args.dataAccess.executeReadOnlySql({
            statement,
            maxRows: MAX_QUERY_RESULT_ROWS,
          })
          const queryRunId = `query-run-${queryRuns.size + 1}`
          const queryRun: QueryRun = {
            id: queryRunId,
            title: parsedArgs.title,
            sourceId: "built_in_postgres",
            sourceLabel: builtInPostgresSource?.label ?? "Built-in Postgres facts",
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
          inspectedSourceIds.add("built_in_postgres")
          executionTrace = appendTrace(executionTrace, {
            id: `source_read.postgres.${queryRunId}`,
            stage: "source_read",
            status: "completed",
            message: `QueryLens executed a read-only built-in Postgres query for ${parsedArgs.title}.`,
            metadata: {
              sourceId: "built_in_postgres",
              rows: execution.rowset.totalRows,
            },
          })

          functionResponses.push({
            callId: functionCall.id,
            name: functionCall.name,
            payload: {
              queryRunId,
              title: parsedArgs.title,
              sourceId: queryRun.sourceId,
              sourceLabel: queryRun.sourceLabel,
              sourceType: queryRun.sourceType,
              language: queryRun.language,
              statement,
              summary: execution.summary,
              rowCount: execution.rowset.totalRows,
              truncated: execution.rowset.truncated,
              columns: execution.rowset.columns,
              rows: execution.rowset.rows,
            },
          })
        } catch (error) {
          executionTrace = appendTrace(executionTrace, {
            id: `source_read.postgres_error.${step + 1}`,
            stage: "source_read",
            status: "failed",
            message:
              error instanceof Error
                ? error.message
                : "QueryLens could not execute that Postgres query safely.",
          })
          functionResponses.push({
            callId: functionCall.id,
            name: functionCall.name,
            payload: {
              error:
                error instanceof Error
                  ? error.message
                  : "QueryLens could not execute that Postgres query safely.",
            },
          })
        }
        continue
      }

      if (functionCall.name === "run_mongodb_pipeline") {
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
            sourceId: "built_in_mongodb",
            sourceLabel: builtInMongoSource?.label ?? "Built-in Mongo context",
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
          inspectedSourceIds.add("built_in_mongodb")
          executionTrace = appendTrace(executionTrace, {
            id: `source_read.mongodb.${queryRunId}`,
            stage: "source_read",
            status: "completed",
            message: `QueryLens executed a read-only built-in MongoDB pipeline for ${parsedArgs.title}.`,
            metadata: {
              sourceId: "built_in_mongodb",
              rows: execution.rowset.totalRows,
            },
          })

          functionResponses.push({
            callId: functionCall.id,
            name: functionCall.name,
            payload: {
              queryRunId,
              title: parsedArgs.title,
              sourceId: queryRun.sourceId,
              sourceLabel: queryRun.sourceLabel,
              sourceType: queryRun.sourceType,
              language: queryRun.language,
              collection: parsedArgs.collection,
              summary: execution.summary,
              rowCount: execution.rowset.totalRows,
              truncated: execution.rowset.truncated,
              columns: execution.rowset.columns,
              rows: execution.rowset.rows,
            },
          })
        } catch (error) {
          executionTrace = appendTrace(executionTrace, {
            id: `source_read.mongodb_error.${step + 1}`,
            stage: "source_read",
            status: "failed",
            message:
              error instanceof Error
                ? error.message
                : "QueryLens could not execute that MongoDB pipeline safely.",
          })
          functionResponses.push({
            callId: functionCall.id,
            name: functionCall.name,
            payload: {
              error:
                error instanceof Error
                  ? error.message
                  : "QueryLens could not execute that MongoDB pipeline safely.",
            },
          })
        }
        continue
      }

      if (functionCall.name === "run_uploaded_csv_query") {
        try {
          const parsedArgs = uploadedCsvQuerySchema.parse(functionCall.args)
          const source = csvSourceById.get(parsedArgs.datasetId)
          if (!source) {
            throw new Error(`Unknown or inactive uploaded dataset: ${parsedArgs.datasetId}.`)
          }

          const queryRun = await executeUploadedCsvQuery({
            dataAccess: args.dataAccess,
            source,
            request: parsedArgs,
          })
          const queryRunId = `query-run-${queryRuns.size + 1}`
          queryRuns.set(queryRunId, {
            run: {
              ...queryRun.run,
              id: queryRunId,
            },
            result: queryRun.result,
          })
          inspectedSourceIds.add(source.id)
          executionTrace = appendTrace(executionTrace, {
            id: `source_read.csv.${queryRunId}`,
            stage: "source_read",
            status: "completed",
            message: `QueryLens executed a bounded uploaded-CSV query for ${source.label}.`,
            metadata: {
              sourceId: source.id,
              rows: queryRun.result.rowset.totalRows,
            },
          })

          functionResponses.push({
            callId: functionCall.id,
            name: functionCall.name,
            payload: {
              queryRunId,
              title: parsedArgs.title,
              sourceId: source.id,
              sourceLabel: source.label,
              sourceType: "csv",
              language: "sql",
              statement: queryRun.run.statement,
              summary: queryRun.result.summary,
              rowCount: queryRun.result.rowset.totalRows,
              truncated: queryRun.result.rowset.truncated,
              columns: queryRun.result.rowset.columns,
              rows: queryRun.result.rowset.rows,
            },
          })
        } catch (error) {
          executionTrace = appendTrace(executionTrace, {
            id: `source_read.csv_error.${step + 1}`,
            stage: "source_read",
            status: "failed",
            message:
              error instanceof Error
                ? error.message
                : "QueryLens could not execute that uploaded CSV query safely.",
          })
          functionResponses.push({
            callId: functionCall.id,
            name: functionCall.name,
            payload: {
              error:
                error instanceof Error
                  ? error.message
                  : "QueryLens could not execute that uploaded CSV query safely.",
            },
          })
        }
        continue
      }

      if (functionCall.name === "reject_agentic_response") {
        const parsedArgs = rejectAgenticResponseSchema.safeParse(functionCall.args)
        executionTrace = appendTrace(executionTrace, {
          id: `fallback.reject.${step + 1}`,
          stage: "fallback",
          status: "fallback",
          message:
            parsedArgs.success
              ? parsedArgs.data.reason
              : "The question was too ambiguous for a safe bounded multi-source query.",
        })

        return buildFallbackResponse({
          reason: parsedArgs.success
            ? parsedArgs.data.reason
            : "The question was too ambiguous for a safe bounded multi-source query.",
          question: args.question,
          sourceMode: args.dataAccess.sourceMode,
          sourceCatalog: args.sourceCatalog,
          inspectedSourceIds,
          queryRuns: Array.from(queryRuns.values()),
          executionTrace,
        })
      }

      if (functionCall.name === "finish_agentic_response") {
        const parsedArgs = finishAgenticResponseSchema.safeParse(functionCall.args)
        if (!parsedArgs.success) {
          executionTrace = appendTrace(executionTrace, {
            id: `fallback.invalid_finish.${step + 1}`,
            stage: "fallback",
            status: "fallback",
            message:
              "The bounded multi-source agent produced an invalid structured final answer.",
          })

          return buildFallbackResponse({
            reason:
              "The bounded multi-source agent produced an invalid structured final answer.",
            question: args.question,
            sourceMode: args.dataAccess.sourceMode,
            sourceCatalog: args.sourceCatalog,
            inspectedSourceIds,
            queryRuns: Array.from(queryRuns.values()),
            executionTrace,
          })
        }

        const primaryRun = queryRuns.get(parsedArgs.data.primaryQueryRunId)
        const tableRun = queryRuns.get(
          parsedArgs.data.tableQueryRunId ?? parsedArgs.data.primaryQueryRunId,
        )
        const chartRun = parsedArgs.data.chart
          ? queryRuns.get(parsedArgs.data.chart.queryRunId)
          : undefined

        if (!primaryRun || !tableRun || (parsedArgs.data.chart && !chartRun)) {
          executionTrace = appendTrace(executionTrace, {
            id: `fallback.unknown_query_run.${step + 1}`,
            stage: "fallback",
            status: "fallback",
            message:
              "The bounded multi-source agent referenced a query run that was never completed.",
          })

          return buildFallbackResponse({
            reason:
              "The bounded multi-source agent referenced a query run that was never completed.",
            question: args.question,
            sourceMode: args.dataAccess.sourceMode,
            sourceCatalog: args.sourceCatalog,
            inspectedSourceIds,
            queryRuns: Array.from(queryRuns.values()),
            executionTrace,
          })
        }

        const orderedQueryRuns = Array.from(queryRuns.values())
        const sourceAudit = buildSourceAudit({
          sourceCatalog: args.sourceCatalog,
          inspectedSourceIds,
          queryRuns: orderedQueryRuns,
        })
        executionTrace = appendTrace(executionTrace, {
          id: `dispatch.agentic_finish.${step + 1}`,
          stage: "dispatch",
          status: "completed",
          message:
            "The bounded multi-source agent completed a grounded answer from approved read-only query results.",
        })

        const responseSeed: Omit<Phase1AnalysisResponse, "confidence" | "trust" | "trustArtifacts"> = {
          intent: "agentic_query",
          headline: parsedArgs.data.headline,
          summary: parsedArgs.data.summary,
          metric: "custom_query_result",
          timeframe: parsedArgs.data.timeframe,
          comparisonBasis: parsedArgs.data.comparisonBasis,
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
            parsedArgs.data.activeScope,
          ),
          assumptions:
            parsedArgs.data.assumptions.length > 0
              ? parsedArgs.data.assumptions
              : [
                  "The bounded agent stayed inside approved built-in sources and active uploaded CSV datasets.",
                ],
          supportedFollowUps:
            parsedArgs.data.supportedFollowUps.length > 0
              ? parsedArgs.data.supportedFollowUps
              : buildDefaultFollowUps(args.question),
          resultTable: tableRun.result.rowset,
          queryRuns: orderedQueryRuns.map((queryRun) => queryRun.run),
          sourceAudit,
          executionTrace,
          sourceMode: args.dataAccess.sourceMode,
        }
        const trust = buildAgenticTrustModel({
          response: responseSeed,
          sourceAudit,
          queryRuns: orderedQueryRuns,
          executionTrace,
          uncertaintyNotes: parsedArgs.data.uncertaintyNotes,
          limitationNotes: parsedArgs.data.limitationNotes,
        })

        return {
          ...responseSeed,
          confidence: trust.overall.score,
          trust,
        }
      }
    }

    if (!functionResponses.length) {
      executionTrace = appendTrace(executionTrace, {
        id: `fallback.no_function_responses.${step + 1}`,
        stage: "fallback",
        status: "fallback",
        message: "The bounded multi-source agent produced no executable tool results.",
      })

      return buildFallbackResponse({
        reason: "The bounded multi-source agent produced no executable tool results.",
        question: args.question,
        sourceMode: args.dataAccess.sourceMode,
        sourceCatalog: args.sourceCatalog,
        inspectedSourceIds,
        queryRuns: Array.from(queryRuns.values()),
        executionTrace,
      })
    }

    turn = await session.sendFunctionResponses(functionResponses)
  }

  executionTrace = appendTrace(executionTrace, {
    id: "fallback.step_limit",
    stage: "fallback",
    status: "fallback",
    message:
      "The bounded multi-source agent reached its step limit before it could finish safely.",
  })

  if (queryRuns.size > 0) {
    return buildPartialBudgetResponse({
      reason:
        "The bounded multi-source agent reached its step limit before it could finish safely.",
      question: args.question,
      sourceMode: args.dataAccess.sourceMode,
      sourceCatalog: args.sourceCatalog,
      inspectedSourceIds,
      queryRuns: Array.from(queryRuns.values()),
      executionTrace,
    })
  }

  return buildFallbackResponse({
    reason:
      "The bounded multi-source agent reached its step limit before it could finish safely.",
    question: args.question,
    sourceMode: args.dataAccess.sourceMode,
    sourceCatalog: args.sourceCatalog,
    inspectedSourceIds,
    queryRuns: Array.from(queryRuns.values()),
    executionTrace,
  })
}

export const executeAgenticFallback = executeBoundedMultiSourceAgent
