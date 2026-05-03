import { fetchMutation, fetchQuery } from "convex/nextjs"
import { auth } from "@clerk/nextjs/server"

import { api } from "@/convex/_generated/api"
import type {
  CsvColumnProfile,
  DatasetDefinition,
  DatasetId,
  DatasetListItem,
  DatasetProfileSnapshot,
  DatasetSemanticDraft,
  MetricDefinition,
  OnboardedDatasetRecord,
  ResultTable,
  SourceHealth,
} from "@/lib/querylens/types"

export const DATASET_MANIFEST_VERSION = 1

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
  _dimensions: DatasetSemanticDraft["dimensions"],
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
  record: OnboardedDatasetRecord,
): DatasetDefinition {
  return {
    id: record.id,
    label: record.label,
    description: record.description,
    dimensions: ["portfolio"],
    metrics: record.semanticDraft.metrics.map((metric) =>
      buildOnboardedMetricDefinition(metric, record.semanticDraft.dimensions),
    ),
    supportedIntentIds: ["discovery", "aggregate", "trend"],
    supportedTimeframes: ["custom"],
  }
}

export async function listRegisteredDatasets(): Promise<DatasetListItem[]> {
  const { userId } = await auth()
  const onboardedDatasets = userId
    ? await fetchQuery(api.datasets.listDatasets, { clerkUserId: userId })
    : []

  return [buildBuiltInDatasetListItem(), ...onboardedDatasets]
}

export async function getOnboardedDatasetRecord(
  datasetId: DatasetId,
): Promise<OnboardedDatasetRecord | undefined> {
  const { userId } = await auth()
  if (!userId) {
    return undefined
  }

  const dataset = await fetchQuery(
    api.datasets.getDataset,
    {
      datasetId,
      clerkUserId: userId,
    },
  )

  return (dataset as OnboardedDatasetRecord | null | undefined) ?? undefined
}

export async function activateOnboardedDataset(datasetId: DatasetId) {
  const { userId } = await auth()
  if (!userId) {
    throw new Error("Not authenticated.")
  }

  return await fetchMutation(
    api.datasets.activateDataset,
    {
      clerkUserId: userId,
      datasetId,
    },
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
  const { userId } = await auth()
  if (!userId) {
    throw new Error("Not authenticated.")
  }

  return await fetchMutation(
    api.datasets.saveDataset,
    {
      clerkUserId: userId,
      datasetId: args.id,
      label: args.label,
      description: args.description,
      tableName: args.tableName,
      rowCount: args.rowCount,
      primaryTimeField: args.primaryTimeField,
      grain: args.grain,
      manifestVersion: DATASET_MANIFEST_VERSION,
      semanticDraft: args.semanticDraft,
      profileSnapshot: args.profileSnapshot,
      previewRows: args.previewRows,
      columns: args.columns,
    },
  )
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
