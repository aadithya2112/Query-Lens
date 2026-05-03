import { auth } from "@clerk/nextjs/server"

import { importCsvDataset, isCsvImportError } from "@/lib/querylens/server/csv-onboarding"
import type { DatasetImportErrorPayload } from "@/lib/querylens/types"

export async function POST(request: Request) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return Response.json(
        {
          error: "Not authenticated.",
        },
        { status: 401 }
      )
    }

    const formData = await request.formData()
    const file = formData.get("file")

    if (!(file instanceof File)) {
      return Response.json(
        {
          error: "CSV file is required.",
        },
        { status: 400 }
      )
    }

    const bytes = new Uint8Array(await file.arrayBuffer())
    const dataset = await importCsvDataset({
      filename: file.name,
      bytes,
    })

    return Response.json({
      dataset,
    })
  } catch (error) {
    if (isCsvImportError(error)) {
      const payload: DatasetImportErrorPayload = {
        error: error.message,
        code: error.code,
        retryable: error.retryable,
        provider: error.provider,
      }

      return Response.json(payload, { status: error.status })
    }

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "QueryLens could not import that CSV.",
        code: "csv_import_failed",
        retryable: false,
      },
      { status: 500 }
    )
  }
}
