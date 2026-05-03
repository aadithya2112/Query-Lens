import { isBuiltInDatasetId } from "@/lib/querylens/datasets"
import {
  getOnboardedDatasetRecord,
  listOnboardedDatasetRecords,
} from "@/lib/querylens/server/dataset-registry"
import { getQueryLensDatasetRuntime } from "@/lib/querylens/server/dataset-runtime"
import type { AgenticSchemaObject } from "@/lib/querylens/server/agentic-types"
import type {
  ContextEvent,
  OnboardedDatasetRecord,
  ResultTable,
  SourceHealth,
  WeeklyMetricRow,
} from "@/lib/querylens/types"

interface SourceSummary {
  title: string
  description: string
}

export interface SourceContextConnectedUpload {
  id: string
  label: string
  status: "draft" | "active"
  rowCount: number
  tableName: string
  columns: string[]
  previewRows: ResultTable
}

export interface SourceContextPayload {
  kind: "built_in" | "onboarded" | "missing"
  datasetId: string
  datasetLabel: string
  sourceMode: "database"
  sourceHealth: SourceHealth[]
  summaries: SourceSummary[]
  postgresSchema: AgenticSchemaObject[]
  mongoSchema: AgenticSchemaObject[]
  postgresPreview: ResultTable
  mongoPreview: ResultTable
  connectedUploads: SourceContextConnectedUpload[]
}

function buildPostgresPreview(rows: WeeklyMetricRow[]): ResultTable {
  const columns = [
    "weekStart",
    "recordType",
    "regionName",
    "sectorName",
    "cashflowHealthScore",
    "accountCount",
  ]

  const tableRows = rows.map((row) => ({
    weekStart: row.weekStart,
    recordType: row.recordType,
    regionName: row.regionName,
    sectorName: row.sectorName,
    cashflowHealthScore: Number(row.cashflowHealthScore.toFixed(2)),
    accountCount: row.accountCount,
  }))

  return {
    columns,
    rows: tableRows,
    totalRows: rows.length,
    truncated: false,
  }
}

function buildMongoPreview(rows: ContextEvent[]): ResultTable {
  const columns = [
    "collection",
    "occurredAt",
    "severity",
    "regionName",
    "sectorName",
    "summary",
  ]

  const tableRows = rows.map((row) => ({
    collection: row.collection,
    occurredAt: row.occurredAt,
    severity: row.severity,
    regionName: row.regionName,
    sectorName: row.sectorName,
    summary: row.summary,
  }))

  return {
    columns,
    rows: tableRows,
    totalRows: rows.length,
    truncated: false,
  }
}

function buildEmptyPreview(): ResultTable {
  return {
    columns: ["message"],
    rows: [],
    totalRows: 0,
    truncated: false,
  }
}

function buildMissingSourceContextPayload(datasetId: string): SourceContextPayload {
  return {
    kind: "missing",
    datasetId,
    datasetLabel: "Dataset unavailable",
    sourceMode: "database",
    sourceHealth: [],
    summaries: [
      {
        title: "Dataset not found",
        description:
          "QueryLens could not find an uploaded CSV dataset with this id for the current signed-in user.",
      },
      {
        title: "What to do next",
        description:
          "Return to onboarding to import the CSV again, or open the workspace and choose one of your available datasets.",
      },
      {
        title: "Requested dataset id",
        description: datasetId,
      },
    ],
    postgresSchema: [],
    mongoSchema: [],
    postgresPreview: buildEmptyPreview(),
    mongoPreview: buildEmptyPreview(),
    connectedUploads: [],
  }
}

function buildConnectedUpload(dataset: OnboardedDatasetRecord): SourceContextConnectedUpload {
  return {
    id: dataset.id,
    label: dataset.label,
    status: dataset.status,
    rowCount: dataset.rowCount,
    tableName: dataset.tableName,
    columns: dataset.columns.map((column) => column.normalizedName),
    previewRows: dataset.previewRows,
  }
}

function buildConnectedUploadSourceHealth(
  dataset: SourceContextConnectedUpload,
): SourceHealth {
  return {
    id: `upload:${dataset.id}`,
    name: dataset.label,
    type: "csv",
    status: dataset.status === "active" ? "connected" : "draft",
    detail: `${dataset.rowCount.toLocaleString()} imported rows available from uploaded CSV context.`,
    recordCount: dataset.rowCount,
  }
}

export async function getSourceContextPayload(
  datasetId?: string,
): Promise<SourceContextPayload> {
  if (datasetId && !isBuiltInDatasetId(datasetId)) {
    const dataset = await getOnboardedDatasetRecord(datasetId)

    if (dataset) {
      return {
        kind: "onboarded",
        datasetId: dataset.id,
        datasetLabel: dataset.label,
        sourceMode: "database",
        sourceHealth: dataset.profileSnapshot?.sourceHealth ?? [
          {
            id: "postgres",
            name: "Onboarded CSV facts",
            type: "postgres",
            status: dataset.status === "active" ? "connected" : "draft",
            detail: `${dataset.rowCount} imported rows`,
            recordCount: dataset.rowCount,
          },
        ],
        summaries: [
          {
            title: "What data is present",
            description: `${dataset.label} is stored as a user-scoped uploaded CSV with ${dataset.columns.length} detected columns and ${dataset.rowCount.toLocaleString()} imported rows.`,
          },
          {
            title: "How data is used",
            description: "QueryLens reads the uploaded Postgres table directly, then uses the saved semantic draft to support deterministic discovery, aggregate, grouped-summary, and trend questions.",
          },
          {
            title: "Execution mode",
            description:
              "This workspace is reading from the uploaded CSV table stored in QueryLens Postgres. No MongoDB corroboration is attached to this dataset yet.",
          },
        ],
        postgresSchema: [
          {
            name: dataset.tableName,
            description: `Imported CSV rows for ${dataset.label}.`,
            columns: dataset.columns.map((column) => column.normalizedName),
            rowCount: dataset.rowCount,
          },
        ],
        mongoSchema: [],
        postgresPreview: dataset.previewRows,
        mongoPreview: buildEmptyPreview(),
        connectedUploads: [],
      }
    }

    return buildMissingSourceContextPayload(datasetId)
  }

  const { dataAccess, profileStore } = await getQueryLensDatasetRuntime()
  const profileSnapshot = await profileStore.getProfileSnapshot()
  const uploadedDatasets = await listOnboardedDatasetRecords()

  const [weeklyMetrics] = await Promise.all([dataAccess.listWeeklyMetrics()])

  const contextEvents = await dataAccess.listContextEvents({
    targetStart: profileSnapshot.dateCoverage.startDate,
    targetEnd: profileSnapshot.dateCoverage.endDate,
    scope: {},
  })

  const postgresPrimaryObjects = profileSnapshot.schemaSnapshot.postgres
    .map((table) => table.name)
    .slice(0, 3)
    .join(", ")

  const mongoPrimaryObjects = profileSnapshot.schemaSnapshot.mongodb
    .map((collection) => collection.name)
    .join(", ")

  const connectedUploads = uploadedDatasets.map(buildConnectedUpload)
  const uploadCount = connectedUploads.length
  const uploadSummary =
    uploadCount > 0
      ? ` This user also has ${uploadCount} uploaded CSV ${uploadCount === 1 ? "dataset" : "datasets"} connected for chat context.`
      : ""

  return {
    kind: "built_in",
    datasetId: profileSnapshot.datasetId,
    datasetLabel: profileSnapshot.datasetLabel ?? "SME portfolio",
    sourceMode: dataAccess.sourceMode,
    summaries: [
      {
        title: "What data is present",
        description: `QueryLens has ${profileSnapshot.schemaSnapshot.postgres.length} PostgreSQL tables and ${profileSnapshot.schemaSnapshot.mongodb.length} MongoDB collections available for analysis.${uploadSummary}`,
      },
      {
        title: "How data is used",
        description: `Weekly risk and cashflow metrics are computed from ${postgresPrimaryObjects}, then corroborated with contextual signals from ${mongoPrimaryObjects}.`,
      },
      {
        title: "Execution mode",
        description:
          uploadCount > 0
            ? "This workspace is reading from live docker-backed databases in read-only mode, alongside user-uploaded CSV datasets that are available as additional context across chats."
            : "This workspace is reading from live docker-backed databases in read-only mode.",
      },
    ],
    sourceHealth: [
      ...profileSnapshot.sourceHealth,
      ...connectedUploads.map(buildConnectedUploadSourceHealth),
    ],
    postgresSchema: [
      ...profileSnapshot.schemaSnapshot.postgres,
      ...connectedUploads.map((dataset) => ({
        name: dataset.tableName,
        description: `Uploaded CSV rows for ${dataset.label}.`,
        columns: dataset.columns,
        rowCount: dataset.rowCount,
      })),
    ],
    mongoSchema: profileSnapshot.schemaSnapshot.mongodb,
    postgresPreview: buildPostgresPreview(weeklyMetrics),
    mongoPreview: buildMongoPreview(contextEvents),
    connectedUploads,
  }
}
