"use client"

import { Database, FileCheck2, Gauge, Layers3, ShieldCheck } from "lucide-react"

import type {
  MetricDefinition,
  Phase1AnalysisResponse,
  SourceHealth,
} from "@/lib/querylens/types"

interface SidebarProps {
  metric?: MetricDefinition
  sourceHealth: SourceHealth[]
  analysis: Phase1AnalysisResponse
}

function SourceStatus({ source }: { source: SourceHealth }) {
  return (
    <div className="border-b border-border py-4 last:border-b-0">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-foreground">{source.name}</p>
          <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            {source.status.replace("-", " ")}
          </p>
        </div>
        <span className="rounded-full border border-border px-2 py-1 font-mono text-[11px] text-muted-foreground">
          {source.recordCount ?? "ok"}
        </span>
      </div>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        {source.detail}
      </p>
    </div>
  )
}

export default function Sidebar({
  metric,
  sourceHealth,
  analysis,
}: SidebarProps) {
  const isAgentic = analysis.intent === "agentic_query"
  const isBreakdown = analysis.metric === "at_risk_account_count"
  const isCompare = Boolean(analysis.comparisonSummary)
  const isDiscovery = analysis.intent === "discovery"

  return (
    <aside className="rounded-[28px] border border-border bg-card/50 px-5 py-5 backdrop-blur-xl h-fit">
      <div className="border-b border-border pb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-muted/50 text-foreground">
            <Gauge size={20} />
          </div>
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-muted-foreground">
              QueryLens
            </p>
            <h1 className="mt-1 text-xl font-semibold text-foreground">
              {isDiscovery
                ? "Dataset discovery"
                : isAgentic
                ? "Custom live query"
                : isCompare
                ? "SME cashflow compare"
                : isBreakdown
                ? "SME risk concentration breakdown"
                : "SME cashflow investigation"}
            </h1>
          </div>
        </div>
        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          {isDiscovery
            ? "A conversational metadata view that explains what QueryLens currently knows about the sample dataset, the connected sources, and the supported analytical paths."
            : isAgentic
            ? "A read-only live-query view where Gemini explored the approved Postgres and MongoDB sources to answer a question outside the built-in analysis categories."
            : isCompare
            ? "A trust-first side-by-side comparison of weekly cashflow health, using the sample dataset's Postgres facts and Mongo context to explain the gap."
            : isBreakdown
            ? "A trust-first breakdown of where weekly account stress is concentrated, using the sample dataset's Postgres facts and Mongo context side by side."
            : "A trust-first slice for explaining why portfolio health changed, using the sample dataset's Postgres facts and Mongo context side by side."}
        </p>
      </div>

      <section className="border-b border-border py-6">
        <div className="flex items-center gap-2">
          <ShieldCheck size={16} className="text-foreground" />
          <h2 className="text-sm font-semibold text-foreground">
            Current view
          </h2>
        </div>
        <p className="mt-3 text-lg font-semibold text-foreground">
          {analysis.activeScope}
        </p>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          {analysis.timeframe}
        </p>
        {analysis.conversationContextUsed && (
          <>
            <p className="mt-3 font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Conversation memory
            </p>
            <p className="mt-1 text-sm text-foreground">
              Active for this response
            </p>
          </>
        )}
        <p className="mt-3 font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
          Source mode
        </p>
        <p className="mt-1 text-sm text-foreground">
          {analysis.sourceMode === "database"
            ? "Docker-backed databases"
            : "Built-in sample dataset"}
        </p>
      </section>

      <section className="border-b border-border py-6">
        <div className="flex items-center gap-2">
          <Layers3 size={16} className="text-foreground" />
          <h2 className="text-sm font-semibold text-foreground">
            {isDiscovery ? "Discovery scope" : "Metric definition"}
          </h2>
        </div>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {isDiscovery
            ? "Discovery answers come from retrieved dataset metadata, source health, and sample-dataset coverage summaries before analytical execution begins."
            : isAgentic
            ? "Custom live queries are grounded in the approved database schema and executed with read-only guards before QueryLens renders the answer."
            : metric?.description}
        </p>
        {isDiscovery ? (
          <div className="mt-4 space-y-3">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                Available intents
              </p>
              <p className="text-sm text-foreground">
                discovery, what changed, breakdown, compare
              </p>
            </div>
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                Time windows
              </p>
              <p className="text-sm text-foreground">this week, last week</p>
            </div>
          </div>
        ) : isAgentic ? (
          <div className="mt-4 space-y-3">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                Execution mode
              </p>
              <p className="text-sm text-foreground">Auto-run read-only</p>
            </div>
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                Allowed sources
              </p>
              <p className="text-sm text-foreground">
                approved Postgres tables, approved MongoDB collections
              </p>
            </div>
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                Visual output
              </p>
              <p className="text-sm text-foreground">
                chat-native chart when the result shape supports it
              </p>
            </div>
          </div>
        ) : metric ? (
          <div className="mt-4 space-y-3">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                Payment coverage
              </p>
              <p className="text-sm text-foreground">
                {Math.round(metric.weights.inflowOutflowRatio * 100)}%
              </p>
            </div>
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                Balance trend
              </p>
              <p className="text-sm text-foreground">
                {Math.round(metric.weights.balanceTrend * 100)}%
              </p>
            </div>
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                Low-balance exposure
              </p>
              <p className="text-sm text-foreground">
                {Math.round(metric.weights.lowBalanceExposure * 100)}%
              </p>
            </div>
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                Overdue exposure
              </p>
              <p className="text-sm text-foreground">
                {Math.round(metric.weights.overdueExposure * 100)}%
              </p>
            </div>
          </div>
        ) : null}
      </section>

      <section className="py-6">
        <div className="flex items-center gap-2">
          <Database size={16} className="text-foreground" />
          <h2 className="text-sm font-semibold text-foreground">
            Source health
          </h2>
        </div>
        <div className="mt-3">
          {sourceHealth.map((source) => (
            <SourceStatus key={source.id} source={source} />
          ))}
        </div>
        <div className="mt-4 flex items-center gap-2 border-t border-border pt-4">
          <FileCheck2 size={14} className="text-muted-foreground" />
          <p className="text-sm leading-6 text-muted-foreground">
            {isDiscovery
              ? "Discovery keeps the app conversational while staying grounded in retrieved metadata and source health."
              : isAgentic
              ? "Custom queries stay read-only and grounded by schema-aware execution before Gemini summarizes the result."
              : "QueryLens intentionally supports a narrow set of metrics and intents so the answer remains grounded."}
          </p>
        </div>
      </section>
    </aside>
  )
}
