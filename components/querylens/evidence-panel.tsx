"use client"

import { ChevronRight, CircleAlert, Shield, Sparkles } from "lucide-react"

import TrendChart from "@/components/querylens/trend-chart"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { Phase1AnalysisResponse } from "@/lib/querylens/types"

interface EvidencePanelProps {
  analysis: Phase1AnalysisResponse
}

function formatTableValue(value: string | number | boolean | null) {
  if (value === null) {
    return "null"
  }

  if (typeof value === "number") {
    return Number.isInteger(value)
      ? value.toLocaleString()
      : value.toLocaleString(undefined, {
          maximumFractionDigits: 2,
        })
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false"
  }

  return value
}

function ComparisonCards({ analysis }: EvidencePanelProps) {
  const summary = analysis.comparisonSummary

  if (!summary) {
    return null
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="rounded-[24px] border border-border bg-card/50 px-5 py-5 backdrop-blur-xl">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          {summary.leftLabel}
        </p>
        <p className="mt-3 text-3xl font-semibold text-foreground">
          {summary.leftValue.toFixed(1)}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">Cashflow health score</p>
      </div>
      <div className="rounded-[24px] border border-border bg-card/50 px-5 py-5 backdrop-blur-xl">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          {summary.rightLabel}
        </p>
        <p className="mt-3 text-3xl font-semibold text-foreground">
          {summary.rightValue.toFixed(1)}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">Cashflow health score</p>
      </div>
      <div className="rounded-[24px] border border-border bg-card/50 px-5 py-5 backdrop-blur-xl">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          Delta
        </p>
        <p className="mt-3 text-3xl font-semibold text-foreground">
          {summary.delta.toFixed(1)}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          {summary.tie
            ? "No clear leader in the selected compare view"
            : `${summary.winnerLabel} leads`}
        </p>
      </div>
    </div>
  )
}

function TrustBar({ analysis }: EvidencePanelProps) {
  const width = `${analysis.confidence}%`

  return (
    <div className="rounded-[28px] border border-border bg-card/50 px-5 py-5 backdrop-blur-xl">
      <div className="flex flex-col gap-4 2xl:flex-row 2xl:items-end 2xl:justify-between">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-muted-foreground">
            Trust Layer
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-foreground">
            {analysis.headline}
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">
            {analysis.summary}
          </p>
        </div>
        <div className="min-w-55">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Confidence
          </p>
          <div className="mt-3 overflow-hidden rounded-full bg-muted/50">
            <div
              className="h-2 rounded-full bg-foreground transition-all duration-700"
              style={{ width }}
            />
          </div>
          <p className="mt-2 font-mono text-xs text-foreground">
            {analysis.confidence}% confidence
          </p>
        </div>
      </div>
    </div>
  )
}

function DiscoverySummaryCards({ analysis }: EvidencePanelProps) {
  if (!analysis.discoverySummary) {
    return null
  }

  return (
    <div className="grid gap-4 lg:grid-cols-4">
      <div className="rounded-[24px] border border-border bg-card/50 px-5 py-5 backdrop-blur-xl">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          Dataset
        </p>
        <p className="mt-3 text-lg font-semibold text-foreground">
          {analysis.discoverySummary.datasetLabel}
        </p>
      </div>
      <div className="rounded-[24px] border border-border bg-card/50 px-5 py-5 backdrop-blur-xl">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          Metrics
        </p>
        <p className="mt-3 text-3xl font-semibold text-foreground">
          {analysis.discoverySummary.metricCount}
        </p>
      </div>
      <div className="rounded-[24px] border border-border bg-card/50 px-5 py-5 backdrop-blur-xl">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          Sources
        </p>
        <p className="mt-3 text-lg font-semibold text-foreground">
          {analysis.discoverySummary.sourceLabels.join(", ")}
        </p>
      </div>
      <div className="rounded-[24px] border border-border bg-card/50 px-5 py-5 backdrop-blur-xl">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          Coverage
        </p>
        <p className="mt-3 text-lg font-semibold text-foreground">
          {analysis.discoverySummary.timeCoverage}
        </p>
      </div>
    </div>
  )
}

function CatalogSections({ analysis }: EvidencePanelProps) {
  if (!analysis.catalogSections?.length) {
    return null
  }

  return (
    <div className="rounded-[28px] border border-border bg-card/50 px-5 py-5 lg:px-7 lg:py-6 backdrop-blur-xl">
      <div className="flex items-center gap-2">
        <Sparkles size={16} className="text-muted-foreground" />
        <h2 className="text-base font-semibold text-foreground">
          Catalog and suggested paths
        </h2>
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {analysis.catalogSections.map((section) => (
          <div
            key={section.id}
            className="rounded-[22px] border border-border bg-muted/10 px-4 py-4"
          >
            <p className="text-sm font-semibold text-foreground">{section.title}</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {section.summary}
            </p>
            {section.items.length > 0 && (
              <ul className="mt-3 space-y-2">
                {section.items.map((item) => (
                  <li key={item} className="text-sm text-muted-foreground">
                    {item}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function ResultTableCard({ analysis }: EvidencePanelProps) {
  if (!analysis.resultTable || analysis.resultTable.columns.length === 0) {
    return null
  }

  return (
    <div className="rounded-[28px] border border-border bg-card/50 px-5 py-5 lg:px-7 lg:py-6 backdrop-blur-xl">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-muted-foreground" />
          <h2 className="text-base font-semibold text-foreground">
            Result table
          </h2>
        </div>
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          {analysis.resultTable.truncated
            ? `showing ${analysis.resultTable.rows.length} of ${analysis.resultTable.totalRows}+`
            : `${analysis.resultTable.totalRows} rows`}
        </span>
      </div>
      <div className="mt-5 overflow-hidden rounded-[22px] border border-border bg-muted/10">
        <div className="max-h-[360px] overflow-auto">
          <Table className="text-sm">
            <TableHeader className="sticky top-0 z-10 bg-background/95">
              <TableRow className="border-border hover:bg-transparent">
                {analysis.resultTable.columns.map((column) => (
                  <TableHead
                    key={column}
                    className="h-11 px-4 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground"
                  >
                    {column}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {analysis.resultTable.rows.map((row, rowIndex) => (
                <TableRow key={`evidence-result-${rowIndex}`} className="border-border">
                  {analysis.resultTable?.columns.map((column) => (
                    <TableCell key={`${rowIndex}-${column}`} className="px-4 py-3">
                      <span className="block max-w-[260px] truncate text-foreground">
                        {formatTableValue(row[column] ?? null)}
                      </span>
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}

function ExecutedQueries({ analysis }: EvidencePanelProps) {
  if (!analysis.queryRuns?.length) {
    return null
  }

  return (
    <div className="rounded-[28px] border border-border bg-card/50 px-5 py-5 lg:px-7 lg:py-6 backdrop-blur-xl">
      <div className="flex items-center gap-2">
        <Shield size={16} className="text-muted-foreground" />
        <h2 className="text-base font-semibold text-foreground">
          Executed queries
        </h2>
      </div>
      <div className="mt-5 space-y-4">
        {analysis.queryRuns.map((queryRun) => (
          <div
            key={queryRun.id}
            className="rounded-[22px] border border-border bg-muted/10 px-4 py-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {queryRun.title}
                </p>
                <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  {queryRun.sourceType} · {queryRun.language}
                </p>
              </div>
              <span className="rounded-full border border-border px-2 py-1 font-mono text-[11px] text-muted-foreground">
                {queryRun.rowCount} row{queryRun.rowCount === 1 ? "" : "s"}
              </span>
            </div>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              {queryRun.summary}
            </p>
            <pre className="mt-3 overflow-x-auto rounded-[18px] border border-border bg-black/30 p-3 text-xs leading-6 text-foreground">
              <code>{queryRun.statement}</code>
            </pre>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function EvidencePanel({ analysis }: EvidencePanelProps) {
  const isAgentic = analysis.intent === "agentic_query"
  const isBreakdown = analysis.metric === "at_risk_account_count"
  const isCompare = Boolean(analysis.comparisonSummary)
  const isDiscovery = analysis.intent === "discovery"
  const driversHeading = isDiscovery
    ? "Discovery highlights"
    : isAgentic
      ? "Key findings"
      : isBreakdown
        ? "Top concentrations"
        : isCompare
          ? "Top differences"
          : "Top drivers"

  return (
    <section className="px-4 py-4 lg:px-6 lg:py-7 mx-auto max-w-full w-full">
      <div className="mx-auto flex max-w-6xl flex-col gap-5">
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full border border-border bg-muted/20 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.18em] text-foreground">
            {analysis.metric.replace(/_/g, " ")}
          </span>
          <span className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
            {analysis.timeframe}
          </span>
          <span className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
            {analysis.comparisonBasis}
          </span>
        </div>

        <TrustBar analysis={analysis} />
        <DiscoverySummaryCards analysis={analysis} />
        {!isDiscovery && <ComparisonCards analysis={analysis} />}
        {analysis.chartSpec && <TrendChart analysis={analysis} />}
        <ResultTableCard analysis={analysis} />

        <div className="flex flex-col gap-5">
          {isDiscovery ? <CatalogSections analysis={analysis} /> : null}
          <div className="rounded-[28px] border border-border bg-card/50 px-5 py-5 lg:px-7 lg:py-6 backdrop-blur-xl">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-muted-foreground" />
              <h2 className="text-base font-semibold text-foreground">
                {driversHeading}
              </h2>
            </div>
            <div className="mt-5 space-y-5">
              {analysis.drivers.length > 0 ? (
                analysis.drivers.map((driver) => (
                  <div
                    key={driver.id}
                    className="border-b border-border pb-5 last:border-b-0 last:pb-0"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          {driver.title}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">
                          {driver.description}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 font-mono text-xs ${
                          driver.direction === "negative"
                            ? "bg-destructive/20 text-destructive"
                            : "bg-emerald-500/20 text-emerald-400"
                        }`}
                      >
                        {driver.impactLabel}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm leading-6 text-muted-foreground">
                  No ranked findings were produced for this response.
                </p>
              )}
            </div>
          </div>

          <div className="rounded-[28px] border border-border bg-card/50 px-5 py-5 lg:px-7 lg:py-6 backdrop-blur-xl">
            <div className="flex items-center gap-2">
              <Shield size={16} className="text-muted-foreground" />
              <h2 className="text-base font-semibold text-foreground">
                Assumptions
              </h2>
            </div>
            <div className="mt-5 space-y-4">
              {analysis.assumptions.length > 0 ? (
                analysis.assumptions.map((assumption) => (
                  <div key={assumption} className="flex gap-3">
                    <CircleAlert
                      size={16}
                      className="mt-1 shrink-0 text-muted-foreground"
                    />
                    <p className="text-sm leading-6 text-muted-foreground">
                      {assumption}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm leading-6 text-muted-foreground">
                  No additional assumptions were recorded for this response.
                </p>
              )}
            </div>
          </div>
        </div>

        <ExecutedQueries analysis={analysis} />

        <div className="rounded-[28px] border border-border bg-card/50 px-5 py-5 lg:px-7 lg:py-6 backdrop-blur-xl">
          <div className="flex items-center gap-2">
            <Shield size={16} className="text-muted-foreground" />
            <h2 className="text-base font-semibold text-foreground">
              Evidence and corroboration
            </h2>
          </div>
          <div className="mt-5 flex flex-col gap-4">
            {analysis.evidence.length > 0 ? (
              analysis.evidence.map((item) => (
                <div
                  key={`${item.sourceType}-${item.sourceName}-${item.queryTemplateId}`}
                  className="rounded-[22px] border border-border bg-muted/10 px-4 py-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                        {item.sourceType}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-foreground">
                        {item.sourceName}
                      </p>
                    </div>
                    <span className="rounded-full border border-border px-2 py-1 font-mono text-[11px] text-muted-foreground">
                      {item.scope}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    {item.supportingFact}
                  </p>
                  <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                    <span className="text-xs text-muted-foreground">
                      {item.timeRange}
                    </span>
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {item.queryTemplateId}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm leading-6 text-muted-foreground">
                No supporting evidence cards were recorded for this response.
              </p>
            )}
          </div>
          <details className="mt-5 rounded-[22px] border border-border px-4 py-4">
            <summary className="cursor-pointer list-none font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground transition-colors">
              Trace / debug view
            </summary>
            <div className="mt-4 space-y-3 text-sm leading-6 text-muted-foreground">
              <p>
                {isDiscovery
                  ? "The discovery slice uses pgvector-backed metadata retrieval, source health checks, and conversation memory to answer broad questions safely."
                  : isAgentic
                    ? "The agentic slice uses Gemini tool-calling plus guarded read-only database execution to answer unsupported live questions."
                    : isBreakdown
                      ? "The breakdown slice uses validated planning, account-level weekly stress rollups, and contextual Mongo evidence."
                      : isCompare
                        ? "The compare slice uses validated planning, side-by-side weekly metric rows, and contextual Mongo evidence."
                        : "The what-changed slice uses validated planning, sample-dataset weekly metrics, and contextual Mongo evidence."}
              </p>
              {analysis.retrievalTrace && (
                <div className="rounded-[18px] border border-border bg-muted/10 px-4 py-4">
                  <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                    Retrieval trace
                  </p>
                  <p className="mt-2">
                    Dataset matches:{" "}
                    {analysis.retrievalTrace.datasetMatches.length
                      ? analysis.retrievalTrace.datasetMatches.join(", ")
                      : "none"}
                  </p>
                  <p className="mt-1">
                    Memory matches:{" "}
                    {analysis.retrievalTrace.memoryMatches.length
                      ? analysis.retrievalTrace.memoryMatches.join(", ")
                      : "none"}
                  </p>
                  <p className="mt-1">
                    Recent turns used: {analysis.retrievalTrace.recentMessagesCount}
                  </p>
                </div>
              )}
              <ul className="space-y-2">
                {analysis.evidence.map((item) => (
                  <li
                    key={`${item.queryTemplateId}-trace`}
                    className="flex items-start gap-2"
                  >
                    <ChevronRight
                      size={14}
                      className="mt-1 shrink-0 text-muted-foreground"
                    />
                    <span>
                      <span className="font-mono text-muted-foreground">
                        {item.queryTemplateId}
                      </span>{" "}
                      drove the evidence item sourced from{" "}
                      <strong className="text-foreground">
                        {item.sourceName}
                      </strong>
                      .
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
