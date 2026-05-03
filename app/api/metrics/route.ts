import { auth } from "@clerk/nextjs/server"

import { getDatasetMetricManifest } from "@/lib/querylens/datasets"
import { getOnboardedDatasetRecord } from "@/lib/querylens/server/dataset-registry"

export async function GET(request: Request) {
  const { userId } = await auth()

  if (!userId) {
    return Response.json(
      {
        error: "Not authenticated.",
      },
      { status: 401 }
    )
  }

  const { searchParams } = new URL(request.url)
  const datasetId = searchParams.get("datasetId")

  if (!datasetId || datasetId === "sme_portfolio") {
    return Response.json(getDatasetMetricManifest())
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
    metrics: dataset.semanticDraft.metrics.map((metric) => ({
      id: metric.id,
      label: metric.label,
      description: metric.description ?? "",
      scale: "numeric",
      supportedIntents: metric.supportedIntents,
      supportedDimensions: ["portfolio"],
      supportedTimeframes: ["custom"],
      synonyms: metric.synonyms ?? [],
      exampleQuestions: metric.exampleQuestions ?? [],
    })),
  })
}
