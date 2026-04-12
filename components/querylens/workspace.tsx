"use client"

import Link from "next/link"
import { startTransition, useEffect, useState } from "react"

import { Activity, Settings2 } from "lucide-react"

import ChatPanel, {
  type ConversationMessage,
} from "@/components/querylens/chat-panel"
import EvidencePanel from "@/components/querylens/evidence-panel"
import { Button } from "@/components/ui/button"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import type {
  BootstrapPayload,
  Phase1AnalysisResponse,
} from "@/lib/querylens/types"

const CHAT_ID_STORAGE_KEY = "querylens.chatId"
const CHAT_MESSAGES_STORAGE_KEY = "querylens.messages"
const ACTIVE_ANALYSIS_STORAGE_KEY = "querylens.activeAnalysis"

function buildInitialMessages(
  initialQuestion: string,
  initialAnalysis: Phase1AnalysisResponse,
): ConversationMessage[] {
  return [
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
  ]
}

function generateChatId() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID()
  }

  return `querylens-${Date.now()}`
}

function readStoredState<T>(key: string): T | undefined {
  if (typeof window === "undefined") {
    return undefined
  }

  try {
    const rawValue = window.localStorage.getItem(key)
    if (!rawValue) {
      return undefined
    }

    return JSON.parse(rawValue) as T
  } catch {
    return undefined
  }
}

function buildAssistantMessage(
  analysis: Phase1AnalysisResponse,
): ConversationMessage {
  return {
    id: `assistant-${Date.now()}`,
    role: "assistant",
    text: analysis.summary,
    analysis,
  }
}

function buildSuggestedPrompts(
  initialQuestion: string,
  activeAnalysis: Phase1AnalysisResponse,
) {
  return Array.from(
    new Set([
      "What data is currently stored?",
      initialQuestion,
      ...activeAnalysis.supportedFollowUps,
    ]),
  ).slice(0, 6)
}

export default function Workspace({
  initialQuestion,
  metrics,
  sourceHealth,
  initialAnalysis,
}: BootstrapPayload) {
  const [messages, setMessages] = useState<ConversationMessage[]>(
    buildInitialMessages(initialQuestion, initialAnalysis),
  )
  const [activeAnalysis, setActiveAnalysis] = useState(initialAnalysis)
  const [chatId, setChatId] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isRestored, setIsRestored] = useState(false)
  const activeMetric = metrics.find(
    (metric) => metric.id === activeAnalysis.metric,
  )
  const activeMetricLabel =
    activeAnalysis.intent === "discovery"
      ? "Dataset discovery"
      : activeAnalysis.intent === "agentic_query"
        ? "Custom live query"
        : activeMetric?.label || "Cashflow"
  const suggestedPrompts = buildSuggestedPrompts(
    initialQuestion,
    activeAnalysis,
  )

  useEffect(() => {
    const storedChatId = window.localStorage.getItem(CHAT_ID_STORAGE_KEY)
    const nextChatId = storedChatId || generateChatId()

    if (!storedChatId) {
      window.localStorage.setItem(CHAT_ID_STORAGE_KEY, nextChatId)
    }

    setChatId(nextChatId)

    const storedMessages = readStoredState<ConversationMessage[]>(
      CHAT_MESSAGES_STORAGE_KEY,
    )
    const storedAnalysis = readStoredState<Phase1AnalysisResponse>(
      ACTIVE_ANALYSIS_STORAGE_KEY,
    )

    if (storedMessages?.length) {
      setMessages(storedMessages)
    }

    if (storedAnalysis) {
      setActiveAnalysis(storedAnalysis)
    }

    setIsRestored(true)
  }, [])

  useEffect(() => {
    if (!isRestored || typeof window === "undefined") {
      return
    }

    window.localStorage.setItem(
      CHAT_MESSAGES_STORAGE_KEY,
      JSON.stringify(messages),
    )
    window.localStorage.setItem(
      ACTIVE_ANALYSIS_STORAGE_KEY,
      JSON.stringify(activeAnalysis),
    )
  }, [activeAnalysis, isRestored, messages])

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
        body: JSON.stringify({
          question: trimmed,
          chatId: chatId || undefined,
        }),
      })

      if (!response.ok) {
        throw new Error("Query request failed.")
      }

      const analysis = (await response.json()) as Phase1AnalysisResponse

      startTransition(() => {
        setMessages((currentMessages) => [
          ...currentMessages,
          buildAssistantMessage(analysis),
        ])
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
            text: "QueryLens could not analyze that request right now. The current evidence view is still available while the active slice is rechecked.",
          },
        ])
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex h-screen flex-col bg-background text-foreground overflow-hidden">
      <header className="sticky top-0 z-50 flex h-14 shrink-0 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur supports-backdrop-filter:bg-background/60">
        <div className="flex items-center gap-3">
          <Activity className="h-5 w-5 text-foreground" />
          <h1 className="font-semibold text-foreground">
            QueryLens{" "}
            <span className="ml-2 font-normal text-muted-foreground">
              Analysis Workspace
            </span>
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <p className="hidden text-sm text-muted-foreground md:inline-block">
            Metric Focus:{" "}
            <span className="font-medium text-foreground">
              {activeMetricLabel}
            </span>
          </p>
          <div className="h-4 w-px bg-border hidden md:block" />
          <Button asChild variant="ghost" size="sm" className="gap-2">
            <Link href="/explorer">
              <Settings2 className="h-4 w-4" />
              <span className="hidden sm:inline-block">Source context</span>
            </Link>
          </Button>
        </div>
      </header>

      <div className="flex-1 overflow-hidden min-h-0">
        <ResizablePanelGroup direction="horizontal" className="h-full">
          <ResizablePanel
            defaultSize={65}
            minSize={40}
            className="flex h-full min-h-0 flex-col overflow-hidden"
          >
            <ChatPanel
              isLoading={isLoading}
              messages={messages}
              onSend={handleSend}
              suggestedPrompts={suggestedPrompts}
            />
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel
            defaultSize={35}
            minSize={25}
            className="h-full min-h-0 overflow-y-auto bg-muted/10"
          >
            <div className="h-full overflow-y-auto">
              <EvidencePanel analysis={activeAnalysis} />
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  )
}
