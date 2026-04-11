'use client'

import { useMemo, useState } from "react"
import { Compass, Database, Sparkles } from "lucide-react"

import PreviewSurface from "@/components/explorer/preview-surface"
import SourceTree from "@/components/explorer/source-tree"
import SqlWorkbench from "@/components/explorer/sql-workbench"
import { formatSqlQuery, resolveMockQueryPreviewId } from "@/lib/explorer/workbench"
import type { ExplorerModel, SqlEditorState } from "@/lib/explorer/types"

interface ExplorerWorkspaceProps {
  model: ExplorerModel
}

export default function ExplorerWorkspace({ model }: ExplorerWorkspaceProps) {
  const previewsById = useMemo(
    () =>
      Object.fromEntries(model.previews.map((preview) => [preview.id, preview])),
    [model.previews],
  )

  const [selectedPreviewId, setSelectedPreviewId] = useState(model.defaultPreviewId)
  const [activePreviewId, setActivePreviewId] = useState(model.defaultPreviewId)
  const [editorState, setEditorState] = useState<SqlEditorState>({
    query: model.initialQuery,
    lastRunPreviewId: null,
  })

  const selectedPreview = previewsById[selectedPreviewId]
  const activePreview = previewsById[activePreviewId]
  const showingQueryResult = activePreview.kind === "query"

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(201,167,106,0.12),transparent_26%),radial-gradient(circle_at_top_right,rgba(72,101,130,0.18),transparent_24%),linear-gradient(180deg,#071019_0%,#0b121b_48%,#0d131c_100%)] text-[var(--ql-text)]">
      <header className="border-b border-[rgba(255,255,255,0.06)] bg-[rgba(7,11,18,0.68)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1800px] flex-col gap-5 px-4 py-6 lg:flex-row lg:items-end lg:justify-between lg:px-6">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[rgba(201,167,106,0.18)] bg-[rgba(201,167,106,0.08)] text-[var(--ql-accent)]">
                <Compass className="h-5 w-5" />
              </div>
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.32em] text-[var(--ql-accent)]">
                  QueryLens
                </p>
                <h1 className="mt-1 text-2xl font-semibold text-white lg:text-[2rem]">
                  Database explorer
                </h1>
              </div>
            </div>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-[var(--ql-muted)]">
              A UI-only operator surface for scanning PostgreSQL tables and MongoDB collections, with a shared SQL workbench and clean previews built entirely from local mock data.
            </p>
          </div>

          <div className="grid gap-3 text-sm text-white sm:grid-cols-2 xl:grid-cols-3">
            <div className="rounded-2xl border border-white/8 bg-[rgba(255,255,255,0.04)] px-4 py-3">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--ql-muted)]">
                Sources
              </p>
              <p className="mt-2 text-lg font-semibold">PostgreSQL + MongoDB</p>
            </div>
            <div className="rounded-2xl border border-white/8 bg-[rgba(255,255,255,0.04)] px-4 py-3">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--ql-muted)]">
                Selection
              </p>
              <p className="mt-2 text-lg font-semibold">{selectedPreview.path.join(" / ")}</p>
            </div>
            <div className="rounded-2xl border border-white/8 bg-[rgba(255,255,255,0.04)] px-4 py-3 sm:col-span-2 xl:col-span-1">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--ql-muted)]">
                Workbench
              </p>
              <p className="mt-2 text-lg font-semibold">Mock execution only</p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1800px] px-4 py-6 lg:px-6 lg:py-7">
        <div className="grid gap-6 xl:grid-cols-[340px,minmax(0,1fr)]">
          <SourceTree
            sources={model.sources}
            previewsById={previewsById}
            selectedPreviewId={selectedPreviewId}
            onSelectPreview={(previewId) => {
              setSelectedPreviewId(previewId)
              setActivePreviewId(previewId)
            }}
          />

          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-[28px] border border-white/8 bg-[rgba(7,11,18,0.72)] px-5 py-4 backdrop-blur-xl">
                <div className="flex items-center gap-2 text-[var(--ql-accent)]">
                  <Database className="h-4 w-4" />
                  <p className="font-mono text-[11px] uppercase tracking-[0.18em]">Object focus</p>
                </div>
                <p className="mt-3 text-lg font-semibold text-white">{selectedPreview.label}</p>
                <p className="mt-1 text-sm text-[var(--ql-muted)]">{selectedPreview.summary}</p>
              </div>
              <div className="rounded-[28px] border border-white/8 bg-[rgba(7,11,18,0.72)] px-5 py-4 backdrop-blur-xl">
                <div className="flex items-center gap-2 text-[var(--ql-accent)]">
                  <Sparkles className="h-4 w-4" />
                  <p className="font-mono text-[11px] uppercase tracking-[0.18em]">Mode</p>
                </div>
                <p className="mt-3 text-lg font-semibold text-white">
                  {showingQueryResult ? "Workbench result" : "Direct source preview"}
                </p>
                <p className="mt-1 text-sm text-[var(--ql-muted)]">
                  {showingQueryResult
                    ? "The SQL editor is temporarily driving the center preview."
                    : "The center preview reflects the current selection in the source browser."}
                </p>
              </div>
              <div className="rounded-[28px] border border-white/8 bg-[rgba(7,11,18,0.72)] px-5 py-4 backdrop-blur-xl">
                <div className="flex items-center gap-2 text-[var(--ql-accent)]">
                  <Compass className="h-4 w-4" />
                  <p className="font-mono text-[11px] uppercase tracking-[0.18em]">Coverage</p>
                </div>
                <p className="mt-3 text-lg font-semibold text-white">
                  {model.previews.filter((preview) => preview.kind !== "query").length} objects
                </p>
                <p className="mt-1 text-sm text-[var(--ql-muted)]">
                  Tables and collections are seeded locally so the workspace feels real before backend wiring starts.
                </p>
              </div>
            </div>

            <PreviewSurface
              preview={activePreview}
              selectedPreview={selectedPreview}
              showingQueryResult={showingQueryResult}
            />

            <SqlWorkbench
              editorState={editorState}
              queryMocks={model.queryMocks}
              onQueryChange={(query) =>
                setEditorState((current) => ({ ...current, query }))
              }
              onFormat={() =>
                setEditorState((current) => ({
                  ...current,
                  query: formatSqlQuery(current.query),
                }))
              }
              onClear={() =>
                setEditorState({
                  query: "",
                  lastRunPreviewId: null,
                })
              }
              onRun={() => {
                const previewId = resolveMockQueryPreviewId(
                  editorState.query,
                  model.queryMocks,
                  selectedPreviewId,
                )

                setEditorState((current) => ({
                  ...current,
                  lastRunPreviewId: previewId,
                }))
                setActivePreviewId(previewId)
              }}
            />
          </div>
        </div>
      </main>
    </div>
  )
}
