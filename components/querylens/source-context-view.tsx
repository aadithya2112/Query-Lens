import Link from "next/link"

import { ArrowLeft } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { ResultTable } from "@/lib/querylens/types"
import type { SourceContextPayload } from "@/lib/querylens/server/source-context"

interface SourceContextViewProps {
  payload: SourceContextPayload
}

function formatValue(value: string | number | boolean | null) {
  if (value === null) {
    return "—"
  }

  if (typeof value === "number") {
    return Number.isInteger(value)
      ? value.toLocaleString()
      : value.toLocaleString(undefined, { maximumFractionDigits: 2 })
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false"
  }

  return value
}

function PreviewTable({
  title,
  description,
  table,
}: {
  title: string
  description: string
  table: ResultTable
}) {
  return (
    <section className="rounded-3xl border border-border bg-card/50 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        <span className="rounded-full border border-border px-2 py-1 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          {table.truncated
            ? `${table.rows.length} of ${table.totalRows}`
            : `${table.totalRows} rows`}
        </span>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-border">
        <div className="max-h-85 overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-background/95">
              <TableRow className="hover:bg-transparent">
                {table.columns.map((column) => (
                  <TableHead
                    key={column}
                    className="h-10 px-3 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground"
                  >
                    {column}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {table.rows.map((row, rowIndex) => (
                <TableRow key={`${title}-row-${rowIndex}`}>
                  {table.columns.map((column) => (
                    <TableCell
                      key={`${title}-${rowIndex}-${column}`}
                      className="px-3 py-2"
                    >
                      <span className="block max-w-95 truncate text-sm text-foreground">
                        {formatValue(row[column] ?? null)}
                      </span>
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </section>
  )
}

export default function SourceContextView({ payload }: SourceContextViewProps) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/70">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
              QueryLens
            </p>
            <h1 className="mt-1 text-xl font-semibold">Source context</h1>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/demo">
              <ArrowLeft className="h-4 w-4" />
              Back to workspace
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6">
        <section className="rounded-3xl border border-border bg-card/50 p-5">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-base font-semibold">Data summary</h2>
            <span className="rounded-full border border-border px-2 py-1 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              {payload.sourceMode === "database"
                ? "Live database mode"
                : "Fixture mode"}
            </span>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {payload.summaries.map((summary) => (
              <article
                key={summary.title}
                className="rounded-2xl border border-border bg-background/60 p-4"
              >
                <p className="text-sm font-semibold text-foreground">
                  {summary.title}
                </p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {summary.description}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-border bg-card/50 p-5">
          <h2 className="text-base font-semibold">Connected sources</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {payload.sourceHealth.map((source) => (
              <article
                key={source.id}
                className="rounded-2xl border border-border bg-background/60 p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold">{source.name}</p>
                  <span className="rounded-full border border-border px-2 py-1 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                    {source.status}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {source.detail}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <article className="rounded-3xl border border-border bg-card/50 p-5">
            <h2 className="text-base font-semibold">PostgreSQL objects</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Tables that power portfolio facts and metric aggregation.
            </p>
            <ul className="mt-4 space-y-3">
              {payload.postgresSchema.map((table) => (
                <li
                  key={table.name}
                  className="rounded-2xl border border-border bg-background/60 p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold">{table.name}</p>
                    <span className="font-mono text-xs text-muted-foreground">
                      {table.rowCount.toLocaleString()} rows
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {table.description}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {table.columns.slice(0, 6).join(", ")}
                    {table.columns.length > 6 ? " ..." : ""}
                  </p>
                </li>
              ))}
            </ul>
          </article>

          <article className="rounded-3xl border border-border bg-card/50 p-5">
            <h2 className="text-base font-semibold">MongoDB objects</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Collections used as qualitative context alongside metric shifts.
            </p>
            <ul className="mt-4 space-y-3">
              {payload.mongoSchema.map((collection) => (
                <li
                  key={collection.name}
                  className="rounded-2xl border border-border bg-background/60 p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold">{collection.name}</p>
                    <span className="font-mono text-xs text-muted-foreground">
                      {collection.rowCount.toLocaleString()} docs
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {collection.description}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {collection.columns.slice(0, 6).join(", ")}
                    {collection.columns.length > 6 ? " ..." : ""}
                  </p>
                </li>
              ))}
            </ul>
          </article>
        </section>

        <div className="grid gap-4 lg:grid-cols-2">
          <PreviewTable
            title="PostgreSQL preview"
            description="A quick sample from weekly portfolio facts used in analysis responses."
            table={payload.postgresPreview}
          />
          <PreviewTable
            title="MongoDB preview"
            description="A quick sample from contextual event documents used for corroboration."
            table={payload.mongoPreview}
          />
        </div>
      </main>
    </div>
  )
}
