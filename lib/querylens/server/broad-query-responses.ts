import { getDatasetMetricManifest } from "@/lib/querylens/datasets"
import {
  buildCashflowHistoryChartSpec,
  filterRowsForScope,
} from "@/lib/querylens/server/built-in-pipeline/common"
import {
  buildCsvPreviewResponse,
  buildOnboardedSourceCatalogResponse,
  buildOnboardedVisualOverviewResponse,
} from "@/lib/querylens/server/onboarded-analysis"
import { classifyBroadQuestion } from "@/lib/querylens/server/question-capabilities"
import { listOnboardedDatasetRecords } from "@/lib/querylens/server/dataset-registry"
import type {
  CatalogSection,
  DatasetProfileSnapshot,
  EvidenceItem,
  OnboardedDatasetRecord,
  Phase1AnalysisResponse,
  QueryRequestBody,
  ResultTable,
  WeeklyMetricRow,
} from "@/lib/querylens/types"

function buildSourceEvidence(args: {
  sourceName: string
  scope: string
  supportingFact: string
}): EvidenceItem[] {
  return [
    {
      sourceType: "postgres",
      sourceName: args.sourceName,
      timeRange: "Current dataset catalog",
      scope: args.scope,
      supportingFact: args.supportingFact,
      queryTemplateId: "broad_query_catalog",
    },
  ]
}

function firstActiveUpload(records: OnboardedDatasetRecord[]) {
  return records.find((record) => record.status === "active") ?? records[0]
}

async function listOnboardedDatasetRecordsSafely() {
  try {
    return await listOnboardedDatasetRecords()
  } catch (error) {
    console.warn("QueryLens could not list uploaded CSV datasets for broad routing.", error)
    return []
  }
}

function buildNoCsvResponse(): Phase1AnalysisResponse {
  return {
    intent: "discovery",
    headline: "No uploaded CSV dataset is active",
    summary:
      "I can show CSV rows after a CSV has been uploaded and activated. Right now, the built-in SME portfolio sources are available, and uploaded CSV preview rows are not attached to this chat context.",
    metric: "dataset_catalog",
    timeframe: "Current workspace",
    comparisonBasis: "Connected source catalog",
    confidence: 68,
    activeScope: "Workspace",
    drivers: [],
    evidence: [],
    assumptions: [
      "CSV previews require an active uploaded dataset or an explicit uploaded dataset selection.",
    ],
    supportedFollowUps: [
      "Which sources are connected?",
      "What data is currently stored?",
      "Visualize the data and show me the most important information",
    ],
    sourceMode: "database",
  }
}

function buildClarificationResponse(): Phase1AnalysisResponse {
  return {
    intent: "discovery",
    headline: "I can help once you pick a data direction",
    summary:
      "QueryLens can preview uploaded CSV rows, explain tables and sources, visualize the most important dataset signals, or answer supported cashflow and at-risk account questions. Choose one of those directions and I will keep the answer grounded in the available data.",
    metric: "dataset_catalog",
    timeframe: "Current workspace",
    comparisonBasis: "Clarifying broad request",
    confidence: 58,
    activeScope: "Workspace",
    drivers: [],
    evidence: [],
    assumptions: [
      "No specific dataset, metric, source, or visualization target was selected.",
    ],
    supportedFollowUps: [
      "Show me the data in csv",
      "Break down each table and source you have",
      "Visualize the data and show me the most important information",
    ],
    sourceMode: "database",
  }
}

function buildSourceCatalogSections(args: {
  profileSnapshot: DatasetProfileSnapshot
  uploads: OnboardedDatasetRecord[]
}): CatalogSection[] {
  return [
    {
      id: "source-catalog-postgres",
      title: "Built-in Postgres tables",
      summary: `${args.profileSnapshot.schemaSnapshot.postgres.length} approved Postgres tables are available for structured facts.`,
      items: args.profileSnapshot.schemaSnapshot.postgres.map(
        (table) =>
          `${table.name}: ${table.rowCount.toLocaleString()} rows, ${table.columns.length} columns`,
      ),
    },
    {
      id: "source-catalog-mongodb",
      title: "Built-in Mongo context",
      summary: `${args.profileSnapshot.schemaSnapshot.mongodb.length} MongoDB collections provide contextual corroboration.`,
      items: args.profileSnapshot.schemaSnapshot.mongodb.map(
        (collection) =>
          `${collection.name}: ${collection.rowCount.toLocaleString()} documents, ${collection.columns.length} fields`,
      ),
    },
    {
      id: "source-catalog-uploads",
      title: "Uploaded CSV datasets",
      summary:
        args.uploads.length > 0
          ? `${args.uploads.length} uploaded CSV dataset${args.uploads.length === 1 ? "" : "s"} are connected.`
          : "No uploaded CSV datasets are active for this user.",
      items: args.uploads.map(
        (dataset) =>
          `${dataset.label}: ${dataset.rowCount.toLocaleString()} rows, ${dataset.columns.length} columns`,
      ),
    },
  ]
}

function buildSourceCatalogTable(args: {
  profileSnapshot: DatasetProfileSnapshot
  uploads: OnboardedDatasetRecord[]
}): ResultTable {
  const rows = [
    ...args.profileSnapshot.schemaSnapshot.postgres.map((table) => ({
      source: "Built-in Postgres facts",
      object: table.name,
      kind: "postgres_table",
      rows: table.rowCount,
      fields: table.columns.length,
      description: table.description,
    })),
    ...args.profileSnapshot.schemaSnapshot.mongodb.map((collection) => ({
      source: "Built-in Mongo context",
      object: collection.name,
      kind: "mongodb_collection",
      rows: collection.rowCount,
      fields: collection.columns.length,
      description: collection.description,
    })),
    ...args.uploads.map((dataset) => ({
      source: "Uploaded CSV",
      object: dataset.label,
      kind: "csv_dataset",
      rows: dataset.rowCount,
      fields: dataset.columns.length,
      description: dataset.description,
    })),
  ]

  return {
    columns: ["source", "object", "kind", "rows", "fields", "description"],
    rows,
    totalRows: rows.length,
    truncated: false,
  }
}

function buildSourceCatalogResponse(args: {
  profileSnapshot: DatasetProfileSnapshot
  uploads: OnboardedDatasetRecord[]
}): Phase1AnalysisResponse {
  const sections = buildSourceCatalogSections(args)
  const resultTable = buildSourceCatalogTable(args)
  const sourceLabels = [
    "Built-in Postgres facts",
    "Built-in Mongo context",
    ...args.uploads.map((dataset) => dataset.label),
  ]

  return {
    intent: "discovery",
    headline: "QueryLens has structured facts, context, and uploaded data sources",
    summary: `The current workspace has ${args.profileSnapshot.schemaSnapshot.postgres.length} built-in Postgres tables, ${args.profileSnapshot.schemaSnapshot.mongodb.length} MongoDB context collections, and ${args.uploads.length} uploaded CSV dataset${args.uploads.length === 1 ? "" : "s"}. The table below breaks down each source object and the kind of data it stores.`,
    metric: "dataset_catalog",
    timeframe: "Current source catalog",
    comparisonBasis: "Source and table metadata",
    confidence: 84,
    activeScope: args.profileSnapshot.datasetLabel ?? "SME portfolio",
    drivers: [
      {
        id: "source-object-count",
        title: `${resultTable.totalRows} source objects are available`,
        impactLabel: `${resultTable.totalRows} objects`,
        direction: "positive",
        description:
          "QueryLens can answer source and schema questions from metadata without spending the bounded custom-query budget.",
      },
    ],
    evidence: buildSourceEvidence({
      sourceName: "Source catalog",
      scope: args.profileSnapshot.datasetLabel ?? "SME portfolio",
      supportingFact: `${resultTable.totalRows} source objects were read from the approved profile snapshot and uploaded dataset registry.`,
    }),
    assumptions: [
      "Source catalog answers describe available metadata and previews rather than recomputing analytical metrics.",
    ],
    supportedFollowUps: [
      "Show me the data in csv",
      "Visualize the data and show me the most important information",
      "What metrics are available?",
    ],
    discoverySummary: {
      datasetLabel: args.profileSnapshot.datasetLabel ?? "SME portfolio",
      sourceLabels,
      metricCount: getDatasetMetricManifest().metrics.length,
      timeCoverage: `${args.profileSnapshot.dateCoverage.startDate} to ${args.profileSnapshot.dateCoverage.endDate}`,
      dimensionLabels: ["Portfolio", "Region", "Sector", "Region / sector"],
    },
    catalogSections: sections,
    resultTable,
    sourceMode: "database",
  }
}

function buildBuiltInVisualOverviewResponse(args: {
  profileSnapshot: DatasetProfileSnapshot
  weeklyRows: WeeklyMetricRow[]
}): Phase1AnalysisResponse {
  const portfolioRows = filterRowsForScope(args.weeklyRows, {})
  const latestPortfolio = portfolioRows.at(-1)
  const latestWeek = latestPortfolio?.weekStart
  const latestRegions = latestWeek
    ? args.weeklyRows
        .filter((row) => row.weekStart === latestWeek && row.recordType === "region")
        .sort((left, right) => left.cashflowHealthScore - right.cashflowHealthScore)
    : []
  const weakestRegion = latestRegions[0]
  const latestSectors = latestWeek
    ? args.weeklyRows
        .filter((row) => row.weekStart === latestWeek && row.recordType === "sector")
        .sort((left, right) => left.cashflowHealthScore - right.cashflowHealthScore)
    : []
  const weakestSector = latestSectors[0]
  const summaryParts = [
    latestPortfolio
      ? `Latest portfolio cashflow health is ${latestPortfolio.cashflowHealthScore.toFixed(1)} for the week starting ${latestPortfolio.weekStart}.`
      : "Portfolio cashflow health is not available in the current rows.",
    weakestRegion?.regionName
      ? `${weakestRegion.regionName} is the weakest regional slice in the latest week.`
      : undefined,
    weakestSector?.sectorName
      ? `${weakestSector.sectorName} is the weakest sector slice in the latest week.`
      : undefined,
  ].filter(Boolean)

  return {
    intent: "discovery",
    headline: "The key view is portfolio cashflow health over time",
    summary: summaryParts.join(" "),
    metric: "cashflow_health_score",
    timeframe: `${args.profileSnapshot.dateCoverage.startDate} to ${args.profileSnapshot.dateCoverage.endDate}`,
    comparisonBasis: "Visual overview of built-in weekly portfolio metrics",
    confidence: 84,
    activeScope: args.profileSnapshot.datasetLabel ?? "SME portfolio",
    drivers: [
      ...(latestPortfolio
        ? [
            {
              id: "latest-portfolio-score",
              title: "Latest portfolio score",
              impactLabel: latestPortfolio.cashflowHealthScore.toFixed(1),
              direction: "positive" as const,
              description:
                "This score is the headline metric QueryLens uses to anchor the built-in SME portfolio story.",
            },
          ]
        : []),
      ...(weakestRegion?.regionName
        ? [
            {
              id: "weakest-region",
              title: `${weakestRegion.regionName} needs the closest read`,
              impactLabel: weakestRegion.cashflowHealthScore.toFixed(1),
              direction: "negative" as const,
              description:
                "This is the lowest regional cashflow health score in the latest available weekly slice.",
            },
          ]
        : []),
    ],
    chartSpec: buildCashflowHistoryChartSpec(
      portfolioRows,
      args.profileSnapshot.datasetLabel ?? "SME portfolio",
    ),
    evidence: buildSourceEvidence({
      sourceName: "Built-in Postgres facts",
      scope: args.profileSnapshot.datasetLabel ?? "SME portfolio",
      supportingFact: "Weekly portfolio metric rows were used to create the visual overview.",
    }),
    assumptions: [
      "The visual overview chooses the built-in portfolio cashflow health metric as the safest headline chart.",
    ],
    supportedFollowUps: [
      "Why did SME cashflow health drop last week?",
      "What makes up at-risk accounts by region and sector last week?",
      "Break down each table and source you have",
    ],
    resultTable: {
      columns: [
        "weekStart",
        "weekEnd",
        "cashflowHealthScore",
        "accountCount",
        "lowBalanceShare",
        "overdueShare",
      ],
      rows: portfolioRows.map((row) => ({
        weekStart: row.weekStart,
        weekEnd: row.weekEnd,
        cashflowHealthScore: row.cashflowHealthScore,
        accountCount: row.accountCount,
        lowBalanceShare: row.lowBalanceShare,
        overdueShare: row.overdueShare,
      })),
      totalRows: portfolioRows.length,
      truncated: false,
    },
    sourceMode: "database",
  }
}

export async function answerBroadQuestion(args: {
  input: QueryRequestBody
  profileSnapshot: DatasetProfileSnapshot
  weeklyRows: WeeklyMetricRow[]
}): Promise<Phase1AnalysisResponse | undefined> {
  const capability = classifyBroadQuestion(args.input.question)
  if (!capability) {
    return undefined
  }

  if (capability === "clarification") {
    return buildClarificationResponse()
  }

  if (capability === "csv_preview") {
    const uploads = await listOnboardedDatasetRecordsSafely()
    const upload = firstActiveUpload(uploads)
    return upload ? buildCsvPreviewResponse(upload) : buildNoCsvResponse()
  }

  if (capability === "source_catalog") {
    const uploads = await listOnboardedDatasetRecordsSafely()
    return buildSourceCatalogResponse({
      profileSnapshot: args.profileSnapshot,
      uploads,
    })
  }

  if (capability === "visual_overview") {
    if (/\b(csv|uploaded|upload)\b/i.test(args.input.question)) {
      const uploads = await listOnboardedDatasetRecordsSafely()
      const upload = firstActiveUpload(uploads)
      if (!upload) {
        return buildNoCsvResponse()
      }

      return buildOnboardedVisualOverviewResponse(upload)
    }

    return buildBuiltInVisualOverviewResponse({
      profileSnapshot: args.profileSnapshot,
      weeklyRows: args.weeklyRows,
    })
  }

  return undefined
}
