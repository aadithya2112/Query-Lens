export type DatasetId = "sme_portfolio"
export type MetricId =
  | "cashflow_health_score"
  | "at_risk_account_count"
  | "dataset_catalog"
  | "custom_query_result"
export type SupportedTimeframe = "this_week" | "last_week"
export type PlannedTimeframe = SupportedTimeframe | "custom"
export type QueryIntent =
  | "what_changed"
  | "breakdown"
  | "compare"
  | "discovery"
  | "agentic_query"
export type ScopeDimension = "portfolio" | "region" | "sector"
export type ScopeType = "portfolio" | "region" | "sector" | "region_sector"
export type BreakdownDimension = "region" | "sector" | "region_sector"
export type CompareMode = "timeframe" | "peer"
export type CompareDimension = "region" | "sector"
export type DiscoveryFocus =
  | "overview"
  | "metrics"
  | "sources"
  | "dimensions"
  | "time_coverage"
  | "questions"
export type ContextCollection =
  | "complaints"
  | "service_incidents"
  | "risk_alerts"
  | "rm_notes"

export interface ScopeFilter {
  region?: string
  sector?: string
}

export interface DateWindow {
  startDate: string
  endDate: string
  dayCount: number
  label: string
  relativeTimeframe?: SupportedTimeframe
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
  supportedTimeframes: PlannedTimeframe[]
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
  supportedTimeframes: PlannedTimeframe[]
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

export interface SampleDataset {
  regions: Region[]
  sectors: Sector[]
  accounts: Account[]
  dailyMetrics: DailyAccountMetric[]
  weeklyMetrics: WeeklyMetricRow[]
  contextEvents: Record<ContextCollection, ContextEvent[]>
}

export type SeedDataset = SampleDataset

export interface ComparisonWindow {
  timeframe: PlannedTimeframe
  comparisonBasis: "prior_period"
  targetWindow: DateWindow
  comparisonDateWindow?: DateWindow
}

export interface CompareSpec {
  mode: CompareMode
  dimension?: CompareDimension
  leftTimeframe?: SupportedTimeframe
  rightTimeframe?: SupportedTimeframe
  selectedTimeframe?: SupportedTimeframe
  leftWindow?: DateWindow
  rightWindow?: DateWindow
  selectedWindow?: DateWindow
  leftScope: ScopeFilter
  rightScope: ScopeFilter
  leftLabel: string
  rightLabel: string
}

export interface StructuredQueryPlan {
  datasetId: DatasetId
  rawQuestion: string
  intent: QueryIntent
  metricId: MetricId
  timeframe: PlannedTimeframe
  dateWindow: DateWindow
  scope: ScopeFilter
  scopeDimensions: ScopeDimension[]
  comparisonWindow: ComparisonWindow
  breakdownDimension?: BreakdownDimension
  compareSpec?: CompareSpec
  discoveryFocus?: DiscoveryFocus
}

export interface QueryPlanFallback {
  fallbackReason: string
}

export type QueryPlanFailureKind =
  | "unsupported"
  | "guided_failure"
  | "model_unavailable"

export interface QueryPlanResult {
  plan?: StructuredQueryPlan
  parsed?: StructuredQueryPlan
  fallbackReason?: string
  failureKind?: QueryPlanFailureKind
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

export interface ChartDatum {
  [key: string]: string | number | undefined
}

interface BaseChartSpec {
  title: string
  explanation: string
  data: ChartDatum[]
}

export interface CartesianChartSpec extends BaseChartSpec {
  type: "line" | "bar"
  xKey: string
  yKey: string
}

export interface PieChartSpec extends BaseChartSpec {
  type: "pie"
  labelKey: string
  valueKey: string
}

export type ChartSpec = CartesianChartSpec | PieChartSpec
export type QueryAction = "run_follow_up_question" | "leadership_summary"
export type InterpretationMode = "direct" | "guided_reroute" | "fallback"
export type ResponsePresentationMode = "default" | "leadership_summary"

export interface ResultTable {
  columns: string[]
  rows: Array<Record<string, string | number | boolean | null>>
  totalRows: number
  truncated: boolean
}

export interface QueryRun {
  id: string
  title: string
  sourceType: "postgres" | "mongodb"
  language: "sql" | "mongodb"
  statement: string
  status: "completed" | "rejected" | "failed"
  rowCount: number
  summary: string
}

export interface ComparisonSummary {
  mode: CompareMode
  leftLabel: string
  leftValue: number
  rightLabel: string
  rightValue: number
  delta: number
  winnerLabel?: string
  tie?: boolean
}

export interface DiscoverySummary {
  datasetLabel: string
  sourceLabels: string[]
  metricCount: number
  timeCoverage: string
  dimensionLabels: string[]
}

export interface CatalogSection {
  id: string
  title: string
  summary: string
  items: string[]
}

export interface FollowUpAction {
  id: string
  label: string
  question: string
  actionType: QueryAction
  intentHint?: QueryIntent | "leadership_summary"
}

export interface InterpretationMetadata {
  mode: InterpretationMode
  originalQuestion: string
  resolvedQuestion?: string
  explanation: string
}

export interface TrustArtifactSource {
  sourceType: EvidenceItem["sourceType"] | "manifest"
  sourceName: string
  scope: string
  timeRange: string
  note: string
}

export interface TrustArtifacts {
  howProduced: string[]
  sourcesUsed: TrustArtifactSource[]
  directlyObserved: string[]
  inferred: string[]
  assumptionsUsed: string[]
}

export interface RetrievalTrace {
  datasetMatches: string[]
  memoryMatches: string[]
  recentMessagesCount: number
}

export interface Phase1AnalysisResponse {
  intent: QueryIntent
  headline: string
  summary: string
  metric: MetricId
  timeframe: string
  comparisonBasis: string
  confidence: number
  activeScope: string
  drivers: DriverItem[]
  chartSpec?: ChartSpec
  evidence: EvidenceItem[]
  assumptions: string[]
  supportedFollowUps: string[]
  followUpActions?: FollowUpAction[]
  comparisonSummary?: ComparisonSummary
  discoverySummary?: DiscoverySummary
  catalogSections?: CatalogSection[]
  interpretation?: InterpretationMetadata
  trustArtifacts?: TrustArtifacts
  resultTable?: ResultTable
  queryRuns?: QueryRun[]
  conversationContextUsed?: boolean
  retrievalTrace?: RetrievalTrace
  fallback?: boolean
  presentationMode?: ResponsePresentationMode
  sourceMode: "database" | "fixture"
}

export interface FollowUpContext {
  sourceAnalysis?: Phase1AnalysisResponse
}

export interface QueryRequestBody {
  question: string
  chatId?: string
  action?: QueryAction
  followUpContext?: FollowUpContext
  scope?: ScopeFilter
}

export interface SourceHealth {
  id: string
  name: string
  type: "postgres" | "mongodb" | "manifest"
  status: "connected" | "sample-fixture" | "configured"
  detail: string
  recordCount?: number
}

export interface BootstrapPayload {
  initialQuestion: string
  metrics: MetricDefinition[]
  sourceHealth: SourceHealth[]
  initialAnalysis: Phase1AnalysisResponse
}

export interface RetrievalMatch {
  id: string
  title: string
  content: string
  score: number
  kind: string
}

export interface StoredConversationMessage {
  id: string
  chatId: string
  role: "user" | "assistant"
  text: string
  createdAt: string
  intent?: QueryIntent
  metricId?: MetricId
  activeScope?: string
  timeframe?: string
}

export interface RetrievalContext {
  datasetMatches: RetrievalMatch[]
  memoryMatches: RetrievalMatch[]
  recentMessages: StoredConversationMessage[]
}
