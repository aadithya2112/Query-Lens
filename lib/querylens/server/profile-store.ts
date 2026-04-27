import { getDatasetDefinition, getDatasetMetricManifest } from "@/lib/querylens/datasets"
import { getSupportedEntityLabels } from "@/lib/querylens/dataset-semantics"
import {
  getSemanticManifest,
  getSemanticSourceMappings,
  getSemanticSupportedQuestions,
} from "@/lib/querylens/semantic-manifest"
import { getSampleDataset } from "@/lib/querylens/seed-data"
import type { AgenticSchemaSnapshot } from "@/lib/querylens/server/agentic-types"
import {
  AGENTIC_MONGO_COLLECTIONS,
  AGENTIC_POSTGRES_TABLES,
  buildFixtureAgenticSchemaSnapshot,
  getMongoClientPromise,
  getPgPool,
  normalizeDateValue,
} from "@/lib/querylens/server/runtime-shared"
import type {
  DatasetCatalogProfile,
  DatasetProfileSnapshot,
  DatasetSemanticDraft,
  DatasetSourceCount,
  SourceHealth,
} from "@/lib/querylens/types"

interface CountRow {
  count: number | string
}

interface CoverageRow {
  min_date: string | Date
  max_date: string | Date
}

export interface QueryLensDatasetProfileStore {
  sourceMode: DatasetProfileSnapshot["sourceMode"]
  getProfileSnapshot(): Promise<DatasetProfileSnapshot>
  getSemanticDraft(): Promise<DatasetSemanticDraft>
}

function buildSourceCounts(sourceHealth: SourceHealth[]): DatasetSourceCount[] {
  return sourceHealth.map((source) => ({
    sourceId: source.id,
    sourceLabel: source.name,
    recordCount: source.recordCount ?? 0,
  }))
}

function buildTimeCoverageLabel(snapshot: DatasetProfileSnapshot) {
  return `${snapshot.dateCoverage.startDate} to ${snapshot.dateCoverage.endDate}`
}

function buildSemanticDraft(args: {
  snapshot: DatasetProfileSnapshot
}): DatasetSemanticDraft {
  const dataset = getDatasetDefinition(args.snapshot.datasetId)
  const semanticManifest = getSemanticManifest()
  const sourceMappings = getSemanticSourceMappings()

  return {
    datasetId: dataset.id,
    datasetLabel: dataset.label,
    description: dataset.description,
    sourceMode: args.snapshot.sourceMode,
    timeCoverage: buildTimeCoverageLabel(args.snapshot),
    dimensions: semanticManifest.dimensions.map((dimension) => ({
      id: dimension.id,
      label: dimension.label,
    })),
    metrics: dataset.metrics.map((metric) => ({
      id: metric.id,
      label: metric.label,
      supportedIntents: metric.supportedIntents,
    })),
    sources: sourceMappings.map((source) => ({
      id: source.id,
      label: source.label,
      type: source.type,
      description: source.description,
      recordCount:
        args.snapshot.sourceCounts.find((count) => count.sourceId === source.id)
          ?.recordCount ?? 0,
    })),
    notes: [
      "This semantic draft is advisory onboarding metadata generated from source inspection and the current manifest-backed dataset contract.",
      ...semanticManifest.uncertaintyNotes,
    ],
  }
}

export function buildDatasetCatalogProfile(
  snapshot: DatasetProfileSnapshot
): DatasetCatalogProfile {
  const dataset = getDatasetDefinition(snapshot.datasetId)
  const semanticManifest = getSemanticManifest()
  const supportedEntities = getSupportedEntityLabels()
  const supportedQuestions = getSemanticSupportedQuestions()
  const semanticDraft = buildSemanticDraft({ snapshot })

  return {
    datasetLabel: dataset.label,
    datasetDescription: dataset.description,
    sourceMode: snapshot.sourceMode,
    storyAnchors: semanticManifest.storyAnchors,
    timeCoverage: semanticDraft.timeCoverage,
    sourceLabels: snapshot.sourceHealth.map((source) => source.name),
    sourceSummaries: semanticDraft.sources.map((source) => ({
      id: source.id,
      label: source.label,
      description: source.description,
      recordCount: source.recordCount,
    })),
    metricLabels: dataset.metrics.map((metric) => metric.label),
    dimensionLabels: semanticManifest.dimensions.map((dimension) => dimension.label),
    regionLabels: supportedEntities.regions,
    sectorLabels: supportedEntities.sectors,
    supportedQuestions,
  }
}

class FixtureDatasetProfileStore implements QueryLensDatasetProfileStore {
  sourceMode = "fixture" as const

  async getProfileSnapshot(): Promise<DatasetProfileSnapshot> {
    const dataset = getSampleDataset()
    const dailyDates = dataset.dailyMetrics.map((metric) => metric.date).sort()
    const metricManifest = getDatasetMetricManifest()

    const sourceHealth: SourceHealth[] = [
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
        detail: `${AGENTIC_MONGO_COLLECTIONS.reduce(
          (total, collection) => total + dataset.contextEvents[collection.name].length,
          0
        )} contextual documents across 4 collections`,
        recordCount: AGENTIC_MONGO_COLLECTIONS.reduce(
          (total, collection) => total + dataset.contextEvents[collection.name].length,
          0
        ),
      },
      {
        id: "manifest",
        name: "Metric manifest",
        type: "manifest",
        status: "configured",
        detail: "1 supported metric with fixed weekly definitions",
        recordCount: metricManifest.metrics.length,
      },
    ]

    return {
      datasetId: "sme_portfolio",
      sourceMode: this.sourceMode,
      dateCoverage: {
        startDate: dailyDates[0],
        endDate: dailyDates.at(-1) ?? dailyDates[0],
      },
      sourceHealth,
      schemaSnapshot: buildFixtureAgenticSchemaSnapshot(),
      sourceCounts: buildSourceCounts(sourceHealth),
    }
  }

  async getSemanticDraft(): Promise<DatasetSemanticDraft> {
    return buildSemanticDraft({
      snapshot: await this.getProfileSnapshot(),
    })
  }
}

async function buildDatabaseSchemaSnapshot(): Promise<AgenticSchemaSnapshot> {
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

class DatabaseDatasetProfileStore implements QueryLensDatasetProfileStore {
  sourceMode = "database" as const

  async getProfileSnapshot(): Promise<DatasetProfileSnapshot> {
    const pool = getPgPool()
    const client = await getMongoClientPromise()
    const db = client.db()

    const [
      coverageResult,
      accountCount,
      dailyCount,
      weeklyCount,
      complaintsCount,
      incidentsCount,
      riskCount,
      notesCount,
      schemaSnapshot,
    ] = await Promise.all([
      pool.query<CoverageRow>(`
        SELECT
          MIN(date) AS min_date,
          MAX(date) AS max_date
        FROM daily_account_metrics
      `),
      pool.query<CountRow>("SELECT COUNT(*)::int AS count FROM accounts"),
      pool.query<CountRow>("SELECT COUNT(*)::int AS count FROM daily_account_metrics"),
      pool.query<CountRow>("SELECT COUNT(*)::int AS count FROM weekly_portfolio_metrics"),
      db.collection("complaints").countDocuments(),
      db.collection("service_incidents").countDocuments(),
      db.collection("risk_alerts").countDocuments(),
      db.collection("rm_notes").countDocuments(),
      buildDatabaseSchemaSnapshot(),
    ])

    const metricManifest = getDatasetMetricManifest()
    const accountTotal = Number(accountCount.rows[0].count)
    const dailyTotal = Number(dailyCount.rows[0].count)
    const weeklyTotal = Number(weeklyCount.rows[0].count)
    const mongoTotal =
      complaintsCount + incidentsCount + riskCount + notesCount

    const sourceHealth: SourceHealth[] = [
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
        recordCount: metricManifest.metrics.length,
      },
    ]

    return {
      datasetId: "sme_portfolio",
      sourceMode: this.sourceMode,
      dateCoverage: {
        startDate: normalizeDateValue(coverageResult.rows[0].min_date),
        endDate: normalizeDateValue(coverageResult.rows[0].max_date),
      },
      sourceHealth,
      schemaSnapshot,
      sourceCounts: buildSourceCounts(sourceHealth),
    }
  }

  async getSemanticDraft(): Promise<DatasetSemanticDraft> {
    return buildSemanticDraft({
      snapshot: await this.getProfileSnapshot(),
    })
  }
}

export function createFixtureDatasetProfileStore(): QueryLensDatasetProfileStore {
  return new FixtureDatasetProfileStore()
}

export function createDatabaseDatasetProfileStore(): QueryLensDatasetProfileStore {
  return new DatabaseDatasetProfileStore()
}
