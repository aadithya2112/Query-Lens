'use client'

import { useState } from 'react'
import { X, TrendingUp, TrendingDown, AlertTriangle, Sparkles, ChevronRight, BarChart2, Zap, BookOpen } from 'lucide-react'
import type { InsightCard } from '@/lib/data-engine'

interface ProactiveInsightsPanelProps {
  insights: InsightCard[]
  onAsk: (question: string) => void
  onDismiss: (id: string) => void
}

const CATEGORY_STYLES: Record<string, { border: string; bg: string; text: string; icon: React.ReactNode }> = {
  trend: {
    border: 'border-emerald-500/30',
    bg: 'bg-emerald-500/5',
    text: 'text-emerald-400',
    icon: <TrendingUp size={13} className="text-emerald-400" />,
  },
  anomaly: {
    border: 'border-amber-500/30',
    bg: 'bg-amber-500/5',
    text: 'text-amber-400',
    icon: <Zap size={13} className="text-amber-400" />,
  },
  comparison: {
    border: 'border-blue-500/30',
    bg: 'bg-blue-500/5',
    text: 'text-blue-400',
    icon: <BarChart2 size={13} className="text-blue-400" />,
  },
  warning: {
    border: 'border-red-500/30',
    bg: 'bg-red-500/5',
    text: 'text-red-400',
    icon: <AlertTriangle size={13} className="text-red-400" />,
  },
  summary: {
    border: 'border-[#2a2a2a]',
    bg: 'bg-[#111]',
    text: 'text-[#888]',
    icon: <BookOpen size={13} className="text-[#555]" />,
  },
}

const IMPORTANCE_BADGE: Record<string, string> = {
  high: 'bg-red-500/10 text-red-400 border-red-500/20',
  medium: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  low: 'bg-[#111] text-[#444] border-[#1c1c1c]',
}

export default function ProactiveInsightsPanel({ insights, onAsk, onDismiss }: ProactiveInsightsPanelProps) {
  const [expanded, setExpanded] = useState(true)

  if (insights.length === 0) return null

  const highCount = insights.filter(i => i.importance === 'high').length

  return (
    <div className="border-b border-[#1c1c1c] bg-[#0a0a0a]">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-2.5 flex items-center gap-2 hover:bg-[#0f0f0f] transition-colors"
      >
        <div className="w-5 h-5 rounded-md bg-gradient-to-br from-blue-600/20 to-violet-500/20 flex items-center justify-center">
          <Sparkles size={10} className="text-blue-400" />
        </div>
        <span className="text-[10px] font-mono font-semibold text-[#888]">Proactive Insights</span>
        {highCount > 0 && (
          <span className="text-[9px] font-mono bg-red-500/10 text-red-400 border border-red-500/20 px-1.5 py-0.5 rounded-full">
            {highCount} urgent
          </span>
        )}
        <ChevronRight
          size={12}
          className={`ml-auto text-[#444] transition-transform ${expanded ? 'rotate-90' : ''}`}
        />
      </button>

      {expanded && (
        <div className="px-3 pb-3 flex gap-2 overflow-x-auto scrollbar-hide">
          {insights.map(insight => {
            const style = CATEGORY_STYLES[insight.category] || CATEGORY_STYLES.summary
            return (
              <div
                key={insight.id}
                className={`flex-shrink-0 w-52 rounded-xl border ${style.border} ${style.bg} p-3 relative group`}
              >
                <button
                  onClick={() => onDismiss(insight.id)}
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-[#333] hover:text-[#666]"
                >
                  <X size={10} />
                </button>

                <div className="flex items-start gap-2 mb-2">
                  <span className="text-base leading-none">{insight.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className={`text-[9px] font-mono border px-1.5 py-0.5 rounded ${IMPORTANCE_BADGE[insight.importance]}`}>
                        {insight.importance.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-white leading-tight">{insight.title}</p>
                  </div>
                </div>

                {insight.value && (
                  <div className={`text-sm font-mono font-bold mb-1.5 ${style.text}`}>
                    {insight.value}
                    {insight.change !== undefined && (
                      <span className="ml-1 text-[10px]">
                        {insight.change > 0 ? <TrendingUp size={10} className="inline" /> : <TrendingDown size={10} className="inline" />}
                      </span>
                    )}
                  </div>
                )}

                <p className="text-[10px] text-[#555] font-mono leading-relaxed mb-2">{insight.description}</p>

                <button
                  onClick={() => onAsk(`Tell me more about: ${insight.title}. ${insight.description}`)}
                  className="text-[9px] font-mono text-blue-400/60 hover:text-blue-400 transition-colors flex items-center gap-1"
                >
                  <ChevronRight size={9} />
                  Ask AI
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
