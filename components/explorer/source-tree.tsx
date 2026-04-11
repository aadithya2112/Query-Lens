'use client'

import { useMemo, useState } from "react"
import {
  ChevronDown,
  Database,
  FolderTree,
  HardDrive,
  Layers3,
  Table2,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { ExplorerNode, ExplorerPreview, ExplorerSource } from "@/lib/explorer/types"

interface SourceTreeProps {
  sources: ExplorerSource[]
  previewsById: Record<string, ExplorerPreview>
  selectedPreviewId: string
  onSelectPreview: (previewId: string) => void
}

const KIND_ICON = {
  server: HardDrive,
  schema: Layers3,
  table: Table2,
  cluster: Database,
  database: FolderTree,
  collection: Table2,
} as const

function collectDefaultExpanded(nodes: ExplorerNode[], expanded: Record<string, boolean>) {
  for (const node of nodes) {
    if (node.defaultExpanded) {
      expanded[node.id] = true
    }
    if (node.children) {
      collectDefaultExpanded(node.children, expanded)
    }
  }
}

function TreeNode({
  node,
  depth,
  expanded,
  onToggle,
  selectedPreviewId,
  previewsById,
  onSelectPreview,
}: {
  node: ExplorerNode
  depth: number
  expanded: Record<string, boolean>
  onToggle: (nodeId: string) => void
  selectedPreviewId: string
  previewsById: Record<string, ExplorerPreview>
  onSelectPreview: (previewId: string) => void
}) {
  const Icon = KIND_ICON[node.kind]
  const hasChildren = Boolean(node.children?.length)
  const isExpanded = expanded[node.id] ?? false
  const isSelected = node.previewId === selectedPreviewId
  const preview = node.previewId ? previewsById[node.previewId] : null

  return (
    <div>
      <div
        className={cn(
          "group flex items-center gap-2 rounded-2xl px-2 py-2 transition-colors",
          isSelected
            ? "bg-[rgba(201,167,106,0.12)] text-white"
            : "text-[rgba(237,242,248,0.72)] hover:bg-white/4 hover:text-white",
        )}
        style={{ paddingLeft: `${10 + depth * 16}px` }}
      >
        <button
          type="button"
          aria-label={hasChildren ? `Toggle ${node.label}` : undefined}
          onClick={() => hasChildren && onToggle(node.id)}
          className={cn(
            "flex h-5 w-5 items-center justify-center rounded-full text-[rgba(151,164,181,0.72)] transition",
            hasChildren ? "hover:bg-white/6" : "pointer-events-none opacity-30",
          )}
        >
          <ChevronDown
            className={cn("h-3.5 w-3.5 transition-transform", !isExpanded && hasChildren && "-rotate-90")}
          />
        </button>

        <button
          type="button"
          onClick={() => node.previewId && onSelectPreview(node.previewId)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          disabled={!node.previewId}
        >
          <Icon className={cn("h-4 w-4 shrink-0", isSelected ? "text-[var(--ql-accent)]" : "text-[rgba(151,164,181,0.78)]")} />
          <span className="truncate text-sm font-medium">{node.label}</span>
        </button>

        {preview ? (
          <span className="hidden font-mono text-[11px] uppercase tracking-[0.16em] text-[rgba(151,164,181,0.64)] lg:inline">
            {preview.rowCount.toLocaleString()}
          </span>
        ) : null}
      </div>

      {node.meta ? (
        <div
          className="pb-1 pl-12 pr-3 font-mono text-[10px] uppercase tracking-[0.16em] text-[rgba(151,164,181,0.5)]"
          style={{ paddingLeft: `${46 + depth * 16}px` }}
        >
          {node.meta}
        </div>
      ) : null}

      {hasChildren && isExpanded ? (
        <div className="space-y-0.5 pb-1">
          {node.children!.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              onToggle={onToggle}
              selectedPreviewId={selectedPreviewId}
              previewsById={previewsById}
              onSelectPreview={onSelectPreview}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

export default function SourceTree({
  sources,
  previewsById,
  selectedPreviewId,
  onSelectPreview,
}: SourceTreeProps) {
  const initialExpanded = useMemo(() => {
    const expanded: Record<string, boolean> = {}
    for (const source of sources) {
      collectDefaultExpanded(source.nodes, expanded)
    }
    return expanded
  }, [sources])

  const [expanded, setExpanded] = useState(initialExpanded)

  return (
    <aside className="rounded-[28px] border border-[rgba(255,255,255,0.08)] bg-[rgba(7,11,18,0.72)] p-4 shadow-[0_24px_70px_rgba(0,0,0,0.22)] backdrop-blur-xl">
      <div className="border-b border-[rgba(255,255,255,0.08)] pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[rgba(201,167,106,0.18)] bg-[rgba(201,167,106,0.08)] text-[var(--ql-accent)]">
            <Database className="h-5 w-5" />
          </div>
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-[var(--ql-accent)]">
              Explorer
            </p>
            <h2 className="text-base font-semibold text-white">Unified source browser</h2>
          </div>
        </div>
        <p className="mt-3 text-sm leading-6 text-[var(--ql-muted)]">
          Browse PostgreSQL schemas and MongoDB collections from one calm workspace without leaving the page.
        </p>
      </div>

      <div className="mt-4 space-y-5">
        {sources.map((source) => (
          <section key={source.id} className="space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-white">{source.label}</p>
                <p className="mt-1 text-sm text-[var(--ql-muted)]">{source.description}</p>
              </div>
              <Badge
                variant="outline"
                className={cn(
                  "rounded-full border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.18em]",
                  source.status === "live"
                    ? "border-emerald-400/30 bg-emerald-400/8 text-emerald-300"
                    : "border-[rgba(201,167,106,0.22)] bg-[rgba(201,167,106,0.08)] text-[var(--ql-accent)]",
                )}
              >
                {source.status}
              </Badge>
            </div>

            <div className="space-y-1">
              {source.nodes.map((node) => (
                <TreeNode
                  key={node.id}
                  node={node}
                  depth={0}
                  expanded={expanded}
                  onToggle={(nodeId) =>
                    setExpanded((current) => ({ ...current, [nodeId]: !current[nodeId] }))
                  }
                  selectedPreviewId={selectedPreviewId}
                  previewsById={previewsById}
                  onSelectPreview={onSelectPreview}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </aside>
  )
}
