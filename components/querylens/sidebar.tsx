'use client'

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
    <div className="border-b border-[rgba(255,255,255,0.05)] py-4 last:border-b-0">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-white">{source.name}</p>
          <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--ql-muted)]">
            {source.status.replace("-", " ")}
          </p>
        </div>
        <span className="rounded-full border border-[rgba(201,167,106,0.18)] px-2 py-1 font-mono text-[11px] text-[var(--ql-accent)]">
          {source.recordCount ?? "ok"}
        </span>
      </div>
      <p className="mt-2 text-sm leading-6 text-[var(--ql-muted)]">{source.detail}</p>
    </div>
  )
}

export default function Sidebar({ metric, sourceHealth, analysis }: SidebarProps) {
  return (
    <aside className="ql-panel border-b border-r px-5 py-5 lg:min-h-[calc(100vh-74px)] lg:border-b-0 lg:px-6 lg:py-7">
      <div className="border-b border-[rgba(201,167,106,0.14)] pb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[rgba(201,167,106,0.2)] bg-[rgba(201,167,106,0.08)] text-[var(--ql-accent)]">
            <Gauge size={20} />
          </div>
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-[var(--ql-accent)]">
              QueryLens
            </p>
            <h1 className="mt-1 text-xl font-semibold text-white">
              SME cashflow investigation
            </h1>
          </div>
        </div>
        <p className="mt-4 text-sm leading-6 text-[var(--ql-muted)]">
          A trust-first phase-1 slice for explaining why portfolio health changed,
          using seeded Postgres facts and Mongo context side by side.
        </p>
      </div>

      <section className="border-b border-[rgba(201,167,106,0.14)] py-6">
        <div className="flex items-center gap-2">
          <ShieldCheck size={16} className="text-[var(--ql-accent)]" />
          <h2 className="text-sm font-semibold text-white">Current view</h2>
        </div>
        <p className="mt-3 text-lg font-semibold text-white">{analysis.activeScope}</p>
        <p className="mt-1 text-sm leading-6 text-[var(--ql-muted)]">
          {analysis.timeframe}
        </p>
        <p className="mt-3 font-mono text-xs uppercase tracking-[0.18em] text-[var(--ql-muted)]">
          Source mode
        </p>
        <p className="mt-1 text-sm text-white">
          {analysis.sourceMode === "database" ? "Docker-backed databases" : "Seeded fixture adapter"}
        </p>
      </section>

      <section className="border-b border-[rgba(201,167,106,0.14)] py-6">
        <div className="flex items-center gap-2">
          <Layers3 size={16} className="text-[var(--ql-accent)]" />
          <h2 className="text-sm font-semibold text-white">Metric definition</h2>
        </div>
        <p className="mt-3 text-sm leading-6 text-[var(--ql-muted)]">
          {metric.description}
        </p>
        <div className="mt-4 space-y-3">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--ql-muted)]">
              Payment coverage
            </p>
            <p className="text-sm text-white">{Math.round(metric.weights.inflowOutflowRatio * 100)}%</p>
          </div>
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--ql-muted)]">
              Balance trend
            </p>
            <p className="text-sm text-white">{Math.round(metric.weights.balanceTrend * 100)}%</p>
          </div>
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--ql-muted)]">
              Low-balance exposure
            </p>
            <p className="text-sm text-white">{Math.round(metric.weights.lowBalanceExposure * 100)}%</p>
          </div>
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--ql-muted)]">
              Overdue exposure
            </p>
            <p className="text-sm text-white">{Math.round(metric.weights.overdueExposure * 100)}%</p>
          </div>
        </div>
      </section>

      <section className="py-6">
        <div className="flex items-center gap-2">
          <Database size={16} className="text-[var(--ql-accent)]" />
          <h2 className="text-sm font-semibold text-white">Source health</h2>
        </div>
        <div className="mt-3">
          {sourceHealth.map((source) => (
            <SourceStatus key={source.id} source={source} />
          ))}
        </div>
        <div className="mt-4 flex items-center gap-2 border-t border-[rgba(255,255,255,0.05)] pt-4">
          <FileCheck2 size={14} className="text-[var(--ql-accent)]" />
          <p className="text-sm leading-6 text-[var(--ql-muted)]">
            Phase 1 intentionally supports one metric and one intent family so the answer remains grounded.
          </p>
        </div>
      </section>
    </aside>
  )
}
