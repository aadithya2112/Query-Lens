'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

const dummyQueries = [
  `SELECT region, SUM(revenue) as total_revenue, COUNT(*) as order_count\nFROM orders\nWHERE date >= '2024-01-01'\nGROUP BY region\nORDER BY total_revenue DESC`,
  `SELECT dt.quarter, SUM(fr.revenue) as quarterly_revenue\nFROM fact_revenue fr\nJOIN dim_time dt ON fr.date_id = dt.date_id\nWHERE dt.year = 2024\nGROUP BY dt.quarter`,
]

export default function TypingIndicator() {
  const [showQueries, setShowQueries] = useState(false)
  
  return (
    <div className="flex gap-2 items-start">
      <div className="w-6 h-6 rounded-full bg-dt-accent-blue/20 flex items-center justify-center flex-shrink-0 mt-0.5">
        <span className="text-xs">🤖</span>
      </div>
      <div className="w-full">
        <div className="bg-dt-bg-dark border border-dt-border-dark/50 rounded-xl px-4 py-3">
          <div className="flex gap-1.5 items-center justify-between">
            <div className="flex gap-1.5 items-center">
              <span className="text-xs text-dt-text-muted">AI is analyzing queries</span>
              <div className="flex gap-1.5">
                {[0, 1, 2].map(i => (
                  <div
                    key={i}
                    className="w-2 h-2 rounded-full bg-dt-accent-blue/70"
                    style={{
                      animation: `dt-typing-dot 1.4s infinite`,
                      animationDelay: `${i * 0.2}s`,
                    }}
                  />
                ))}
              </div>
            </div>
            <button
              onClick={() => setShowQueries(!showQueries)}
              className="p-1 hover:bg-dt-bg-darker rounded transition-colors"
              title="View queries"
            >
              <ChevronDown size={14} className={`text-dt-text-muted transition-transform duration-200 ${showQueries ? 'rotate-180' : ''}`} />
            </button>
          </div>
          
          {showQueries && (
            <div className="mt-3 pt-3 border-t border-dt-border-dark/50 space-y-2">
              {dummyQueries.map((query, idx) => (
                <div key={idx} className="bg-dt-bg-darker/50 rounded-lg p-2.5 border border-dt-border-dark/30">
                  <p className="text-xs text-dt-text-muted-lighter mb-1.5 font-semibold">Query {idx + 1}</p>
                  <code className="text-xs text-dt-text-muted-lighter/80 font-mono leading-relaxed block whitespace-pre-wrap break-words">
                    {query}
                  </code>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
