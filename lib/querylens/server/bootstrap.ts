import { getDatasetMetricManifest } from "@/lib/querylens/datasets"
import { analyzeQuery } from "@/lib/querylens/server/analysis-orchestrator"
import { getQueryLensDatasetRuntime } from "@/lib/querylens/server/dataset-runtime"
import { DEFAULT_FLAGSHIP_QUESTION } from "@/lib/querylens/server/query-engine-provider"
import type { BootstrapPayload } from "@/lib/querylens/types"

export async function getBootstrapPayload(): Promise<BootstrapPayload> {
  const { profileStore } = await getQueryLensDatasetRuntime()
  const profileSnapshot = await profileStore.getProfileSnapshot()

  return {
    initialQuestion: DEFAULT_FLAGSHIP_QUESTION,
    metrics: getDatasetMetricManifest().metrics,
    sourceHealth: profileSnapshot.sourceHealth,
    initialAnalysis: await analyzeQuery({
      question: DEFAULT_FLAGSHIP_QUESTION,
    }, { executionContext: "bootstrap" }),
  }
}
