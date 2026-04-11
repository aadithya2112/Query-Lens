'use client'

import { useState } from 'react'
import {
  ChevronDown,
  Database as DatabaseIcon,
  Table2,
  FileText,
  Upload,
  Eye,
  EyeOff,
  Shield,
  Wifi,
  Hash,
  Type,
  Calendar,
  ToggleLeft,
  FileSpreadsheet,
  BookOpen,
  Plus,
  X,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'
import type { Database, DataSource, Column } from '@/lib/data-engine'

interface SidebarProps {
  databases: Database[]
  dataSources: DataSource[]
  selectedDatabase: string
  selectedTable: string
  onDatabaseSelect: (db: string) => void
  onTableSelect: (table: string) => void
  onFileUpload: (files: FileList) => void
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  number: <Hash size={10} className="text-blue-400" />,
  string: <Type size={10} className="text-emerald-400" />,
  date: <Calendar size={10} className="text-amber-400" />,
  boolean: <ToggleLeft size={10} className="text-purple-400" />,
}

const SOURCE_ICONS: Record<string, React.ReactNode> = {
  database: <DatabaseIcon size={14} className="text-blue-400" />,
  csv: <FileSpreadsheet size={14} className="text-emerald-400" />,
  excel: <FileSpreadsheet size={14} className="text-emerald-400" />,
  pdf: <BookOpen size={14} className="text-red-400" />,
  docx: <FileText size={14} className="text-blue-400" />,
  txt: <FileText size={14} className="text-gray-400" />,
}

export default function Sidebar({
  databases,
  dataSources,
  selectedDatabase,
  selectedTable,
  onDatabaseSelect,
  onTableSelect,
  onFileUpload,
}: SidebarProps) {
  const [expandedDbs, setExpandedDbs] = useState<Record<string, boolean>>({
    sales_db: true,
    analytics_dw: false,
  })
  const [expandedTables, setExpandedTables] = useState<Record<string, boolean>>({})
  const [showPII, setShowPII] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const [activeTab, setActiveTab] = useState<'schema' | 'sources'>('schema')

  const toggleDatabase = (dbName: string) => {
    setExpandedDbs(prev => ({ ...prev, [dbName]: !prev[dbName] }))
  }

  const toggleTable = (key: string) => {
    setExpandedTables(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    if (e.dataTransfer.files.length > 0) onFileUpload(e.dataTransfer.files)
  }

  const formatCount = (n: number) =>
    n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n)

  return (
    <div className="w-72 flex flex-col bg-[#0b0b0b] border-r border-[#1c1c1c] overflow-hidden flex-shrink-0">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-[#1c1c1c]">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-blue-600/20 flex items-center justify-center">
            <DatabaseIcon size={14} className="text-blue-400" />
          </div>
          <div>
            <h2 className="font-mono text-sm font-bold text-white leading-tight">DataTalk AI</h2>
            <p className="text-[10px] text-[#555] font-mono">v2.0 · Multi-Agent</p>
          </div>
          <div className="ml-auto flex items-center gap-1">
            <Wifi size={11} className="text-emerald-400" />
            <span className="text-[10px] text-emerald-400 font-mono">Live</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#1c1c1c]">
        {(['schema', 'sources'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 text-[10px] font-mono font-semibold uppercase tracking-wider transition-colors ${
              activeTab === tab
                ? 'text-blue-400 border-b-2 border-blue-500 bg-blue-500/5'
                : 'text-[#444] hover:text-[#888]'
            }`}
          >
            {tab === 'schema' ? 'Schema' : 'Sources'}
          </button>
        ))}
      </div>

      {/* PII toggle */}
      {activeTab === 'schema' && (
        <div className="px-3 py-2 flex items-center justify-between border-b border-[#1c1c1c]">
          <div className="flex items-center gap-1.5">
            <Shield size={10} className="text-amber-400" />
            <span className="text-[10px] text-[#555] font-mono">PII Fields</span>
          </div>
          <button
            onClick={() => setShowPII(!showPII)}
            className="flex items-center gap-1 text-[10px] font-mono text-[#444] hover:text-[#888] transition-colors"
          >
            {showPII ? <Eye size={10} /> : <EyeOff size={10} />}
            {showPII ? 'Visible' : 'Masked'}
          </button>
        </div>
      )}

      {/* Schema tab */}
      {activeTab === 'schema' && (
        <div className="flex-1 overflow-y-auto">
          {databases.map(db => (
            <div key={db.name}>
              {/* Database header */}
              <button
                onClick={() => toggleDatabase(db.name)}
                className="w-full px-3 py-2.5 flex items-center gap-2 hover:bg-[#111] transition-colors border-b border-[#161616]"
              >
                <ChevronDown
                  size={13}
                  className={`text-[#444] transition-transform duration-200 flex-shrink-0 ${expandedDbs[db.name] ? 'rotate-0' : '-rotate-90'}`}
                />
                <DatabaseIcon size={13} className="text-[#3b82f6] flex-shrink-0" />
                <span className="font-mono text-xs font-semibold text-[#ccc] flex-1 text-left truncate">{db.name}</span>
                <span
                  className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${
                    db.connected ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                  }`}
                >
                  {db.connected ? 'ON' : 'OFF'}
                </span>
              </button>

              {expandedDbs[db.name] && (
                <div>
                  {db.tables.map(table => {
                    const tKey = `${db.name}.${table.name}`
                    const isSelected = selectedTable === table.name && selectedDatabase === db.name
                    const isExpanded = expandedTables[tKey]

                    return (
                      <div key={tKey}>
                        <div
                          className={`flex items-center px-3 py-1.5 pl-7 cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-blue-600/15 border-l-2 border-blue-500'
                              : 'hover:bg-[#111] border-l-2 border-transparent'
                          }`}
                        >
                          <button
                            onClick={() => toggleTable(tKey)}
                            className="flex items-center gap-1.5 flex-1 min-w-0 text-left"
                          >
                            <ChevronDown
                              size={10}
                              className={`text-[#444] transition-transform flex-shrink-0 ${isExpanded ? 'rotate-0' : '-rotate-90'}`}
                            />
                            <Table2 size={11} className={isSelected ? 'text-blue-400' : 'text-[#555]'} />
                            <span className={`font-mono text-xs truncate ${isSelected ? 'text-blue-300' : 'text-[#888]'}`}>
                              {table.name}
                            </span>
                          </button>
                          <button
                            onClick={() => { onDatabaseSelect(db.name); onTableSelect(table.name) }}
                            className="ml-1 text-[9px] text-[#444] hover:text-blue-400 font-mono transition-colors"
                          >
                            {formatCount(table.rowCount)}r
                          </button>
                        </div>

                        {isExpanded && (
                          <div className="pl-10 pb-1">
                            {table.columns.map(col => (
                              <div
                                key={col.name}
                                className="flex items-center gap-1.5 px-2 py-0.5 hover:bg-[#0f0f0f] rounded"
                              >
                                {TYPE_ICONS[col.type] || <Hash size={10} className="text-[#555]" />}
                                <span className={`font-mono text-[10px] ${col.isPII && !showPII ? 'text-amber-600/60' : 'text-[#666]'}`}>
                                  {col.isPII && !showPII ? '••••••' : col.name}
                                </span>
                                {col.isPII && (
                                  <Shield size={8} className="text-amber-500/60 ml-auto" />
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Sources tab */}
      {activeTab === 'sources' && (
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          <div className="space-y-1.5">
            {dataSources.map(source => (
              <div
                key={source.id}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#111] border border-[#1c1c1c] hover:border-[#2a2a2a] transition-colors"
              >
                {SOURCE_ICONS[source.type] || <FileText size={14} className="text-[#555]" />}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-mono text-[#ccc] truncate">{source.name}</p>
                  {source.recordCount && (
                    <p className="text-[10px] font-mono text-[#444]">{formatCount(source.recordCount)} records</p>
                  )}
                </div>
                {source.status === 'ready' ? (
                  <CheckCircle2 size={12} className="text-emerald-400 flex-shrink-0" />
                ) : (
                  <AlertCircle size={12} className="text-amber-400 flex-shrink-0" />
                )}
              </div>
            ))}
          </div>

          {/* Upload area */}
          <div
            onDragOver={e => { e.preventDefault(); setIsDragOver(true) }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            onClick={() => {
              const input = document.createElement('input')
              input.type = 'file'
              input.multiple = true
              input.accept = '.csv,.xlsx,.xls,.pdf,.docx,.txt'
              input.onchange = e => {
                const files = (e.target as HTMLInputElement).files
                if (files) onFileUpload(files)
              }
              input.click()
            }}
            className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${
              isDragOver
                ? 'border-blue-500/60 bg-blue-500/5'
                : 'border-[#1c1c1c] hover:border-[#2a2a2a] hover:bg-[#111]'
            }`}
          >
            <Upload size={18} className={`mx-auto mb-2 ${isDragOver ? 'text-blue-400' : 'text-[#444]'}`} />
            <p className="text-xs font-mono text-[#555]">Drop files here</p>
            <p className="text-[10px] font-mono text-[#333] mt-0.5">CSV · Excel · PDF · DOCX · TXT</p>
          </div>

          <div className="text-[10px] font-mono text-[#333] px-1">
            <p className="text-[#444] mb-1 font-semibold">Supported Sources</p>
            <p>• MySQL / PostgreSQL</p>
            <p>• CSV / Excel (structured)</p>
            <p>• PDF / DOCX (RAG search)</p>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="border-t border-[#1c1c1c] px-4 py-2.5 flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <span className="text-[10px] font-mono text-[#444]">2 sources connected</span>
        <span className="ml-auto text-[10px] font-mono text-blue-400/60">6-agent AI</span>
      </div>
    </div>
  )
}
