"use client"

import { useMemo, useState } from "react"

import { CheckCircle2, Database, FileUp, Sparkles, Table2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import type {
  DatasetImportErrorPayload,
  OnboardedDatasetRecord,
} from "@/lib/querylens/types"

const steps = [
  { id: "upload", label: "Upload", icon: FileUp },
  { id: "inspect", label: "Inspect", icon: Table2 },
  { id: "review", label: "Semantic Draft", icon: Sparkles },
  { id: "complete", label: "Complete", icon: CheckCircle2 },
] as const

export function resolveImportErrorMessage(
  payload: Partial<DatasetImportErrorPayload> | undefined
) {
  if (payload?.code === "openrouter_rate_limited") {
    return "OpenRouter is temporarily rate-limiting semantic refinement. Please retry in a moment."
  }

  if (payload?.code === "openrouter_auth_failed") {
    return "OpenRouter rejected the configured credentials for semantic refinement. Check the API key and try again."
  }

  if (payload?.code === "openrouter_upstream_error") {
    return "OpenRouter could not refine the semantic draft right now. Please retry in a moment."
  }

  return payload?.error ?? "QueryLens could not import that CSV."
}

export default function OnboardingPage() {
  const [file, setFile] = useState<File | null>(null)
  const [dataset, setDataset] = useState<OnboardedDatasetRecord | null>(null)
  const [stepIndex, setStepIndex] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const activeStep = steps[stepIndex]
  const ActiveStepIcon = activeStep.icon
  const inferredSummary = useMemo(() => {
    if (!dataset) {
      return null
    }

    return {
      rowCount: dataset.rowCount.toLocaleString(),
      columnCount: dataset.columns.length.toLocaleString(),
      metricCount: dataset.semanticDraft.metrics.length.toLocaleString(),
      dimensionCount: dataset.semanticDraft.dimensions.length.toLocaleString(),
    }
  }, [dataset])

  async function handleImport() {
    if (!file) {
      setError("Choose a CSV file to start onboarding.")
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.set("file", file)

      const response = await fetch("/api/datasets/import/csv", {
        method: "POST",
        body: formData,
      })
      const payload = await response.json()

      if (!response.ok) {
        throw new Error(resolveImportErrorMessage(payload))
      }

      setDataset(payload.dataset)
      setStepIndex(1)
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "QueryLens could not import that CSV."
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleActivate() {
    if (!dataset) {
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch(`/api/datasets/${dataset.id}/activate`, {
        method: "POST",
      })
      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload.error ?? "Could not activate dataset.")
      }

      setDataset(payload.dataset)
      setStepIndex(3)
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "QueryLens could not activate that dataset."
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-background px-6 py-10 text-foreground sm:px-10">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-muted-foreground">
              Dataset Onboarding
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight">
              Bring a CSV into QueryLens
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">
              This first slice imports a CSV, profiles it deterministically, drafts
              a semantic contract, and stores the normalized rows in Postgres before
              you start querying.
            </p>
          </div>
          <Button asChild variant="outline">
            <a href="/demo">Back to workspace</a>
          </Button>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-4">
          {steps.map((step, index) => {
            const Icon = step.icon
            const isActive = index === stepIndex
            const isComplete = index < stepIndex

            return (
              <Card
                key={step.id}
                className={`rounded-3xl border px-5 py-5 ${
                  isActive
                    ? "border-foreground bg-card"
                    : isComplete
                      ? "border-emerald-500/40 bg-emerald-500/5"
                      : "border-border bg-card/60"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-background/70">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                      Step {index + 1}
                    </p>
                    <p className="mt-1 text-sm font-semibold">{step.label}</p>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <Card className="rounded-[32px] border-border bg-card/60 p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-background/70">
                <ActiveStepIcon className="h-5 w-5" />
              </div>
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  Current step
                </p>
                <h2 className="mt-1 text-xl font-semibold">{activeStep.label}</h2>
              </div>
            </div>

            {stepIndex === 0 && (
              <div className="mt-8 space-y-5">
                <div className="rounded-[28px] border border-dashed border-border bg-background/50 p-6">
                  <label className="block text-sm font-medium text-foreground">
                    CSV file
                  </label>
                  <input
                    accept=".csv,text/csv"
                    className="mt-4 block w-full rounded-2xl border border-border bg-background px-4 py-6 text-sm"
                    type="file"
                    onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                  />
                  <p className="mt-3 text-sm text-muted-foreground">
                    Limits: 25 MB, 100k rows, 200 columns, UTF-8 CSV with a header row.
                  </p>
                </div>
                <Button onClick={handleImport} disabled={!file || isSubmitting}>
                  {isSubmitting ? "Importing CSV..." : "Import and profile CSV"}
                </Button>
              </div>
            )}

            {stepIndex === 1 && dataset && (
              <div className="mt-8 space-y-5">
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {[
                    ["Rows", inferredSummary?.rowCount ?? "0"],
                    ["Columns", inferredSummary?.columnCount ?? "0"],
                    ["Measures", inferredSummary?.metricCount ?? "0"],
                    ["Dimensions", inferredSummary?.dimensionCount ?? "0"],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="rounded-[24px] border border-border bg-background/50 p-5"
                    >
                      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                        {label}
                      </p>
                      <p className="mt-3 text-2xl font-semibold">{value}</p>
                    </div>
                  ))}
                </div>
                <div className="rounded-[28px] border border-border bg-background/50 p-5">
                  <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                    Preview
                  </p>
                  <div className="mt-4 overflow-auto">
                    <table className="min-w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          {dataset.previewRows.columns.map((column) => (
                            <th key={column} className="px-3 py-2 font-medium">
                              {column}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {dataset.previewRows.rows.slice(0, 6).map((row, rowIndex) => (
                          <tr key={`preview-${rowIndex}`} className="border-b border-border/60">
                            {dataset.previewRows.columns.map((column) => (
                              <td key={`${rowIndex}-${column}`} className="px-3 py-2 text-muted-foreground">
                                {String(row[column] ?? "")}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <Button onClick={() => setStepIndex(2)}>Continue to semantic draft</Button>
              </div>
            )}

            {stepIndex === 2 && dataset && (
              <div className="mt-8 space-y-5">
                <div className="rounded-[28px] border border-border bg-background/50 p-5">
                  <h3 className="text-lg font-semibold">{dataset.semanticDraft.datasetLabel}</h3>
                  <p className="mt-2 text-sm leading-7 text-muted-foreground">
                    {dataset.semanticDraft.description}
                  </p>
                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <div>
                      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                        Measures
                      </p>
                      <div className="mt-3 space-y-3">
                        {dataset.semanticDraft.metrics.map((metric) => (
                          <div key={metric.id} className="rounded-2xl border border-border p-4">
                            <p className="font-semibold">{metric.label}</p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {metric.description ?? "Inferred numeric metric"}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                        Dimensions
                      </p>
                      <div className="mt-3 space-y-3">
                        {dataset.semanticDraft.dimensions.map((dimension) => (
                          <div key={dimension.id} className="rounded-2xl border border-border p-4">
                            <p className="font-semibold">{dimension.label}</p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              Column: {dimension.columnId ?? dimension.id}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                <Button onClick={handleActivate} disabled={isSubmitting}>
                  {isSubmitting ? "Activating dataset..." : "Activate dataset"}
                </Button>
              </div>
            )}

            {stepIndex === 3 && dataset && (
              <div className="mt-8 rounded-[28px] border border-emerald-500/30 bg-emerald-500/5 p-6">
                <div className="flex items-center gap-3">
                  <Database className="h-5 w-5" />
                  <div>
                    <h3 className="text-lg font-semibold">Dataset activated</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {dataset.label} is now registered in QueryLens and ready for safe CSV queries.
                    </p>
                  </div>
                </div>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Button onClick={() => window.location.assign(`/demo?datasetId=${encodeURIComponent(dataset.id)}`)}>
                    Open in workspace
                  </Button>
                  <Button variant="outline" onClick={() => window.location.assign("/onboarding")}>
                    Import another CSV
                  </Button>
                </div>
              </div>
            )}

            {error && (
              <div className="mt-5 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                {error}
              </div>
            )}
          </Card>

          <Card className="rounded-[32px] border-border bg-card/60 p-6">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              What this slice does
            </p>
            <div className="mt-4 space-y-4 text-sm leading-7 text-muted-foreground">
              <p>Imports a CSV and stores normalized rows in Postgres.</p>
              <p>Profiles types, identifiers, measures, dimensions, and the primary time field heuristically.</p>
              <p>Generates a semantic draft that QueryLens uses as the safe contract for first queries.</p>
              <p>Limits supported questions to discovery, aggregates, grouped summaries, and time trends.</p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
