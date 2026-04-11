'use client'

import { useState, useEffect } from 'react'
import { Sparkles, ChevronDown, TrendingUp, Zap } from 'lucide-react'

interface AiInsightBarProps {
  results?: any[]
  onAsk?: (q: string) => void
}

const ROTATING_INSIGHTS = [
  { icon: '⚡', text: 'North America leads with 1,200 orders generating $125K revenue — up 34% from baseline' },
  { icon: '📈', text: 'Asia Pacific shows the strongest growth momentum at +18% MoM order volume' },
  { icon: '💡', text: 'Enterprise segment drives 68% of revenue from only 22% of accounts' },
  { icon: '⚠️', text: 'LATAM average order value declined 8% — possible pricing pressure or product mix shift' },
  { icon: '🏆', text: 'Electronics category reached all-time high market share at 31% of total revenue' },
]

export default function AiInsightBar({ results, onAsk }: AiInsightBarProps) {
  const [insightIdx, setInsightIdx] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)

  useEffect(() => {
    const interval = setInterval(() => {
      setIsAnimating(true)
      setTimeout(() => {
        setInsightIdx(i => (i + 1) % ROTATING_INSIGHTS.length)
        setIsAnimating(false)
      }, 300)
    }, 6000)
    return () => clearInterval(interval)
  }, [])

  const current = ROTATING_INSIGHTS[insightIdx]

  return (
    <div className="px-4 py-2 bg-[#0a0a0a] border-t border-[#1c1c1c] flex items-center gap-2 flex-shrink-0">
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <Sparkles size={11} className="text-blue-400" />
        <span className="text-[10px] font-mono font-semibold text-blue-400">AI Insight</span>
      </div>
      <div className={`flex-1 min-w-0 transition-opacity duration-300 ${isAnimating ? 'opacity-0' : 'opacity-100'}`}>
        <p className="text-[10px] font-mono text-[#555] truncate">
          <span className="mr-1.5">{current.icon}</span>
          {current.text}
        </p>
      </div>
      {onAsk && (
        <button
          onClick={() => onAsk(`Tell me more: ${current.text}`)}
          className="flex-shrink-0 text-[10px] font-mono text-blue-400/50 hover:text-blue-400 transition-colors border border-blue-500/15 hover:border-blue-500/30 px-2 py-0.5 rounded"
        >
          Ask
        </button>
      )}
    </div>
  )
}
