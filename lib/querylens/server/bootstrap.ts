import { getDatasetMetricManifest } from "@/lib/querylens/datasets"
import { analyzeQuery } from "@/lib/querylens/server/analysis-orchestrator"
import { getQueryLensDatasetRuntime } from "@/lib/querylens/server/dataset-runtime"
import { getOnboardedDatasetRecord, listRegisteredDatasets } from "@/lib/querylens/server/dataset-registry"
import { resolveBootstrapDatasetId } from "@/lib/querylens/server/onboarded-analysis"
import { DEFAULT_FLAGSHIP_QUESTION } from "@/lib/querylens/server/query-engine-provider"
import type { BootstrapPayload } from "@/lib/querylens/types"

export async function getBootstrapPayload(datasetId?: string): Promise<BootstrapPayload> {
  const resolvedDatasetId = await resolveBootstrapDatasetId(datasetId)
  const datasets = await listRegisteredDatasets()

  if (resolvedDatasetId !== "sme_portfolio") {
    const dataset = await getOnboardedDatasetRecord(resolvedDatasetId)
    if (!dataset) {
      return getBootstrapPayload("sme_portfolio")
    }

    const initialQuestion = "What data is currently stored?"
    return {
      datasetId: resolvedDatasetId,
      datasets,
      initialQuestion,
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
      sourceHealth: [
        {
          id: "postgres",
          name: "Onboarded CSV facts",
          type: "postgres",
          status: dataset.status === "active" ? "connected" : "draft",
          detail: `${dataset.rowCount} imported rows`,
          recordCount: dataset.rowCount,
        },
      ],
      initialAnalysis: await analyzeQuery(
        {
          question: initialQuestion,
          datasetId: resolvedDatasetId,
        },
        { executionContext: "bootstrap" }
      ),
    }
  }

  const { profileStore } = await getQueryLensDatasetRuntime()
  const profileSnapshot = await profileStore.getProfileSnapshot()

  return {
    datasetId: resolvedDatasetId,
    datasets,
    initialQuestion: DEFAULT_FLAGSHIP_QUESTION,
    metrics: getDatasetMetricManifest().metrics,
    sourceHealth: profileSnapshot.sourceHealth,
    initialAnalysis: await analyzeQuery(
      {
        question: DEFAULT_FLAGSHIP_QUESTION,
        datasetId: resolvedDatasetId,
      },
      { executionContext: "bootstrap" }
    ),
  }
}
