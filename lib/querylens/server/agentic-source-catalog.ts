import type {
  AgenticConnectedCsvSource,
  AgenticSourceCatalog,
} from "@/lib/querylens/server/agentic-types"
import { listOnboardedDatasetRecords } from "@/lib/querylens/server/dataset-registry"
import type {
  DatasetProfileSnapshot,
  OnboardedDatasetRecord,
} from "@/lib/querylens/types"

function buildCsvSource(record: OnboardedDatasetRecord): AgenticConnectedCsvSource {
  return {
    id: record.id,
    datasetId: record.id,
    label: record.label,
    description: record.description,
    tableName: record.tableName,
    rowCount: record.rowCount,
    columns: record.columns.map((column) => column.normalizedName),
    primaryTimeField: record.primaryTimeField,
    metrics: record.semanticDraft.metrics.map((metric) => ({
      id: metric.id,
      label: metric.label,
      supportedIntents: metric.supportedIntents,
    })),
    dimensions: record.semanticDraft.dimensions.map((dimension) => ({
      id: dimension.id,
      label: dimension.label,
    })),
  }
}

function buildBuiltInRecordCount(snapshot: DatasetProfileSnapshot, sourceId: string) {
  return (
    snapshot.sourceHealth.find((source) => source.id === sourceId)?.recordCount ??
    snapshot.sourceCounts.find((source) => source.sourceId === sourceId)?.recordCount ??
    0
  )
}

export async function buildAgenticSourceCatalog(args: {
  profileSnapshot: DatasetProfileSnapshot
}): Promise<AgenticSourceCatalog> {
  const activeUploads = (await listOnboardedDatasetRecords()).filter(
    (dataset) => dataset.status === "active",
  )
  const csvSources = activeUploads.map(buildCsvSource)

  return {
    entries: [
      {
        id: "built_in_postgres",
        sourceType: "postgres",
        label: "Built-in Postgres facts",
        description:
          "Approved built-in QueryLens Postgres tables for structured live reads.",
        recordCount: buildBuiltInRecordCount(args.profileSnapshot, "postgres"),
        objectCount: args.profileSnapshot.schemaSnapshot.postgres.length,
        queryable: true,
      },
      {
        id: "built_in_mongodb",
        sourceType: "mongodb",
        label: "Built-in Mongo context",
        description:
          "Approved built-in QueryLens MongoDB collections for contextual corroboration.",
        recordCount: buildBuiltInRecordCount(args.profileSnapshot, "mongodb"),
        objectCount: args.profileSnapshot.schemaSnapshot.mongodb.length,
        queryable: true,
      },
      ...csvSources.map((source) => ({
        id: source.id,
        sourceType: "csv" as const,
        label: source.label,
        description: `${source.rowCount.toLocaleString()} uploaded CSV rows stored in QueryLens Postgres.`,
        recordCount: source.rowCount,
        objectCount: 1,
        queryable: true,
      })),
    ],
    schema: {
      postgres: args.profileSnapshot.schemaSnapshot.postgres,
      mongodb: args.profileSnapshot.schemaSnapshot.mongodb,
      csv: csvSources,
    },
  }
}
