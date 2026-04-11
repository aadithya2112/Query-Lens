"use client"

import { Send, Sparkles } from "lucide-react"
import { useEffect, useRef, useState } from "react"

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
}

const QUICK_PROMPTS = [
  "Why did SME cashflow health drop last week?",
  "What makes up at-risk accounts by region and sector last week?",
  "Compare cashflow health this week vs last week",
  "Why did North West cashflow health drop last week?",
  "Why did hospitality cashflow health drop this week?",
]

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
        </div>
      )}
    </div>
  )
}

export default function ChatPanel({
  messages,
  isLoading,
  onSend,
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

        {isLoading && (
          <div className="ql-enter rounded-[22px] border border-border px-4 py-4 text-sm text-muted-foreground">
            QueryLens is assembling the weekly drivers and corroborating
            context.
          </div>
        )}

        <div ref={scrollAnchorRef} />
      </div>

      <div className="flex flex-col gap-4 border-t border-border pt-4">
        {messages.length <= 2 && (
          <div className="flex flex-wrap gap-2">
            {QUICK_PROMPTS.map((prompt) => (
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
