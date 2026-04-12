import { MongoClient } from "mongodb"
import { Pool } from "pg"

import { getSampleDataset } from "@/lib/querylens/seed-data"
import type {
  AgenticQueryExecutionResult,
  AgenticSchemaSnapshot,
} from "@/lib/querylens/server/agentic-types"
import type {
  ContextCollection,
  ContextEvent,
  DailyAccountMetric,
  ScopeFilter,
  SourceHealth,
  WeeklyAccountStressRow,
  WeeklyMetricRow,
} from "@/lib/querylens/types"

export interface QueryLensDataAccess {
  sourceMode: "database" | "fixture"
  listWeeklyMetrics(): Promise<WeeklyMetricRow[]>
  listDailyMetrics(args: {
    startDate: string
    endDate: string
    scope: ScopeFilter
  }): Promise<DailyAccountMetric[]>
  listWeeklyAccountStress(args: {
    targetStart: string
    scope: ScopeFilter
  }): Promise<WeeklyAccountStressRow[]>
  listContextEvents(args: {
    targetStart: string
    targetEnd: string
    scope: ScopeFilter
  }): Promise<ContextEvent[]>
  getDateCoverage(): Promise<{
    startDate: string
    endDate: string
  }>
  getSourceHealth(): Promise<SourceHealth[]>
  getAgenticSchemaSnapshot(): Promise<AgenticSchemaSnapshot>
  executeReadOnlySql(args: {
    statement: string
    maxRows: number
  }): Promise<AgenticQueryExecutionResult>
  executeReadOnlyMongoPipeline(args: {
    collection: ContextCollection
    pipeline: Record<string, unknown>[]
    maxRows: number
  }): Promise<AgenticQueryExecutionResult>
}

declare global {
  var __querylensPgPool: Pool | undefined
  var __querylensMongoClientPromise: Promise<MongoClient> | undefined
}

const CONTEXT_COLLECTIONS: ContextCollection[] = [
  "complaints",
  "service_incidents",
  "risk_alerts",
  "rm_notes",
]

const AGENTIC_POSTGRES_TABLES = [
  {
    name: "regions",
    description: "Reference table of supported SME regions.",
    columns: ["id", "name"],
  },
  {
    name: "sectors",
    description: "Reference table of supported SME sectors.",
    columns: ["id", "name"],
  },
  {
    name: "accounts",
    description: "Account master data with region, sector, segment, and baseline thresholds.",
    columns: [
      "id",
      "business_name",
      "region_id",
      "sector_id",
      "segment",
      "low_balance_threshold",
      "base_daily_inbound",
      "base_daily_outbound",
      "base_balance",
      "base_utilization",
    ],
  },
  {
    name: "daily_account_metrics",
    description: "Daily account facts including balances, payments, utilization, and stress flags.",
    columns: [
      "account_id",
      "date",
      "week_start",
      "region_id",
      "sector_id",
      "inbound_payments",
      "outbound_payments",
      "end_balance",
      "loan_utilization",
      "low_balance_flag",
      "overdue_flag",
    ],
  },
  {
    name: "weekly_portfolio_metrics",
    description: "Weekly portfolio, region, sector, and region-sector aggregates with cashflow health components.",
    columns: [
      "week_start",
      "week_end",
      "record_type",
      "region_id",
      "sector_id",
      "region_name",
      "sector_name",
      "account_count",
      "inbound_payments",
      "outbound_payments",
      "opening_balance",
      "closing_balance",
      "low_balance_share",
      "overdue_share",
      "avg_utilization",
      "inflow_outflow_score",
      "balance_trend_score",
      "low_balance_score",
      "overdue_score",
      "cashflow_health_score",
    ],
  },
] as const

const AGENTIC_MONGO_COLLECTIONS = [
  {
    name: "complaints",
    description: "Customer complaint events tied to regions, sectors, and severity.",
    columns: [
      "id",
      "occurredAt",
      "weekStart",
      "regionId",
      "sectorId",
      "regionName",
      "sectorName",
      "severity",
      "summary",
      "detail",
    ],
  },
  {
    name: "service_incidents",
    description: "Operational incidents that can corroborate payment disruption or service stress.",
    columns: [
      "id",
      "occurredAt",
      "weekStart",
      "regionId",
      "sectorId",
      "regionName",
      "sectorName",
      "severity",
      "summary",
      "detail",
    ],
  },
  {
    name: "risk_alerts",
    description: "Risk alerts that provide contextual signals around exposure changes.",
    columns: [
      "id",
      "occurredAt",
      "weekStart",
      "regionId",
      "sectorId",
      "regionName",
      "sectorName",
      "severity",
      "summary",
      "detail",
    ],
  },
  {
    name: "rm_notes",
    description: "Relationship-manager notes used as qualitative corroborating context.",
    columns: [
      "id",
      "occurredAt",
      "weekStart",
      "regionId",
      "sectorId",
      "regionName",
      "sectorName",
      "severity",
      "summary",
      "detail",
    ],
  },
] as const

interface WeeklyMetricDbRow {
  week_start: string | Date
  week_end: string | Date
  record_type: WeeklyMetricRow["recordType"]
  region_id: string | null
  sector_id: string | null
  region_name: string | null
  sector_name: string | null
  account_count: number | string
  inbound_payments: number | string
  outbound_payments: number | string
  opening_balance: number | string
  closing_balance: number | string
  low_balance_share: number | string
  overdue_share: number | string
  avg_utilization: number | string
  inflow_outflow_score: number | string
  balance_trend_score: number | string
  low_balance_score: number | string
  overdue_score: number | string
  cashflow_health_score: number | string
}

interface CountRow {
  count: number | string
}

interface CoverageRow {
  min_date: string | Date
  max_date: string | Date
}

interface WeeklyAccountStressDbRow {
  week_start: string | Date
  account_id: string
  region_id: string
  sector_id: string
  region_name: string
  sector_name: string
  low_balance_days: number | string
  has_overdue: boolean
}

interface DailyMetricDbRow {
  account_id: string
  date: string | Date
  week_start: string | Date
  region_id: string
  sector_id: string
  inbound_payments: number | string
  outbound_payments: number | string
  end_balance: number | string
  loan_utilization: number | string
  low_balance_flag: boolean
  overdue_flag: boolean
}

function sortContextEvents(left: ContextEvent, right: ContextEvent) {
  const severityOrder = { high: 0, medium: 1, low: 2 }
  const severitySort = severityOrder[left.severity] - severityOrder[right.severity]
  if (severitySort !== 0) return severitySort
  return left.occurredAt.localeCompare(right.occurredAt)
}

function normalizeDateValue(value: string | Date) {
  if (typeof value === "string") {
    return value.slice(0, 10)
  }

  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, "0")
  const day = String(value.getDate()).padStart(2, "0")

  return `${year}-${month}-${day}`
}

function serializeQueryValue(value: unknown): string | number | boolean | null {
  if (value === null || value === undefined) {
    return null
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value
  }

  if (typeof value === "bigint") {
    return value.toString()
  }

  if (value instanceof Date) {
    return value.toISOString()
  }

  if (Array.isArray(value)) {
    return JSON.stringify(value)
  }

  if (typeof value === "object") {
    return JSON.stringify(value)
  }

  return String(value)
}

function normalizeQueryRows(
  rows: Array<Record<string, unknown>>,
  maxRows: number
): AgenticQueryExecutionResult["rowset"] {
  const visibleRows = rows.slice(0, maxRows)
  const columns = Array.from(
    visibleRows.reduce((set, row) => {
      Object.keys(row).forEach((key) => set.add(key))
      return set
    }, new Set<string>())
  )

  return {
    columns,
    rows: visibleRows.map((row) =>
      Object.fromEntries(
        columns.map((column) => [column, serializeQueryValue(row[column])])
      )
    ),
    totalRows: rows.length,
    truncated: rows.length > maxRows,
  }
}

function buildFixtureAgenticSchemaSnapshot(): AgenticSchemaSnapshot {
  const dataset = getSampleDataset()

  return {
    postgres: AGENTIC_POSTGRES_TABLES.map((table) => ({
      ...table,
      rowCount:
        table.name === "regions"
          ? dataset.regions.length
          : table.name === "sectors"
            ? dataset.sectors.length
            : table.name === "accounts"
              ? dataset.accounts.length
              : table.name === "daily_account_metrics"
                ? dataset.dailyMetrics.length
                : dataset.weeklyMetrics.length,
    })),
    mongodb: AGENTIC_MONGO_COLLECTIONS.map((collection) => ({
      ...collection,
      rowCount: dataset.contextEvents[collection.name as ContextCollection].length,
    })),
  }
}

class FixtureDataAccess implements QueryLensDataAccess {
  sourceMode: "fixture" = "fixture"

  async listWeeklyMetrics(): Promise<WeeklyMetricRow[]> {
    return getSampleDataset().weeklyMetrics
  }

  async listDailyMetrics(args: {
    startDate: string
    endDate: string
    scope: ScopeFilter
  }): Promise<DailyAccountMetric[]> {
    const dataset = getSampleDataset()

    return dataset.dailyMetrics.filter((metric) => {
      if (metric.date < args.startDate || metric.date > args.endDate) return false
      if (args.scope.region && metric.regionId !== args.scope.region) return false
      if (args.scope.sector && metric.sectorId !== args.scope.sector) return false
      return true
    })
  }

  async listWeeklyAccountStress(args: {
    targetStart: string
    scope: ScopeFilter
  }): Promise<WeeklyAccountStressRow[]> {
    const dataset = getSampleDataset()
    const grouped = new Map<string, WeeklyAccountStressRow>()

    dataset.dailyMetrics
      .filter((metric) => {
        if (metric.weekStart !== args.targetStart) return false
        if (args.scope.region && metric.regionId !== args.scope.region) return false
        if (args.scope.sector && metric.sectorId !== args.scope.sector) return false
        return true
      })
      .forEach((metric) => {
        const account = dataset.accounts.find(
          (candidate) => candidate.id === metric.accountId
        )
        const region = dataset.regions.find(
          (candidate) => candidate.id === metric.regionId
        )
        const sector = dataset.sectors.find(
          (candidate) => candidate.id === metric.sectorId
        )

        if (!account || !region || !sector) {
          return
        }

        const existing = grouped.get(metric.accountId)

        if (existing) {
          existing.lowBalanceDays += metric.lowBalanceFlag ? 1 : 0
          existing.hasOverdue = existing.hasOverdue || metric.overdueFlag
          return
        }

        grouped.set(metric.accountId, {
          weekStart: metric.weekStart,
          accountId: account.id,
          regionId: region.id,
          sectorId: sector.id,
          regionName: region.name,
          sectorName: sector.name,
          lowBalanceDays: metric.lowBalanceFlag ? 1 : 0,
          hasOverdue: metric.overdueFlag,
        })
      })

    return Array.from(grouped.values()).sort((left, right) =>
      left.accountId.localeCompare(right.accountId)
    )
  }

  async listContextEvents(args: {
    targetStart: string
    targetEnd: string
    scope: ScopeFilter
  }): Promise<ContextEvent[]> {
    const dataset = getSampleDataset()
    return CONTEXT_COLLECTIONS.flatMap((collection) => dataset.contextEvents[collection])
      .filter((event) => {
        if (event.occurredAt < `${args.targetStart}T00:00:00Z`) return false
        if (event.occurredAt > `${args.targetEnd}T23:59:59Z`) return false
        if (args.scope.region && event.regionId && event.regionId !== args.scope.region)
          return false
        if (args.scope.sector && event.sectorId && event.sectorId !== args.scope.sector)
          return false
        if (args.scope.region && !event.regionId && !event.sectorId) return false
        return true
      })
      .sort(sortContextEvents)
  }

  async getDateCoverage() {
    const dates = getSampleDataset().dailyMetrics.map((metric) => metric.date).sort()

    return {
      startDate: dates[0],
      endDate: dates.at(-1) ?? dates[0],
    }
  }

  async getSourceHealth(): Promise<SourceHealth[]> {
    const dataset = getSampleDataset()

    return [
      {
        id: "postgres",
        name: "Postgres facts",
        type: "postgres",
        status: "sample-fixture",
        detail: `${dataset.accounts.length} accounts · ${dataset.dailyMetrics.length} daily rows · ${dataset.weeklyMetrics.length} weekly rows`,
        recordCount: dataset.weeklyMetrics.length,
      },
      {
        id: "mongodb",
        name: "Mongo context",
        type: "mongodb",
        status: "sample-fixture",
        detail: `${CONTEXT_COLLECTIONS.reduce(
          (total, collection) => total + dataset.contextEvents[collection].length,
          0
        )} contextual documents across 4 collections`,
        recordCount: CONTEXT_COLLECTIONS.reduce(
          (total, collection) => total + dataset.contextEvents[collection].length,
          0
        ),
      },
      {
        id: "manifest",
        name: "Metric manifest",
        type: "manifest",
        status: "configured",
        detail: "1 supported metric with fixed weekly definitions",
        recordCount: 1,
      },
    ]
  }

  async getAgenticSchemaSnapshot(): Promise<AgenticSchemaSnapshot> {
    return buildFixtureAgenticSchemaSnapshot()
  }

  async executeReadOnlySql(): Promise<AgenticQueryExecutionResult> {
    throw new Error("Agentic SQL execution is only available in database mode.")
  }

  async executeReadOnlyMongoPipeline(): Promise<AgenticQueryExecutionResult> {
    throw new Error("Agentic Mongo execution is only available in database mode.")
  }
}

function getPgPool() {
  if (!process.env.POSTGRES_URL) {
    throw new Error("POSTGRES_URL is not configured.")
  }

  if (!globalThis.__querylensPgPool) {
    globalThis.__querylensPgPool = new Pool({
      connectionString: process.env.POSTGRES_URL,
    })
  }

  return globalThis.__querylensPgPool
}

function getMongoClientPromise() {
  if (!process.env.MONGODB_URL) {
    throw new Error("MONGODB_URL is not configured.")
  }

  if (!globalThis.__querylensMongoClientPromise) {
    globalThis.__querylensMongoClientPromise = new MongoClient(
      process.env.MONGODB_URL
    ).connect()
  }

  return globalThis.__querylensMongoClientPromise
}

class DatabaseDataAccess implements QueryLensDataAccess {
  sourceMode: "database" = "database"

  async listWeeklyMetrics(): Promise<WeeklyMetricRow[]> {
    const pool = getPgPool()
    const result = await pool.query<WeeklyMetricDbRow>(`
      SELECT
        week_start,
        week_end,
        record_type,
        region_id,
        sector_id,
        region_name,
        sector_name,
        account_count,
        inbound_payments,
        outbound_payments,
        opening_balance,
        closing_balance,
        low_balance_share,
        overdue_share,
        avg_utilization,
        inflow_outflow_score,
        balance_trend_score,
        low_balance_score,
        overdue_score,
        cashflow_health_score
      FROM weekly_portfolio_metrics
      ORDER BY week_start, record_type, COALESCE(region_id, ''), COALESCE(sector_id, '')
    `)

    return result.rows.map((row: WeeklyMetricDbRow) => ({
      weekStart: normalizeDateValue(row.week_start),
      weekEnd: normalizeDateValue(row.week_end),
      recordType: row.record_type,
      regionId: row.region_id,
      sectorId: row.sector_id,
      regionName: row.region_name,
      sectorName: row.sector_name,
      accountCount: Number(row.account_count),
      inboundPayments: Number(row.inbound_payments),
      outboundPayments: Number(row.outbound_payments),
      openingBalance: Number(row.opening_balance),
      closingBalance: Number(row.closing_balance),
      lowBalanceShare: Number(row.low_balance_share),
      overdueShare: Number(row.overdue_share),
      avgUtilization: Number(row.avg_utilization),
      inflowOutflowScore: Number(row.inflow_outflow_score),
      balanceTrendScore: Number(row.balance_trend_score),
      lowBalanceScore: Number(row.low_balance_score),
      overdueScore: Number(row.overdue_score),
      cashflowHealthScore: Number(row.cashflow_health_score),
    })) as WeeklyMetricRow[]
  }

  async listDailyMetrics(args: {
    startDate: string
    endDate: string
    scope: ScopeFilter
  }): Promise<DailyAccountMetric[]> {
    const pool = getPgPool()
    const result = await pool.query<DailyMetricDbRow>(
      `
        SELECT
          account_id,
          date,
          week_start,
          region_id,
          sector_id,
          inbound_payments,
          outbound_payments,
          end_balance,
          loan_utilization,
          low_balance_flag,
          overdue_flag
        FROM daily_account_metrics
        WHERE date BETWEEN $1 AND $2
          AND ($3::text IS NULL OR region_id = $3)
          AND ($4::text IS NULL OR sector_id = $4)
        ORDER BY date, account_id
      `,
      [args.startDate, args.endDate, args.scope.region ?? null, args.scope.sector ?? null]
    )

    return result.rows.map((row) => ({
      accountId: row.account_id,
      date: normalizeDateValue(row.date),
      weekStart: normalizeDateValue(row.week_start),
      regionId: row.region_id,
      sectorId: row.sector_id,
      inboundPayments: Number(row.inbound_payments),
      outboundPayments: Number(row.outbound_payments),
      endBalance: Number(row.end_balance),
      loanUtilization: Number(row.loan_utilization),
      lowBalanceFlag: row.low_balance_flag,
      overdueFlag: row.overdue_flag,
    }))
  }

  async listWeeklyAccountStress(args: {
    targetStart: string
    scope: ScopeFilter
  }): Promise<WeeklyAccountStressRow[]> {
    const pool = getPgPool()
    const result = await pool.query<WeeklyAccountStressDbRow>(
      `
        SELECT
          dam.week_start,
          dam.account_id,
          a.region_id,
          a.sector_id,
          r.name AS region_name,
          s.name AS sector_name,
          COUNT(*) FILTER (WHERE dam.low_balance_flag)::int AS low_balance_days,
          BOOL_OR(dam.overdue_flag) AS has_overdue
        FROM daily_account_metrics dam
        INNER JOIN accounts a ON a.id = dam.account_id
        INNER JOIN regions r ON r.id = a.region_id
        INNER JOIN sectors s ON s.id = a.sector_id
        WHERE dam.week_start = $1
          AND ($2::text IS NULL OR a.region_id = $2)
          AND ($3::text IS NULL OR a.sector_id = $3)
        GROUP BY
          dam.week_start,
          dam.account_id,
          a.region_id,
          a.sector_id,
          r.name,
          s.name
        ORDER BY dam.account_id
      `,
      [args.targetStart, args.scope.region ?? null, args.scope.sector ?? null]
    )

    return result.rows.map((row) => ({
      weekStart: normalizeDateValue(row.week_start),
      accountId: row.account_id,
      regionId: row.region_id,
      sectorId: row.sector_id,
      regionName: row.region_name,
      sectorName: row.sector_name,
      lowBalanceDays: Number(row.low_balance_days),
      hasOverdue: row.has_overdue,
    }))
  }

  async listContextEvents(args: {
    targetStart: string
    targetEnd: string
    scope: ScopeFilter
  }): Promise<ContextEvent[]> {
    const client = await getMongoClientPromise()
    const db = client.db()
    const scopeFilter = {
      ...(args.scope.region ? { regionId: args.scope.region } : {}),
      ...(args.scope.sector ? { sectorId: args.scope.sector } : {}),
    }

    const results = await Promise.all(
      CONTEXT_COLLECTIONS.map(async (collection) => {
        const documents = await db
          .collection<ContextEvent>(collection)
          .find({
            occurredAt: {
              $gte: `${args.targetStart}T00:00:00Z`,
              $lte: `${args.targetEnd}T23:59:59Z`,
            },
            ...scopeFilter,
          })
          .toArray()

        return documents.map(({ _id, ...document }) => document)
      })
    )

    return results.flat().sort(sortContextEvents)
  }

  async getDateCoverage() {
    const pool = getPgPool()
    const result = await pool.query<CoverageRow>(`
      SELECT
        MIN(date) AS min_date,
        MAX(date) AS max_date
      FROM daily_account_metrics
    `)
    const row = result.rows[0]

    return {
      startDate: normalizeDateValue(row.min_date),
      endDate: normalizeDateValue(row.max_date),
    }
  }

  async getSourceHealth(): Promise<SourceHealth[]> {
    const pool = getPgPool()
    const client = await getMongoClientPromise()
    const db = client.db()

    const [
      accountCount,
      dailyCount,
      weeklyCount,
      complaintsCount,
      incidentsCount,
      riskCount,
      notesCount,
    ] = await Promise.all([
      pool.query<CountRow>("SELECT COUNT(*)::int AS count FROM accounts"),
      pool.query<CountRow>("SELECT COUNT(*)::int AS count FROM daily_account_metrics"),
      pool.query<CountRow>("SELECT COUNT(*)::int AS count FROM weekly_portfolio_metrics"),
      db.collection("complaints").countDocuments(),
      db.collection("service_incidents").countDocuments(),
      db.collection("risk_alerts").countDocuments(),
      db.collection("rm_notes").countDocuments(),
    ])

    const accountTotal = Number(accountCount.rows[0].count)
    const dailyTotal = Number(dailyCount.rows[0].count)
    const weeklyTotal = Number(weeklyCount.rows[0].count)
    const mongoTotal =
      complaintsCount + incidentsCount + riskCount + notesCount

    return [
      {
        id: "postgres",
        name: "Postgres facts",
        type: "postgres",
        status: "connected",
        detail: `${accountTotal} accounts · ${dailyTotal} daily rows · ${weeklyTotal} weekly rows`,
        recordCount: weeklyTotal,
      },
      {
        id: "mongodb",
        name: "Mongo context",
        type: "mongodb",
        status: "connected",
        detail: `${mongoTotal} contextual documents across 4 collections`,
        recordCount: mongoTotal,
      },
      {
        id: "manifest",
        name: "Metric manifest",
        type: "manifest",
        status: "configured",
        detail: "1 supported metric with fixed weekly definitions",
        recordCount: 1,
      },
    ]
  }

  async getAgenticSchemaSnapshot(): Promise<AgenticSchemaSnapshot> {
    const pool = getPgPool()
    const client = await getMongoClientPromise()
    const db = client.db()

    const postgresCounts = await Promise.all(
      AGENTIC_POSTGRES_TABLES.map(async (table) => {
        const result = await pool.query<CountRow>(
          `SELECT COUNT(*)::int AS count FROM ${table.name}`
        )

        return {
          ...table,
          rowCount: Number(result.rows[0]?.count ?? 0),
        }
      })
    )

    const mongodbCounts = await Promise.all(
      AGENTIC_MONGO_COLLECTIONS.map(async (collection) => ({
        ...collection,
        rowCount: await db.collection(collection.name).countDocuments(),
      }))
    )

    return {
      postgres: postgresCounts,
      mongodb: mongodbCounts,
    }
  }

  async executeReadOnlySql(args: {
    statement: string
    maxRows: number
  }): Promise<AgenticQueryExecutionResult> {
    const pool = getPgPool()
    const client = await pool.connect()
    const trimmed = args.statement.trim().replace(/;+\s*$/g, "")

    try {
      await client.query("BEGIN READ ONLY")
      await client.query("SET LOCAL statement_timeout = 5000")
      const result = await client.query<Record<string, unknown>>(
        `SELECT * FROM (${trimmed}) AS querylens_agentic_result LIMIT ${Math.max(args.maxRows + 1, 2)}`
      )
      await client.query("ROLLBACK")

      const rowset = normalizeQueryRows(result.rows, args.maxRows)

      return {
        rowset,
        summary: rowset.truncated
          ? `Returned ${rowset.totalRows}+ rows before truncation.`
          : `Returned ${rowset.totalRows} row${rowset.totalRows === 1 ? "" : "s"}.`,
      }
    } catch (error) {
      try {
        await client.query("ROLLBACK")
      } catch {
        // Ignore rollback errors after the original query failure.
      }

      throw error
    } finally {
      client.release()
    }
  }

  async executeReadOnlyMongoPipeline(args: {
    collection: ContextCollection
    pipeline: Record<string, unknown>[]
    maxRows: number
  }): Promise<AgenticQueryExecutionResult> {
    const client = await getMongoClientPromise()
    const db = client.db()
    const result = await db
      .collection<Record<string, unknown>>(args.collection)
      .aggregate([...args.pipeline, { $limit: args.maxRows + 1 }], {
        maxTimeMS: 5000,
      })
      .toArray()

    const rowset = normalizeQueryRows(
      result.map((row) => {
        const { _id, ...document } = row
        return document
      }),
      args.maxRows
    )

    return {
      rowset,
      summary: rowset.truncated
        ? `Returned ${rowset.totalRows}+ documents before truncation.`
        : `Returned ${rowset.totalRows} document${rowset.totalRows === 1 ? "" : "s"}.`,
    }
  }
}

async function canUseDatabaseAdapter() {
  if (
    process.env.QUERYLENS_DATA_MODE === "fixture" ||
    !process.env.POSTGRES_URL ||
    !process.env.MONGODB_URL
  ) {
    return false
  }

  try {
    const pool = getPgPool()
    const mongo = await getMongoClientPromise()

    await Promise.all([pool.query("SELECT 1"), mongo.db().command({ ping: 1 })])
    return true
  } catch (error) {
    console.warn("QueryLens database adapters unavailable, falling back to the sample dataset.", error)
    return false
  }
}

export async function getQueryLensDataAccess(): Promise<QueryLensDataAccess> {
  if (await canUseDatabaseAdapter()) {
    return new DatabaseDataAccess()
  }

  return new FixtureDataAccess()
}
