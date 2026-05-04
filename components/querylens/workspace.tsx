"use client"

import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import { useAuth, useUser, UserButton } from "@clerk/nextjs"
import { useMutation, useQuery } from "convex/react"
import type { ImperativePanelHandle } from "react-resizable-panels"

import {
  Activity,
  ChevronLeft,
  ChevronRight,
  FileDown,
  Github,
  Home,
  Link2,
  MessageSquareText,
  Plus,
  Settings2,
  Shield,
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import type {
  BootstrapPayload,
  DatasetListItem,
  Phase1AnalysisResponse,
  QueryAction,
} from "@/lib/querylens/types"
import { useIsMobile } from "@/hooks/use-mobile"

const COLLAPSED_PANEL_SIZE = 4
const COLLAPSE_THRESHOLD = 5
const DEFAULT_TRUTH_PANEL_SIZE = 38

function sanitizeForConvex<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function isCollapsedPanelSize(size: number) {
  return size <= COLLAPSE_THRESHOLD
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

export function shouldAutoOpenTruthPane(args: {
  analysis?: Phase1AnalysisResponse
  isMobile: boolean
}) {
  return Boolean(args.analysis) && !args.isMobile
}

export function shouldCenterChatColumn(args: {
  isMobile: boolean
  isChatSidebarCollapsed: boolean
  isTruthCollapsed: boolean
}) {
  return (
    !args.isMobile &&
    args.isChatSidebarCollapsed &&
    args.isTruthCollapsed
  )
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
  }, [clerkUserId, user])
}

function ChatSidebar({
  chats,
  activeChatId,
  isCollapsed,
  isCreatingChat,
  onCollapse,
  onCreateChat,
  onExpand,
  onSelectChat,
}: {
  chats: Array<{
    _id: Id<"chats">
    title?: string
    updatedAt: number
  }>
  activeChatId: Id<"chats"> | null
  isCollapsed: boolean
  isCreatingChat: boolean
  onCollapse: () => void
  onCreateChat: () => void
  onExpand: () => void
  onSelectChat: (chatId: Id<"chats">) => void
}) {
  if (isCollapsed) {
    return (
      <aside className="flex h-full min-w-0 flex-col items-center border-r border-border bg-background/80 py-3">
        <Button
          aria-expanded={false}
          aria-label="Expand chats sidebar"
          className="h-8 w-8 shrink-0"
          onClick={onExpand}
          size="icon"
          type="button"
          variant="ghost"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </aside>
    )
  }

  return (
    <aside className="flex h-full min-h-0 w-full min-w-0 flex-col border-r border-border bg-background/80 px-3 py-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Chats
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Dataset workspace
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <Button
            aria-expanded
            aria-label="Collapse chats sidebar"
            className="h-8 w-8"
            onClick={onCollapse}
            size="icon"
            type="button"
            variant="ghost"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
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

function EvidenceColumn({
  analysis,
  isCollapsed,
  onCollapse,
  onExpand,
}: {
  analysis: Phase1AnalysisResponse
  isCollapsed: boolean
  onCollapse: () => void
  onExpand: () => void
}) {
  if (isCollapsed) {
    return (
      <aside className="flex h-full min-w-0 flex-col items-center border-l border-border bg-muted/10 py-3">
        <Button
          aria-expanded={false}
          aria-label="Expand evidence and trust panel"
          className="h-8 w-8 shrink-0"
          onClick={onExpand}
          size="icon"
          type="button"
          variant="ghost"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="mt-3 text-[10px] font-mono uppercase tracking-[0.22em] text-muted-foreground [writing-mode:vertical-rl]">
          Evidence
        </span>
      </aside>
    )
  }

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden border-l border-border bg-muted/10">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Evidence & Trust
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Grounding, evidence, and trust signals
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <div className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background/70 text-muted-foreground">
            <Shield className="h-4 w-4" />
          </div>
          <Button
            aria-expanded
            aria-label="Collapse evidence and trust panel"
            className="h-8 w-8"
            onClick={onCollapse}
            size="icon"
            type="button"
            variant="ghost"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <EvidencePanel analysis={analysis} />
      </div>
    </div>
  )
}

function MobileWorkspaceToolbar({
  activeDatasetLabel,
  activeMetricLabel,
  onOpenChats,
  onOpenTruth,
}: {
  activeDatasetLabel: string
  activeMetricLabel: string
  onOpenChats: () => void
  onOpenTruth: () => void
}) {
  return (
    <div className="border-b border-border bg-background/95 px-4 py-3 backdrop-blur md:hidden">
      <div className="flex items-center gap-2">
        <Button
          className="gap-2"
          onClick={onOpenChats}
          size="sm"
          type="button"
          variant="outline"
        >
          <MessageSquareText className="h-4 w-4" />
          Chats
        </Button>
        <Button
          className="gap-2"
          onClick={onOpenTruth}
          size="sm"
          type="button"
          variant="outline"
        >
          <Shield className="h-4 w-4" />
          Evidence & Trust
        </Button>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span className="truncate">{activeDatasetLabel}</span>
        <span className="truncate text-right">Metric: {activeMetricLabel}</span>
      </div>
    </div>
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
  const [isChatSidebarCollapsed, setIsChatSidebarCollapsed] = useState(false)
  const [isEvidenceCollapsed, setIsEvidenceCollapsed] = useState(true)
  const [isMobileChatsOpen, setIsMobileChatsOpen] = useState(false)
  const [isMobileTruthOpen, setIsMobileTruthOpen] = useState(false)
  const [isExportingPdf, setIsExportingPdf] = useState(false)
  const [lastExportUrl, setLastExportUrl] = useState<string | null>(null)
  const isMobile = useIsMobile()
  const chatSidebarPanelRef = useRef<ImperativePanelHandle>(null)
  const evidencePanelRef = useRef<ImperativePanelHandle>(null)
  const hasInitializedDesktopTruthPaneRef = useRef(false)
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
  const activeDataset = datasets.find((dataset) => dataset.id === datasetId)
  const activeMetricLabel =
    activeAnalysis.intent === "discovery"
      ? "Dataset discovery"
      : activeAnalysis.intent === "agentic_query"
        ? "Custom live query"
        : activeMetric?.label || "Cashflow"
  const activeDatasetLabel = activeDataset?.label || "Dataset workspace"
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
      ...userProfile,
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
    userProfile,
  ])

  useEffect(() => {
    if (!isMobile) {
      setIsMobileChatsOpen(false)
      setIsMobileTruthOpen(false)
    }

    const id = requestAnimationFrame(() => {
      const chatPanel = chatSidebarPanelRef.current
      if (chatPanel) {
        setIsChatSidebarCollapsed(
          chatPanel.isCollapsed() || isCollapsedPanelSize(chatPanel.getSize()),
        )
      }

      const evPanel = evidencePanelRef.current

      if (!evPanel) {
        return
      }

      if (!isMobile && !hasInitializedDesktopTruthPaneRef.current) {
        evPanel.collapse()
        hasInitializedDesktopTruthPaneRef.current = true
        setIsEvidenceCollapsed(true)
        return
      }

      setIsEvidenceCollapsed(
        evPanel.isCollapsed() || isCollapsedPanelSize(evPanel.getSize()),
      )
    })

    return () => cancelAnimationFrame(id)
  }, [isMobile])

  const expandTruthPane = (size = DEFAULT_TRUTH_PANEL_SIZE) => {
    setIsEvidenceCollapsed(false)
    requestAnimationFrame(() => {
      evidencePanelRef.current?.expand(size)
    })
  }

  const collapseTruthPane = () => {
    setIsEvidenceCollapsed(true)
    evidencePanelRef.current?.collapse()
  }

  const collapseChatsPane = () => {
    setIsChatSidebarCollapsed(true)
    chatSidebarPanelRef.current?.collapse()
  }

  const expandChatsPane = () => {
    setIsChatSidebarCollapsed(false)
    chatSidebarPanelRef.current?.expand()
  }

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
        ...userProfile,
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
        ...userProfile,
        role: "assistant",
        text: analysis.summary,
        analysis: sanitizeForConvex(analysis),
      })
      if (shouldAutoOpenTruthPane({ analysis, isMobile })) {
        expandTruthPane()
      }
    } catch (error) {
      console.error(error)
      await appendMessage({
        chatId,
        ...userProfile,
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

  const handleExportPdf = async () => {
    if (!chatId || isExportingPdf || isChatBootstrapping) {
      return
    }

    setIsExportingPdf(true)

    try {
      const response = await fetch("/api/chats/export-pdf", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chatId,
          datasetId,
        }),
      })

      if (!response.ok) {
        throw new Error("Export request failed.")
      }

      const payload = (await response.json()) as {
        url: string
      }
      setLastExportUrl(payload.url)

      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(payload.url).catch(() => undefined)
      }

      window.open(payload.url, "_blank", "noopener,noreferrer")
    } catch (error) {
      console.error("QueryLens could not export this chat.", error)
    } finally {
      setIsExportingPdf(false)
    }
  }

  const centerChatColumn = shouldCenterChatColumn({
    isMobile,
    isChatSidebarCollapsed,
    isTruthCollapsed: isEvidenceCollapsed,
  })

  const mainWorkspacePanels = (
    <ResizablePanelGroup
      autoSaveId="querylens-main-split"
      className="h-full"
      direction="horizontal"
    >
      <ResizablePanel
        defaultSize={96}
        minSize={30}
        className="flex h-full min-h-0 flex-col overflow-hidden"
      >
        <div
          className={
            centerChatColumn
              ? "flex h-full min-h-0 w-full justify-center overflow-hidden bg-muted/5"
              : "h-full min-h-0 w-full"
          }
        >
          <div
            className={
              centerChatColumn
                ? "flex h-full min-h-0 w-full max-w-4xl min-w-0 flex-col"
                : "h-full min-h-0 w-full"
            }
          >
            <ChatPanel
              isLoading={isLoading || isChatBootstrapping}
              messages={messages}
              onSend={handleSend}
              suggestedPrompts={suggestedPrompts}
            />
          </div>
        </div>
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel
        ref={evidencePanelRef}
        className="flex min-h-0 min-w-0"
        collapsedSize={COLLAPSED_PANEL_SIZE}
        collapsible
        defaultSize={4}
        maxSize={72}
        minSize={22}
        onCollapse={() => setIsEvidenceCollapsed(true)}
        onExpand={() => setIsEvidenceCollapsed(false)}
        onResize={(size) => setIsEvidenceCollapsed(isCollapsedPanelSize(size))}
      >
        <EvidenceColumn
          analysis={activeAnalysis}
          isCollapsed={isEvidenceCollapsed}
          onCollapse={collapseTruthPane}
          onExpand={() => expandTruthPane()}
        />
      </ResizablePanel>
    </ResizablePanelGroup>
  )

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
            <Link href={`/explorer?datasetId=${encodeURIComponent(datasetId)}`}>
              <Settings2 className="h-4 w-4" />
              <span className="hidden sm:inline-block">Source context</span>
            </Link>
          </Button>
          <Button
            className="gap-2"
            disabled={!chatId || isChatBootstrapping || isExportingPdf}
            onClick={() => void handleExportPdf()}
            size="sm"
            type="button"
            variant="ghost"
          >
            <FileDown className="h-4 w-4" />
            <span className="hidden sm:inline-block">
              {isExportingPdf ? "Exporting..." : "Export PDF"}
            </span>
          </Button>
          {lastExportUrl && (
            <Button
              className="gap-2"
              onClick={() => {
                if (typeof navigator !== "undefined" && navigator.clipboard) {
                  void navigator.clipboard.writeText(lastExportUrl)
                }
              }}
              size="sm"
              type="button"
              variant="ghost"
            >
              <Link2 className="h-4 w-4" />
              <span className="hidden sm:inline-block">Copy link</span>
            </Button>
          )}
          <div className="ml-2 flex h-8 w-8 items-center justify-center">
            <UserButton />
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {isMobile ? (
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <MobileWorkspaceToolbar
              activeDatasetLabel={activeDatasetLabel}
              activeMetricLabel={activeMetricLabel}
              onOpenChats={() => setIsMobileChatsOpen(true)}
              onOpenTruth={() => setIsMobileTruthOpen(true)}
            />
            <div className="min-h-0 min-w-0 flex-1 overflow-hidden bg-muted/5">
              <div className="mx-auto flex h-full min-h-0 w-full max-w-4xl min-w-0 flex-col">
                <ChatPanel
                  isLoading={isLoading || isChatBootstrapping}
                  messages={messages}
                  onSend={handleSend}
                  suggestedPrompts={suggestedPrompts}
                />
              </div>
            </div>

            <Sheet open={isMobileChatsOpen} onOpenChange={setIsMobileChatsOpen}>
              <SheetContent
                side="left"
                className="gap-0 p-0 [&>button]:hidden"
              >
                <SheetHeader className="sr-only">
                  <SheetTitle>Chats</SheetTitle>
                  <SheetDescription>
                    Browse saved chats for this dataset workspace.
                  </SheetDescription>
                </SheetHeader>
                <ChatSidebar
                  activeChatId={chatId}
                  chats={chats ?? []}
                  isCollapsed={false}
                  isCreatingChat={isCreatingChat}
                  onCollapse={() => setIsMobileChatsOpen(false)}
                  onCreateChat={() => {
                    void handleCreateChat().finally(() => {
                      setIsMobileChatsOpen(false)
                    })
                  }}
                  onExpand={() => undefined}
                  onSelectChat={(nextChatId) => {
                    setChatId(nextChatId)
                    setIsMobileChatsOpen(false)
                  }}
                />
              </SheetContent>
            </Sheet>

            <Sheet open={isMobileTruthOpen} onOpenChange={setIsMobileTruthOpen}>
              <SheetContent
                side="right"
                className="gap-0 p-0 [&>button]:hidden"
              >
                <SheetHeader className="sr-only">
                  <SheetTitle>Evidence and trust</SheetTitle>
                  <SheetDescription>
                    Grounding evidence and trust signals for the active answer.
                  </SheetDescription>
                </SheetHeader>
                <div className="flex h-full min-h-0 flex-col overflow-hidden bg-muted/10">
                  <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3">
                    <div className="min-w-0">
                      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                        Evidence & Trust
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Grounding, evidence, and trust signals
                      </p>
                    </div>
                    <Button
                      aria-label="Close evidence and trust panel"
                      className="h-8 w-8"
                      onClick={() => setIsMobileTruthOpen(false)}
                      size="icon"
                      type="button"
                      variant="ghost"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto">
                    <EvidencePanel analysis={activeAnalysis} />
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        ) : (
          <ResizablePanelGroup
            autoSaveId="workspace-chat-sidebar"
            className="min-h-0 min-w-0 flex-1"
            direction="horizontal"
          >
            <ResizablePanel
              ref={chatSidebarPanelRef}
              className="flex min-h-0 min-w-0"
              collapsedSize={COLLAPSED_PANEL_SIZE}
              collapsible
              defaultSize={18}
              maxSize={35}
              minSize={12}
              onCollapse={() => setIsChatSidebarCollapsed(true)}
              onExpand={() => setIsChatSidebarCollapsed(false)}
              onResize={(size) =>
                setIsChatSidebarCollapsed(isCollapsedPanelSize(size))
              }
            >
              <ChatSidebar
                activeChatId={chatId}
                chats={chats ?? []}
                isCollapsed={isChatSidebarCollapsed}
                isCreatingChat={isCreatingChat}
                onCollapse={collapseChatsPane}
                onCreateChat={handleCreateChat}
                onExpand={expandChatsPane}
                onSelectChat={setChatId}
              />
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel
              className="min-h-0 min-w-0"
              defaultSize={82}
              minSize={50}
            >
              {mainWorkspacePanels}
            </ResizablePanel>
          </ResizablePanelGroup>
        )}
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
