'use client'

import { useEffect, useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  Shield,
  Zap,
  TrendingUp,
  AlertTriangle,
  BarChart2,
  BookOpen,
  ThumbsUp,
  ThumbsDown,
  Copy,
  Check,
  Eye,
  MessageSquare,
  Sparkles,
  Activity,
} from 'lucide-react'
import type { ChatMessage, AgentStep } from '@/lib/data-engine'
import InlineChart from './inline-chart'

interface ChatMessageComponentProps {
  message: ChatMessage
  index: number
  simpleMode: boolean
  onFollowUp: (q: string) => void
  onAskWhy: () => void
  onGenerateStory: () => void
}

const INTENT_ICONS: Record<string, React.ReactNode> = {
  root_cause: <Zap size={11} className="text-amber-400" />,
  trend: <TrendingUp size={11} className="text-emerald-400" />,
  comparison: <BarChart2 size={11} className="text-blue-400" />,
  ranking: <TrendingUp size={11} className="text-purple-400" />,
  prediction: <Activity size={11} className="text-pink-400" />,
  breakdown: <BarChart2 size={11} className="text-cyan-400" />,
  summary: <BookOpen size={11} className="text-[#888]" />,
}

const INSIGHT_COLORS = {
  trend: 'border-l-emerald-500/50 bg-emerald-500/5',
  anomaly: 'border-l-amber-500/50 bg-amber-500/5',
  comparison: 'border-l-blue-500/50 bg-blue-500/5',
  summary: 'border-l-[#2a2a2a] bg-[#111]',
  warning: 'border-l-red-500/50 bg-red-500/5',
}

function ConfidenceBar({ score }: { score: number }) {
  const color = score >= 85 ? 'bg-emerald-500' : score >= 70 ? 'bg-amber-500' : 'bg-red-500'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-[#1c1c1c] rounded-full overflow-hidden">
        <div
          className={`h-full ${color} rounded-full transition-all duration-700`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className={`text-[10px] font-mono font-bold ${
        score >= 85 ? 'text-emerald-400' : score >= 70 ? 'text-amber-400' : 'text-red-400'
      }`}>{score}%</span>
    </div>
  )
}

function AgentTimeline({ steps }: { steps: AgentStep[] }) {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-[10px] text-[#444] hover:text-[#888] transition-colors font-mono"
      >
        <Activity size={10} />
        Agent Pipeline ({steps.length} steps)
        <ChevronDown size={10} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="mt-2 space-y-1 pl-2 border-l border-[#1c1c1c]">
          {steps.map((step, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                step.status === 'done' ? 'bg-emerald-400' :
                step.status === 'running' ? 'bg-blue-400 animate-pulse' :
                'bg-red-400'
              }`} />
              <span className="text-[10px] font-mono text-[#555] flex-1">{step.agent}</span>
              <span className="text-[10px] font-mono text-[#333]">{step.duration}ms</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function WhatIfPanel({ scenario }: { scenario: NonNullable<ChatMessage['whatIf']> }) {
  return (
    <div className="mt-3 p-3 rounded-xl bg-gradient-to-br from-purple-500/10 to-pink-500/5 border border-purple-500/20">
      <div className="flex items-center gap-1.5 mb-2">
        <Zap size={12} className="text-purple-400" />
        <span className="text-xs font-mono font-semibold text-purple-300">What-If Simulation</span>
      </div>
      <p className="text-[10px] text-[#555] font-mono mb-2">
        {scenario.variable}: ${scenario.originalValue.toLocaleString()} → ${scenario.newValue.toLocaleString()}
      </p>
      {scenario.impact.map((impact, i) => (
        <div key={i} className="flex items-center justify-between py-1 border-b border-purple-500/10 last:border-0">
          <span className="text-[10px] text-[#888] font-mono">{impact.metric}</span>
          <span className={`text-[10px] font-mono font-bold ${impact.change > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            +{impact.change.toFixed(1)}%
          </span>
          <span className="text-[10px] text-[#444] font-mono">conf:{impact.confidence}%</span>
        </div>
      ))}
    </div>
  )
}

export default function ChatMessageComponent({
  message,
  index,
  simpleMode,
  onFollowUp,
  onAskWhy,
  onGenerateStory,
}: ChatMessageComponentProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [showQueries, setShowQueries] = useState(false)
  const [showChart, setShowChart] = useState(true)
  const [copied, setCopied] = useState(false)
  const [showDataQuality, setShowDataQuality] = useState(false)
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null)

  useEffect(() => {
    const timeout = setTimeout(() => setIsVisible(true), index * 25)
    return () => clearTimeout(timeout)
  }, [index])

  const isUser = message.role === 'user'

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const displayContent = simpleMode && message.simpleContent ? message.simpleContent : message.content

  // Parse markdown-like bold text
  const renderContent = (text: string) => {
    return text.split('\n').map((line, i) => {
      const parts = line.split(/\*\*(.*?)\*\*/)
      return (
        <p key={i} className={`${line.startsWith('•') ? 'pl-2' : ''} ${line === '' ? 'h-2' : ''}`}>
          {parts.map((part, j) => j % 2 === 1 ? <strong key={j} className="text-white font-semibold">{part}</strong> : part)}
        </p>
      )
    })
  }

  if (isUser) {
    return (
      <div
        className={`transform transition-all duration-300 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}
      >
        <div className="flex justify-end">
          <div className="max-w-[85%] rounded-2xl rounded-br-sm px-4 py-2.5 bg-blue-600 text-white text-xs leading-relaxed font-medium shadow-lg shadow-blue-500/20">
            {message.content}
          </div>
        </div>
        <p className="text-right text-[10px] text-[#333] font-mono mt-1 pr-1">
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    )
  }

  return (
    <div
      className={`transform transition-all duration-300 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}
    >
      {/* AI avatar & header */}
      <div className="flex items-start gap-2 mb-2">
        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-lg shadow-blue-500/30">
          <Sparkles size={11} className="text-white" />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-semibold text-[#888]">DataTalk AI</span>
          {message.intent && INTENT_ICONS[message.intent] && (
            <span className="flex items-center gap-1 text-[10px] font-mono text-[#444] border border-[#1c1c1c] px-1.5 py-0.5 rounded">
              {INTENT_ICONS[message.intent]}
              {message.intent.replace('_', ' ')}
            </span>
          )}
        </div>
        <p className="ml-auto text-[10px] text-[#333] font-mono">
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>

      {/* Message bubble */}
      <div className="ml-8 space-y-3">
        <div className="bg-[#111] border border-[#1c1c1c] rounded-2xl rounded-tl-sm px-4 py-3 text-xs text-[#ccc] leading-relaxed">
          {simpleMode && message.simpleContent && (
            <div className="mb-3 px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center gap-2">
              <Eye size={11} className="text-blue-400 flex-shrink-0" />
              <span className="text-[10px] text-blue-300 font-mono">Simple mode — plain English explanation</span>
            </div>
          )}

          <div className="space-y-0.5">{renderContent(displayContent)}</div>

          {/* What-If panel */}
          {message.whatIf && <WhatIfPanel scenario={message.whatIf} />}

          {/* Confidence Score */}
          {message.confidence !== undefined && (
            <div className="mt-3 pt-3 border-t border-[#1c1c1c]">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-mono text-[#444]">Confidence Score</span>
                <span className="text-[9px] font-mono text-[#333]">based on data completeness</span>
              </div>
              <ConfidenceBar score={message.confidence} />
            </div>
          )}

          {/* Sources */}
          {message.sources && message.sources.length > 0 && (
            <div className="mt-3 pt-3 border-t border-[#1c1c1c] flex items-center gap-2 flex-wrap">
              <Shield size={10} className="text-[#444]" />
              <span className="text-[10px] font-mono text-[#444]">Sources:</span>
              {message.sources.map(s => (
                <span key={s} className="text-[10px] font-mono text-blue-400/70 bg-blue-500/8 border border-blue-500/15 px-1.5 py-0.5 rounded">
                  {s}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Insight Cards */}
        {message.insightCards && message.insightCards.length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            {message.insightCards.slice(0, 4).map(card => (
              <div
                key={card.id}
                className={`p-2.5 rounded-xl border-l-2 border border-[#1c1c1c] ${INSIGHT_COLORS[card.category]}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs">{card.icon}</span>
                  {card.value && (
                    <span className={`text-[10px] font-mono font-bold ${
                      card.change && card.change > 0 ? 'text-emerald-400' :
                      card.change && card.change < 0 ? 'text-red-400' :
                      card.category === 'warning' ? 'text-amber-400' : 'text-[#888]'
                    }`}>{card.value}</span>
                  )}
                </div>
                <p className="text-[10px] font-semibold text-[#ccc] leading-tight mb-0.5">{card.title}</p>
                <p className="text-[9px] text-[#555] leading-tight">{card.description}</p>
              </div>
            ))}
          </div>
        )}

        {/* Chart */}
        {message.chartData && (
          <div className="rounded-xl border border-[#1c1c1c] overflow-hidden bg-[#0c0c0c]">
            <div className="px-3 py-2 border-b border-[#1c1c1c] flex items-center justify-between">
              <span className="text-[10px] font-mono font-semibold text-[#888]">{message.chartData.title}</span>
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-mono text-[#333] uppercase">{message.chartData.type}</span>
                <button
                  onClick={() => setShowChart(!showChart)}
                  className="text-[10px] text-[#444] hover:text-[#888] transition-colors font-mono"
                >
                  {showChart ? 'hide' : 'show'}
                </button>
              </div>
            </div>
            {showChart && (
              <>
                <div className="h-48">
                  <InlineChart chartData={message.chartData} />
                </div>
                {message.chartData.explanation && (
                  <div className="px-3 py-2 border-t border-[#1c1c1c] flex items-start gap-1.5">
                    <BarChart2 size={10} className="text-blue-400 mt-0.5 flex-shrink-0" />
                    <p className="text-[10px] text-[#555] font-mono leading-relaxed">{message.chartData.explanation}</p>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* SQL Queries */}
        {message.queries && message.queries.length > 0 && (
          <div>
            <button
              onClick={() => setShowQueries(!showQueries)}
              className="flex items-center gap-1.5 text-[10px] text-[#444] hover:text-blue-400 transition-colors font-mono"
            >
              <ChevronDown size={10} className={`transition-transform ${showQueries ? 'rotate-180' : ''}`} />
              View generated SQL ({message.queries.length})
            </button>
            {showQueries && (
              <div className="mt-2 space-y-2">
                {message.queries.map((q, i) => (
                  <div key={i} className="relative rounded-lg bg-[#080808] border border-[#1c1c1c] overflow-hidden">
                    <div className="px-3 py-1.5 border-b border-[#1c1c1c] flex items-center justify-between">
                      <span className="text-[9px] text-[#333] font-mono">SQL Query {i + 1}</span>
                      <button
                        onClick={() => { navigator.clipboard.writeText(q); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
                        className="text-[9px] text-[#444] hover:text-[#888] font-mono flex items-center gap-1"
                      >
                        {copied ? <Check size={9} className="text-emerald-400" /> : <Copy size={9} />}
                        {copied ? 'copied' : 'copy'}
                      </button>
                    </div>
                    <pre className="px-3 py-2 text-[10px] text-[#555] font-mono overflow-x-auto leading-relaxed">
                      <code>{q}</code>
                    </pre>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Data Quality */}
        {message.dataQuality && (
          <div>
            <button
              onClick={() => setShowDataQuality(!showDataQuality)}
              className="flex items-center gap-1.5 text-[10px] font-mono transition-colors"
              style={{ color: message.dataQuality.biasWarnings.length > 0 ? '#f59e0b' : '#555' }}
            >
              <AlertTriangle size={10} />
              Data Quality: {message.dataQuality.completeness}% complete
              {message.dataQuality.biasWarnings.length > 0 && (
                <span className="text-amber-400">· {message.dataQuality.biasWarnings.length} warning</span>
              )}
              <ChevronDown size={10} className={`transition-transform ${showDataQuality ? 'rotate-180' : ''}`} />
            </button>
            {showDataQuality && (
              <div className="mt-2 p-3 rounded-lg bg-[#0c0c0c] border border-[#1c1c1c] space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-[9px] text-[#444] font-mono mb-1">Completeness</p>
                    <ConfidenceBar score={message.dataQuality.completeness} />
                  </div>
                  <div>
                    <p className="text-[9px] text-[#444] font-mono mb-1">Accuracy</p>
                    <ConfidenceBar score={message.dataQuality.accuracy} />
                  </div>
                </div>
                {message.dataQuality.biasWarnings.map((w, i) => (
                  <div key={i} className="flex items-start gap-1.5 text-[10px] text-amber-400/80 font-mono">
                    <AlertTriangle size={9} className="mt-0.5 flex-shrink-0" />
                    {w}
                  </div>
                ))}
                {message.dataQuality.missingFields.map((f, i) => (
                  <div key={i} className="flex items-start gap-1.5 text-[10px] text-[#555] font-mono">
                    <span className="text-[#333]">⚬</span>
                    {f}
                  </div>
                ))}
                {message.dataQuality.outliers.map((o, i) => (
                  <div key={i} className="flex items-start gap-1.5 text-[10px] text-[#555] font-mono">
                    <span className="text-[#333]">⚬</span>
                    {o}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Agent Pipeline */}
        {message.agentSteps && <AgentTimeline steps={message.agentSteps} />}

        {/* Follow-up suggestions */}
        {message.followUpQuestions && message.followUpQuestions.length > 0 && (
          <div>
            <p className="text-[10px] font-mono text-[#333] mb-1.5">Suggested follow-ups:</p>
            <div className="flex flex-wrap gap-1.5">
              {message.followUpQuestions.map((q, i) => (
                <button
                  key={i}
                  onClick={() => onFollowUp(q)}
                  className="text-[10px] font-mono text-blue-400/70 border border-blue-500/20 bg-blue-500/5 hover:bg-blue-500/10 hover:text-blue-300 px-2 py-1 rounded-lg transition-all"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={onAskWhy}
            className="flex items-center gap-1 text-[10px] font-mono text-[#444] hover:text-amber-400 transition-colors border border-[#1c1c1c] hover:border-amber-500/30 px-2 py-1 rounded"
          >
            <Zap size={9} />
            Ask Why
          </button>
          <button
            onClick={onGenerateStory}
            className="flex items-center gap-1 text-[10px] font-mono text-[#444] hover:text-emerald-400 transition-colors border border-[#1c1c1c] hover:border-emerald-500/30 px-2 py-1 rounded"
          >
            <BookOpen size={9} />
            Data Story
          </button>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 text-[10px] font-mono text-[#444] hover:text-[#888] transition-colors border border-[#1c1c1c] px-2 py-1 rounded"
          >
            {copied ? <Check size={9} className="text-emerald-400" /> : <Copy size={9} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
          <div className="ml-auto flex items-center gap-1">
            <button
              onClick={() => setFeedback('up')}
              className={`p-1 rounded transition-colors ${feedback === 'up' ? 'text-emerald-400' : 'text-[#333] hover:text-[#666]'}`}
            >
              <ThumbsUp size={11} />
            </button>
            <button
              onClick={() => setFeedback('down')}
              className={`p-1 rounded transition-colors ${feedback === 'down' ? 'text-red-400' : 'text-[#333] hover:text-[#666]'}`}
            >
              <ThumbsDown size={11} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
