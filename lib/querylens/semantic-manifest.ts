import manifest from "@/data/semantic-manifest.json"
import type {
  DatasetId,
  MetricDefinition,
  MetricManifest,
  ScopeFilter,
  SemanticEntityDefinition,
  SemanticManifest,
  SemanticSourceDefinition,
  ScopeType,
} from "@/lib/querylens/types"

const semanticManifest = manifest as SemanticManifest
const DEFAULT_DATASET_ID: DatasetId = "sme_portfolio"

function getEntityCatalogKey(scopeType: "region" | "sector") {
  return scopeType === "region" ? "regions" : "sectors"
}

export function getSemanticManifest(
  datasetId: DatasetId = DEFAULT_DATASET_ID,
): SemanticManifest {
  if (datasetId !== DEFAULT_DATASET_ID) {
    return semanticManifest
  }

  return semanticManifest
}

export function getSemanticMetricManifest(
  datasetId: DatasetId = DEFAULT_DATASET_ID,
): MetricManifest {
  return {
    metrics: getSemanticManifest(datasetId).metrics,
  }
}

export function getSemanticDimensions(datasetId: DatasetId = DEFAULT_DATASET_ID) {
  return getSemanticManifest(datasetId).dimensions
}

export function getSemanticEntityCatalog(
  scopeType: "region" | "sector",
  datasetId: DatasetId = DEFAULT_DATASET_ID,
): SemanticEntityDefinition[] {
  return getSemanticManifest(datasetId).entities[getEntityCatalogKey(scopeType)]
}

export function getSemanticSourceMappings(
  datasetId: DatasetId = DEFAULT_DATASET_ID,
): SemanticSourceDefinition[] {
  return getSemanticManifest(datasetId).sources
}

export function getSemanticSupportedQuestions(
  datasetId: DatasetId = DEFAULT_DATASET_ID,
): string[] {
  return getSemanticManifest(datasetId).supportedQuestions
}

export function getSemanticMetricDefinition(
  metricId: MetricDefinition["id"],
  datasetId: DatasetId = DEFAULT_DATASET_ID,
): MetricDefinition | undefined {
  return getSemanticManifest(datasetId).metrics.find((metric) => metric.id === metricId)
}

export function getPrimarySemanticMetricDefinition(
  datasetId: DatasetId = DEFAULT_DATASET_ID,
): MetricDefinition {
  return getSemanticManifest(datasetId).metrics[0]
}

export function findSemanticEntityById(
  scopeType: "region" | "sector",
  id: string,
  datasetId: DatasetId = DEFAULT_DATASET_ID,
): SemanticEntityDefinition | undefined {
  return getSemanticEntityCatalog(scopeType, datasetId).find((entity) => entity.id === id)
}

export function findSemanticEntityByText(
  scopeType: "region" | "sector",
  rawValue: string | undefined,
  datasetId: DatasetId = DEFAULT_DATASET_ID,
): SemanticEntityDefinition | undefined {
  if (!rawValue) {
    return undefined
  }

  const normalizedCandidate = normalizeSemanticText(rawValue)

  return getSemanticEntityCatalog(scopeType, datasetId).find((entity) => {
    const candidates = [
      entity.id.replace(/_/g, " "),
      entity.label,
      ...(entity.aliases ?? []),
    ].map(normalizeSemanticText)

    return candidates.some(
      (candidate) =>
        normalizedCandidate === candidate ||
        normalizedCandidate.includes(candidate),
    )
  })
}

export function getSemanticEntityLabel(
  scopeType: "region" | "sector",
  id: string | undefined,
  datasetId: DatasetId = DEFAULT_DATASET_ID,
): string | undefined {
  if (!id) {
    return undefined
  }

  return findSemanticEntityById(scopeType, id, datasetId)?.label
}

export function getSupportedEntityLabels(
  datasetId: DatasetId = DEFAULT_DATASET_ID,
) {
  return {
    regions: getSemanticEntityCatalog("region", datasetId).map((region) => region.label),
    sectors: getSemanticEntityCatalog("sector", datasetId).map((sector) => sector.label),
  }
}

export function getScopeLabel(
  scope: ScopeFilter,
  datasetId: DatasetId = DEFAULT_DATASET_ID,
) {
  const regionLabel = getSemanticEntityLabel("region", scope.region, datasetId)
  const sectorLabel = getSemanticEntityLabel("sector", scope.sector, datasetId)

  if (regionLabel && sectorLabel) {
    return `${regionLabel} / ${sectorLabel}`
  }

  if (regionLabel) {
    return regionLabel
  }

  if (sectorLabel) {
    return sectorLabel
  }

  return getSemanticManifest(datasetId).dataset.portfolioLabel
}

export function getScopeTypeLabel(
  scopeType: ScopeType,
  datasetId: DatasetId = DEFAULT_DATASET_ID,
) {
  return getSemanticDimensions(datasetId).find((dimension) => dimension.id === scopeType)?.label
}

export function normalizeSemanticText(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}
