import { z } from "zod"

import { getDefaultDatasetId, isBuiltInDatasetId } from "@/lib/querylens/datasets"
import { getOnboardedDatasetRecord } from "@/lib/querylens/server/dataset-registry"
import { canUseReasoningProvider, type QueryLensExecutionContext } from "@/lib/querylens/server/ai-config"
import { generateStructuredData } from "@/lib/querylens/server/reasoning-provider"
import { getPgPool } from "@/lib/querylens/server/runtime-shared"
import type {
  ChartSpec,
  CsvColumnProfile,
  DatasetSemanticDraft,
  OnboardedDatasetRecord,
  Phase1AnalysisResponse,
  QueryRequestBody,
  QueryRun,
  ResultTable,
} from "@/lib/querylens/types"

const plannerSchema = z.object({
  intent: z.enum(["discovery", "aggregate", "group_by", "trend", "unsupported"]),
  metricId: z.string().optional(),
  dimensionId: z.string().optional(),
  aggregation: z.enum(["sum", "avg", "min", "max", "count"]).optional(),
  reason: z.string().optional(),
})

interface PlannedOnboardedQuery {
  intent: z.infer<typeof plannerSchema>["intent"]
  metricId?: string
  dimensionId?: string
  aggregation?: "sum" | "avg" | "min" | "max" | "count"
  reason?: string
}

function quoteIdentifier(value: string) {
  return `"${value.replace(/"/g, "\"\"")}"`
}

function formatTableValue(value: unknown) {
  if (value === null || value === undefined) {
    return null
  }

  if (typeof value === "number" || typeof value === "boolean" || typeof value === "string") {
    return value
  }

  if (value instanceof Date) {
    return value.toISOString()
  }

  return String(value)
}

function buildSourceEvidence(summary: string) {
  return [
    {
      sourceType: "postgres" as const,
      sourceName: "Onboarded CSV facts",
      timeRange: "Imported dataset coverage",
      scope: "Dataset-wide",
      supportingFact: summary,
      queryTemplateId: "onboarded_dataset_sql",
    },
  ]
}

function buildFallbackResponse(args: {
  record: OnboardedDatasetRecord
  reason: string
}): Phase1AnalysisResponse {
  const firstMetric = args.record.semanticDraft.metrics[0]
  const firstDimension = args.record.semanticDraft.dimensions[0]
  const supportedFollowUps = [
    "What data is currently stored?",
    firstMetric
      ? `What is the total ${firstMetric.label.toLowerCase()}?`
      : "How many rows are in this dataset?",
    firstMetric && firstDimension
      ? `Show ${firstMetric.label.toLowerCase()} by ${firstDimension.label.toLowerCase()}.`
      : "Show a simple grouped summary.",
  ].filter(Boolean) as string[]

  return {
    intent: "discovery",
    headline: `QueryLens could not safely map that question for ${args.record.label}`,
    summary: `${args.reason} This first CSV slice supports dataset discovery, scalar aggregates, grouped summaries, and time trends over the detected primary time field.`,
    metric: "dataset_catalog",
    timeframe: "Imported dataset coverage",
    comparisonBasis: "Deterministic onboarded CSV execution",
    confidence: 42,
    activeScope: args.record.label,
    drivers: [],
    evidence: [],
    assumptions: [
      "Onboarded CSV datasets only support the narrow deterministic analytics surface in this slice.",
    ],
    supportedFollowUps,
    fallback: true,
    sourceMode: "database",
  }
}

function resolveMetric(
  record: OnboardedDatasetRecord,
  question: string
) {
  const normalizedQuestion = question.toLowerCase()
  return record.semanticDraft.metrics.find((metric) => {
    const candidates = [
      metric.id,
      metric.label,
      metric.columnId ?? "",
      ...(metric.synonyms ?? []),
    ]

    return candidates.some((candidate) =>
      candidate && normalizedQuestion.includes(candidate.toLowerCase())
    )
  })
}

function resolveDimension(
  record: OnboardedDatasetRecord,
  question: string
) {
  const normalizedQuestion = question.toLowerCase()
  return record.semanticDraft.dimensions.find((dimension) => {
    const candidates = [
      dimension.id,
      dimension.label,
      dimension.columnId ?? "",
      ...(dimension.synonyms ?? []),
    ]

    return candidates.some((candidate) =>
      candidate && normalizedQuestion.includes(candidate.toLowerCase())
    )
  })
}

function planDeterministically(
  record: OnboardedDatasetRecord,
  question: string
): PlannedOnboardedQuery {
  const normalizedQuestion = question.toLowerCase()
  const metric = resolveMetric(record, question)
  const dimension = resolveDimension(record, question)

  if (/(compare|versus|vs\b|why did|what changed|breakdown)/.test(normalizedQuestion)) {
    return {
      intent: "unsupported",
      reason:
        "That request falls outside the first onboarded CSV slice.",
    }
  }

  if (
    /(what data|what is stored|what columns|schema|available fields|metrics|questions)/.test(
      normalizedQuestion
    )
  ) {
    return { intent: "discovery" }
  }

  if (
    /(trend|over time|by date|daily|weekly|monthly)/.test(normalizedQuestion)
  ) {
    return {
      intent: "trend",
      metricId: metric?.id,
    }
  }

  if (/\bby\b/.test(normalizedQuestion) && dimension?.id) {
    return {
      intent: "group_by",
      metricId: metric?.id,
      dimensionId: dimension.id,
      aggregation: /(average|avg)/.test(normalizedQuestion) ? "avg" : "sum",
    }
  }

  if (metric?.id || /(count|rows|records)/.test(normalizedQuestion)) {
    return {
      intent: "aggregate",
      metricId: metric?.id,
      aggregation: /(average|avg)/.test(normalizedQuestion)
        ? "avg"
        : /(minimum|min\b)/.test(normalizedQuestion)
          ? "min"
          : /(maximum|max\b)/.test(normalizedQuestion)
            ? "max"
            : /(count|rows|records)/.test(normalizedQuestion)
              ? "count"
              : "sum",
    }
  }

  return {
    intent: "unsupported",
    reason:
      "QueryLens could not resolve a supported measure or grouping from that question.",
  }
}

function buildPlannerPrompt(record: OnboardedDatasetRecord, question: string) {
  return `
You are planning a QueryLens query for an onboarded CSV dataset.

Supported intents:
- discovery
- aggregate
- group_by
- trend
- unsupported

Rules:
- choose unsupported for compare, causality, breakdown, or freeform investigative requests
- metricId must match one of the known metric ids exactly when present
- dimensionId must match one of the known dimension ids exactly when present
- trend requires the dataset to have a primary time field
- aggregate and group_by should use the measure-oriented metric ids

Dataset:
${JSON.stringify(
  {
    id: record.id,
    label: record.label,
    primaryTimeField: record.primaryTimeField,
    metrics: record.semanticDraft.metrics.map((metric) => ({
      id: metric.id,
      label: metric.label,
      synonyms: metric.synonyms ?? [],
    })),
    dimensions: record.semanticDraft.dimensions.map((dimension) => ({
      id: dimension.id,
      label: dimension.label,
      synonyms: dimension.synonyms ?? [],
    })),
  },
  null,
  2
)}

Question:
${question}
  `.trim()
}

async function planWithModel(
  record: OnboardedDatasetRecord,
  question: string
) {
  const result = await generateStructuredData(
    {
      prompt: buildPlannerPrompt(record, question),
      responseJsonSchema: {
        type: "object",
        additionalProperties: false,
        required: ["intent"],
        properties: {
          intent: {
            type: "string",
            enum: ["discovery", "aggregate", "group_by", "trend", "unsupported"],
          },
          metricId: { type: "string" },
          dimensionId: { type: "string" },
          aggregation: {
            type: "string",
            enum: ["sum", "avg", "min", "max", "count"],
          },
          reason: { type: "string" },
        },
      },
      schemaName: "querylens_onboarded_query_plan",
    },
    plannerSchema
  )

  return result.data
}

async function planOnboardedQuery(
  record: OnboardedDatasetRecord,
  question: string,
  executionContext: QueryLensExecutionContext
) {
  if (!canUseReasoningProvider(executionContext)) {
    return planDeterministically(record, question)
  }

  try {
    const result = await planWithModel(record, question)
    return result ?? planDeterministically(record, question)
  } catch {
    return planDeterministically(record, question)
  }
}

function findMetricColumn(record: OnboardedDatasetRecord, metricId?: string) {
  if (!metricId) {
    return undefined
  }

  const metric = record.semanticDraft.metrics.find((candidate) => candidate.id === metricId)
  if (!metric?.columnId) {
    return undefined
  }

  return record.columns.find((column) => column.normalizedName === metric.columnId)
}

function findDimensionColumn(record: OnboardedDatasetRecord, dimensionId?: string) {
  if (!dimensionId) {
    return undefined
  }

  const dimension = record.semanticDraft.dimensions.find((candidate) => candidate.id === dimensionId)
  if (!dimension?.columnId) {
    return undefined
  }

  return record.columns.find((column) => column.normalizedName === dimension.columnId)
}

async function runSql(statement: string) {
  const pool = getPgPool()
  const result = await pool.query<Record<string, unknown>>(statement)
  const columns = Object.keys(result.rows[0] ?? {})

  return {
    rows: result.rows.map((row) =>
      Object.fromEntries(
        Object.entries(row).map(([key, value]) => [key, formatTableValue(value)])
      )
    ),
    table: {
      columns,
      rows: result.rows.map((row) =>
        Object.fromEntries(
          columns.map((column) => [column, formatTableValue(row[column])])
        )
      ),
      totalRows: result.rows.length,
      truncated: false,
    } satisfies ResultTable,
  }
}

function buildQueryRun(args: {
  id: string
  title: string
  sourceId: string
  sourceLabel: string
  statement: string
  rowCount: number
  summary: string
}): QueryRun {
  return {
    id: args.id,
    title: args.title,
    sourceId: args.sourceId,
    sourceLabel: args.sourceLabel,
    sourceType: "postgres",
    language: "sql",
    statement: args.statement,
    status: "completed",
    rowCount: args.rowCount,
    summary: args.summary,
  }
}

function buildDiscoveryResponse(record: OnboardedDatasetRecord): Phase1AnalysisResponse {
  const dimensionLabels = record.semanticDraft.dimensions.map((dimension) => dimension.label)
  const metricLabels = record.semanticDraft.metrics.map((metric) => metric.label)

  return {
    intent: "discovery",
    headline: `${record.label} is ready for safe CSV analysis`,
    summary: `${record.label} contains ${record.rowCount.toLocaleString()} rows, ${record.columns.length} columns, and ${metricLabels.length} inferred measures. QueryLens can currently answer discovery questions, scalar aggregates, grouped summaries, and${record.primaryTimeField ? " time trends" : " simple summaries"} for this onboarded dataset.`,
    metric: "dataset_catalog",
    timeframe: record.semanticDraft.timeCoverage,
    comparisonBasis: "Onboarded CSV semantic draft",
    confidence: 79,
    activeScope: record.label,
    drivers: [],
    evidence: buildSourceEvidence("Semantic draft and imported Postgres rows were used."),
    assumptions: record.semanticDraft.notes,
    supportedFollowUps: [
      "What data is currently stored?",
      ...record.semanticDraft.metrics.flatMap((metric) => metric.exampleQuestions ?? []).slice(0, 3),
    ],
    discoverySummary: {
      datasetLabel: record.label,
      sourceLabels: ["Onboarded CSV facts", "Semantic draft"],
      metricCount: metricLabels.length,
      timeCoverage: record.semanticDraft.timeCoverage,
      dimensionLabels,
    },
    catalogSections: [
      {
        id: "dataset-overview",
        title: "Dataset overview",
        summary: record.description,
        items: [
          `${record.rowCount.toLocaleString()} rows`,
          `${record.columns.length} columns`,
          record.grain,
        ],
      },
      {
        id: "dataset-metrics",
        title: "Inferred measures",
        summary: metricLabels.join(", "),
        items: metricLabels,
      },
      {
        id: "dataset-dimensions",
        title: "Candidate dimensions",
        summary: dimensionLabels.join(", "),
        items: dimensionLabels,
      },
    ],
    resultTable: record.previewRows,
    sourceMode: "database",
  }
}

function buildChartFromRows(args: {
  type: "bar" | "line"
  title: string
  explanation: string
  xKey: string
  yKey: string
  rows: Array<Record<string, string | number | boolean | null>>
}): ChartSpec {
  const data = args.rows
    .map((row) => {
      const rawLabel = row[args.xKey]
      const rawValue = row[args.yKey]
      const value =
        typeof rawValue === "number" ? rawValue : Number(rawValue)

      if (
        (typeof rawLabel !== "string" && typeof rawLabel !== "number") ||
        !Number.isFinite(value)
      ) {
        return undefined
      }

      return {
        [args.xKey]: String(rawLabel),
        [args.yKey]: value,
      }
    })
    .filter((row): row is Record<string, string | number> => Boolean(row))

  return {
    type: args.type,
    title: args.title,
    explanation: args.explanation,
    xKey: args.xKey,
    yKey: args.yKey,
    data,
  }
}

export async function analyzeOnboardedDatasetQuery(args: {
  input: QueryRequestBody
  executionContext: QueryLensExecutionContext
}): Promise<Phase1AnalysisResponse | undefined> {
  const datasetId = args.input.datasetId
  if (!datasetId || isBuiltInDatasetId(datasetId)) {
    return undefined
  }

  const record = await getOnboardedDatasetRecord(datasetId)
  if (!record) {
    return buildFallbackResponse({
      record: {
        id: datasetId,
        label: datasetId,
        description: "Unknown onboarded dataset",
        status: "draft",
        sourceKind: "csv",
        sourceMode: "database",
        tableName: "",
        rowCount: 0,
        grain: "row_level",
        manifestVersion: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        semanticDraft: {
          datasetId,
          datasetLabel: datasetId,
          description: "Unknown onboarded dataset",
          sourceMode: "database",
          timeCoverage: "Unknown",
          dimensions: [],
          metrics: [],
          sources: [],
          notes: [],
        },
        columns: [],
        previewRows: {
          columns: [],
          rows: [],
          totalRows: 0,
          truncated: false,
        },
      },
      reason: "QueryLens could not find that onboarded dataset.",
    })
  }

  const planned = await planOnboardedQuery(
    record,
    args.input.question,
    args.executionContext
  )

  if (planned.intent === "unsupported") {
    return buildFallbackResponse({
      record,
      reason:
        planned.reason ??
        "That question is outside the first supported CSV analytics surface.",
    })
  }

  if (planned.intent === "discovery") {
    return buildDiscoveryResponse(record)
  }

  const metricColumn = findMetricColumn(record, planned.metricId)
  if (!metricColumn && planned.aggregation !== "count") {
    return buildFallbackResponse({
      record,
      reason: "QueryLens could not resolve a supported numeric measure for that question.",
    })
  }

  if (planned.intent === "aggregate") {
    const aggregation = planned.aggregation ?? "sum"
    const expression =
      aggregation === "count"
        ? "COUNT(*)::double precision"
        : `${aggregation.toUpperCase()}(${quoteIdentifier(metricColumn?.normalizedName ?? "id")})::double precision`
    const statement = `SELECT ${expression} AS value FROM ${quoteIdentifier(record.tableName)}`
    const result = await runSql(statement)
    const value = Number(result.rows[0]?.value ?? 0)
    const metricLabel =
      metricColumn?.label ?? (aggregation === "count" ? "Row count" : "Selected measure")
    const summary = `${aggregation.toUpperCase()} ${metricLabel.toLowerCase()} is ${Number.isFinite(value) ? value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "not available"} for ${record.label}.`

    return {
      intent: "aggregate",
      headline: `${metricLabel} at a glance`,
      summary,
      metric: metricColumn?.normalizedName ?? "row_count",
      timeframe: record.semanticDraft.timeCoverage,
      comparisonBasis: "Deterministic aggregate over imported CSV rows",
      confidence: 86,
      activeScope: record.label,
      drivers: [],
      evidence: buildSourceEvidence(summary),
      assumptions: record.semanticDraft.notes,
      supportedFollowUps: [
        "What data is currently stored?",
        ...record.semanticDraft.metrics.flatMap((metric) => metric.exampleQuestions ?? []).slice(0, 3),
      ],
      resultTable: result.table,
      queryRuns: [
        buildQueryRun({
          id: "onboarded-aggregate",
          title: `${aggregation.toUpperCase()} ${metricLabel}`,
          sourceId: record.id,
          sourceLabel: record.label,
          statement,
          rowCount: result.table.totalRows,
          summary,
        }),
      ],
      sourceMode: "database",
    }
  }

  if (planned.intent === "group_by") {
    const dimensionColumn = findDimensionColumn(record, planned.dimensionId)
    if (!dimensionColumn || !metricColumn) {
      return buildFallbackResponse({
        record,
        reason: "QueryLens could not resolve the requested grouping safely.",
      })
    }

    const aggregation = planned.aggregation ?? "sum"
    const statement = `
      SELECT
        ${quoteIdentifier(dimensionColumn.normalizedName)} AS label,
        ${aggregation.toUpperCase()}(${quoteIdentifier(metricColumn.normalizedName)})::double precision AS value
      FROM ${quoteIdentifier(record.tableName)}
      GROUP BY 1
      ORDER BY 2 DESC NULLS LAST
      LIMIT 12
    `.trim()
    const result = await runSql(statement)
    const topLabel = String(result.rows[0]?.label ?? "No value")
    const summary = `${metricColumn.label} is highest for ${topLabel} when grouped by ${dimensionColumn.label.toLowerCase()}.`

    return {
      intent: "aggregate",
      headline: `${metricColumn.label} by ${dimensionColumn.label}`,
      summary,
      metric: metricColumn.normalizedName,
      timeframe: record.semanticDraft.timeCoverage,
      comparisonBasis: "Deterministic grouped aggregate over imported CSV rows",
      confidence: 83,
      activeScope: record.label,
      drivers: [],
      chartSpec: buildChartFromRows({
        type: "bar",
        title: `${metricColumn.label} by ${dimensionColumn.label}`,
        explanation: `Grouped ${aggregation} over ${dimensionColumn.label.toLowerCase()}.`,
        xKey: "label",
        yKey: "value",
        rows: result.table.rows,
      }),
      evidence: buildSourceEvidence(summary),
      assumptions: record.semanticDraft.notes,
      supportedFollowUps: [
        `What is the total ${metricColumn.label.toLowerCase()}?`,
        record.primaryTimeField
          ? `Show the trend of ${metricColumn.label.toLowerCase()} over time.`
          : "What data is currently stored?",
      ],
      resultTable: result.table,
      queryRuns: [
        buildQueryRun({
          id: "onboarded-grouped-summary",
          title: `${metricColumn.label} by ${dimensionColumn.label}`,
          sourceId: record.id,
          sourceLabel: record.label,
          statement,
          rowCount: result.table.totalRows,
          summary,
        }),
      ],
      sourceMode: "database",
    }
  }

  if (planned.intent === "trend") {
    if (!record.primaryTimeField || !metricColumn) {
      return buildFallbackResponse({
        record,
        reason: "This onboarded dataset does not have a resolved primary time field and measure for trend analysis.",
      })
    }

    const statement = `
      SELECT
        ${quoteIdentifier(record.primaryTimeField)} AS period,
        SUM(${quoteIdentifier(metricColumn.normalizedName)})::double precision AS value
      FROM ${quoteIdentifier(record.tableName)}
      WHERE ${quoteIdentifier(record.primaryTimeField)} IS NOT NULL
      GROUP BY 1
      ORDER BY 1 ASC
      LIMIT 60
    `.trim()
    const result = await runSql(statement)
    const summary = `${metricColumn.label} trend uses ${record.primaryTimeField} as the primary time field across ${result.table.totalRows} plotted periods.`

    return {
      intent: "trend",
      headline: `${metricColumn.label} over time`,
      summary,
      metric: metricColumn.normalizedName,
      timeframe: record.semanticDraft.timeCoverage,
      comparisonBasis: `Deterministic time trend over ${record.primaryTimeField}`,
      confidence: 84,
      activeScope: record.label,
      drivers: [],
      chartSpec: buildChartFromRows({
        type: "line",
        title: `${metricColumn.label} over time`,
        explanation: `Summed by ${record.primaryTimeField}.`,
        xKey: "period",
        yKey: "value",
        rows: result.table.rows,
      }),
      evidence: buildSourceEvidence(summary),
      assumptions: record.semanticDraft.notes,
      supportedFollowUps: [
        `What is the total ${metricColumn.label.toLowerCase()}?`,
        "What data is currently stored?",
      ],
      resultTable: result.table,
      queryRuns: [
        buildQueryRun({
          id: "onboarded-trend",
          title: `${metricColumn.label} over time`,
          sourceId: record.id,
          sourceLabel: record.label,
          statement,
          rowCount: result.table.totalRows,
          summary,
        }),
      ],
      sourceMode: "database",
    }
  }

  return buildDiscoveryResponse(record)
}

export async function resolveBootstrapDatasetId(datasetId?: string) {
  if (!datasetId || isBuiltInDatasetId(datasetId)) {
    return getDefaultDatasetId()
  }

  const record = await getOnboardedDatasetRecord(datasetId)
  return record?.status === "active" ? record.id : getDefaultDatasetId()
}
