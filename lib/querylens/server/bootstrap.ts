import { getPrimaryMetricDefinition } from "@/lib/querylens/metric-manifest"
import { analyzePhase1Query } from "@/lib/querylens/server/analysis"
import { DEFAULT_FLAGSHIP_QUESTION } from "@/lib/querylens/server/analysis-provider"
import { getQueryLensDataAccess } from "@/lib/querylens/server/repositories"
import type { BootstrapPayload } from "@/lib/querylens/types"

export async function getBootstrapPayload(): Promise<BootstrapPayload> {
  const dataAccess = await getQueryLensDataAccess()

  return {
    initialQuestion: DEFAULT_FLAGSHIP_QUESTION,
    metric: getPrimaryMetricDefinition(),
    sourceHealth: await dataAccess.getSourceHealth(),
    initialAnalysis: await analyzePhase1Query({
      question: DEFAULT_FLAGSHIP_QUESTION,
    }, { executionContext: "bootstrap" }),
  }
}
