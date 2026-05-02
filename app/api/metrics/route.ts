import { getDatasetMetricManifest } from "@/lib/querylens/datasets"
import { getOnboardedDatasetRecord } from "@/lib/querylens/server/dataset-registry"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const datasetId = searchParams.get("datasetId")

  if (!datasetId || datasetId === "sme_portfolio") {
    return Response.json(getDatasetMetricManifest())
  }

  const dataset = await getOnboardedDatasetRecord(datasetId)
  return Response.json({
    metrics: dataset?.semanticDraft.metrics.map((metric) => ({
      id: metric.id,
      label: metric.label,
      description: metric.description ?? "",
      scale: "numeric",
      supportedIntents: metric.supportedIntents,
      supportedDimensions: ["portfolio"],
      supportedTimeframes: ["custom"],
      synonyms: metric.synonyms ?? [],
      exampleQuestions: metric.exampleQuestions ?? [],
    })) ?? [],
  })
}
