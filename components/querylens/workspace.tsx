'use client'

import { startTransition, useState } from "react"

import ChatPanel, { type ConversationMessage } from "@/components/querylens/chat-panel"
import EvidencePanel from "@/components/querylens/evidence-panel"
import Sidebar from "@/components/querylens/sidebar"
import type { BootstrapPayload, Phase1AnalysisResponse } from "@/lib/querylens/types"

function buildAssistantMessage(analysis: Phase1AnalysisResponse): ConversationMessage {
  return {
    id: `assistant-${Date.now()}`,
    role: "assistant",
    text: analysis.summary,
    analysis,
  }
}

export default function Workspace({
  initialQuestion,
  metric,
  sourceHealth,
  initialAnalysis,
}: BootstrapPayload) {
  const [messages, setMessages] = useState<ConversationMessage[]>([
    {
      id: "user-initial",
      role: "user",
      text: initialQuestion,
    },
    {
      id: "assistant-initial",
      role: "assistant",
      text: initialAnalysis.summary,
      analysis: initialAnalysis,
    },
  ])
  const [activeAnalysis, setActiveAnalysis] = useState(initialAnalysis)
  const [isLoading, setIsLoading] = useState(false)

  const handleSend = async (question: string) => {
    const trimmed = question.trim()
    if (!trimmed || isLoading) {
      return
    }

    const nextUserMessage: ConversationMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      text: trimmed,
    }

    startTransition(() => {
      setMessages((currentMessages) => [...currentMessages, nextUserMessage])
    })
    setIsLoading(true)

    try {
      const response = await fetch("/api/query", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ question: trimmed }),
      })

      if (!response.ok) {
        throw new Error("Query request failed.")
      }

      const analysis = (await response.json()) as Phase1AnalysisResponse

      startTransition(() => {
        setMessages((currentMessages) => [...currentMessages, buildAssistantMessage(analysis)])
        setActiveAnalysis(analysis)
      })
    } catch (error) {
      console.error(error)
      startTransition(() => {
        setMessages((currentMessages) => [
          ...currentMessages,
          {
            id: `assistant-error-${Date.now()}`,
            role: "assistant",
            text: "QueryLens could not analyze that request right now. The current evidence view is still available while the local slice is rechecked.",
          },
        ])
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(201,167,106,0.12),transparent_28%),radial-gradient(circle_at_top_right,rgba(72,101,130,0.16),transparent_24%),linear-gradient(180deg,#071019_0%,#0b121b_45%,#0d131c_100%)] text-[var(--ql-text)]">
      <header className="border-b border-[rgba(255,255,255,0.06)] bg-[rgba(7,11,18,0.68)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1800px] items-center justify-between px-4 py-5 lg:px-6">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.32em] text-[var(--ql-accent)]">
              QueryLens
            </p>
            <h1 className="mt-1 text-lg font-semibold text-white lg:text-xl">
              Cross-source “what changed” vertical slice
            </h1>
          </div>
          <div className="hidden text-right lg:block">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--ql-muted)]">
              Phase 1
            </p>
            <p className="mt-1 text-sm text-white">Trust-first SME cashflow analysis</p>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1800px] lg:grid-cols-[290px,minmax(0,1fr),430px]">
        <Sidebar analysis={activeAnalysis} metric={metric} sourceHealth={sourceHealth} />
        <EvidencePanel analysis={activeAnalysis} />
        <ChatPanel isLoading={isLoading} messages={messages} onSend={handleSend} />
      </div>
    </div>
  )
}
