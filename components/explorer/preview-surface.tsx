'use client'

import { useMemo, useState } from "react"
import { ChevronLeft, ChevronRight, Database, Search, Sparkles } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import type { ExplorerPreview } from "@/lib/explorer/types"

interface PreviewSurfaceProps {
  preview: ExplorerPreview
  selectedPreview: ExplorerPreview
  showingQueryResult: boolean
}

const PAGE_SIZE = 4

function formatCellValue(value: string | number | boolean | null) {
  if (value === null) {
    return "null"
  }

  if (typeof value === "number") {
    return Number.isInteger(value) ? value.toLocaleString() : value.toLocaleString(undefined, { maximumFractionDigits: 2 })
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false"
  }

  return value
}

export default function PreviewSurface({
  preview,
  selectedPreview,
  showingQueryResult,
}: PreviewSurfaceProps) {
  return (
    <PreviewSurfaceContent
      key={preview.id}
      preview={preview}
      selectedPreview={selectedPreview}
      showingQueryResult={showingQueryResult}
    />
  )
}

function PreviewSurfaceContent({
  preview,
  selectedPreview,
  showingQueryResult,
}: PreviewSurfaceProps) {
  const [tab, setTab] = useState("data")
  const [searchTerm, setSearchTerm] = useState("")
  const [page, setPage] = useState(0)

  const filteredRows = useMemo(() => {
    const normalized = searchTerm.trim().toLowerCase()
    if (!normalized) {
      return preview.rows
    }

    return preview.rows.filter((row) =>
      Object.values(row).some((value) =>
        String(value ?? "").toLowerCase().includes(normalized)
      )
    )
  }, [preview.rows, searchTerm])

  const maxPage = Math.max(0, Math.ceil(filteredRows.length / PAGE_SIZE) - 1)
  const safePage = Math.min(page, maxPage)
  const visibleRows = filteredRows.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE)

  const sourceTone =
    preview.sourceType === "postgresql"
      ? "border-sky-400/25 bg-sky-400/8 text-sky-200"
      : "border-[rgba(201,167,106,0.22)] bg-[rgba(201,167,106,0.08)] text-[var(--ql-accent)]"

  return (
    <section className="rounded-[32px] border border-[rgba(255,255,255,0.08)] bg-[rgba(7,11,18,0.78)] shadow-[0_24px_70px_rgba(0,0,0,0.2)] backdrop-blur-xl">
      <div className="border-b border-[rgba(255,255,255,0.08)] px-5 py-5 lg:px-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={cn("rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.18em]", sourceTone)}>
                {preview.sourceType}
              </Badge>
              <Badge
                variant="outline"
                className="rounded-full border border-white/10 bg-white/4 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--ql-muted)]"
              >
                {preview.kind}
              </Badge>
              {showingQueryResult ? (
                <Badge
                  variant="outline"
                  className="rounded-full border border-emerald-400/25 bg-emerald-400/8 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-emerald-300"
                >
                  SQL result
                </Badge>
              ) : null}
            </div>

            <h1 className="mt-4 text-2xl font-semibold tracking-tight text-white lg:text-[2rem]">
              {preview.path.join(" / ")}
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--ql-muted)]">
              {preview.summary}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm text-white lg:min-w-[280px]">
            <div className="rounded-2xl border border-white/8 bg-white/4 px-4 py-3">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--ql-muted)]">
                Records
              </p>
              <p className="mt-2 text-xl font-semibold">{preview.rowCount.toLocaleString()}</p>
            </div>
            <div className="rounded-2xl border border-white/8 bg-white/4 px-4 py-3">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--ql-muted)]">
                Fields
              </p>
              <p className="mt-2 text-xl font-semibold">{preview.columns.length}</p>
            </div>
            <div className="rounded-2xl border border-white/8 bg-white/4 px-4 py-3">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--ql-muted)]">
                Source
              </p>
              <p className="mt-2 text-sm font-medium">{preview.sourceLabel}</p>
            </div>
            <div className="rounded-2xl border border-white/8 bg-white/4 px-4 py-3">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--ql-muted)]">
                Anchor
              </p>
              <p className="mt-2 text-sm font-medium">
                {showingQueryResult ? selectedPreview.path.join(" / ") : "Direct selection"}
              </p>
            </div>
          </div>
        </div>

        {showingQueryResult ? (
          <div className="mt-4 flex items-start gap-3 rounded-2xl border border-emerald-400/18 bg-emerald-400/8 px-4 py-3 text-sm text-emerald-100">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
            <p>
              Showing a canned SQL workbench result. The selected object remains{" "}
              <span className="font-medium text-white">{selectedPreview.path.join(" / ")}</span>.
            </p>
          </div>
        ) : null}
      </div>

      <div className="px-5 py-5 lg:px-7">
        <Tabs value={tab} onValueChange={setTab} className="gap-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <TabsList className="h-auto rounded-full border border-white/8 bg-white/4 p-1">
              <TabsTrigger
                value="data"
                className="rounded-full px-4 py-2 text-xs font-mono uppercase tracking-[0.18em] data-[state=active]:bg-[rgba(201,167,106,0.14)] data-[state=active]:text-white"
              >
                Data
              </TabsTrigger>
              <TabsTrigger
                value="structure"
                className="rounded-full px-4 py-2 text-xs font-mono uppercase tracking-[0.18em] data-[state=active]:bg-[rgba(201,167,106,0.14)] data-[state=active]:text-white"
              >
                Structure
              </TabsTrigger>
            </TabsList>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[rgba(151,164,181,0.6)]" />
                <input
                  aria-label="Filter rows"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search rows or documents"
                  className="h-11 w-full rounded-full border border-white/10 bg-[rgba(255,255,255,0.04)] pl-10 pr-4 text-sm text-white outline-none transition placeholder:text-[rgba(151,164,181,0.6)] focus:border-[rgba(201,167,106,0.36)] sm:w-72"
                />
              </label>
              <div className="flex items-center gap-2 rounded-full border border-white/10 bg-[rgba(255,255,255,0.04)] px-3 py-2 text-sm text-[var(--ql-muted)]">
                <Database className="h-4 w-4" />
                <span>
                  {filteredRows.length} of {preview.rows.length} {preview.rowLabel}
                </span>
              </div>
            </div>
          </div>

          <TabsContent value="data" className="min-h-[420px]">
            <div className="overflow-hidden rounded-[28px] border border-white/8 bg-[rgba(3,6,10,0.34)]">
              <div className="max-h-[460px] overflow-auto">
                <Table className="text-sm">
                  <TableHeader className="sticky top-0 z-10 bg-[rgba(12,18,27,0.95)] backdrop-blur">
                    <TableRow className="border-white/8 hover:bg-transparent">
                      {preview.columns.map((column) => (
                        <TableHead
                          key={column.name}
                          className="h-11 px-4 font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--ql-muted)]"
                        >
                          {column.name}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleRows.map((row, rowIndex) => (
                      <TableRow key={`${preview.id}-${rowIndex}`} className="border-white/6 hover:bg-white/3">
                        {preview.columns.map((column) => (
                          <TableCell
                            key={`${rowIndex}-${column.name}`}
                            className={cn(
                              "px-4 py-3 align-top text-[13px]",
                              typeof row[column.name] === "number"
                                ? "font-medium text-sky-100"
                                : "text-[rgba(237,242,248,0.84)]",
                            )}
                          >
                            <span className="block max-w-[280px] truncate">
                              {formatCellValue(row[column.name] ?? null)}
                            </span>
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex flex-col gap-3 border-t border-white/8 px-4 py-3 text-sm text-[var(--ql-muted)] sm:flex-row sm:items-center sm:justify-between">
                <p>
                  Page {safePage + 1} of {maxPage + 1}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((current) => Math.max(0, current - 1))}
                    disabled={safePage === 0}
                    className="inline-flex h-9 items-center gap-1 rounded-full border border-white/10 px-3 text-white transition disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Prev
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage((current) => Math.min(maxPage, current + 1))}
                    disabled={safePage >= maxPage}
                    className="inline-flex h-9 items-center gap-1 rounded-full border border-white/10 px-3 text-white transition disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="structure" className="min-h-[420px]">
            <div className="grid gap-3">
              {preview.columns.map((column) => (
                <div
                  key={column.name}
                  className="rounded-[24px] border border-white/8 bg-[rgba(255,255,255,0.04)] px-4 py-4 transition hover:border-[rgba(201,167,106,0.22)]"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-semibold text-white">{column.name}</h3>
                        <Badge variant="outline" className="rounded-full border border-white/10 bg-white/4 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--ql-muted)]">
                          {column.type}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={cn(
                            "rounded-full border font-mono text-[10px] uppercase tracking-[0.16em]",
                            column.nullable
                              ? "border-amber-400/25 bg-amber-400/8 text-amber-200"
                              : "border-emerald-400/25 bg-emerald-400/8 text-emerald-200",
                          )}
                        >
                          {column.nullable ? "nullable" : "required"}
                        </Badge>
                      </div>
                      <p className="mt-2 text-sm text-[var(--ql-muted)]">
                        {column.description ?? "Field surfaced in the UI-only explorer with a representative sample value for orientation."}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-white/8 bg-[rgba(3,6,10,0.34)] px-4 py-3 text-sm">
                      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--ql-muted)]">
                        Sample
                      </p>
                      <p className="mt-2 max-w-[280px] truncate text-white">{column.sample}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </section>
  )
}
