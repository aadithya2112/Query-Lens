"use client"

import Link from "next/link"
import { useState } from "react"
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react"

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
  const pageSize = 10
  const [currentPage, setCurrentPage] = useState(1)
  const totalPages = Math.ceil(table.rows.length / pageSize)
  
  const startIndex = (currentPage - 1) * pageSize
  const visibleRows = table.rows.slice(startIndex, startIndex + pageSize)

  return (
    <section className="rounded-[32px] border border-white/10 bg-[#1c1c1e]/40 backdrop-blur-xl p-6 lg:p-8 flex flex-col h-full shadow-2xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-white/90 tracking-tight">{title}</h2>
          <p className="mt-1.5 text-sm text-[#86868b]">{description}</p>
        </div>
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.2em] text-white/70 whitespace-nowrap shadow-inner">
          {table.totalRows} rows
        </span>
      </div>

      <div className="mt-6 flex-1 flex flex-col overflow-hidden rounded-2xl border border-white/10 shadow-inner bg-black/20">
        <div className="flex-1 overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-[#1c1c1e]/80 backdrop-blur-md border-b border-white/10">
              <TableRow className="hover:bg-transparent border-b-transparent">
                {table.columns.map((column) => (
                  <TableHead
                    key={column}
                    className="h-11 px-4 font-mono text-[11px] uppercase tracking-[0.16em] text-[#86868b]"
                  >
                    {column}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleRows.map((row, rowIndex) => (
                <TableRow 
                  key={`${title}-row-${startIndex + rowIndex}`}
                  className="hover:bg-white/5 border-b-white/5 transition-colors"
                >
                  {table.columns.map((column) => (
                    <TableCell
                      key={`${title}-${startIndex + rowIndex}-${column}`}
                      className="px-4 py-3"
                    >
                      <span className="block max-w-95 truncate text-sm text-white/80 font-medium">
                        {formatValue(row[column] ?? null)}
                      </span>
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        
        {totalPages > 1 && (
          <div className="border-t border-white/10 bg-white/5 p-3 flex items-center justify-between">
            <p className="text-xs text-[#86868b] px-2 font-medium">
              Viewing {startIndex + 1} - {Math.min(startIndex + pageSize, table.rows.length)}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0 rounded-full border-white/10 bg-white/5 text-white/80 hover:bg-white/10 hover:text-white"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs font-semibold text-white/90 min-w-[50px] text-center">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0 rounded-full border-white/10 bg-white/5 text-white/80 hover:bg-white/10 hover:text-white"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

export default function SourceContextView({ payload }: SourceContextViewProps) {
  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-white/30 pb-20">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-black/60 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-8">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[#86868b]">
              QueryLens PRO
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white/90">Source Context</h1>
          </div>
          <Button asChild variant="outline" size="sm" className="rounded-full border-white/20 bg-white/5 hover:bg-white/10 text-white transition-all backdrop-blur-lg">
            <Link href="/demo" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              <span className="font-medium">Back to Workspace</span>
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-10 sm:px-8 animate-in fade-in slide-in-from-bottom-8 duration-1000">
        
        <section className="rounded-[32px] border border-white/10 bg-[#1c1c1e]/40 backdrop-blur-xl shadow-2xl p-6 lg:p-8">
          <div className="flex flex-wrap items-center gap-4">
            <h2 className="text-xl font-semibold tracking-tight text-white/90">Data Summary</h2>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.2em] text-emerald-400/90 shadow-inner">
              {payload.sourceMode === "database"
                ? "Live database mode"
                : "Fixture mode"}
            </span>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {payload.summaries.map((summary) => (
              <article
                key={summary.title}
                className="rounded-2xl border border-white/5 bg-white/5 p-5 shadow-inner transition-transform hover:bg-white/10"
              >
                <p className="text-sm font-semibold text-white/90 tracking-tight">
                  {summary.title}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-[#86868b]">
                  {summary.description}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-[32px] border border-white/10 bg-[#1c1c1e]/40 backdrop-blur-xl shadow-2xl p-6 lg:p-8">
          <h2 className="text-xl font-semibold tracking-tight text-white/90">Connected Sources</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {payload.sourceHealth.map((source) => (
              <article
                key={source.id}
                className="rounded-2xl border border-white/5 bg-white/5 p-5 shadow-inner transition-transform hover:bg-white/10"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-white/90">{source.name}</p>
                  <span className="rounded-full border border-white/10 bg-[#27c93f]/20 text-[#27c93f] px-3 py-1 font-mono text-[11px] uppercase tracking-[0.2em]">
                    {source.status}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-[#86868b]">
                  {source.detail}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="grid gap-8 lg:grid-cols-2">
          <article className="rounded-[32px] border border-white/10 bg-[#1c1c1e]/40 backdrop-blur-xl shadow-2xl p-6 lg:p-8">
            <h2 className="text-xl font-semibold tracking-tight text-white/90">PostgreSQL Objects</h2>
            <p className="mt-2 text-sm text-[#86868b]">
              Tables that power portfolio facts and metric aggregation.
            </p>
            <ul className="mt-6 space-y-4">
              {payload.postgresSchema.map((table) => (
                <li
                  key={table.name}
                  className="rounded-2xl border border-white/5 bg-white/5 p-5 shadow-inner transition-colors hover:bg-white/10"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold tracking-tight text-white/90">{table.name}</p>
                    <span className="font-mono text-xs text-[#86868b]">
                      {table.rowCount.toLocaleString()} rows
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-[#86868b] leading-relaxed">
                    {table.description}
                  </p>
                  <p className="mt-3 font-mono text-[10px] uppercase tracking-widest text-[#86868b] bg-black/20 p-2 rounded-lg border border-white/5">
                    {table.columns.slice(0, 6).join(", ")}
                    {table.columns.length > 6 ? " ..." : ""}
                  </p>
                </li>
              ))}
            </ul>
          </article>

          <article className="rounded-[32px] border border-white/10 bg-[#1c1c1e]/40 backdrop-blur-xl shadow-2xl p-6 lg:p-8">
            <h2 className="text-xl font-semibold tracking-tight text-white/90">MongoDB Objects</h2>
            <p className="mt-2 text-sm text-[#86868b]">
              Collections used as qualitative context alongside metric shifts.
            </p>
            <ul className="mt-6 space-y-4">
              {payload.mongoSchema.map((collection) => (
                <li
                  key={collection.name}
                  className="rounded-2xl border border-white/5 bg-white/5 p-5 shadow-inner transition-colors hover:bg-white/10"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold tracking-tight text-white/90">{collection.name}</p>
                    <span className="font-mono text-xs text-[#86868b]">
                      {collection.rowCount.toLocaleString()} docs
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-[#86868b] leading-relaxed">
                    {collection.description}
                  </p>
                  <p className="mt-3 font-mono text-[10px] uppercase tracking-widest text-[#86868b] bg-black/20 p-2 rounded-lg border border-white/5">
                    {collection.columns.slice(0, 6).join(", ")}
                    {collection.columns.length > 6 ? " ..." : ""}
                  </p>
                </li>
              ))}
            </ul>
          </article>
        </section>

        <div className="flex flex-col gap-8 mt-4">
          <PreviewTable
            title="PostgreSQL Context Preview"
            description="A quick sample from weekly portfolio facts used in analysis responses."
            table={payload.postgresPreview}
          />
          <PreviewTable
            title="MongoDB Context Preview"
            description="A quick sample from contextual event documents used for corroboration."
            table={payload.mongoPreview}
          />
        </div>
      </main>
    </div>
  )
}
