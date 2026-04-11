'use client'

import { useState, useMemo } from 'react'
import { Download, Filter, Search, SortAsc, SortDesc, BarChart2, Table2, Sparkles } from 'lucide-react'
import ResultsChart from './results-chart'
import AiInsightBar from './ai-insight-bar'

interface ResultsGridProps {
  results: any[]
  isLoading?: boolean
  sqlQuery?: string
  onInsightAsk?: (q: string) => void
}

export default function ResultsGrid({ results, isLoading = false, sqlQuery, onInsightAsk }: ResultsGridProps) {
  const [viewMode, setViewMode] = useState<'table' | 'chart'>('table')
  const [searchTerm, setSearchTerm] = useState('')
  const [sortColumn, setSortColumn] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const columns = useMemo(() => {
    if (!results || results.length === 0) return []
    return Object.keys(results[0])
  }, [results])

  const filtered = useMemo(() => {
    let data = results
    if (searchTerm) {
      data = data.filter(row =>
        Object.values(row).some(v => String(v).toLowerCase().includes(searchTerm.toLowerCase()))
      )
    }
    if (sortColumn) {
      data = [...data].sort((a, b) => {
        const aV = a[sortColumn]
        const bV = b[sortColumn]
        const mult = sortDir === 'asc' ? 1 : -1
        if (typeof aV === 'number') return (aV - bV) * mult
        return String(aV).localeCompare(String(bV)) * mult
      })
    }
    return data
  }, [results, searchTerm, sortColumn, sortDir])

  const handleSort = (col: string) => {
    if (sortColumn === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortColumn(col); setSortDir('desc') }
  }

  const exportCSV = () => {
    if (!results.length) return
    const header = columns.join(',')
    const rows = results.map(row => columns.map(c => JSON.stringify(row[c])).join(','))
    const csv = [header, ...rows].join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = 'datatalk_results.csv'
    a.click()
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="px-4 py-2 border-b border-[#1a1a1a] flex gap-3 bg-[#0c0c0c]">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-3 rounded bg-[#1c1c1c] animate-pulse" style={{ width: `${70 + i * 20}px` }} />
          ))}
        </div>
        <div className="flex-1 overflow-y-auto">
          {[...Array(5)].map((_, row) => (
            <div key={row} className="px-4 py-2.5 border-b border-[#141414] flex gap-3">
              {[...Array(4)].map((_, col) => (
                <div
                  key={col}
                  className="h-3 rounded"
                  style={{
                    width: `${65 + col * 25}px`,
                    background: 'linear-gradient(90deg, #111 25%, #1a1a1a 50%, #111 75%)',
                    backgroundSize: '200% 100%',
                    animation: 'dt-shimmer 1.5s infinite',
                  }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (results.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <Table2 size={24} className="text-[#333] mx-auto mb-3" />
          <p className="text-xs text-[#444] font-mono">No results yet</p>
          <p className="text-[10px] text-[#333] font-mono mt-1">Ask a question to execute a query</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="px-4 py-2 border-b border-[#1a1a1a] bg-[#0c0c0c] flex items-center gap-2 flex-shrink-0">
        <div className="flex items-center gap-1 flex-1">
          <div className="relative">
            <Search size={10} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#333]" />
            <input
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Filter results..."
              className="pl-7 pr-3 py-1 bg-[#111] border border-[#1c1c1c] rounded-lg text-[10px] font-mono text-[#888] placeholder-[#333] focus:outline-none focus:border-blue-500/40 w-40"
            />
          </div>
          <span className="text-[10px] font-mono text-[#444]">
            {filtered.length} / {results.length} rows
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setViewMode('table')}
            className={`p-1.5 rounded transition-colors ${viewMode === 'table' ? 'text-blue-400 bg-blue-500/10' : 'text-[#444] hover:text-[#888]'}`}
          >
            <Table2 size={13} />
          </button>
          <button
            onClick={() => setViewMode('chart')}
            className={`p-1.5 rounded transition-colors ${viewMode === 'chart' ? 'text-blue-400 bg-blue-500/10' : 'text-[#444] hover:text-[#888]'}`}
          >
            <BarChart2 size={13} />
          </button>
          <button
            onClick={exportCSV}
            className="flex items-center gap-1 px-2 py-1 text-[10px] font-mono text-[#444] hover:text-[#888] border border-[#1c1c1c] hover:border-[#2a2a2a] rounded transition-all"
          >
            <Download size={10} />
            Export
          </button>
        </div>
      </div>

      {viewMode === 'table' ? (
        <div className="flex-1 overflow-auto">
          <table className="w-full text-[10px] font-mono">
            <thead className="sticky top-0 z-10">
              <tr className="bg-[#0e0e0e] border-b border-[#1c1c1c]">
                {columns.map(col => (
                  <th
                    key={col}
                    onClick={() => handleSort(col)}
                    className="px-4 py-2 text-left text-[#555] whitespace-nowrap cursor-pointer hover:text-[#888] transition-colors select-none"
                  >
                    <span className="inline-flex items-center gap-1">
                      {col}
                      {sortColumn === col ? (
                        sortDir === 'asc'
                          ? <SortAsc size={9} className="text-blue-400" />
                          : <SortDesc size={9} className="text-blue-400" />
                      ) : (
                        <SortAsc size={9} className="text-[#333] opacity-0 group-hover:opacity-100" />
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, idx) => (
                <tr
                  key={idx}
                  className="border-b border-[#141414] hover:bg-[#0f0f0f] transition-colors group"
                >
                  {columns.map(col => {
                    const val = row[col]
                    const isNum = typeof val === 'number'
                    return (
                      <td
                        key={`${idx}-${col}`}
                        className={`px-4 py-2 whitespace-nowrap ${isNum ? 'text-blue-300 text-right' : 'text-[#888]'}`}
                      >
                        {isNum ? val.toLocaleString() : String(val)}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex-1 p-4">
          <ResultsChart data={filtered} />
        </div>
      )}

      <AiInsightBar results={results} onAsk={onInsightAsk} />
    </div>
  )
}
