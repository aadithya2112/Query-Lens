import { MongoClient } from "mongodb"
import { Pool } from "pg"

import { getSeedDataset } from "@/lib/querylens/seed-data"
import type {
  ContextCollection,
  ContextEvent,
  ScopeFilter,
  SourceHealth,
  WeeklyMetricRow,
} from "@/lib/querylens/types"

export interface QueryLensDataAccess {
  sourceMode: "database" | "fixture"
  listWeeklyMetrics(): Promise<WeeklyMetricRow[]>
  listContextEvents(args: {
    targetStart: string
    targetEnd: string
    scope: ScopeFilter
  }): Promise<ContextEvent[]>
  getSourceHealth(): Promise<SourceHealth[]>
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

class FixtureDataAccess implements QueryLensDataAccess {
  sourceMode: "fixture" = "fixture"

  async listWeeklyMetrics(): Promise<WeeklyMetricRow[]> {
    return getSeedDataset().weeklyMetrics
  }

  async listContextEvents(args: {
    targetStart: string
    targetEnd: string
    scope: ScopeFilter
  }): Promise<ContextEvent[]> {
    const dataset = getSeedDataset()
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

  async getSourceHealth(): Promise<SourceHealth[]> {
    const dataset = getSeedDataset()

    return [
      {
        id: "postgres",
        name: "Postgres facts",
        type: "postgres",
        status: "seeded-fixture",
        detail: `${dataset.accounts.length} accounts · ${dataset.dailyMetrics.length} daily rows · ${dataset.weeklyMetrics.length} weekly rows`,
        recordCount: dataset.weeklyMetrics.length,
      },
      {
        id: "mongodb",
        name: "Mongo context",
        type: "mongodb",
        status: "seeded-fixture",
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
    console.warn("QueryLens database adapters unavailable, falling back to fixtures.", error)
    return false
  }
}

export async function getQueryLensDataAccess(): Promise<QueryLensDataAccess> {
  if (await canUseDatabaseAdapter()) {
    return new DatabaseDataAccess()
  }

  return new FixtureDataAccess()
}
