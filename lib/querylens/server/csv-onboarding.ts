import { z } from "zod"

import { getQueryLensAiConfig } from "@/lib/querylens/server/ai-config"
import {
  buildOnboardedProfileSnapshot,
  getOnboardedDatasetRecord,
  saveOnboardedDataset,
} from "@/lib/querylens/server/dataset-registry"
import {
  generateStructuredData,
  isReasoningProviderError,
  mapReasoningProviderErrorToImportCode,
} from "@/lib/querylens/server/reasoning-provider"
import { getPgPool } from "@/lib/querylens/server/runtime-shared"
import type {
  CsvColumnProfile,
  DatasetImportErrorCode,
  DatasetId,
  DatasetSemanticDraft,
  OnboardedColumnType,
  OnboardedDatasetRecord,
  ResultTable,
} from "@/lib/querylens/types"

const MAX_FILE_BYTES = 25 * 1024 * 1024
const MAX_ROWS = 100_000
const MAX_COLUMNS = 200
const PREVIEW_ROW_LIMIT = 8
const OPENROUTER_REFINEMENT_MAX_ATTEMPTS = 3
const OPENROUTER_REFINEMENT_BACKOFF_MS = [500, 1500]
const SEMANTIC_REFINEMENT_TIMEOUT_MS = 12_000

const refinementSchema = z.object({
  datasetLabel: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  uncertaintyNotes: z.array(z.string().min(1)).default([]),
  dimensions: z
    .array(
      z.object({
        id: z.string().min(1),
        label: z.string().min(1),
        synonyms: z.array(z.string().min(1)).default([]),
      })
    )
    .default([]),
  metrics: z
    .array(
      z.object({
        id: z.string().min(1),
        label: z.string().min(1),
        description: z.string().min(1).optional(),
        synonyms: z.array(z.string().min(1)).default([]),
        exampleQuestions: z.array(z.string().min(1)).default([]),
      })
    )
    .default([]),
})

type ParsedCsvRow = Record<string, string>

export class CsvImportError extends Error {
  code: DatasetImportErrorCode
  retryable: boolean
  provider?: "openrouter"
  status: number

  constructor(args: {
    message: string
    code: DatasetImportErrorCode
    retryable: boolean
    provider?: "openrouter"
    status?: number
  }) {
    super(args.message)
    this.name = "CsvImportError"
    this.code = args.code
    this.retryable = args.retryable
    this.provider = args.provider
    this.status = args.status ?? 500
  }
}

export function isCsvImportError(error: unknown): error is CsvImportError {
  return error instanceof CsvImportError
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError"
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48)
}

function titleize(value: string) {
  return value
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function quoteIdentifier(value: string) {
  return `"${value.replace(/"/g, "\"\"")}"`
}

function buildDatasetId(label: string) {
  return `csv_${slugify(label) || "dataset"}_${Date.now().toString(36)}`
}

function buildTableName(datasetId: string) {
  return `querylens_dataset_rows_${slugify(datasetId)}`
}

export function parseCsv(text: string) {
  const rows: string[][] = []
  let current = ""
  let row: string[] = []
  let inQuotes = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    const next = text[index + 1]

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"'
        index += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (char === "," && !inQuotes) {
      row.push(current)
      current = ""
      continue
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        index += 1
      }

      row.push(current)
      current = ""
      if (row.some((cell) => cell.length > 0)) {
        rows.push(row)
      }
      row = []
      continue
    }

    current += char
  }

  row.push(current)
  if (row.some((cell) => cell.length > 0)) {
    rows.push(row)
  }

  return rows
}

export function normalizeHeaders(rawHeaders: string[]) {
  const seen = new Map<string, number>()

  return rawHeaders.map((rawHeader, index) => {
    const trimmed = rawHeader.trim()
    const fallback = trimmed || `column_${index + 1}`
    const base = slugify(fallback) || `column_${index + 1}`
    const currentCount = seen.get(base) ?? 0
    seen.set(base, currentCount + 1)

    return {
      originalName: fallback,
      normalizedName: currentCount === 0 ? base : `${base}_${currentCount + 1}`,
      label: titleize(fallback.replace(/[_-]+/g, " ")),
    }
  })
}

function toRecordRows(parsedRows: string[][], headers: ReturnType<typeof normalizeHeaders>) {
  return parsedRows.map((row) =>
    Object.fromEntries(
      headers.map((header, index) => [header.normalizedName, row[index] ?? ""])
    )
  )
}

function isInteger(value: string) {
  return /^-?\d+$/.test(value)
}

function isNumber(value: string) {
  return /^-?\d+(?:\.\d+)?$/.test(value)
}

function isBoolean(value: string) {
  return /^(true|false|yes|no|y|n)$/i.test(value)
}

function isDateLike(value: string) {
  return !Number.isNaN(Date.parse(value))
}

export function inferColumnType(values: string[]): OnboardedColumnType {
  const nonEmpty = values.map((value) => value.trim()).filter(Boolean)
  if (!nonEmpty.length) {
    return "string"
  }

  const integerMatches = nonEmpty.filter(isInteger).length
  const numberMatches = nonEmpty.filter(isNumber).length
  const booleanMatches = nonEmpty.filter(isBoolean).length
  const dateMatches = nonEmpty.filter(isDateLike).length

  if (integerMatches === nonEmpty.length) {
    return "integer"
  }

  if (numberMatches === nonEmpty.length) {
    return "number"
  }

  if (booleanMatches === nonEmpty.length) {
    return "boolean"
  }

  if (dateMatches === nonEmpty.length) {
    return nonEmpty.some((value) => /t|\d{2}:\d{2}/i.test(value))
      ? "datetime"
      : "date"
  }

  return "string"
}

function toTypedValue(value: string, type: OnboardedColumnType) {
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  switch (type) {
    case "integer":
      return Number.parseInt(trimmed, 10)
    case "number":
      return Number.parseFloat(trimmed)
    case "boolean":
      return /^(true|yes|y)$/i.test(trimmed)
    case "date":
      return trimmed.slice(0, 10)
    case "datetime":
      return new Date(trimmed).toISOString()
    default:
      return trimmed
  }
}

function buildPreviewRows(
  headers: ReturnType<typeof normalizeHeaders>,
  rows: ParsedCsvRow[],
  columnTypes: Map<string, OnboardedColumnType>
): ResultTable {
  return {
    columns: headers.map((header) => header.normalizedName),
    rows: rows.slice(0, PREVIEW_ROW_LIMIT).map((row) =>
      Object.fromEntries(
        headers.map((header) => [
          header.normalizedName,
          toTypedValue(row[header.normalizedName] ?? "", columnTypes.get(header.normalizedName) ?? "string"),
        ])
      )
    ),
    totalRows: rows.length,
    truncated: rows.length > PREVIEW_ROW_LIMIT,
  }
}

function detectPrimaryTimeField(columns: CsvColumnProfile[]) {
  const scored = columns
    .filter((column) => column.isTimeField)
    .sort((left, right) => {
      const leftNamed = /(date|time|timestamp|day|week|month|year)/i.test(left.name)
      const rightNamed = /(date|time|timestamp|day|week|month|year)/i.test(right.name)
      if (leftNamed !== rightNamed) {
        return Number(rightNamed) - Number(leftNamed)
      }

      return left.nullRatio - right.nullRatio
    })

  return scored[0]?.normalizedName
}

function detectGrain(columns: CsvColumnProfile[], primaryTimeField?: string) {
  if (!primaryTimeField) {
    return "row_level"
  }

  const identifierColumn = columns.find((column) => column.isIdentifier)
  if (identifierColumn) {
    return `row_per_${identifierColumn.normalizedName}_per_${primaryTimeField}`
  }

  return `row_per_${primaryTimeField}`
}

function buildSupportedQuestions(
  metricColumns: CsvColumnProfile[],
  dimensionColumns: CsvColumnProfile[],
  primaryTimeField?: string
) {
  const firstMetric = metricColumns[0]
  const firstDimension = dimensionColumns[0]
  const questions = ["What data is currently stored?"]

  if (firstMetric) {
    questions.push(`What is the total ${firstMetric.label.toLowerCase()}?`)
    if (firstDimension) {
      questions.push(
        `Show ${firstMetric.label.toLowerCase()} by ${firstDimension.label.toLowerCase()}.`
      )
    }
    if (primaryTimeField) {
      questions.push(
        `Show the trend of ${firstMetric.label.toLowerCase()} over time.`
      )
    }
  }

  return questions
}

function buildHeuristicSemanticDraft(args: {
  datasetId: DatasetId
  label: string
  description: string
  columns: CsvColumnProfile[]
  rowCount: number
  primaryTimeField?: string
  startDate?: string
  endDate?: string
}): DatasetSemanticDraft {
  const dimensionColumns = args.columns.filter((column) => column.isDimension)
  const metricColumns = args.columns.filter((column) => column.isMeasure)
  const supportedQuestions = buildSupportedQuestions(
    metricColumns,
    dimensionColumns,
    args.primaryTimeField
  )

  return {
    datasetId: args.datasetId,
    datasetLabel: args.label,
    description: args.description,
    sourceMode: "database",
    timeCoverage:
      args.startDate && args.endDate
        ? `${args.startDate} to ${args.endDate}`
        : "No primary time field detected",
    dimensions: dimensionColumns.map((column) => ({
      id: column.normalizedName,
      label: column.label,
      columnId: column.normalizedName,
      synonyms: [column.name, column.label.toLowerCase()],
    })),
    metrics: metricColumns.map((column) => ({
      id: column.normalizedName,
      label: column.label,
      description: `Aggregated view of ${column.label.toLowerCase()}.`,
      supportedIntents: args.primaryTimeField
        ? ["aggregate", "trend", "discovery"]
        : ["aggregate", "discovery"],
      aggregation: "sum",
      columnId: column.normalizedName,
      synonyms: [column.name, column.label.toLowerCase()],
      exampleQuestions: supportedQuestions.filter((question) =>
        question.toLowerCase().includes(column.label.toLowerCase())
      ),
    })),
    sources: [
      {
        id: "postgres",
        label: "Onboarded CSV facts",
        type: "postgres",
        description: `${args.rowCount} uploaded CSV rows stored in QueryLens Postgres.`,
        recordCount: args.rowCount,
      },
      {
        id: "manifest",
        label: "Semantic draft",
        type: "manifest",
        description: "Generated from deterministic profiling with optional model refinement.",
        recordCount: 1,
      },
    ],
    notes: [
      "This draft was inferred automatically from the uploaded CSV and should be treated as a first-pass semantic contract.",
      args.primaryTimeField
        ? `Trend questions are limited to the detected primary time field "${args.primaryTimeField}".`
        : "No primary time field was detected, so trend questions are not enabled.",
    ],
  }
}

export async function refineSemanticDraft(args: {
  filename: string
  draft: DatasetSemanticDraft
  columns: CsvColumnProfile[]
}) {
  const config = getQueryLensAiConfig()
  const providerAvailable =
    config.reasoningProvider !== "deterministic" &&
    (config.reasoningProvider === "gemini"
      ? Boolean(config.apiKey)
      : Boolean(config.openrouterApiKey))

  if (!providerAvailable) {
    return args.draft
  }

  const request = {
    prompt: `
You are refining a semantic draft for QueryLens CSV onboarding.

Keep the shape conservative and trustworthy:
- do not invent columns
- do not introduce unsupported metrics
- preserve the existing ids
- improve labels, descriptions, synonyms, and example questions only
- prefer short, user-friendly wording

Filename: ${args.filename}

Columns:
${args.columns
  .map(
    (column) =>
      `- ${column.normalizedName} (${column.type}) label=${column.label} identifier=${column.isIdentifier} dimension=${column.isDimension} measure=${column.isMeasure} timeField=${column.isTimeField}`
  )
  .join("\n")}

Current draft:
${JSON.stringify(args.draft, null, 2)}
      `.trim(),
    responseJsonSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        datasetLabel: { type: "string" },
        description: { type: "string" },
        uncertaintyNotes: {
          type: "array",
          items: { type: "string" },
        },
        dimensions: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["id", "label", "synonyms"],
            properties: {
              id: { type: "string" },
              label: { type: "string" },
              synonyms: {
                type: "array",
                items: { type: "string" },
              },
            },
          },
        },
        metrics: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["id", "label", "synonyms", "exampleQuestions"],
            properties: {
              id: { type: "string" },
              label: { type: "string" },
              description: { type: "string" },
              synonyms: {
                type: "array",
                items: { type: "string" },
              },
              exampleQuestions: {
                type: "array",
                items: { type: "string" },
              },
            },
          },
        },
      },
    },
    schemaName: "querylens_csv_semantic_draft",
  } as const
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), SEMANTIC_REFINEMENT_TIMEOUT_MS)

  let result

  try {
    if (config.reasoningProvider === "openrouter") {
      let lastError: unknown

      for (let attempt = 0; attempt < OPENROUTER_REFINEMENT_MAX_ATTEMPTS; attempt += 1) {
        try {
          result = await generateStructuredData(
            {
              ...request,
              signal: controller.signal,
            },
            refinementSchema
          )
          lastError = undefined
          break
        } catch (error) {
          lastError = error

          if (isAbortError(error)) {
            return args.draft
          }

          if (
            !isReasoningProviderError(error) ||
            !error.retryable ||
            attempt === OPENROUTER_REFINEMENT_MAX_ATTEMPTS - 1
          ) {
            break
          }

          await wait(
            OPENROUTER_REFINEMENT_BACKOFF_MS[attempt] ??
              OPENROUTER_REFINEMENT_BACKOFF_MS.at(-1) ??
              1500
          )
        }
      }

      if (!result && lastError) {
        if (isReasoningProviderError(lastError)) {
          if (lastError.retryable) {
            return args.draft
          }

          throw new CsvImportError({
            message:
              lastError.status === 429
                ? "OpenRouter is temporarily rate-limiting semantic refinement. Please retry in a moment."
                : "OpenRouter could not refine the semantic draft right now.",
            code: mapReasoningProviderErrorToImportCode(lastError),
            retryable: lastError.retryable,
            provider: "openrouter",
            status: lastError.retryable ? 503 : 500,
          })
        }

        throw lastError
      }
    } else {
      result = await Promise.race([
        generateStructuredData(request, refinementSchema),
        new Promise<never>((_, reject) => {
          controller.signal.addEventListener(
            "abort",
            () => reject(new DOMException("Timed out", "AbortError")),
            { once: true }
          )
        }),
      ])
    }
  } catch (error) {
    if (isAbortError(error)) {
      return args.draft
    }

    throw error
  } finally {
    clearTimeout(timeoutId)
  }

  if (!result || !result.data) {
    return args.draft
  }

  const refinedDraft = result.data
  const refinedDimensions = refinedDraft.dimensions ?? []
  const refinedMetrics = refinedDraft.metrics ?? []
  const refinedUncertaintyNotes = refinedDraft.uncertaintyNotes ?? []

  return {
    ...args.draft,
    datasetLabel: refinedDraft.datasetLabel ?? args.draft.datasetLabel,
    description: refinedDraft.description ?? args.draft.description,
    dimensions: args.draft.dimensions.map((dimension) => {
      const refined = refinedDimensions.find((candidate) => candidate.id === dimension.id)
      return refined
        ? {
            ...dimension,
            label: refined.label,
            synonyms: refined.synonyms,
          }
        : dimension
    }),
    metrics: args.draft.metrics.map((metric) => {
      const refined = refinedMetrics.find((candidate) => candidate.id === metric.id)
      return refined
        ? {
            ...metric,
            label: refined.label,
            description: refined.description ?? metric.description,
            synonyms: refined.synonyms,
            exampleQuestions: refined.exampleQuestions,
          }
        : metric
    }),
    notes: [
      ...args.draft.notes,
      ...refinedUncertaintyNotes,
    ],
  }
}

export function buildColumnProfiles(headers: ReturnType<typeof normalizeHeaders>, rows: ParsedCsvRow[]) {
  return headers.map((header) => {
    const values = rows.map((row) => row[header.normalizedName] ?? "")
    const nonEmptyValues = values.map((value) => value.trim()).filter(Boolean)
    const type = inferColumnType(values)
    const distinctCount = new Set(nonEmptyValues).size
    const nullRatio = values.length === 0 ? 0 : (values.length - nonEmptyValues.length) / values.length
    const nameLooksId = /\b(id|uuid|key)\b/i.test(header.originalName)
    const isIdentifier =
      nameLooksId ||
      ((type === "string" || type === "integer") &&
        distinctCount > 0 &&
        distinctCount >= Math.max(2, rows.length * 0.9))
    const isTimeField = type === "date" || type === "datetime"
    const isMeasure = (type === "integer" || type === "number") && !isIdentifier
    const isDimension =
      !isMeasure &&
      !isTimeField &&
      (type === "string" || type === "boolean" || isIdentifier)

    return {
      name: header.originalName,
      normalizedName: header.normalizedName,
      label: header.label,
      type,
      nullRatio: Number(nullRatio.toFixed(4)),
      distinctCount,
      sampleValues: Array.from(new Set(nonEmptyValues)).slice(0, 5),
      isIdentifier,
      isDimension,
      isMeasure,
      isTimeField,
    } satisfies CsvColumnProfile
  })
}

function resolveSqlType(type: OnboardedColumnType) {
  switch (type) {
    case "integer":
      return "BIGINT"
    case "number":
      return "DOUBLE PRECISION"
    case "boolean":
      return "BOOLEAN"
    case "date":
      return "DATE"
    case "datetime":
      return "TIMESTAMPTZ"
    default:
      return "TEXT"
  }
}

async function createPhysicalTable(args: {
  tableName: string
  columns: CsvColumnProfile[]
  rows: ParsedCsvRow[]
}) {
  const pool = getPgPool()
  const columnSql = args.columns
    .map((column) => `${quoteIdentifier(column.normalizedName)} ${resolveSqlType(column.type)}`)
    .join(", ")

  await pool.query(`CREATE TABLE ${quoteIdentifier(args.tableName)} (${columnSql})`)

  const columnNames = args.columns.map((column) => quoteIdentifier(column.normalizedName)).join(", ")
  const chunkSize = 250

  for (let offset = 0; offset < args.rows.length; offset += chunkSize) {
    const chunk = args.rows.slice(offset, offset + chunkSize)
    const values: unknown[] = []
    const placeholders = chunk
      .map((row, rowIndex) => {
        const rowPlaceholders = args.columns.map((column, columnIndex) => {
          values.push(toTypedValue(row[column.normalizedName] ?? "", column.type))
          return `$${rowIndex * args.columns.length + columnIndex + 1}`
        })
        return `(${rowPlaceholders.join(", ")})`
      })
      .join(", ")

    await pool.query(
      `INSERT INTO ${quoteIdentifier(args.tableName)} (${columnNames}) VALUES ${placeholders}`,
      values
    )
  }
}

async function dropPhysicalTable(tableName: string) {
  const pool = getPgPool()
  await pool.query(`DROP TABLE IF EXISTS ${quoteIdentifier(tableName)}`)
}

export async function importCsvDataset(args: {
  filename: string
  bytes: Uint8Array
}): Promise<OnboardedDatasetRecord> {
  if (args.bytes.byteLength > MAX_FILE_BYTES) {
    throw new Error("CSV upload exceeds the 25 MB size limit.")
  }

  const text = new TextDecoder("utf-8", { fatal: true }).decode(args.bytes)
  const csvRows = parseCsv(text)
  if (csvRows.length < 2) {
    throw new Error("CSV must include a header row and at least one data row.")
  }

  const [rawHeaders, ...rawDataRows] = csvRows
  if (rawHeaders.length > MAX_COLUMNS) {
    throw new Error("CSV exceeds the 200 column limit.")
  }
  if (rawDataRows.length > MAX_ROWS) {
    throw new Error("CSV exceeds the 100000 row limit.")
  }

  const headers = normalizeHeaders(rawHeaders)
  const rows = toRecordRows(rawDataRows, headers)
  const columns = buildColumnProfiles(headers, rows)
  const primaryTimeField = detectPrimaryTimeField(columns)
  const grain = detectGrain(columns, primaryTimeField)
  const datasetLabel = titleize(
    args.filename.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9]+/g, " ")
  ) || "Uploaded dataset"
  const datasetId = buildDatasetId(datasetLabel)
  const tableName = buildTableName(datasetId)
  const columnTypes = new Map(columns.map((column) => [column.normalizedName, column.type]))

  await createPhysicalTable({
    tableName,
    columns,
    rows,
  })

  try {
    let startDate: string | undefined
    let endDate: string | undefined
    if (primaryTimeField) {
      const sortedDates = rows
        .map((row) => row[primaryTimeField] ?? "")
        .filter(Boolean)
        .map((value) => new Date(value).toISOString().slice(0, 10))
        .sort()

      startDate = sortedDates[0]
      endDate = sortedDates.at(-1)
    }

    const draft = await refineSemanticDraft({
      filename: args.filename,
      draft: buildHeuristicSemanticDraft({
        datasetId,
        label: datasetLabel,
        description: `${datasetLabel} imported from CSV onboarding.`,
        columns,
        rowCount: rows.length,
        primaryTimeField,
        startDate,
        endDate,
      }),
      columns,
    })

    const previewRows = buildPreviewRows(headers, rows, columnTypes)
    const profileSnapshot = buildOnboardedProfileSnapshot({
      datasetId,
      label: draft.datasetLabel,
      description: draft.description,
      rowCount: rows.length,
      startDate,
      endDate,
      primaryTimeField,
    })

    await saveOnboardedDataset({
      id: datasetId,
      label: draft.datasetLabel,
      description: draft.description,
      tableName,
      rowCount: rows.length,
      primaryTimeField,
      grain,
      semanticDraft: {
        ...draft,
        datasetId,
      },
      profileSnapshot,
      columns,
      previewRows,
    })

    const stored = await getOnboardedDatasetRecord(datasetId)
    if (!stored) {
      throw new Error("QueryLens could not load the imported dataset after saving it.")
    }

    return stored
  } catch (error) {
    await dropPhysicalTable(tableName).catch((cleanupError) => {
      console.error("QueryLens could not clean up a failed CSV import table.", cleanupError)
    })

    throw error
  }
}
