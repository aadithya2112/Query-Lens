import { getPgPool } from "@/lib/querylens/server/runtime-shared"
import type {
  CsvColumnProfile,
  DatasetDefinition,
  DatasetId,
  DatasetListItem,
  DatasetProfileSnapshot,
  DatasetSemanticDraft,
  MetricDefinition,
  OnboardedDatasetRecord,
  QueryLensSourceMode,
  ResultTable,
  SourceHealth,
} from "@/lib/querylens/types"

const DATASET_MANIFEST_VERSION = 1

interface DatasetRow {
  id: string
  label: string
  description: string
  status: "draft" | "active"
  source_kind: "csv"
  table_name: string
  row_count: number | string
  primary_time_field: string | null
  grain: string
  manifest_version: number | string
  semantic_draft_json: DatasetSemanticDraft
  profile_snapshot_json: DatasetProfileSnapshot
  preview_rows_json: ResultTable
  created_at: Date | string
  updated_at: Date | string
}

interface ColumnRow {
  dataset_id: string
  column_name: string
  normalized_name: string
  label: string
  data_type: CsvColumnProfile["type"]
  null_ratio: number | string
  distinct_count: number | string
  sample_values_json: CsvColumnProfile["sampleValues"]
  is_identifier: boolean
  is_dimension: boolean
  is_measure: boolean
  is_time_field: boolean
}

let datasetTablesReady: Promise<void> | undefined

function toIsoString(value: Date | string) {
  return typeof value === "string" ? value : value.toISOString()
}

function buildBuiltInDatasetListItem(): DatasetListItem {
  return {
    id: "sme_portfolio",
    label: "SME portfolio",
    description: "Database-backed SME portfolio dataset for the flagship QueryLens flows.",
    status: "built_in",
    sourceKind: "built_in",
    sourceMode: "database",
  }
}

function buildOnboardedMetricDefinition(
  metric: DatasetSemanticDraft["metrics"][number],
  _dimensions: DatasetSemanticDraft["dimensions"]
): MetricDefinition {
  return {
    id: metric.id,
    label: metric.label,
    description:
      metric.description ??
      `Derived aggregate metric for ${metric.label.toLowerCase()}.`,
    scale: "numeric",
    supportedIntents: metric.supportedIntents,
    supportedDimensions: ["portfolio"],
    supportedTimeframes: ["custom"],
    synonyms: metric.synonyms ?? [],
    exampleQuestions: metric.exampleQuestions ?? [],
  }
}

export function buildOnboardedDatasetDefinition(
  record: OnboardedDatasetRecord
): DatasetDefinition {
  return {
    id: record.id,
    label: record.label,
    description: record.description,
    dimensions: [
      "portfolio",
    ],
    metrics: record.semanticDraft.metrics.map((metric) =>
      buildOnboardedMetricDefinition(metric, record.semanticDraft.dimensions)
    ),
    supportedIntentIds: ["discovery", "aggregate", "trend"],
    supportedTimeframes: ["custom"],
  }
}

export async function ensureDatasetRegistryTables() {
  if (datasetTablesReady) {
    return datasetTablesReady
  }

  datasetTablesReady = (async () => {
    const pool = getPgPool()
    await pool.query(`
      CREATE TABLE IF NOT EXISTS querylens_datasets (
        id TEXT PRIMARY KEY,
        label TEXT NOT NULL,
        description TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('draft', 'active')),
        source_kind TEXT NOT NULL CHECK (source_kind IN ('csv')),
        table_name TEXT NOT NULL,
        row_count INTEGER NOT NULL,
        primary_time_field TEXT,
        grain TEXT NOT NULL,
        manifest_version INTEGER NOT NULL,
        semantic_draft_json JSONB NOT NULL,
        profile_snapshot_json JSONB NOT NULL,
        preview_rows_json JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS querylens_dataset_columns (
        dataset_id TEXT NOT NULL REFERENCES querylens_datasets(id) ON DELETE CASCADE,
        column_name TEXT NOT NULL,
        normalized_name TEXT NOT NULL,
        label TEXT NOT NULL,
        data_type TEXT NOT NULL,
        null_ratio DOUBLE PRECISION NOT NULL,
        distinct_count INTEGER NOT NULL,
        sample_values_json JSONB NOT NULL,
        is_identifier BOOLEAN NOT NULL,
        is_dimension BOOLEAN NOT NULL,
        is_measure BOOLEAN NOT NULL,
        is_time_field BOOLEAN NOT NULL,
        ordinal_position INTEGER NOT NULL,
        PRIMARY KEY (dataset_id, column_name)
      )
    `)
  })()

  return datasetTablesReady
}

function mapColumnRow(row: ColumnRow): CsvColumnProfile {
  return {
    name: row.column_name,
    normalizedName: row.normalized_name,
    label: row.label,
    type: row.data_type,
    nullRatio: Number(row.null_ratio),
    distinctCount: Number(row.distinct_count),
    sampleValues: row.sample_values_json,
    isIdentifier: row.is_identifier,
    isDimension: row.is_dimension,
    isMeasure: row.is_measure,
    isTimeField: row.is_time_field,
  }
}

function mapDatasetRow(row: DatasetRow, columns: CsvColumnProfile[]): OnboardedDatasetRecord {
  return {
    id: row.id,
    label: row.label,
    description: row.description,
    status: row.status,
    sourceKind: "csv",
    sourceMode: "database",
    tableName: row.table_name,
    rowCount: Number(row.row_count),
    primaryTimeField: row.primary_time_field ?? undefined,
    grain: row.grain,
    manifestVersion: Number(row.manifest_version),
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
    semanticDraft: row.semantic_draft_json,
    columns,
    previewRows: row.preview_rows_json,
  }
}

export async function listRegisteredDatasets(): Promise<DatasetListItem[]> {
  await ensureDatasetRegistryTables()
  const pool = getPgPool()
  const result = await pool.query<Pick<DatasetRow, "id" | "label" | "description" | "status">>(`
    SELECT id, label, description, status
    FROM querylens_datasets
    ORDER BY created_at DESC
  `)

  return [
    buildBuiltInDatasetListItem(),
    ...result.rows.map((row) => ({
      id: row.id,
      label: row.label,
      description: row.description,
      status: row.status,
      sourceKind: "csv" as const,
      sourceMode: "database" as QueryLensSourceMode,
    })),
  ]
}

export async function getOnboardedDatasetRecord(
  datasetId: DatasetId
): Promise<OnboardedDatasetRecord | undefined> {
  await ensureDatasetRegistryTables()
  const pool = getPgPool()
  const [datasetResult, columnResult] = await Promise.all([
    pool.query<DatasetRow>(
      `
        SELECT *
        FROM querylens_datasets
        WHERE id = $1
      `,
      [datasetId]
    ),
    pool.query<ColumnRow>(
      `
        SELECT *
        FROM querylens_dataset_columns
        WHERE dataset_id = $1
        ORDER BY ordinal_position ASC
      `,
      [datasetId]
    ),
  ])

  const datasetRow = datasetResult.rows[0]
  if (!datasetRow) {
    return undefined
  }

  return mapDatasetRow(
    datasetRow,
    columnResult.rows.map(mapColumnRow)
  )
}

export async function activateOnboardedDataset(datasetId: DatasetId) {
  await ensureDatasetRegistryTables()
  const pool = getPgPool()
  await pool.query(
    `
      UPDATE querylens_datasets
      SET status = 'active',
          updated_at = NOW()
      WHERE id = $1
    `,
    [datasetId]
  )
}

export async function saveOnboardedDataset(args: {
  id: DatasetId
  label: string
  description: string
  tableName: string
  rowCount: number
  primaryTimeField?: string
  grain: string
  semanticDraft: DatasetSemanticDraft
  profileSnapshot: DatasetProfileSnapshot
  columns: CsvColumnProfile[]
  previewRows: ResultTable
}) {
  await ensureDatasetRegistryTables()
  const pool = getPgPool()

  await pool.query("BEGIN")
  try {
    await pool.query(
      `
        INSERT INTO querylens_datasets (
          id,
          label,
          description,
          status,
          source_kind,
          table_name,
          row_count,
          primary_time_field,
          grain,
          manifest_version,
          semantic_draft_json,
          profile_snapshot_json,
          preview_rows_json
        ) VALUES (
          $1, $2, $3, 'draft', 'csv', $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11::jsonb
        )
      `,
      [
        args.id,
        args.label,
        args.description,
        args.tableName,
        args.rowCount,
        args.primaryTimeField ?? null,
        args.grain,
        DATASET_MANIFEST_VERSION,
        JSON.stringify(args.semanticDraft),
        JSON.stringify(args.profileSnapshot),
        JSON.stringify(args.previewRows),
      ]
    )

    for (const [index, column] of args.columns.entries()) {
      await pool.query(
        `
          INSERT INTO querylens_dataset_columns (
            dataset_id,
            column_name,
            normalized_name,
            label,
            data_type,
            null_ratio,
            distinct_count,
            sample_values_json,
            is_identifier,
            is_dimension,
            is_measure,
            is_time_field,
            ordinal_position
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11, $12, $13
          )
        `,
        [
          args.id,
          column.name,
          column.normalizedName,
          column.label,
          column.type,
          column.nullRatio,
          column.distinctCount,
          JSON.stringify(column.sampleValues),
          column.isIdentifier,
          column.isDimension,
          column.isMeasure,
          column.isTimeField,
          index,
        ]
      )
    }

    await pool.query("COMMIT")
  } catch (error) {
    await pool.query("ROLLBACK")
    throw error
  }
}

export function buildOnboardedProfileSnapshot(args: {
  datasetId: DatasetId
  label: string
  description: string
  rowCount: number
  startDate?: string
  endDate?: string
  primaryTimeField?: string
}): DatasetProfileSnapshot {
  const sourceHealth: SourceHealth[] = [
    {
      id: "postgres",
      name: "Onboarded CSV facts",
      type: "postgres",
      status: "draft",
      detail: `${args.rowCount} imported rows stored in QueryLens Postgres`,
      recordCount: args.rowCount,
    },
    {
      id: "manifest",
      name: "Semantic draft",
      type: "manifest",
      status: "configured",
      detail: "Heuristic-first semantic draft generated during onboarding",
      recordCount: 1,
    },
  ]

  return {
    datasetId: args.datasetId,
    datasetLabel: args.label,
    datasetDescription: args.description,
    sourceMode: "database",
    dateCoverage: {
      startDate: args.startDate ?? "N/A",
      endDate: args.endDate ?? args.startDate ?? "N/A",
    },
    sourceHealth,
    schemaSnapshot: {
      postgres: [
        {
          name: "onboarded_dataset_rows",
          description: `Imported CSV rows for ${args.label}`,
          columns: [],
          rowCount: args.rowCount,
        },
      ],
      mongodb: [],
    },
    sourceCounts: sourceHealth.map((source) => ({
      sourceId: source.id,
      sourceLabel: source.name,
      recordCount: source.recordCount ?? 0,
    })),
  }
}
