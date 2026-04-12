"use client"

import { startTransition, useEffect, useState } from "react"

import Link from "next/link"
import { Activity, Github, Home, Settings2 } from "lucide-react"

import ChatPanel, {
  type ConversationMessage,
} from "@/components/querylens/chat-panel"
import EvidencePanel from "@/components/querylens/evidence-panel"
import Sidebar from "@/components/querylens/sidebar"
import { Button } from "@/components/ui/button"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetDescription,
} from "@/components/ui/sheet"
import type {
  BootstrapPayload,
  Phase1AnalysisResponse,
} from "@/lib/querylens/types"

const CHAT_ID_STORAGE_KEY = "querylens.chatId"
const CHAT_MESSAGES_STORAGE_KEY = "querylens.messages"
const ACTIVE_ANALYSIS_STORAGE_KEY = "querylens.activeAnalysis"

function buildInitialMessages(
  initialQuestion: string,
  initialAnalysis: Phase1AnalysisResponse
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
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
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

export default function Workspace({
  initialQuestion,
  metrics,
  sourceHealth,
  initialAnalysis,
}: BootstrapPayload) {
  const [messages, setMessages] = useState<ConversationMessage[]>(
    buildInitialMessages(initialQuestion, initialAnalysis)
  )
  const [activeAnalysis, setActiveAnalysis] = useState(initialAnalysis)
  const [chatId, setChatId] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isRestored, setIsRestored] = useState(false)
  const activeMetric = metrics.find((metric) => metric.id === activeAnalysis.metric)

  useEffect(() => {
    const storedChatId = window.localStorage.getItem(CHAT_ID_STORAGE_KEY)
    const nextChatId = storedChatId || generateChatId()

    if (!storedChatId) {
      window.localStorage.setItem(CHAT_ID_STORAGE_KEY, nextChatId)
    }

    setChatId(nextChatId)

    const storedMessages = readStoredState<ConversationMessage[]>(
      CHAT_MESSAGES_STORAGE_KEY
    )
    const storedAnalysis = readStoredState<Phase1AnalysisResponse>(
      ACTIVE_ANALYSIS_STORAGE_KEY
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

    window.localStorage.setItem(CHAT_MESSAGES_STORAGE_KEY, JSON.stringify(messages))
    window.localStorage.setItem(
      ACTIVE_ANALYSIS_STORAGE_KEY,
      JSON.stringify(activeAnalysis)
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
          <a
            href="/"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted/20 hover:text-foreground"
            title="Home"
          >
            <Home className="h-4 w-4" />
          </a>
          <a
            href="https://github.com/aadithya2112/Query-Lens"
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted/20 hover:text-foreground"
            title="GitHub"
          >
            <Github className="h-4 w-4" />
          </a>
          <div className="h-4 w-px bg-border hidden md:block" />
          <p className="hidden text-sm text-muted-foreground md:inline-block">
              Metric Focus:{" "}
              <span className="font-medium text-foreground">
                {activeAnalysis.intent === "discovery"
                  ? "Dataset discovery"
                  : activeMetric?.label || "Cashflow"}
              </span>
            </p>
          <div className="h-4 w-px bg-border hidden md:block" />
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2">
                <Settings2 className="h-4 w-4" />
                <span className="hidden sm:inline-block">Source context</span>
              </Button>
            </SheetTrigger>
            <SheetContent className="w-full sm:w-[400px] overflow-y-auto border-border bg-background sm:max-w-md">
              <SheetHeader>
                <SheetTitle>Analysis Context</SheetTitle>
                <SheetDescription>
                  Health data and underlying metric logic.
                </SheetDescription>
              </SheetHeader>
              <div className="mt-6">
                <Sidebar
                  analysis={activeAnalysis}
                  metric={activeMetric}
                  sourceHealth={sourceHealth}
                />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      <div className="flex-1 overflow-hidden min-h-0">
        <ResizablePanelGroup direction="horizontal" className="h-full">
          <ResizablePanel
            defaultSize={35}
            minSize={25}
            className="flex h-full min-h-0 flex-col overflow-hidden"
          >
            <ChatPanel
              isLoading={isLoading}
              messages={messages}
              onSend={handleSend}
            />
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel
            defaultSize={65}
            minSize={40}
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
