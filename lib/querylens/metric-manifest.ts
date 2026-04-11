import manifest from "@/data/metric-manifest.json"
import type { MetricDefinition, MetricManifest } from "@/lib/querylens/types"

const metricManifest = manifest as MetricManifest

export function getMetricManifest(): MetricManifest {
  return metricManifest
}

export function getPrimaryMetricDefinition(): MetricDefinition {
  return metricManifest.metrics[0]
}
