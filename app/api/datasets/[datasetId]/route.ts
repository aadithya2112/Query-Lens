import { auth } from "@clerk/nextjs/server"

import { isBuiltInDatasetId } from "@/lib/querylens/datasets"
import { getOnboardedDatasetRecord } from "@/lib/querylens/server/dataset-registry"

export async function GET(
  _request: Request,
  context: { params: Promise<{ datasetId: string }> }
) {
  const { datasetId } = await context.params
  const { userId } = await auth()

  if (!userId) {
    return Response.json(
      {
        error: "Not authenticated.",
      },
      { status: 401 }
    )
  }

  if (isBuiltInDatasetId(datasetId)) {
    return Response.json({
      dataset: {
        id: "sme_portfolio",
        label: "SME portfolio",
        description: "Built-in QueryLens sample dataset.",
        status: "built_in",
      },
    })
  }

  const dataset = await getOnboardedDatasetRecord(datasetId)
  if (!dataset) {
    return Response.json(
      {
        error: "Dataset not found.",
      },
      { status: 404 }
    )
  }

  return Response.json({ dataset })
}
