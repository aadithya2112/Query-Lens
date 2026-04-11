'use client'

import { useState } from 'react'
import QueryEditor from './query-editor'
import ResultsGrid from './results-grid'
import AiInsightBar from './ai-insight-bar'
import ProactiveInsightsPanel from './proactive-insights'
import { PROACTIVE_INSIGHTS } from '@/lib/data-engine'
import type { InsightCard } from '@/lib/data-engine'

interface EditorPanelProps {
  query: string
  onQueryChange: (query: string) => void
  isLoading: boolean
  results: any[]
  selectedDb?: string
  onInsightAsk?: (q: string) => void
}

export default function EditorPanel({
  query,
  onQueryChange,
  isLoading,
  results,
  selectedDb = 'sales_db',
  onInsightAsk,
}: EditorPanelProps) {
  const [isRunning, setIsRunning] = useState(false)
  const [proactiveInsights, setProactiveInsights] = useState<InsightCard[]>(PROACTIVE_INSIGHTS)

  const handleRun = () => {
    setIsRunning(true)
    setTimeout(() => setIsRunning(false), 1200)
  }

  const handleDismissInsight = (id: string) => {
    setProactiveInsights(prev => prev.filter(i => i.id !== id))
  }

  return (
    <div className="flex-1 flex flex-col bg-[#090909] overflow-hidden">
      {/* Top breadcrumb */}
      <div className="px-4 py-2 border-b border-[#1a1a1a] flex items-center bg-[#0c0c0c] flex-shrink-0">
        <span className="text-[10px] font-mono text-[#333]">workspace</span>
        <span className="text-[10px] font-mono text-[#222] mx-1.5">/</span>
        <span className="text-[10px] font-mono text-blue-400/60">{selectedDb}</span>
        <div className="ml-auto flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="text-[10px] font-mono text-[#333]">Connected</span>
          </div>
        </div>
      </div>

      {/* Proactive Insights strip */}
      {onInsightAsk && (
        <ProactiveInsightsPanel
          insights={proactiveInsights}
          onAsk={onInsightAsk}
          onDismiss={handleDismissInsight}
        />
      )}

      {/* Query Editor */}
      <QueryEditor
        value={query}
        onChange={onQueryChange}
        onRun={handleRun}
        isRunning={isRunning || isLoading}
        dbName={selectedDb}
      />

      {/* Results section */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="px-4 py-1.5 bg-[#0c0c0c] border-b border-[#1a1a1a] flex items-center gap-2 flex-shrink-0">
          <span className="text-[10px] font-mono text-[#333]">Query Results</span>
          {!isLoading && results.length > 0 && (
            <span className="text-[10px] font-mono text-[#555]">· {results.length} rows</span>
          )}
        </div>

        <ResultsGrid
          results={results}
          isLoading={isLoading}
          sqlQuery={query}
          onInsightAsk={onInsightAsk}
        />
      </div>
    </div>
  )
}
