'use client'

import { useEffect, useMemo, useRef } from "react"
import { Eraser, Play, Wand2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { QueryMockMatch, SqlEditorState } from "@/lib/explorer/types"

interface SqlWorkbenchProps {
  editorState: SqlEditorState
  queryMocks: QueryMockMatch[]
  onQueryChange: (query: string) => void
  onFormat: () => void
  onClear: () => void
  onRun: () => void
}

const SQL_KEYWORDS =
  /\b(SELECT|FROM|WHERE|GROUP BY|ORDER BY|HAVING|JOIN|LEFT|RIGHT|INNER|OUTER|ON|AS|AND|OR|NOT|IN|IS|NULL|LIMIT|OFFSET|DISTINCT|COUNT|SUM|AVG|MAX|MIN|DESC|ASC|WITH)\b/gi

function highlightSql(sql: string) {
  return sql.split("\n").map((line, lineIndex) => {
    const nodes: React.ReactNode[] = []
    let lastIndex = 0
    let match: RegExpExecArray | null = null
    const regex = new RegExp(SQL_KEYWORDS.source, "gi")

    while ((match = regex.exec(line)) !== null) {
      if (match.index > lastIndex) {
        const segment = line.slice(lastIndex, match.index)
        const parts = segment.split(/(\'[^\']*\'|\"[^\"]*\"|\b\d+(?:\.\d+)?\b|--.*$)/g)
        parts.forEach((part, partIndex) => {
          if (!part) {
            return
          }

          let className = "text-[rgba(237,242,248,0.72)]"
          if (/^\'[^\']*\'$/.test(part) || /^\"[^\"]*\"$/.test(part)) {
            className = "text-amber-200"
          } else if (/^\d+(?:\.\d+)?$/.test(part)) {
            className = "text-sky-200"
          } else if (/^--.*$/.test(part)) {
            className = "text-[rgba(151,164,181,0.56)]"
          }

          nodes.push(
            <span key={`${lineIndex}-${partIndex}-${part}`} className={className}>
              {part}
            </span>,
          )
        })
      }

      nodes.push(
        <span key={`${lineIndex}-kw-${match.index}`} className="font-semibold text-[var(--ql-accent)]">
          {match[0]}
        </span>,
      )

      lastIndex = match.index + match[0].length
    }

    if (lastIndex < line.length) {
      nodes.push(
        <span key={`${lineIndex}-tail`} className="text-[rgba(237,242,248,0.72)]">
          {line.slice(lastIndex)}
        </span>,
      )
    }

    if (line.length === 0) {
      nodes.push(<span key={`${lineIndex}-empty`}>&nbsp;</span>)
    }

    return (
      <div key={lineIndex} className="min-h-6">
        {nodes}
      </div>
    )
  })
}

export default function SqlWorkbench({
  editorState,
  queryMocks,
  onQueryChange,
  onFormat,
  onClear,
  onRun,
}: SqlWorkbenchProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const lineNumberRef = useRef<HTMLDivElement | null>(null)
  const highlightRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) {
      return
    }

    const syncScroll = () => {
      if (lineNumberRef.current) {
        lineNumberRef.current.scrollTop = textarea.scrollTop
      }
      if (highlightRef.current) {
        highlightRef.current.scrollTop = textarea.scrollTop
        highlightRef.current.scrollLeft = textarea.scrollLeft
      }
    }

    textarea.addEventListener("scroll", syncScroll)
    return () => textarea.removeEventListener("scroll", syncScroll)
  }, [])

  const lineNumbers = useMemo(() => {
    const count = Math.max(1, editorState.query.split("\n").length)
    return Array.from({ length: count }, (_, index) => index + 1)
  }, [editorState.query])

  return (
    <section className="rounded-[32px] border border-[rgba(255,255,255,0.08)] bg-[rgba(7,11,18,0.78)] shadow-[0_24px_70px_rgba(0,0,0,0.2)] backdrop-blur-xl">
      <div className="flex flex-col gap-4 border-b border-[rgba(255,255,255,0.08)] px-5 py-5 lg:flex-row lg:items-start lg:justify-between lg:px-7">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="rounded-full border border-sky-400/25 bg-sky-400/8 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-sky-200">
              SQL workbench
            </Badge>
            <Badge variant="outline" className="rounded-full border border-white/10 bg-white/4 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--ql-muted)]">
              global scratchpad
            </Badge>
          </div>
          <h2 className="mt-4 text-xl font-semibold text-white">Relational editor</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--ql-muted)]">
            Use the workbench to sketch SQL against the PostgreSQL side of the model. Running a query swaps in a canned result set without calling a backend.
          </p>
        </div>

        <div className="grid gap-2 text-sm text-[var(--ql-muted)]">
          {queryMocks.map((queryMock) => (
            <button
              key={queryMock.id}
              type="button"
              onClick={() => onQueryChange(queryMock.sampleQuery)}
              className="rounded-2xl border border-white/8 bg-white/4 px-4 py-3 text-left transition hover:border-[rgba(201,167,106,0.22)] hover:text-white"
            >
              <p className="font-medium text-white">{queryMock.label}</p>
              <p className="mt-1 text-sm text-[var(--ql-muted)]">{queryMock.description}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="px-5 py-5 lg:px-7">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onRun}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-[var(--ql-accent)] px-5 text-sm font-semibold text-[#09111a] transition hover:brightness-105"
          >
            <Play className="h-4 w-4 fill-current" />
            Run mock query
          </button>
          <button
            type="button"
            onClick={onFormat}
            className="inline-flex h-11 items-center gap-2 rounded-full border border-white/10 px-4 text-sm font-medium text-white transition hover:border-[rgba(201,167,106,0.3)] hover:bg-white/4"
          >
            <Wand2 className="h-4 w-4" />
            Format
          </button>
          <button
            type="button"
            onClick={onClear}
            className="inline-flex h-11 items-center gap-2 rounded-full border border-white/10 px-4 text-sm font-medium text-white transition hover:border-white/20 hover:bg-white/4"
          >
            <Eraser className="h-4 w-4" />
            Clear
          </button>
        </div>

        <div className="overflow-hidden rounded-[28px] border border-white/8 bg-[rgba(3,6,10,0.4)]">
          <div className="grid grid-cols-[56px,minmax(0,1fr)]">
            <div
              ref={lineNumberRef}
              className="max-h-[360px] overflow-hidden border-r border-white/8 bg-[rgba(255,255,255,0.03)] px-3 py-4 font-mono text-[11px] leading-6 text-[rgba(151,164,181,0.58)]"
            >
              {lineNumbers.map((lineNumber) => (
                <div key={lineNumber} className="text-right">
                  {lineNumber}
                </div>
              ))}
            </div>

            <div className="relative">
              <div
                ref={highlightRef}
                aria-hidden="true"
                className="pointer-events-none max-h-[360px] overflow-auto px-4 py-4 font-mono text-[13px] leading-6"
              >
                {highlightSql(editorState.query)}
              </div>

              <textarea
                ref={textareaRef}
                aria-label="SQL editor"
                value={editorState.query}
                onChange={(event) => onQueryChange(event.target.value)}
                spellCheck={false}
                className={cn(
                  "absolute inset-0 max-h-[360px] min-h-[360px] w-full resize-none overflow-auto bg-transparent px-4 py-4 font-mono text-[13px] leading-6 text-transparent caret-[var(--ql-accent)] outline-none",
                  "selection:bg-[rgba(201,167,106,0.22)] selection:text-transparent",
                )}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
