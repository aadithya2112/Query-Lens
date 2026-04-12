"use client"

import { Send, Sparkles } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"

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

export interface ConversationMessage {
  id: string
  role: "user" | "assistant"
  text: string
  analysis?: Phase1AnalysisResponse
}

interface ChatPanelProps {
  messages: ConversationMessage[]
  isLoading: boolean
  onSend: (question: string) => Promise<void> | void
  suggestedPrompts: string[]
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

function InlineResultTable({ analysis }: { analysis: Phase1AnalysisResponse }) {
  if (!analysis.resultTable || analysis.resultTable.columns.length === 0) {
    return null
  }

  return (
    <div className="mt-4 overflow-hidden rounded-[22px] border border-border bg-background/40">
      <div className="border-b border-border px-4 py-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          Result preview
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {analysis.resultTable.truncated
            ? `Showing ${analysis.resultTable.rows.length} of at least ${analysis.resultTable.totalRows} rows`
            : `${analysis.resultTable.totalRows} row${analysis.resultTable.totalRows === 1 ? "" : "s"}`}
        </p>
      </div>
      <div className="max-h-72 overflow-auto">
        <Table className="text-xs">
          <TableHeader className="sticky top-0 z-10 bg-background/95">
            <TableRow className="border-border hover:bg-transparent">
              {analysis.resultTable.columns.map((column) => (
                <TableHead
                  key={column}
                  className="h-10 px-3 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground"
                >
                  {column}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {analysis.resultTable.rows.slice(0, 6).map((row, rowIndex) => (
              <TableRow key={`chat-result-${rowIndex}`} className="border-border">
                {analysis.resultTable?.columns.map((column) => (
                  <TableCell
                    key={`${rowIndex}-${column}`}
                    className="max-w-[180px] px-3 py-2 align-top text-foreground"
                  >
                    <span className="block truncate">
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
  )
}

function QueryRunsDisclosure({ analysis }: { analysis: Phase1AnalysisResponse }) {
  if (!analysis.queryRuns?.length) {
    return null
  }

  return (
    <div className="mt-4 rounded-[22px] border border-border bg-background/30 px-4 py-4">
      <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-4">
        Queries used
      </div>
      <div className="space-y-4">
        {analysis.queryRuns.map((queryRun) => (
          <div
            key={queryRun.id}
            className="rounded-[18px] border border-border bg-background/40 px-4 py-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
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
            <pre className="mt-3 overflow-x-auto rounded-2xl border border-border bg-black/30 p-3 text-xs leading-6 text-foreground">
              <code>{queryRun.statement}</code>
            </pre>
          </div>
        ))}
      </div>
    </div>
  )
}

function AssistantMessage({
  message,
  onSend,
}: {
  message: ConversationMessage
  onSend: (question: string) => void
}) {
  const analysis = message.analysis

  return (
    <div className="ql-enter rounded-3xl border border-border bg-card/50 px-4 py-4">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-2xl border border-border bg-muted/20 text-foreground">
          <Sparkles size={14} />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">
            QueryLens analyst
          </p>
          {analysis && (
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              {analysis.activeScope}
            </p>
          )}
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {analysis?.headline && (
          <p className="text-base font-semibold text-foreground">
            {analysis.headline}
          </p>
        )}
        <p className="text-sm leading-7 text-muted-foreground">
          {message.text}
        </p>
      </div>

      {analysis?.chartSpec && (
        <div className="mt-4">
          <TrendChart analysis={analysis} compact />
        </div>
      )}

      {analysis && <InlineResultTable analysis={analysis} />}
      {analysis && <QueryRunsDisclosure analysis={analysis} />}

      {analysis && (
        <div className="mt-4 border-t border-border pt-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground">
              {analysis.timeframe}
            </span>
            <span className="font-mono text-xs text-muted-foreground">
              confidence {analysis.confidence}%
            </span>
          </div>
          {analysis.conversationContextUsed && (
            <p className="mt-3 text-xs text-muted-foreground">
              Conversation context was used to interpret this reply.
            </p>
          )}
          {analysis.supportedFollowUps.length > 0 && analysis.confidence >= 50 && !message.text.includes("could not complete that custom analysis safely") && (
            <div className="mt-4 flex flex-wrap gap-2">
              {analysis.supportedFollowUps.map((followUp) => (
                <button
                  key={followUp}
                  className="rounded-full border border-border px-3 py-1.5 text-left text-xs bg-muted/20 text-muted-foreground transition hover:border-muted-foreground hover:text-foreground"
                  onClick={() => onSend(followUp)}
                  type="button"
                >
                  {followUp}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ThinkingIndicator() {
  const STAGES = [
    "Parsing your question",
    "Retrieving relevant context",
    "Generating SQL queries",
    "Executing against live sources",
    "Analyzing results",
    "Composing grounded answer",
  ]

  const [stageIndex, setStageIndex] = useState(0)

  const advanceStage = useCallback(() => {
    setStageIndex((current) =>
      current < STAGES.length - 1 ? current + 1 : current,
    )
  }, [STAGES.length])

  useEffect(() => {
    const intervalId = setInterval(advanceStage, 2400)
    return () => clearInterval(intervalId)
  }, [advanceStage])

  return (
    <div className="ql-thinking-card px-5 py-5">
      {/* header row */}
      <div className="relative z-10 flex items-center gap-3">
        <div className="ql-thinking-orb">
          <div className="ql-thinking-dots">
            <span className="ql-thinking-dot" />
            <span className="ql-thinking-dot" />
            <span className="ql-thinking-dot" />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <p className="text-sm font-semibold text-foreground/90 ql-thinking-text">
            QueryLens is thinking…
          </p>
          <div className="ql-thinking-stage">
            <span className="ql-thinking-stage-dot" />
            {STAGES[stageIndex]}
          </div>
        </div>
      </div>

      {/* progress shimmer bar */}
      <div className="relative z-10 mt-4">
        <div className="ql-thinking-bar" />
      </div>
    </div>
  )
}

export default function ChatPanel({
  messages,
  isLoading,
  onSend,
  suggestedPrompts,
}: ChatPanelProps) {
  const [inputValue, setInputValue] = useState("")
  const scrollAnchorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isLoading])

  const submit = async () => {
    const nextQuestion = inputValue.trim()
    if (!nextQuestion || isLoading) {
      return
    }

    setInputValue("")
    await onSend(nextQuestion)
  }

  return (
    <aside className="relative flex h-full min-h-0 flex-col px-4 py-4 lg:px-5 lg:py-7 bg-background overflow-hidden">
      <div className="flex-1 space-y-4 overflow-y-auto py-5 px-1 pr-3">
        {messages.map((message) =>
          message.role === "user" ? (
            <div
              key={message.id}
              className="ql-enter ml-auto max-w-[88%] rounded-[22px] bg-foreground/10 px-4 py-3 text-sm leading-7 text-foreground"
            >
              {message.text}
            </div>
          ) : (
            <AssistantMessage
              key={message.id}
              message={message}
              onSend={onSend}
            />
          ),
        )}

        {isLoading && <ThinkingIndicator />}

        <div ref={scrollAnchorRef} />
      </div>

      <div className="flex flex-col gap-4 border-t border-border pt-4">
        {messages.length <= 2 && (
          <div className="flex flex-wrap gap-2">
            {suggestedPrompts.map((prompt) => (
              <button
                key={prompt}
                className="rounded-full border border-border px-3 py-1.5 text-left text-xs text-muted-foreground transition hover:border-muted-foreground hover:text-foreground bg-muted/20"
                onClick={() => onSend(prompt)}
                type="button"
              >
                {prompt}
              </button>
            ))}
          </div>
        )}
        <div className="rounded-full border border-border bg-card/50 backdrop-blur-xl p-1.5 pl-4 flex items-end gap-2 shadow-sm">
          <textarea
            className="min-h-10 max-h-32 w-full resize-none bg-transparent py-2.5 text-sm leading-tight text-foreground outline-none placeholder:text-muted-foreground"
            onChange={(event) => setInputValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault()
                void submit()
              }
            }}
            placeholder="Ask a question..."
            rows={1}
            value={inputValue}
          />
          <button
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-foreground text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!inputValue.trim() || isLoading}
            onClick={() => void submit()}
            type="button"
          >
            <Send size={16} />
          </button>
        </div>
        <p className="text-[11px] text-center text-muted-foreground">
          Enter to send, Shift+Enter for a new line.
        </p>
      </div>
    </aside>
  )
}
