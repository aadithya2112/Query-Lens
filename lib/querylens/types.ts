export type DatasetId = "sme_portfolio"
export type MetricId = "cashflow_health_score" | "at_risk_account_count"
export type SupportedTimeframe = "this_week" | "last_week"
export type QueryIntent = "what_changed" | "breakdown"
export type ScopeDimension = "portfolio" | "region" | "sector"
export type ScopeType = "portfolio" | "region" | "sector" | "region_sector"
export type BreakdownDimension = "region" | "sector" | "region_sector"
export type ContextCollection =
  | "complaints"
  | "service_incidents"
  | "risk_alerts"
  | "rm_notes"

export interface ScopeFilter {
  region?: string
  sector?: string
}

export interface MetricDefinition {
  id: MetricId
  label: string
  description: string
  scale: string
  supportedIntents: QueryIntent[]
  weights: {
    inflowOutflowRatio: number
    balanceTrend: number
    lowBalanceExposure: number
    overdueExposure: number
  }
  supportedDimensions: string[]
  supportedTimeframes: string[]
  synonyms: string[]
  exampleQuestions: string[]
}

export interface MetricManifest {
  metrics: MetricDefinition[]
}

export interface DatasetDefinition {
  id: DatasetId
  label: string
  description: string
  dimensions: Array<"portfolio" | "region" | "sector">
  metrics: MetricDefinition[]
  supportedIntentIds: string[]
  supportedTimeframes: SupportedTimeframe[]
}

export interface Region {
  id: string
  name: string
}

export interface Sector {
  id: string
  name: string
}

export interface Account {
  id: string
  businessName: string
  regionId: string
  sectorId: string
  segment: "starter" | "growth" | "established"
  lowBalanceThreshold: number
  baseDailyInbound: number
  baseDailyOutbound: number
  baseBalance: number
  baseUtilization: number
}

export interface DailyAccountMetric {
  accountId: string
  date: string
  weekStart: string
  regionId: string
  sectorId: string
  inboundPayments: number
  outboundPayments: number
  endBalance: number
  loanUtilization: number
  lowBalanceFlag: boolean
  overdueFlag: boolean
}

export interface WeeklyMetricRow {
  weekStart: string
  weekEnd: string
  recordType: ScopeType
  regionId: string | null
  sectorId: string | null
  regionName: string | null
  sectorName: string | null
  accountCount: number
  inboundPayments: number
  outboundPayments: number
  openingBalance: number
  closingBalance: number
  lowBalanceShare: number
  overdueShare: number
  avgUtilization: number
  inflowOutflowScore: number
  balanceTrendScore: number
  lowBalanceScore: number
  overdueScore: number
  cashflowHealthScore: number
}

export interface ContextEvent {
  id: string
  collection: ContextCollection
  occurredAt: string
  weekStart: string
  regionId: string | null
  sectorId: string | null
  regionName: string | null
  sectorName: string | null
  severity: "high" | "medium" | "low"
  summary: string
  detail: string
}

export interface WeeklyAccountStressRow {
  weekStart: string
  accountId: string
  regionId: string
  sectorId: string
  regionName: string
  sectorName: string
  lowBalanceDays: number
  hasOverdue: boolean
}

export interface SeedDataset {
  regions: Region[]
  sectors: Sector[]
  accounts: Account[]
  dailyMetrics: DailyAccountMetric[]
  weeklyMetrics: WeeklyMetricRow[]
  contextEvents: Record<ContextCollection, ContextEvent[]>
}

export interface ComparisonWindow {
  timeframe: SupportedTimeframe
  comparisonBasis: "prior_period"
}

export interface StructuredQueryPlan {
  datasetId: DatasetId
  rawQuestion: string
  intent: QueryIntent
  metricId: MetricId
  timeframe: SupportedTimeframe
  scope: ScopeFilter
  scopeDimensions: ScopeDimension[]
  comparisonWindow: ComparisonWindow
  breakdownDimension?: BreakdownDimension
}

export interface QueryPlanFallback {
  fallbackReason: string
}

export interface QueryPlanResult {
  plan?: StructuredQueryPlan
  parsed?: StructuredQueryPlan
  fallbackReason?: string
}

export type ParsedPhase1Query = StructuredQueryPlan

export interface DriverItem {
  id: string
  title: string
  impactLabel: string
  direction: "negative" | "positive"
  description: string
}

export interface EvidenceItem {
  sourceType: "postgres" | "mongodb"
  sourceName: string
  timeRange: string
  scope: string
  supportingFact: string
  queryTemplateId: string
}

export interface Phase1ChartPoint {
  label: string
  weekStart: string
  weekEnd: string
  score: number
}

export interface ChartSpec {
  type: "line"
  title: string
  xKey: "label"
  yKey: "score"
  data: Phase1ChartPoint[]
  explanation: string
}

export interface Phase1AnalysisResponse {
  headline: string
  summary: string
  metric: MetricId
  timeframe: string
  comparisonBasis: string
  confidence: number
  activeScope: string
  drivers: DriverItem[]
  chartSpec: ChartSpec
  evidence: EvidenceItem[]
  assumptions: string[]
  supportedFollowUps: string[]
  fallback?: boolean
  sourceMode: "database" | "fixture"
}

export interface QueryRequestBody {
  question: string
  scope?: ScopeFilter
}

export interface SourceHealth {
  id: string
  name: string
  type: "postgres" | "mongodb" | "manifest"
  status: "connected" | "seeded-fixture" | "configured"
  detail: string
  recordCount?: number
}

export interface BootstrapPayload {
  initialQuestion: string
  metric: MetricDefinition
  sourceHealth: SourceHealth[]
  initialAnalysis: Phase1AnalysisResponse
}
