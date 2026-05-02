import { activateOnboardedDataset, getOnboardedDatasetRecord } from "@/lib/querylens/server/dataset-registry"

export async function POST(
  _request: Request,
  context: { params: Promise<{ datasetId: string }> }
) {
  const { datasetId } = await context.params
  const dataset = await getOnboardedDatasetRecord(datasetId)

  if (!dataset) {
    return Response.json(
      {
        error: "Dataset not found.",
      },
      { status: 404 }
    )
  }

  await activateOnboardedDataset(datasetId)

  return Response.json({
    dataset: await getOnboardedDatasetRecord(datasetId),
  })
}
