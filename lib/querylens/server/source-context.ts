import { getQueryLensDataAccess } from "@/lib/querylens/server/repositories"
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

  const tableRows = rows.slice(0, 6).map((row) => ({
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
    truncated: rows.length > tableRows.length,
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

  const tableRows = rows.slice(0, 6).map((row) => ({
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
    truncated: rows.length > tableRows.length,
  }
}

export async function getSourceContextPayload(): Promise<SourceContextPayload> {
  const dataAccess = await getQueryLensDataAccess()

  const [sourceHealth, schema, coverage, weeklyMetrics] = await Promise.all([
    dataAccess.getSourceHealth(),
    dataAccess.getAgenticSchemaSnapshot(),
    dataAccess.getDateCoverage(),
    dataAccess.listWeeklyMetrics(),
  ])

  const contextEvents = await dataAccess.listContextEvents({
    targetStart: coverage.startDate,
    targetEnd: coverage.endDate,
    scope: {},
  })

  const postgresPrimaryObjects = schema.postgres
    .map((table) => table.name)
    .slice(0, 3)
    .join(", ")

  const mongoPrimaryObjects = schema.mongodb
    .map((collection) => collection.name)
    .join(", ")

  return {
    sourceMode: dataAccess.sourceMode,
    sourceHealth,
    summaries: [
      {
        title: "What data is present",
        description: `QueryLens has ${schema.postgres.length} PostgreSQL tables and ${schema.mongodb.length} MongoDB collections available for analysis.`,
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
    postgresSchema: schema.postgres,
    mongoSchema: schema.mongodb,
    postgresPreview: buildPostgresPreview(weeklyMetrics),
    mongoPreview: buildMongoPreview(contextEvents),
  }
}
