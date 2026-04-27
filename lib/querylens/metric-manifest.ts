import { getPrimarySemanticMetricDefinition, getSemanticMetricManifest } from "@/lib/querylens/semantic-manifest"
import type { MetricDefinition, MetricManifest } from "@/lib/querylens/types"

export function getMetricManifest(): MetricManifest {
  return getSemanticMetricManifest()
}

export function getPrimaryMetricDefinition(): MetricDefinition {
  return getPrimarySemanticMetricDefinition()
}
