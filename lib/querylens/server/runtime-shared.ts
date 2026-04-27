import { MongoClient } from "mongodb"
import { Pool } from "pg"

import { getSampleDataset } from "@/lib/querylens/seed-data"
import type { AgenticSchemaSnapshot } from "@/lib/querylens/server/agentic-types"
import type { ContextCollection, ContextEvent } from "@/lib/querylens/types"

declare global {
  var __querylensPgPool: Pool | undefined
  var __querylensMongoClientPromise: Promise<MongoClient> | undefined
}

export const CONTEXT_COLLECTIONS: ContextCollection[] = [
  "complaints",
  "service_incidents",
  "risk_alerts",
  "rm_notes",
]

export const AGENTIC_POSTGRES_TABLES = [
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

export const AGENTIC_MONGO_COLLECTIONS = [
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

export function sortContextEvents(left: ContextEvent, right: ContextEvent) {
  const severityOrder = { high: 0, medium: 1, low: 2 }
  const severitySort = severityOrder[left.severity] - severityOrder[right.severity]
  if (severitySort !== 0) return severitySort
  return left.occurredAt.localeCompare(right.occurredAt)
}

export function normalizeDateValue(value: string | Date) {
  if (typeof value === "string") {
    return value.slice(0, 10)
  }

  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, "0")
  const day = String(value.getDate()).padStart(2, "0")

  return `${year}-${month}-${day}`
}

export function buildFixtureAgenticSchemaSnapshot(): AgenticSchemaSnapshot {
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

export function getPgPool() {
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

export function getMongoClientPromise() {
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

export async function canUseDatabaseAdapter() {
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
