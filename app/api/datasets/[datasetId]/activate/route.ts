import { auth } from "@clerk/nextjs/server"

import { activateOnboardedDataset, getOnboardedDatasetRecord } from "@/lib/querylens/server/dataset-registry"

export async function POST(
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

  const dataset = await getOnboardedDatasetRecord(datasetId)

  if (!dataset) {
    return Response.json(
      {
        error: "Dataset not found.",
      },
      { status: 404 }
    )
  }

  return Response.json({
    dataset: await activateOnboardedDataset(datasetId),
  })
}
