import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"

export default defineSchema({
  users: defineTable({
    clerkUserId: v.string(),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_clerkUserId", ["clerkUserId"]),

  chats: defineTable({
    userId: v.id("users"),
    clerkUserId: v.string(),
    datasetId: v.string(),
    title: v.optional(v.string()),
    isDefault: v.optional(v.boolean()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId_and_datasetId", ["userId", "datasetId"])
    .index("by_clerkUserId_and_datasetId", ["clerkUserId", "datasetId"]),

  messages: defineTable({
    chatId: v.id("chats"),
    userId: v.id("users"),
    clerkUserId: v.string(),
    role: v.union(v.literal("user"), v.literal("assistant")),
    text: v.string(),
    analysis: v.optional(v.any()),
    createdAt: v.number(),
  })
    .index("by_chatId_and_createdAt", ["chatId", "createdAt"])
    .index("by_clerkUserId_and_chatId", ["clerkUserId", "chatId"]),
})
