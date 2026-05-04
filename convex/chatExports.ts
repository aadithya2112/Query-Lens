import { v } from "convex/values"

import type { Id, Doc } from "./_generated/dataModel"
import { mutation, query } from "./_generated/server"
import type { MutationCtx, QueryCtx } from "./_generated/server"
import { requireClerkUserId } from "./clerkUsers"

async function requireOwnedChat(args: {
  ctx: QueryCtx | MutationCtx
  chatId: Id<"chats">
  clerkUserId: string
}): Promise<Doc<"chats">> {
  const chat = await args.ctx.db.get(args.chatId)
  if (!chat || chat.clerkUserId !== args.clerkUserId) {
    throw new Error("Unauthorized")
  }

  return chat
}

export const generateUploadUrl = mutation({
  args: {
    clerkUserId: v.string(),
    chatId: v.id("chats"),
  },
  handler: async (ctx, args): Promise<{ uploadUrl: string }> => {
    const clerkUserId = requireClerkUserId(args.clerkUserId)
    await requireOwnedChat({
      ctx,
      chatId: args.chatId,
      clerkUserId,
    })

    const uploadUrl = await ctx.storage.generateUploadUrl()
    return { uploadUrl }
  },
})

export const getSignedPdfUrl = query({
  args: {
    clerkUserId: v.string(),
    chatId: v.id("chats"),
    storageId: v.id("_storage"),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ url: string; expiresInHint: string } | null> => {
    const clerkUserId = requireClerkUserId(args.clerkUserId)
    await requireOwnedChat({
      ctx,
      chatId: args.chatId,
      clerkUserId,
    })

    const url = await ctx.storage.getUrl(args.storageId)
    if (!url) {
      return null
    }

    return {
      url,
      expiresInHint: "temporary",
    }
  },
})
