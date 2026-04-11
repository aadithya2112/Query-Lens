'use client'

import { ChevronRight, CircleAlert, Shield, Sparkles } from "lucide-react"

import TrendChart from "@/components/querylens/trend-chart"
import type { Phase1AnalysisResponse } from "@/lib/querylens/types"

interface EvidencePanelProps {
  analysis: Phase1AnalysisResponse
}

function TrustBar({ analysis }: EvidencePanelProps) {
  const width = `${analysis.confidence}%`

  return (
    <div className="ql-panel rounded-[24px] border px-5 py-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-[var(--ql-accent)]">
            Trust Layer
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-white">{analysis.headline}</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--ql-muted)]">
            {analysis.summary}
          </p>
        </div>
        <div className="min-w-[220px]">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--ql-muted)]">
            Confidence
          </p>
          <div className="mt-3 overflow-hidden rounded-full bg-[rgba(255,255,255,0.08)]">
            <div
              className="h-2 rounded-full bg-[var(--ql-accent)] transition-all duration-700"
              style={{ width }}
            />
          </div>
          <p className="mt-2 font-mono text-xs text-white">{analysis.confidence}% confidence</p>
        </div>
      </div>
    </div>
  )
}

export default function EvidencePanel({ analysis }: EvidencePanelProps) {
  return (
    <section className="min-h-[calc(100vh-74px)] border-b border-r border-[rgba(255,255,255,0.05)] px-4 py-4 lg:border-b-0 lg:px-6 lg:py-7">
      <div className="mx-auto flex max-w-6xl flex-col gap-5">
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full border border-[rgba(201,167,106,0.2)] px-3 py-1 font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--ql-accent)]">
            {analysis.metric.replace(/_/g, " ")}
          </span>
          <span className="rounded-full border border-[rgba(255,255,255,0.08)] px-3 py-1 text-xs text-[var(--ql-muted)]">
            {analysis.timeframe}
          </span>
          <span className="rounded-full border border-[rgba(255,255,255,0.08)] px-3 py-1 text-xs text-[var(--ql-muted)]">
            {analysis.comparisonBasis}
          </span>
        </div>

        <TrustBar analysis={analysis} />
        <TrendChart analysis={analysis} />

        <div className="grid gap-5 xl:grid-cols-[1.2fr,0.8fr]">
          <div className="ql-panel rounded-[28px] border px-5 py-5 lg:px-7 lg:py-6">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-[var(--ql-accent)]" />
              <h2 className="text-base font-semibold text-white">Top drivers</h2>
            </div>
            <div className="mt-5 space-y-5">
              {analysis.drivers.map((driver) => (
                <div
                  key={driver.id}
                  className="border-b border-[rgba(255,255,255,0.06)] pb-5 last:border-b-0 last:pb-0"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">{driver.title}</p>
                      <p className="mt-2 text-sm leading-6 text-[var(--ql-muted)]">
                        {driver.description}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 font-mono text-xs ${
                        driver.direction === "negative"
                          ? "bg-[rgba(195,111,80,0.14)] text-[var(--ql-warn)]"
                          : "bg-[rgba(123,196,161,0.14)] text-[var(--ql-success)]"
                      }`}
                    >
                      {driver.impactLabel}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="ql-panel rounded-[28px] border px-5 py-5 lg:px-7 lg:py-6">
            <div className="flex items-center gap-2">
              <Shield size={16} className="text-[var(--ql-accent)]" />
              <h2 className="text-base font-semibold text-white">Assumptions</h2>
            </div>
            <div className="mt-5 space-y-4">
              {analysis.assumptions.map((assumption) => (
                <div key={assumption} className="flex gap-3">
                  <CircleAlert size={16} className="mt-1 shrink-0 text-[var(--ql-accent)]" />
                  <p className="text-sm leading-6 text-[var(--ql-muted)]">{assumption}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="ql-panel rounded-[28px] border px-5 py-5 lg:px-7 lg:py-6">
          <div className="flex items-center gap-2">
            <Shield size={16} className="text-[var(--ql-accent)]" />
            <h2 className="text-base font-semibold text-white">Evidence and corroboration</h2>
          </div>
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {analysis.evidence.map((item) => (
              <div
                key={`${item.sourceType}-${item.sourceName}-${item.queryTemplateId}`}
                className="rounded-[22px] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] px-4 py-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--ql-accent)]">
                      {item.sourceType}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-white">{item.sourceName}</p>
                  </div>
                  <span className="rounded-full border border-[rgba(255,255,255,0.08)] px-2 py-1 font-mono text-[11px] text-[var(--ql-muted)]">
                    {item.scope}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-[var(--ql-muted)]">
                  {item.supportingFact}
                </p>
                <div className="mt-4 flex items-center justify-between border-t border-[rgba(255,255,255,0.06)] pt-3">
                  <span className="text-xs text-[var(--ql-muted)]">{item.timeRange}</span>
                  <span className="font-mono text-[11px] text-[var(--ql-accent)]">
                    {item.queryTemplateId}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <details className="mt-5 rounded-[22px] border border-[rgba(255,255,255,0.08)] px-4 py-4">
            <summary className="cursor-pointer list-none font-mono text-xs uppercase tracking-[0.18em] text-[var(--ql-accent)]">
              Trace / debug view
            </summary>
            <div className="mt-4 space-y-3 text-sm leading-6 text-[var(--ql-muted)]">
              <p>The phase-1 slice uses deterministic parsing, seeded weekly metrics, and contextual Mongo evidence.</p>
              <ul className="space-y-2">
                {analysis.evidence.map((item) => (
                  <li key={`${item.queryTemplateId}-trace`} className="flex items-start gap-2">
                    <ChevronRight size={14} className="mt-1 shrink-0 text-[var(--ql-accent)]" />
                    <span>
                      <span className="font-mono text-[var(--ql-accent)]">{item.queryTemplateId}</span>{" "}
                      drove the evidence item sourced from <strong className="text-white">{item.sourceName}</strong>.
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </details>
        </div>
      </div>
    </section>
  )
}
