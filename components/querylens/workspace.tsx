"use client"

import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import { useAuth, useUser, UserButton } from "@clerk/nextjs"
import { useMutation, useQuery } from "convex/react"

import {
  Activity,
  Github,
  Home,
  MessageSquareText,
  Plus,
  Settings2,
} from "lucide-react"

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
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import type {
  BootstrapPayload,
  DatasetListItem,
  Phase1AnalysisResponse,
  QueryAction,
} from "@/lib/querylens/types"

function sanitizeForConvex<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function mapConvexMessage(message: {
  _id: string
  role: "user" | "assistant"
  text: string
  analysis?: Phase1AnalysisResponse
}): ConversationMessage {
  return {
    id: message._id,
    role: message.role,
    text: message.text,
    analysis: message.analysis,
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

function formatChatTime(updatedAt: number) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(updatedAt))
}

function useClerkProfileArgs(clerkUserId: string) {
  const { user } = useUser()

  return useMemo(() => {
    const profile: {
      clerkUserId: string
      name?: string
      email?: string
      imageUrl?: string
    } = {
      clerkUserId,
    }
    const email = user?.primaryEmailAddress?.emailAddress

    if (user?.fullName) {
      profile.name = user.fullName
    }
    if (email) {
      profile.email = email
    }
    if (user?.imageUrl) {
      profile.imageUrl = user.imageUrl
    }

    return profile
  }, [
    clerkUserId,
    user?.fullName,
    user?.imageUrl,
    user?.primaryEmailAddress?.emailAddress,
  ])
}

function ChatSidebar({
  chats,
  activeChatId,
  isCreatingChat,
  onCreateChat,
  onSelectChat,
}: {
  chats: Array<{
    _id: Id<"chats">
    title?: string
    updatedAt: number
  }>
  activeChatId: Id<"chats"> | null
  isCreatingChat: boolean
  onCreateChat: () => void
  onSelectChat: (chatId: Id<"chats">) => void
}) {
  return (
    <aside className="hidden w-60 shrink-0 border-r border-border bg-background/80 px-3 py-4 md:flex md:flex-col">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Chats
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Dataset workspace
          </p>
        </div>
        <Button
          aria-label="New chat"
          className="h-8 w-8"
          disabled={isCreatingChat}
          onClick={onCreateChat}
          size="icon"
          type="button"
          variant="ghost"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <div className="mt-4 min-h-0 flex-1 space-y-1 overflow-y-auto">
        {chats.map((chat) => {
          const isActive = chat._id === activeChatId

          return (
            <button
              key={chat._id}
              className={`flex w-full items-start gap-2 rounded-lg border px-3 py-2 text-left transition ${
                isActive
                  ? "border-border bg-muted/40 text-foreground"
                  : "border-transparent text-muted-foreground hover:border-border hover:bg-muted/20 hover:text-foreground"
              }`}
              onClick={() => onSelectChat(chat._id)}
              type="button"
            >
              <MessageSquareText className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">
                  {chat.title || "Untitled chat"}
                </span>
                <span className="mt-1 block truncate text-[11px] text-muted-foreground">
                  {formatChatTime(chat.updatedAt)}
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </aside>
  )
}

function LoadingWorkspace() {
  return (
    <div className="flex h-screen items-center justify-center bg-background text-foreground">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <Activity className="h-4 w-4 animate-pulse text-foreground" />
        Opening QueryLens...
      </div>
    </div>
  )
}

function SignInPrompt() {
  return (
    <div className="flex h-screen items-center justify-center bg-background px-6 text-foreground">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card/50 px-6 py-8 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-border bg-muted/20">
          <Activity className="h-5 w-5" />
        </div>
        <h1 className="mt-5 text-xl font-semibold">QueryLens workspace</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Sign in to open your saved chats and keep each dataset workspace tied
          to your account.
        </p>
        <Button asChild className="mt-6">
          <Link href="/sign-in">Sign in</Link>
        </Button>
      </div>
    </div>
  )
}

function AuthenticatedWorkspace({
  datasetId,
  datasets,
  initialQuestion,
  metrics,
  initialAnalysis,
  clerkUserId,
}: BootstrapPayload & { clerkUserId: string }) {
  const [chatId, setChatId] = useState<Id<"chats"> | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isCreatingChat, setIsCreatingChat] = useState(false)
  const seededChatRef = useRef<Id<"chats"> | null>(null)
  const getOrCreateDefaultChat = useMutation(api.chats.getOrCreateDefaultChat)
  const createChat = useMutation(api.chats.createChat)
  const seedInitialMessages = useMutation(api.chats.seedInitialMessages)
  const appendMessage = useMutation(api.chats.appendMessage)
  const chats = useQuery(api.chats.listChats, {
    clerkUserId,
    datasetId,
  })
  const storedMessages = useQuery(
    api.chats.listMessages,
    chatId ? { chatId, clerkUserId } : "skip",
  )
  const messages = useMemo(
    () => (storedMessages ?? []).map(mapConvexMessage),
    [storedMessages],
  )
  const activeAnalysis = useMemo(() => {
    for (const message of [...messages].reverse()) {
      if (message.role === "assistant" && message.analysis) {
        return message.analysis
      }
    }

    return initialAnalysis
  }, [initialAnalysis, messages])
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
  const isChatBootstrapping = !chatId || storedMessages === undefined
  const userProfile = useClerkProfileArgs(clerkUserId)

  useEffect(() => {
    let isCancelled = false
    setChatId(null)

    void getOrCreateDefaultChat({
      datasetId,
      ...userProfile,
    })
      .then((nextChatId) => {
        if (!isCancelled) {
          setChatId(nextChatId)
        }
      })
      .catch((error) => {
        console.error("QueryLens could not open the Convex chat.", error)
      })

    return () => {
      isCancelled = true
    }
  }, [datasetId, getOrCreateDefaultChat, userProfile])

  useEffect(() => {
    if (
      !chatId ||
      storedMessages === undefined ||
      storedMessages.length > 0 ||
      seededChatRef.current === chatId
    ) {
      return
    }

    seededChatRef.current = chatId
    void seedInitialMessages({
      chatId,
      clerkUserId,
      initialQuestion,
      initialAnswer: initialAnalysis.summary,
      initialAnalysis: sanitizeForConvex(initialAnalysis),
    }).catch((error) => {
      seededChatRef.current = null
      console.error("QueryLens could not seed the initial chat.", error)
    })
  }, [
    chatId,
    clerkUserId,
    initialAnalysis,
    initialQuestion,
    seedInitialMessages,
    storedMessages,
  ])

  const handleSend = async (
    question: string,
    options?: {
      action?: QueryAction
      sourceAnalysis?: Phase1AnalysisResponse
    },
  ) => {
    const trimmed = question.trim()
    if (!trimmed || isLoading || !chatId) {
      return
    }

    setIsLoading(true)

    try {
      await appendMessage({
        chatId,
        clerkUserId,
        role: "user",
        text: trimmed,
      })

      const response = await fetch("/api/query", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: trimmed,
          chatId,
          datasetId,
          action: options?.action,
          followUpContext: options?.sourceAnalysis
            ? {
                sourceAnalysis: options.sourceAnalysis,
              }
            : undefined,
        }),
      })

      if (!response.ok) {
        throw new Error("Query request failed.")
      }

      const analysis = (await response.json()) as Phase1AnalysisResponse
      await appendMessage({
        chatId,
        clerkUserId,
        role: "assistant",
        text: analysis.summary,
        analysis: sanitizeForConvex(analysis),
      })
    } catch (error) {
      console.error(error)
      await appendMessage({
        chatId,
        clerkUserId,
        role: "assistant",
        text: "QueryLens could not analyze that request right now. The current evidence view is still available while the active slice is rechecked.",
      }).catch((appendError) => {
        console.error("QueryLens could not persist the error message.", appendError)
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateChat = async () => {
    if (isCreatingChat) {
      return
    }

    setIsCreatingChat(true)

    try {
      const nextChatId = await createChat({
        datasetId,
        ...userProfile,
      })
      setChatId(nextChatId)
    } catch (error) {
      console.error("QueryLens could not create a new chat.", error)
    } finally {
      setIsCreatingChat(false)
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

        <div className="flex items-center gap-1">
          <label className="hidden md:flex items-center gap-2 mr-2 text-sm text-muted-foreground">
            <span>Dataset</span>
            <select
              className="h-8 rounded-md border border-border bg-background px-2 text-sm text-foreground"
              value={datasetId}
              onChange={(event) => {
                window.location.assign(
                  `/demo?datasetId=${encodeURIComponent(event.target.value)}`,
                )
              }}
            >
              {datasets.map((dataset: DatasetListItem) => (
                <option key={dataset.id} value={dataset.id}>
                  {dataset.label}
                </option>
              ))}
            </select>
          </label>
          <p className="hidden text-sm text-muted-foreground md:inline-block mr-2">
            Metric Focus:{" "}
            <span className="font-medium text-foreground">
              {activeMetricLabel}
            </span>
          </p>
          <div className="h-4 w-px bg-border hidden md:block mr-1" />
          <Button asChild variant="ghost" size="icon" className="h-8 w-8">
            <Link href="/" aria-label="Home">
              <Home className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="ghost" size="icon" className="h-8 w-8">
            <a
              href="https://github.com/aadithya2112/Query-Lens"
              target="_blank"
              rel="noreferrer"
              aria-label="GitHub"
            >
              <Github className="h-4 w-4" />
            </a>
          </Button>
          <div className="h-4 w-px bg-border" />
          <Button asChild variant="ghost" size="sm" className="gap-2">
            <Link href="/explorer">
              <Settings2 className="h-4 w-4" />
              <span className="hidden sm:inline-block">Source context</span>
            </Link>
          </Button>
          <div className="ml-2 flex h-8 w-8 items-center justify-center">
            <UserButton />
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden min-h-0">
        <ChatSidebar
          activeChatId={chatId}
          chats={chats ?? []}
          isCreatingChat={isCreatingChat}
          onCreateChat={handleCreateChat}
          onSelectChat={setChatId}
        />
        <div className="min-w-0 flex-1 overflow-hidden">
          <ResizablePanelGroup direction="horizontal" className="h-full">
            <ResizablePanel
              defaultSize={65}
              minSize={40}
              className="h-full min-h-0 overflow-y-auto bg-muted/10"
            >
              <div className="h-full overflow-y-auto">
                <EvidencePanel analysis={activeAnalysis} />
              </div>
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel
              defaultSize={35}
              minSize={25}
              className="flex h-full min-h-0 flex-col overflow-hidden"
            >
              <ChatPanel
                isLoading={isLoading || isChatBootstrapping}
                messages={messages}
                onSend={handleSend}
                suggestedPrompts={suggestedPrompts}
              />
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      </div>
    </div>
  )
}

export default function Workspace(props: BootstrapPayload) {
  const { isLoaded, isSignedIn, userId } = useAuth()

  if (!isLoaded) {
    return <LoadingWorkspace />
  }

  if (!isSignedIn || !userId) {
    return <SignInPrompt />
  }

  return <AuthenticatedWorkspace {...props} clerkUserId={userId} />
}
