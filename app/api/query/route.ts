import { z } from "zod"

import { analyzeQuery } from "@/lib/querylens/server/analysis-orchestrator"
import type { QueryRequestBody } from "@/lib/querylens/types"

const queryRequestSchema = z.object({
  question: z.string().min(1, "Question is required."),
  chatId: z.string().min(1).optional(),
  action: z
    .enum(["run_follow_up_question", "leadership_summary"])
    .optional(),
  followUpContext: z
    .object({
      sourceAnalysis: z.record(z.string(), z.unknown()).optional(),
    })
    .optional(),
  scope: z
    .object({
      region: z.string().optional(),
      sector: z.string().optional(),
    })
    .optional(),
})

export async function POST(request: Request) {
  try {
    const payload = queryRequestSchema.parse(await request.json()) as QueryRequestBody
    const response = await analyzeQuery(payload)
    return Response.json(response)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        {
          error: "Invalid query payload.",
          details: error.flatten(),
        },
        { status: 400 }
      )
    }

    console.error("QueryLens /api/query failed.", error)
    return Response.json(
      {
        error: "QueryLens could not analyze that request right now.",
      },
      { status: 500 }
    )
  }
}
