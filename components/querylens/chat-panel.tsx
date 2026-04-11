'use client'

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
  "Why did North West cashflow health drop last week?",
  "Why did hospitality cashflow health drop this week?",
]

function AssistantMessage({ message, onSend }: { message: ConversationMessage; onSend: (question: string) => void }) {
  const analysis = message.analysis

  return (
    <div className="ql-enter rounded-[24px] border border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.02)] px-4 py-4">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-2xl border border-[rgba(201,167,106,0.18)] bg-[rgba(201,167,106,0.08)] text-[var(--ql-accent)]">
          <Sparkles size={14} />
        </div>
        <div>
          <p className="text-sm font-semibold text-white">QueryLens analyst</p>
          {analysis && (
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--ql-muted)]">
              {analysis.activeScope}
            </p>
          )}
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {analysis?.headline && <p className="text-base font-semibold text-white">{analysis.headline}</p>}
        <p className="text-sm leading-7 text-[var(--ql-muted)]">{message.text}</p>
      </div>

      {analysis && (
        <div className="mt-4 border-t border-[rgba(255,255,255,0.06)] pt-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-[var(--ql-muted)]">{analysis.timeframe}</span>
            <span className="font-mono text-xs text-[var(--ql-accent)]">
              confidence {analysis.confidence}%
            </span>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {analysis.supportedFollowUps.map((followUp) => (
              <button
                key={followUp}
                className="rounded-full border border-[rgba(201,167,106,0.18)] px-3 py-1.5 text-left text-xs text-[var(--ql-muted)] transition hover:border-[rgba(201,167,106,0.34)] hover:text-white"
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

export default function ChatPanel({ messages, isLoading, onSend }: ChatPanelProps) {
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
    <aside className="ql-panel flex min-h-[calc(100vh-74px)] flex-col px-4 py-4 lg:px-5 lg:py-7">
      <div className="border-b border-[rgba(201,167,106,0.14)] pb-5">
        <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-[var(--ql-accent)]">
          Ask QueryLens
        </p>
        <h2 className="mt-2 text-xl font-semibold text-white">
          Explain one weekly change clearly
        </h2>
        <p className="mt-3 text-sm leading-6 text-[var(--ql-muted)]">
          This first slice is intentionally narrow: ask why the seeded cashflow health score changed this week or last week.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-[rgba(255,255,255,0.05)] py-4">
        {QUICK_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            className="rounded-full border border-[rgba(255,255,255,0.08)] px-3 py-1.5 text-left text-xs text-[var(--ql-muted)] transition hover:border-[rgba(201,167,106,0.34)] hover:text-white"
            onClick={() => onSend(prompt)}
            type="button"
          >
            {prompt}
          </button>
        ))}
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto py-5">
        {messages.map((message) =>
          message.role === "user" ? (
            <div key={message.id} className="ql-enter ml-auto max-w-[88%] rounded-[22px] bg-[var(--ql-accent)]/95 px-4 py-3 text-sm leading-7 text-[#10151c]">
              {message.text}
            </div>
          ) : (
            <AssistantMessage key={message.id} message={message} onSend={onSend} />
          )
        )}

        {isLoading && (
          <div className="ql-enter rounded-[22px] border border-[rgba(255,255,255,0.07)] px-4 py-4 text-sm text-[var(--ql-muted)]">
            QueryLens is assembling the weekly drivers and corroborating context.
          </div>
        )}

        <div ref={scrollAnchorRef} />
      </div>

      <div className="border-t border-[rgba(201,167,106,0.14)] pt-4">
        <div className="rounded-[24px] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] p-3">
          <textarea
            className="min-h-[92px] w-full resize-none bg-transparent text-sm leading-7 text-white outline-none placeholder:text-[var(--ql-muted)]"
            onChange={(event) => setInputValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault()
                void submit()
              }
            }}
            placeholder="Why did SME cashflow health drop last week?"
            value={inputValue}
          />
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-xs text-[var(--ql-muted)]">Enter to send, Shift+Enter for a new line.</p>
            <button
              className="inline-flex items-center gap-2 rounded-full bg-[var(--ql-accent)] px-4 py-2 text-sm font-medium text-[#11151c] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!inputValue.trim() || isLoading}
              onClick={() => void submit()}
              type="button"
            >
              <Send size={14} />
              Ask
            </button>
          </div>
        </div>
      </div>
    </aside>
  )
}
