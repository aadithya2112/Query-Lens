import { v } from "convex/values"

import type { Doc, Id } from "./_generated/dataModel"
import { mutation, query } from "./_generated/server"
import type { MutationCtx, QueryCtx } from "./_generated/server"

const profileArgs = {
  clerkUserId: v.string(),
  name: v.optional(v.string()),
  email: v.optional(v.string()),
  imageUrl: v.optional(v.string()),
}

function requireClerkUserId(clerkUserId: string) {
  const trimmed = clerkUserId.trim()

  if (!trimmed) {
    throw new Error("Missing Clerk user id")
  }

  return trimmed
}

async function getOrCreateCurrentUser(
  ctx: MutationCtx,
  profile: {
    clerkUserId: string
    name?: string
    email?: string
    imageUrl?: string
  },
) {
  const clerkUserId = requireClerkUserId(profile.clerkUserId)
  const now = Date.now()
  const [existingUser] = await ctx.db
    .query("users")
    .withIndex("by_clerkUserId", (q) =>
      q.eq("clerkUserId", clerkUserId),
    )
    .take(1)

  if (existingUser) {
    const userPatch: {
      name?: string
      email?: string
      imageUrl?: string
      updatedAt: number
    } = {
      updatedAt: now,
    }

    if (profile.name) {
      userPatch.name = profile.name
    }
    if (profile.email) {
      userPatch.email = profile.email
    }
    if (profile.imageUrl) {
      userPatch.imageUrl = profile.imageUrl
    }

    await ctx.db.patch(existingUser._id, userPatch)
    return existingUser
  }

  const userDocument: {
    clerkUserId: string
    name?: string
    email?: string
    imageUrl?: string
    createdAt: number
    updatedAt: number
  } = {
    clerkUserId,
    createdAt: now,
    updatedAt: now,
  }

  if (profile.name) {
    userDocument.name = profile.name
  }
  if (profile.email) {
    userDocument.email = profile.email
  }
  if (profile.imageUrl) {
    userDocument.imageUrl = profile.imageUrl
  }

  const userId = await ctx.db.insert("users", userDocument)

  return await ctx.db.get(userId)
}

async function findDefaultChat(args: {
  ctx: MutationCtx
  clerkUserId: string
  datasetId: string
}) {
  const chats = await args.ctx.db
    .query("chats")
    .withIndex("by_clerkUserId_and_datasetId", (q) =>
      q
        .eq("clerkUserId", args.clerkUserId)
        .eq("datasetId", args.datasetId),
    )
    .take(100)

  const explicitDefault = chats.find((chat) => chat.isDefault)
  if (explicitDefault) {
    return explicitDefault
  }

  const legacyDefault =
    chats.find((chat) => chat.title === "Default chat") ??
    (chats.length === 1 ? chats[0] : null)

  if (legacyDefault) {
    await args.ctx.db.patch(legacyDefault._id, {
      isDefault: true,
    })
  }

  return legacyDefault
}

async function requireOwnedChat(args: {
  ctx: QueryCtx | MutationCtx
  chatId: Id<"chats">
  clerkUserId: string
}) {
  const chat = await args.ctx.db.get(args.chatId)

  if (!chat || chat.clerkUserId !== args.clerkUserId) {
    throw new Error("Unauthorized")
  }

  return chat
}

function titleFromText(text: string) {
  const normalized = text.replace(/\s+/g, " ").trim()

  if (normalized.length <= 48) {
    return normalized || "New chat"
  }

  return `${normalized.slice(0, 45)}...`
}

export const getOrCreateDefaultChat = mutation({
  args: {
    ...profileArgs,
    datasetId: v.string(),
  },
  handler: async (ctx, args): Promise<Id<"chats">> => {
    const clerkUserId = requireClerkUserId(args.clerkUserId)
    const user = await getOrCreateCurrentUser(ctx, args)

    if (!user) {
      throw new Error("Could not create user")
    }

    const existingChat = await findDefaultChat({
      ctx,
      clerkUserId,
      datasetId: args.datasetId,
    })

    if (existingChat) {
      return existingChat._id
    }

    const now = Date.now()
    return await ctx.db.insert("chats", {
      userId: user._id,
      clerkUserId,
      datasetId: args.datasetId,
      title: "Default chat",
      isDefault: true,
      createdAt: now,
      updatedAt: now,
    })
  },
})

export const createChat = mutation({
  args: {
    ...profileArgs,
    datasetId: v.string(),
  },
  handler: async (ctx, args): Promise<Id<"chats">> => {
    const clerkUserId = requireClerkUserId(args.clerkUserId)
    const user = await getOrCreateCurrentUser(ctx, args)

    if (!user) {
      throw new Error("Could not create user")
    }

    const now = Date.now()
    return await ctx.db.insert("chats", {
      userId: user._id,
      clerkUserId,
      datasetId: args.datasetId,
      title: "New chat",
      isDefault: false,
      createdAt: now,
      updatedAt: now,
    })
  },
})

export const listChats = query({
  args: {
    clerkUserId: v.string(),
    datasetId: v.string(),
  },
  handler: async (ctx, args): Promise<Doc<"chats">[]> => {
    const clerkUserId = requireClerkUserId(args.clerkUserId)
    const chats = await ctx.db
      .query("chats")
      .withIndex("by_clerkUserId_and_datasetId", (q) =>
        q
          .eq("clerkUserId", clerkUserId)
          .eq("datasetId", args.datasetId),
      )
      .take(100)

    return chats.sort((left, right) => right.updatedAt - left.updatedAt)
  },
})

export const listMessages = query({
  args: {
    clerkUserId: v.string(),
    chatId: v.id("chats"),
  },
  handler: async (ctx, args): Promise<Doc<"messages">[]> => {
    const clerkUserId = requireClerkUserId(args.clerkUserId)
    await requireOwnedChat({
      ctx,
      chatId: args.chatId,
      clerkUserId,
    })

    return await ctx.db
      .query("messages")
      .withIndex("by_chatId_and_createdAt", (q) =>
        q.eq("chatId", args.chatId),
      )
      .order("asc")
      .take(200)
  },
})

export const seedInitialMessages = mutation({
  args: {
    clerkUserId: v.string(),
    chatId: v.id("chats"),
    initialQuestion: v.string(),
    initialAnswer: v.string(),
    initialAnalysis: v.any(),
  },
  handler: async (ctx, args): Promise<{ seeded: boolean }> => {
    const clerkUserId = requireClerkUserId(args.clerkUserId)
    const user = await getOrCreateCurrentUser(ctx, { clerkUserId })

    if (!user) {
      throw new Error("Could not create user")
    }

    await requireOwnedChat({
      ctx,
      chatId: args.chatId,
      clerkUserId,
    })

    const [existingMessage] = await ctx.db
      .query("messages")
      .withIndex("by_chatId_and_createdAt", (q) =>
        q.eq("chatId", args.chatId),
      )
      .take(1)

    if (existingMessage) {
      return { seeded: false }
    }

    const now = Date.now()
    await ctx.db.insert("messages", {
      chatId: args.chatId,
      userId: user._id,
      clerkUserId,
      role: "user",
      text: args.initialQuestion,
      createdAt: now,
    })
    await ctx.db.insert("messages", {
      chatId: args.chatId,
      userId: user._id,
      clerkUserId,
      role: "assistant",
      text: args.initialAnswer,
      analysis: args.initialAnalysis,
      createdAt: now + 1,
    })
    await ctx.db.patch(args.chatId, {
      updatedAt: now + 1,
    })

    return { seeded: true }
  },
})

export const appendMessage = mutation({
  args: {
    clerkUserId: v.string(),
    chatId: v.id("chats"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    text: v.string(),
    analysis: v.optional(v.any()),
  },
  handler: async (ctx, args): Promise<Id<"messages">> => {
    const clerkUserId = requireClerkUserId(args.clerkUserId)
    const user = await getOrCreateCurrentUser(ctx, { clerkUserId })

    if (!user) {
      throw new Error("Could not create user")
    }

    await requireOwnedChat({
      ctx,
      chatId: args.chatId,
      clerkUserId,
    })

    const now = Date.now()
    const message: {
      chatId: Id<"chats">
      userId: Id<"users">
      clerkUserId: string
      role: "user" | "assistant"
      text: string
      analysis?: unknown
      createdAt: number
    } = {
      chatId: args.chatId,
      userId: user._id,
      clerkUserId,
      role: args.role,
      text: args.text,
      createdAt: now,
    }

    if (args.analysis !== undefined) {
      message.analysis = args.analysis
    }

    const messageId = await ctx.db.insert("messages", message)
    const chatPatch: {
      title?: string
      updatedAt: number
    } = {
      updatedAt: now,
    }

    const chat = await ctx.db.get(args.chatId)
    if (
      args.role === "user" &&
      chat &&
      (!chat.title || chat.title === "Default chat" || chat.title === "New chat")
    ) {
      chatPatch.title = titleFromText(args.text)
    }

    await ctx.db.patch(args.chatId, chatPatch)

    return messageId
  },
})
