'use client'

import { useState } from 'react'
import { Play, Square, Code2, Maximize2, Database } from 'lucide-react'

interface QueryEditorProps {
  value: string
  onChange: (value: string) => void
  onRun?: () => void
  isRunning?: boolean
  dbName?: string
}

// SQL syntax highlighting (simple tokenizer)
function highlightSQL(sql: string): React.ReactNode[] {
  const keywords = /\b(SELECT|FROM|WHERE|GROUP BY|ORDER BY|HAVING|JOIN|LEFT|RIGHT|INNER|OUTER|ON|AS|AND|OR|NOT|IN|IS|NULL|LIMIT|OFFSET|DISTINCT|COUNT|SUM|AVG|MAX|MIN|CASE|WHEN|THEN|ELSE|END|INSERT|UPDATE|DELETE|CREATE|TABLE|INDEX|VIEW|WITH|UNION|DESC|ASC|DATE_TRUNC|INTERVAL|CURRENT_DATE)\b/gi

  return sql.split('\n').map((line, lineIdx) => {
    const parts: React.ReactNode[] = []
    let lastIndex = 0
    let match

    const regex = new RegExp(keywords.source, 'gi')
    while ((match = regex.exec(line)) !== null) {
      if (match.index > lastIndex) {
        const segment = line.slice(lastIndex, match.index)
        // Color strings
        const strParts = segment.split(/(\'[^\']*\'|\"[^\"]*\"|[0-9]+)/)
        strParts.forEach((part, i) => {
          if (part.match(/^\'[^\']*\'$/) || part.match(/^\"[^\"]*\"$/)) {
            parts.push(<span key={`s-${lineIdx}-${match!.index}-${i}`} className="text-amber-400">{part}</span>)
          } else if (part.match(/^[0-9]+$/)) {
            parts.push(<span key={`n-${lineIdx}-${match!.index}-${i}`} className="text-purple-400">{part}</span>)
          } else {
            parts.push(<span key={`t-${lineIdx}-${match!.index}-${i}`} className="text-[#888]">{part}</span>)
          }
        })
      }
      parts.push(
        <span key={`k-${lineIdx}-${match.index}`} className="text-blue-400 font-semibold">
          {match[0]}
        </span>
      )
      lastIndex = match.index + match[0].length
    }

    if (lastIndex < line.length) {
      const remaining = line.slice(lastIndex)
      parts.push(<span key={`r-${lineIdx}`} className="text-[#888]">{remaining}</span>)
    }

    return (
      <div key={lineIdx} className="flex">
        <span className="w-8 text-right pr-3 text-[#2a2a2a] select-none flex-shrink-0 font-mono text-[10px] leading-5">
          {lineIdx + 1}
        </span>
        <span className="flex-1 font-mono text-[10px] leading-5">{parts}</span>
      </div>
    )
  })
}

export default function QueryEditor({ value, onChange, onRun, isRunning, dbName = 'sales_db' }: QueryEditorProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const lineCount = value.split('\n').length

  return (
    <div className={`flex flex-col border-b border-[#1a1a1a] ${isExpanded ? 'flex-1' : ''}`} style={isExpanded ? {} : { height: '200px' }}>
      {/* Editor header */}
      <div className="px-4 py-2 bg-[#0c0c0c] border-b border-[#1a1a1a] flex items-center gap-2 flex-shrink-0">
        <Code2 size={12} className="text-[#555]" />
        <span className="text-[10px] font-mono text-[#555]">SQL Editor</span>
        <div className="flex items-center gap-1 ml-2">
          <Database size={10} className="text-blue-400/50" />
          <span className="text-[10px] font-mono text-blue-400/60">{dbName}</span>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="text-[9px] font-mono text-[#333]">{lineCount}L</span>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 hover:bg-[#1c1c1c] rounded transition-colors text-[#444] hover:text-[#888]"
          >
            <Maximize2 size={11} />
          </button>
          <button
            onClick={onRun}
            disabled={isRunning}
            className="flex items-center gap-1.5 px-3 py-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-[10px] font-mono rounded-lg transition-all active:scale-95"
          >
            {isRunning ? <Square size={10} /> : <Play size={10} className="fill-white" />}
            {isRunning ? 'Running' : 'Run'}
          </button>
        </div>
      </div>

      {/* Editor body - dual pane: syntax highlighted preview + actual textarea */}
      <div className="flex-1 relative overflow-hidden bg-[#080808]">
        {/* Syntax highlighted overlay */}
        <div
          className="absolute inset-0 overflow-auto p-4 pointer-events-none"
          style={{ fontFamily: 'monospace', fontSize: '11px', lineHeight: '20px' }}
        >
          {highlightSQL(value)}
        </div>

        {/* The actual editable textarea (transparent) */}
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          className="absolute inset-0 w-full h-full opacity-0 resize-none focus:opacity-100 focus:bg-[#080808]/90 p-4 pl-12 text-[#888] font-mono text-[10px] leading-5 focus:outline-none focus:opacity-50"
          style={{ caretColor: '#3b82f6' }}
          spellCheck={false}
        />
      </div>
    </div>
  )
}
