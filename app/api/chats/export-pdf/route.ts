import { z } from "zod"
import { auth } from "@clerk/nextjs/server"
import { fetchMutation, fetchQuery } from "convex/nextjs"

import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { buildChatTranscriptPdf } from "@/lib/querylens/server/chat-pdf"
import type { ChartSpec } from "@/lib/querylens/types"

const exportRequestSchema = z.object({
  chatId: z.string().min(1, "Chat is required."),
  datasetId: z.string().min(1).optional(),
})

export const runtime = "nodejs"
const MAX_CHARTS_IN_EXPORT = 24

function extractChartSpec(analysis: unknown): ChartSpec | undefined {
  if (!analysis || typeof analysis !== "object") {
    return undefined
  }

  const maybeChart = (analysis as { chartSpec?: unknown }).chartSpec
  if (!maybeChart || typeof maybeChart !== "object") {
    return undefined
  }

  const maybeType = (maybeChart as { type?: unknown }).type
  if (maybeType !== "line" && maybeType !== "bar" && maybeType !== "pie") {
    return undefined
  }

  return maybeChart as ChartSpec
}

export async function POST(request: Request) {
  try {
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) {
      return Response.json(
        {
          error: "Not authenticated.",
        },
        { status: 401 },
      )
    }

    const payload = exportRequestSchema.parse(await request.json())
    const chatId = payload.chatId as Id<"chats">

    const messages = await fetchQuery(api.chats.listMessages, {
      clerkUserId,
      chatId,
    })

    let chartCount = 0
    const exportMessages: Array<{
      role: "user" | "assistant"
      text: string
      createdAt: number
      chartTitle?: string
      chartSpec?: ChartSpec
    }> = []

    for (const message of messages) {
      const chartSpec =
        chartCount < MAX_CHARTS_IN_EXPORT
          ? extractChartSpec(message.analysis)
          : undefined

      if (chartSpec) {
        chartCount += 1
      }

      exportMessages.push({
        role: message.role,
        text: message.text,
        createdAt: message.createdAt,
        chartTitle: chartSpec?.title,
        chartSpec,
      })
    }

    const pdfBytes = await buildChatTranscriptPdf({
      title: "QueryLens Chat Export",
      datasetId: payload.datasetId,
      generatedAt: new Date(),
      messages: exportMessages,
    })

    const { uploadUrl } = await fetchMutation(api.chatExports.generateUploadUrl, {
      clerkUserId,
      chatId,
    })
    const uploadResponse = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/pdf",
      },
      body: new Blob([pdfBytes], {
        type: "application/pdf",
      }),
    })

    if (!uploadResponse.ok) {
      throw new Error("Upload failed")
    }

    const uploadPayload = (await uploadResponse.json()) as {
      storageId: Id<"_storage">
    }

    const signed = await fetchQuery(api.chatExports.getSignedPdfUrl, {
      clerkUserId,
      chatId,
      storageId: uploadPayload.storageId,
    })

    if (!signed) {
      throw new Error("Could not create signed URL")
    }

    return Response.json(signed)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        {
          error: "Invalid export payload.",
          details: error.flatten(),
        },
        { status: 400 },
      )
    }

    console.error("QueryLens /api/chats/export-pdf failed.", error)
    return Response.json(
      {
        error: "QueryLens could not export this chat right now.",
      },
      { status: 500 },
    )
  }
}
