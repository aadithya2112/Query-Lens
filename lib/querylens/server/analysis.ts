import { analyzeQuery } from "@/lib/querylens/server/analysis-orchestrator"
import type { QueryLensExecutionContext } from "@/lib/querylens/server/ai-config"
import type { Phase1AnalysisResponse, QueryRequestBody } from "@/lib/querylens/types"

export async function analyzePhase1Query(
  input: QueryRequestBody,
  options: { executionContext?: QueryLensExecutionContext } = {}
): Promise<Phase1AnalysisResponse> {
  return analyzeQuery(input, options)
}
