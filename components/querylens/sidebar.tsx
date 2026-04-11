"use client"

import { Database, FileCheck2, Gauge, Layers3, ShieldCheck } from "lucide-react"

import type {
  MetricDefinition,
  Phase1AnalysisResponse,
  SourceHealth,
} from "@/lib/querylens/types"

interface SidebarProps {
  metric: MetricDefinition
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
  const isBreakdown = analysis.metric === "at_risk_account_count"

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
              {isBreakdown
                ? "SME risk concentration breakdown"
                : "SME cashflow investigation"}
            </h1>
          </div>
        </div>
        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          {isBreakdown
            ? "A trust-first breakdown of where weekly account stress is concentrated, using seeded Postgres facts and Mongo context side by side."
            : "A trust-first slice for explaining why portfolio health changed, using seeded Postgres facts and Mongo context side by side."}
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
        <p className="mt-3 font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
          Source mode
        </p>
        <p className="mt-1 text-sm text-foreground">
          {analysis.sourceMode === "database"
            ? "Docker-backed databases"
            : "Seeded fixture adapter"}
        </p>
      </section>

      <section className="border-b border-border py-6">
        <div className="flex items-center gap-2">
          <Layers3 size={16} className="text-foreground" />
          <h2 className="text-sm font-semibold text-foreground">
            Metric definition
          </h2>
        </div>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {metric.description}
        </p>
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
            QueryLens intentionally supports a narrow set of metrics and intents
            so the answer remains grounded.
          </p>
        </div>
      </section>
    </aside>
  )
}
