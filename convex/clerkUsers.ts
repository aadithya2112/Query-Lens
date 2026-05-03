import type { Doc } from "./_generated/dataModel"
import type { MutationCtx } from "./_generated/server"

export function requireClerkUserId(clerkUserId: string) {
  const trimmed = clerkUserId.trim()

  if (!trimmed) {
    throw new Error("Missing Clerk user id")
  }

  return trimmed
}

export async function getOrCreateCurrentUser(
  ctx: MutationCtx,
  profile: {
    clerkUserId: string
    name?: string
    email?: string
    imageUrl?: string
  },
): Promise<Doc<"users">> {
  const clerkUserId = requireClerkUserId(profile.clerkUserId)
  const now = Date.now()
  const [existingUser] = await ctx.db
    .query("users")
    .withIndex("by_clerkUserId", (q) => q.eq("clerkUserId", clerkUserId))
    .take(1)

  if (existingUser) {
    const patch: {
      name?: string
      email?: string
      imageUrl?: string
      updatedAt: number
    } = {
      updatedAt: now,
    }

    if (profile.name) {
      patch.name = profile.name
    }
    if (profile.email) {
      patch.email = profile.email
    }
    if (profile.imageUrl) {
      patch.imageUrl = profile.imageUrl
    }

    await ctx.db.patch(existingUser._id, patch)

    return {
      ...existingUser,
      ...patch,
    }
  }

  const userId = await ctx.db.insert("users", {
    clerkUserId,
    name: profile.name,
    email: profile.email,
    imageUrl: profile.imageUrl,
    createdAt: now,
    updatedAt: now,
  })

  const user = await ctx.db.get(userId)

  if (!user) {
    throw new Error("Could not create user")
  }

  return user
}
