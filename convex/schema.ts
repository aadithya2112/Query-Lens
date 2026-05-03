import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"

export default defineSchema({
  users: defineTable({
    clerkUserId: v.string(),
    tokenIdentifier: v.optional(v.string()),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_clerkUserId", ["clerkUserId"])
    .index("by_tokenIdentifier", ["tokenIdentifier"]),

  chats: defineTable({
    userId: v.id("users"),
    clerkUserId: v.string(),
    tokenIdentifier: v.optional(v.string()),
    datasetId: v.string(),
    title: v.optional(v.string()),
    isDefault: v.optional(v.boolean()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId_and_datasetId", ["userId", "datasetId"])
    .index("by_clerkUserId_and_datasetId", ["clerkUserId", "datasetId"])
    .index("by_tokenIdentifier_and_datasetId", ["tokenIdentifier", "datasetId"]),

  messages: defineTable({
    chatId: v.id("chats"),
    userId: v.id("users"),
    clerkUserId: v.string(),
    tokenIdentifier: v.optional(v.string()),
    role: v.union(v.literal("user"), v.literal("assistant")),
    text: v.string(),
    analysis: v.optional(v.any()),
    createdAt: v.number(),
  })
    .index("by_chatId_and_createdAt", ["chatId", "createdAt"])
    .index("by_clerkUserId_and_chatId", ["clerkUserId", "chatId"])
    .index("by_tokenIdentifier_and_chatId", ["tokenIdentifier", "chatId"]),

  datasets: defineTable({
    userId: v.id("users"),
    clerkUserId: v.string(),
    tokenIdentifier: v.optional(v.string()),
    datasetId: v.string(),
    label: v.string(),
    description: v.string(),
    status: v.union(v.literal("draft"), v.literal("active")),
    sourceKind: v.literal("csv"),
    sourceMode: v.literal("database"),
    tableName: v.string(),
    rowCount: v.number(),
    primaryTimeField: v.optional(v.string()),
    grain: v.string(),
    manifestVersion: v.number(),
    semanticDraft: v.any(),
    profileSnapshot: v.any(),
    previewRows: v.any(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId_and_createdAt", ["userId", "createdAt"])
    .index("by_clerkUserId_and_datasetId", ["clerkUserId", "datasetId"])
    .index("by_tokenIdentifier_and_datasetId", ["tokenIdentifier", "datasetId"]),

  datasetColumns: defineTable({
    datasetDocId: v.id("datasets"),
    datasetId: v.string(),
    columnName: v.string(),
    normalizedName: v.string(),
    label: v.string(),
    dataType: v.string(),
    nullRatio: v.number(),
    distinctCount: v.number(),
    sampleValues: v.array(v.union(v.string(), v.number(), v.boolean(), v.null())),
    isIdentifier: v.boolean(),
    isDimension: v.boolean(),
    isMeasure: v.boolean(),
    isTimeField: v.boolean(),
    ordinalPosition: v.number(),
  })
    .index("by_datasetDocId_and_ordinalPosition", ["datasetDocId", "ordinalPosition"])
    .index("by_datasetId_and_ordinalPosition", ["datasetId", "ordinalPosition"]),
})
