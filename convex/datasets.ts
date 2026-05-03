import { v } from "convex/values"

import type { MutationCtx, QueryCtx } from "./_generated/server"
import { mutation, query } from "./_generated/server"
import { getOrCreateCurrentUser, requireClerkUserId } from "./clerkUsers"

const columnProfileValidator = v.object({
  name: v.string(),
  normalizedName: v.string(),
  label: v.string(),
  type: v.string(),
  nullRatio: v.number(),
  distinctCount: v.number(),
  sampleValues: v.array(v.union(v.string(), v.number(), v.boolean(), v.null())),
  isIdentifier: v.boolean(),
  isDimension: v.boolean(),
  isMeasure: v.boolean(),
  isTimeField: v.boolean(),
})

function mapDatasetListItem(dataset: {
  datasetId: string
  label: string
  description: string
  status: "draft" | "active"
}) {
  return {
    id: dataset.datasetId,
    label: dataset.label,
    description: dataset.description,
    status: dataset.status,
    sourceKind: "csv" as const,
    sourceMode: "database" as const,
  }
}

function mapDatasetRecord(
  dataset: {
    datasetId: string
    label: string
    description: string
    status: "draft" | "active"
    tableName: string
    rowCount: number
    primaryTimeField?: string
    grain: string
    manifestVersion: number
    semanticDraft: unknown
    profileSnapshot: unknown
    previewRows: unknown
    createdAt: number
    updatedAt: number
  },
  columns: Array<{
    columnName: string
    normalizedName: string
    label: string
    dataType: string
    nullRatio: number
    distinctCount: number
    sampleValues: Array<string | number | boolean | null>
    isIdentifier: boolean
    isDimension: boolean
    isMeasure: boolean
    isTimeField: boolean
  }>,
) {
  return {
    id: dataset.datasetId,
    label: dataset.label,
    description: dataset.description,
    status: dataset.status,
    sourceKind: "csv" as const,
    sourceMode: "database" as const,
    tableName: dataset.tableName,
    rowCount: dataset.rowCount,
    primaryTimeField: dataset.primaryTimeField,
    grain: dataset.grain,
    manifestVersion: dataset.manifestVersion,
    createdAt: new Date(dataset.createdAt).toISOString(),
    updatedAt: new Date(dataset.updatedAt).toISOString(),
    semanticDraft: dataset.semanticDraft,
    profileSnapshot: dataset.profileSnapshot,
    columns: columns.map((column) => ({
      name: column.columnName,
      normalizedName: column.normalizedName,
      label: column.label,
      type: column.dataType,
      nullRatio: column.nullRatio,
      distinctCount: column.distinctCount,
      sampleValues: column.sampleValues,
      isIdentifier: column.isIdentifier,
      isDimension: column.isDimension,
      isMeasure: column.isMeasure,
      isTimeField: column.isTimeField,
    })),
    previewRows: dataset.previewRows,
  }
}

async function getOwnedDatasetDoc(
  ctx: QueryCtx | MutationCtx,
  args: {
    datasetId: string
    clerkUserId: string
  },
) {
  const [dataset] = await ctx.db
    .query("datasets")
    .withIndex("by_clerkUserId_and_datasetId", (q) =>
      q.eq("clerkUserId", args.clerkUserId).eq("datasetId", args.datasetId),
    )
    .take(1)

  return dataset ?? null
}

export const listDatasets = query({
  args: {
    clerkUserId: v.string(),
  },
  handler: async (ctx, args) => {
    const clerkUserId = requireClerkUserId(args.clerkUserId)
    const datasets = await ctx.db
      .query("datasets")
      .withIndex("by_clerkUserId_and_datasetId", (q) => q.eq("clerkUserId", clerkUserId))
      .collect()

    return datasets
      .sort((left, right) => right.createdAt - left.createdAt)
      .map(mapDatasetListItem)
  },
})

export const getDataset = query({
  args: {
    datasetId: v.string(),
    clerkUserId: v.string(),
  },
  handler: async (ctx, args) => {
    const clerkUserId = requireClerkUserId(args.clerkUserId)
    const dataset = await getOwnedDatasetDoc(ctx, {
      datasetId: args.datasetId,
      clerkUserId,
    })

    if (!dataset) {
      return null
    }

    const columns = await ctx.db
      .query("datasetColumns")
      .withIndex("by_datasetDocId_and_ordinalPosition", (q) =>
        q.eq("datasetDocId", dataset._id),
      )
      .collect()

    return mapDatasetRecord(dataset, columns)
  },
})

export const saveDataset = mutation({
  args: {
    clerkUserId: v.string(),
    datasetId: v.string(),
    label: v.string(),
    description: v.string(),
    tableName: v.string(),
    rowCount: v.number(),
    primaryTimeField: v.optional(v.string()),
    grain: v.string(),
    manifestVersion: v.number(),
    semanticDraft: v.any(),
    profileSnapshot: v.any(),
    previewRows: v.any(),
    columns: v.array(columnProfileValidator),
  },
  handler: async (ctx, args) => {
    const clerkUserId = requireClerkUserId(args.clerkUserId)
    const user = await getOrCreateCurrentUser(ctx, { clerkUserId })
    const existingDataset = await getOwnedDatasetDoc(ctx, {
      datasetId: args.datasetId,
      clerkUserId,
    })

    if (existingDataset) {
      throw new Error("Dataset already exists.")
    }

    const now = Date.now()
    const datasetDocId = await ctx.db.insert("datasets", {
      userId: user._id,
      clerkUserId,
      datasetId: args.datasetId,
      label: args.label,
      description: args.description,
      status: "draft",
      sourceKind: "csv",
      sourceMode: "database",
      tableName: args.tableName,
      rowCount: args.rowCount,
      primaryTimeField: args.primaryTimeField,
      grain: args.grain,
      manifestVersion: args.manifestVersion,
      semanticDraft: args.semanticDraft,
      profileSnapshot: args.profileSnapshot,
      previewRows: args.previewRows,
      createdAt: now,
      updatedAt: now,
    })

    for (const [index, column] of args.columns.entries()) {
      await ctx.db.insert("datasetColumns", {
        datasetDocId,
        datasetId: args.datasetId,
        columnName: column.name,
        normalizedName: column.normalizedName,
        label: column.label,
        dataType: column.type,
        nullRatio: column.nullRatio,
        distinctCount: column.distinctCount,
        sampleValues: column.sampleValues,
        isIdentifier: column.isIdentifier,
        isDimension: column.isDimension,
        isMeasure: column.isMeasure,
        isTimeField: column.isTimeField,
        ordinalPosition: index,
      })
    }

    const dataset = await ctx.db.get(datasetDocId)
    if (!dataset) {
      throw new Error("Could not load saved dataset.")
    }

    return mapDatasetRecord(
      dataset,
      args.columns.map((column) => ({
        columnName: column.name,
        normalizedName: column.normalizedName,
        label: column.label,
        dataType: column.type,
        nullRatio: column.nullRatio,
        distinctCount: column.distinctCount,
        sampleValues: column.sampleValues,
        isIdentifier: column.isIdentifier,
        isDimension: column.isDimension,
        isMeasure: column.isMeasure,
        isTimeField: column.isTimeField,
      })),
    )
  },
})

export const activateDataset = mutation({
  args: {
    clerkUserId: v.string(),
    datasetId: v.string(),
  },
  handler: async (ctx, args) => {
    const clerkUserId = requireClerkUserId(args.clerkUserId)
    const user = await getOrCreateCurrentUser(ctx, { clerkUserId })
    const dataset = await getOwnedDatasetDoc(ctx, {
      datasetId: args.datasetId,
      clerkUserId,
    })

    if (!dataset || dataset.userId !== user._id) {
      throw new Error("Dataset not found.")
    }

    const patchedAt = Date.now()
    await ctx.db.patch(dataset._id, {
      status: "active",
      updatedAt: patchedAt,
    })

    const columns = await ctx.db
      .query("datasetColumns")
      .withIndex("by_datasetDocId_and_ordinalPosition", (q) =>
        q.eq("datasetDocId", dataset._id),
      )
      .collect()

    return mapDatasetRecord(
      {
        ...dataset,
        status: "active",
        updatedAt: patchedAt,
      },
      columns,
    )
  },
})
