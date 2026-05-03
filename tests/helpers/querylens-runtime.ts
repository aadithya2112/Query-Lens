import { getDatasetMetricManifest } from "@/lib/querylens/datasets"
import { getSampleDataset } from "@/lib/querylens/seed-data"
import {
  AGENTIC_MONGO_COLLECTIONS,
  AGENTIC_POSTGRES_TABLES,
  CONTEXT_COLLECTIONS,
  sortContextEvents,
} from "@/lib/querylens/server/runtime-shared"
import type { QueryLensDataAccess } from "@/lib/querylens/server/repositories"
import type { QueryLensDatasetProfileStore } from "@/lib/querylens/server/profile-store"
import type {
  ContextCollection,
  ContextEvent,
  DatasetProfileSnapshot,
  DailyAccountMetric,
  ScopeFilter,
  WeeklyAccountStressRow,
} from "@/lib/querylens/types"

function listSampleContextEvents(args: {
  targetStart: string
  targetEnd: string
  scope: ScopeFilter
}): ContextEvent[] {
  const dataset = getSampleDataset()

  return CONTEXT_COLLECTIONS.flatMap((collection) => dataset.contextEvents[collection])
    .filter((event) => {
      if (event.occurredAt < `${args.targetStart}T00:00:00Z`) return false
      if (event.occurredAt > `${args.targetEnd}T23:59:59Z`) return false
      if (args.scope.region && event.regionId && event.regionId !== args.scope.region) {
        return false
      }
      if (args.scope.sector && event.sectorId && event.sectorId !== args.scope.sector) {
        return false
      }
      if (args.scope.region && !event.regionId && !event.sectorId) return false
      return true
    })
    .sort(sortContextEvents)
}

function listSampleDailyMetrics(args: {
  startDate: string
  endDate: string
  scope: ScopeFilter
}): DailyAccountMetric[] {
  return getSampleDataset().dailyMetrics.filter((metric) => {
    if (metric.date < args.startDate || metric.date > args.endDate) return false
    if (args.scope.region && metric.regionId !== args.scope.region) return false
    if (args.scope.sector && metric.sectorId !== args.scope.sector) return false
    return true
  })
}

function listSampleWeeklyAccountStress(args: {
  targetStart: string
  scope: ScopeFilter
}): WeeklyAccountStressRow[] {
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
      const region = dataset.regions.find((candidate) => candidate.id === metric.regionId)
      const sector = dataset.sectors.find((candidate) => candidate.id === metric.sectorId)

      if (!region || !sector) {
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
        accountId: metric.accountId,
        regionId: region.id,
        sectorId: sector.id,
        regionName: region.name,
        sectorName: sector.name,
        lowBalanceDays: metric.lowBalanceFlag ? 1 : 0,
        hasOverdue: metric.overdueFlag,
      })
    })

  return Array.from(grouped.values()).sort((left, right) =>
    left.accountId.localeCompare(right.accountId),
  )
}

export function buildMockDatabaseProfileSnapshot(): DatasetProfileSnapshot {
  const dataset = getSampleDataset()
  const dailyDates = dataset.dailyMetrics.map((metric) => metric.date).sort()
  const metricManifest = getDatasetMetricManifest()
  const mongoTotal = AGENTIC_MONGO_COLLECTIONS.reduce(
    (total, collection) =>
      total + dataset.contextEvents[collection.name as ContextCollection].length,
    0,
  )
  const sourceHealth = [
    {
      id: "postgres",
      name: "Postgres facts",
      type: "postgres" as const,
      status: "connected" as const,
      detail: `${dataset.accounts.length} accounts · ${dataset.dailyMetrics.length} daily rows · ${dataset.weeklyMetrics.length} weekly rows`,
      recordCount: dataset.weeklyMetrics.length,
    },
    {
      id: "mongodb",
      name: "Mongo context",
      type: "mongodb" as const,
      status: "connected" as const,
      detail: `${mongoTotal} contextual documents across 4 collections`,
      recordCount: mongoTotal,
    },
    {
      id: "manifest",
      name: "Metric manifest",
      type: "manifest" as const,
      status: "configured" as const,
      detail: "1 supported metric with fixed weekly definitions",
      recordCount: metricManifest.metrics.length,
    },
  ]

  return {
    datasetId: "sme_portfolio",
    sourceMode: "database",
    dateCoverage: {
      startDate: dailyDates[0],
      endDate: dailyDates.at(-1) ?? dailyDates[0],
    },
    sourceHealth,
    schemaSnapshot: {
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
      csv: [],
    },
    sourceCounts: sourceHealth.map((source) => ({
      sourceId: source.id,
      sourceLabel: source.name,
      recordCount: source.recordCount ?? 0,
    })),
  }
}

export function createMockDatabaseDataAccess(
  overrides: Partial<QueryLensDataAccess> = {},
): QueryLensDataAccess {
  const dataset = getSampleDataset()

  return {
    sourceMode: "database",
    listWeeklyMetrics: async () => dataset.weeklyMetrics,
    listDailyMetrics: async (args) => listSampleDailyMetrics(args),
    listWeeklyAccountStress: async (args) => listSampleWeeklyAccountStress(args),
    listContextEvents: async (args) => listSampleContextEvents(args),
    getDateCoverage: async () => {
      const dates = dataset.dailyMetrics.map((metric) => metric.date).sort()
      return {
        startDate: dates[0],
        endDate: dates.at(-1) ?? dates[0],
      }
    },
    executeReadOnlySql: async () => ({
      rowset: {
        columns: [],
        rows: [],
        totalRows: 0,
        truncated: false,
      },
      summary: "Returned 0 rows.",
    }),
    executeReadOnlyMongoPipeline: async () => ({
      rowset: {
        columns: [],
        rows: [],
        totalRows: 0,
        truncated: false,
      },
      summary: "Returned 0 documents.",
    }),
    ...overrides,
  }
}

export function createMockDatabaseProfileStore(): QueryLensDatasetProfileStore {
  return {
    sourceMode: "database",
    getProfileSnapshot: async () => buildMockDatabaseProfileSnapshot(),
    getSemanticDraft: async () => {
      const { buildDatasetCatalogProfile } = await import(
        "@/lib/querylens/server/profile-store"
      )
      const snapshot = buildMockDatabaseProfileSnapshot()
      const profile = buildDatasetCatalogProfile(snapshot)
      return {
        datasetId: "sme_portfolio",
        datasetLabel: profile.datasetLabel,
        description: profile.datasetDescription,
        sourceMode: "database",
        timeCoverage: profile.timeCoverage,
        dimensions: [],
        metrics: getDatasetMetricManifest().metrics.map((metric) => ({
          id: metric.id,
          label: metric.label,
          supportedIntents: metric.supportedIntents,
        })),
        sources: snapshot.sourceHealth.map((source) => ({
          id: source.id,
          label: source.name,
          type: source.type as "postgres" | "mongodb" | "manifest",
          description: source.detail,
          recordCount: source.recordCount ?? 0,
        })),
        notes: [],
      }
    },
  }
}

export function createMockQueryLensDatasetRuntime() {
  return {
    dataAccess: createMockDatabaseDataAccess(),
    profileStore: createMockDatabaseProfileStore(),
  }
}
