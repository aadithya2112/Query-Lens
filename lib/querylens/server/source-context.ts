import { getQueryLensDatasetRuntime } from "@/lib/querylens/server/dataset-runtime"
import type { AgenticSchemaObject } from "@/lib/querylens/server/agentic-types"
import type {
  ContextEvent,
  ResultTable,
  SourceHealth,
  WeeklyMetricRow,
} from "@/lib/querylens/types"

interface SourceSummary {
  title: string
  description: string
}

export interface SourceContextPayload {
  sourceMode: "database" | "fixture"
  sourceHealth: SourceHealth[]
  summaries: SourceSummary[]
  postgresSchema: AgenticSchemaObject[]
  mongoSchema: AgenticSchemaObject[]
  postgresPreview: ResultTable
  mongoPreview: ResultTable
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

export async function getSourceContextPayload(): Promise<SourceContextPayload> {
  const { dataAccess, profileStore } = await getQueryLensDatasetRuntime()
  const profileSnapshot = await profileStore.getProfileSnapshot()

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

  return {
    sourceMode: dataAccess.sourceMode,
    sourceHealth: profileSnapshot.sourceHealth,
    summaries: [
      {
        title: "What data is present",
        description: `QueryLens has ${profileSnapshot.schemaSnapshot.postgres.length} PostgreSQL tables and ${profileSnapshot.schemaSnapshot.mongodb.length} MongoDB collections available for analysis.`,
      },
      {
        title: "How data is used",
        description: `Weekly risk and cashflow metrics are computed from ${postgresPrimaryObjects}, then corroborated with contextual signals from ${mongoPrimaryObjects}.`,
      },
      {
        title: "Execution mode",
        description:
          dataAccess.sourceMode === "database"
            ? "This workspace is reading from live docker-backed databases in read-only mode."
            : "This workspace is running against the built-in fixture dataset with the same schema shape.",
      },
    ],
    postgresSchema: profileSnapshot.schemaSnapshot.postgres,
    mongoSchema: profileSnapshot.schemaSnapshot.mongodb,
    postgresPreview: buildPostgresPreview(weeklyMetrics),
    mongoPreview: buildMongoPreview(contextEvents),
  }
}
