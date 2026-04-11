'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Send,
  Mic,
  MicOff,
  X,
  ChevronRight,
  Sparkles,
  Eye,
  EyeOff,
  Languages,
  Zap,
  TrendingUp,
  BarChart2,
  Search,
  BookOpen,
  RefreshCw,
} from 'lucide-react'
import type { ChatMessage } from '@/lib/data-engine'
import ChatMessageComponent from './chat-message'

interface ChatPanelProps {
  messages: ChatMessage[]
  isTyping: boolean
  onSendMessage: (message: string) => void
  onMinimize: () => void
  simpleMode: boolean
  onToggleSimpleMode: () => void
}

const QUICK_ACTIONS = [
  { label: 'Top Regions', icon: <TrendingUp size={10} />, query: 'What are the top regions by revenue this quarter?' },
  { label: 'Trends', icon: <BarChart2 size={10} />, query: 'Show me monthly revenue trends for the past 12 months' },
  { label: 'Compare', icon: <RefreshCw size={10} />, query: 'Compare Q1 2024 vs Q1 2023 revenue by channel' },
  { label: 'Churn Risk', icon: <Zap size={10} />, query: 'Which customers have churn risk based on order frequency?' },
  { label: 'Products', icon: <Search size={10} />, query: 'Show me the top 10 products by margin' },
  { label: 'Story', icon: <BookOpen size={10} />, query: 'Generate a data story for our Q1 performance' },
]

const GREETING_SUGGESTIONS = [
  'What are the top regions by revenue?',
  'Show me product performance trends',
  'Why did North America revenue spike last week?',
  'Compare this quarter to last year',
]

function TypingIndicator() {
  return (
    <div className="flex items-start gap-2">
      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center flex-shrink-0">
        <Sparkles size={10} className="text-white" />
      </div>
      <div className="bg-[#111] border border-[#1c1c1c] rounded-2xl rounded-tl-sm px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[#444] font-mono">AI agents analyzing</span>
          <div className="flex gap-1">
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-blue-500/60"
                style={{ animation: `dt-typing-dot 1.4s infinite`, animationDelay: `${i * 0.2}s` }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ChatPanel({
  messages,
  isTyping,
  onSendMessage,
  onMinimize,
  simpleMode,
  onToggleSimpleMode,
}: ChatPanelProps) {
  const [inputValue, setInputValue] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [lang, setLang] = useState('EN')
  const scrollEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  const handleSend = useCallback(() => {
    if (inputValue.trim()) {
      onSendMessage(inputValue.trim())
      setInputValue('')
      inputRef.current?.focus()
    }
  }, [inputValue, onSendMessage])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleFollowUp = (q: string) => {
    onSendMessage(q)
  }

  const handleAskWhy = (messageId: string) => {
    const msg = messages.find(m => m.id === messageId)
    if (msg) onSendMessage(`Why did this happen? Explain the root cause of: ${msg.content.slice(0, 80)}...`)
  }

  const handleGenerateStory = (messageId: string) => {
    const msg = messages.find(m => m.id === messageId)
    if (msg) onSendMessage(`Generate a data story narrative based on this insight: ${msg.content.slice(0, 80)}...`)
  }

  const toggleVoice = () => {
    setIsRecording(!isRecording)
    // Voice input simulation
    if (!isRecording) {
      setTimeout(() => {
        setInputValue('What caused the revenue spike in North America?')
        setIsRecording(false)
      }, 2500)
    }
  }

  return (
    <div className="h-full flex flex-col bg-[#0b0b0b] overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#1c1c1c] flex items-center gap-2 bg-[#0b0b0b] flex-shrink-0">
        <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center">
          <Sparkles size={12} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-xs font-mono font-bold text-white">Data Assistant</h2>
          <p className="text-[10px] font-mono text-[#444]">6-agent AI system</p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1">
          {/* Simple mode toggle */}
          <button
            onClick={onToggleSimpleMode}
            title={simpleMode ? 'Switch to detailed mode' : 'Switch to simple mode (ELI5)'}
            className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono transition-all border ${
              simpleMode
                ? 'text-blue-400 border-blue-500/40 bg-blue-500/10'
                : 'text-[#444] border-[#1c1c1c] hover:text-[#888]'
            }`}
          >
            {simpleMode ? <Eye size={10} /> : <EyeOff size={10} />}
            ELI5
          </button>

          {/* Lang toggle */}
          <button
            onClick={() => setLang(l => l === 'EN' ? 'ES' : l === 'ES' ? 'FR' : 'EN')}
            className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono text-[#444] border border-[#1c1c1c] hover:text-[#888] transition-all"
          >
            <Languages size={10} />
            {lang}
          </button>

          <button
            onClick={onMinimize}
            className="p-1.5 hover:bg-[#1c1c1c] rounded transition-colors text-[#444] hover:text-[#888]"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Quick actions */}
      <div className="px-3 py-2 flex gap-1.5 overflow-x-auto border-b border-[#1a1a1a] flex-shrink-0 scrollbar-hide">
        {QUICK_ACTIONS.map((action) => (
          <button
            key={action.label}
            onClick={() => onSendMessage(action.query)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-mono text-[#555] border border-[#1c1c1c] hover:border-blue-500/30 hover:text-blue-400 hover:bg-blue-500/5 transition-all whitespace-nowrap flex-shrink-0"
          >
            {action.icon}
            {action.label}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-4 space-y-5">
          {/* Empty state */}
          {messages.length === 0 && (
            <div className="py-8 text-center">
              <div className="w-12 h-12 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-blue-600/20 to-violet-600/20 flex items-center justify-center border border-blue-500/20">
                <Sparkles size={20} className="text-blue-400" />
              </div>
              <p className="text-sm font-mono font-semibold text-white mb-1">Ask anything about your data</p>
              <p className="text-xs text-[#444] font-mono mb-5">
                Natural language → instant insights
              </p>
              <div className="space-y-2">
                {GREETING_SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => onSendMessage(s)}
                    className="w-full text-left text-xs font-mono text-[#555] border border-[#1c1c1c] hover:border-blue-500/30 hover:text-blue-400 hover:bg-blue-500/5 px-3 py-2 rounded-xl transition-all flex items-center gap-2"
                  >
                    <ChevronRight size={11} />
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, idx) => (
            <ChatMessageComponent
              key={msg.id}
              message={msg}
              index={idx}
              simpleMode={simpleMode}
              onFollowUp={handleFollowUp}
              onAskWhy={() => handleAskWhy(msg.id)}
              onGenerateStory={() => handleGenerateStory(msg.id)}
            />
          ))}
          {isTyping && <TypingIndicator />}
          <div ref={scrollEndRef} />
        </div>
      </div>

      {/* Input area */}
      <div className="px-4 py-3 border-t border-[#1c1c1c] bg-[#0b0b0b] flex-shrink-0">
        <div className="relative">
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your data in plain English..."
            rows={1}
            className="w-full px-4 py-3 pr-20 bg-[#111] text-white border border-[#1c1c1c] rounded-xl text-xs placeholder-[#333] focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all font-mono resize-none"
            style={{
              caretColor: '#3b82f6',
              minHeight: '44px',
              maxHeight: '120px',
              scrollbarWidth: 'none',
            }}
            onInput={e => {
              const el = e.currentTarget
              el.style.height = 'auto'
              el.style.height = Math.min(el.scrollHeight, 120) + 'px'
            }}
          />
          <div className="absolute right-2 bottom-2 flex items-center gap-1.5">
            <button
              onClick={toggleVoice}
              className={`p-1.5 rounded-lg transition-all ${
                isRecording
                  ? 'bg-red-500/20 text-red-400 animate-pulse'
                  : 'text-[#444] hover:text-[#888] hover:bg-[#1c1c1c]'
              }`}
            >
              {isRecording ? <MicOff size={14} /> : <Mic size={14} />}
            </button>
            <button
              onClick={handleSend}
              disabled={!inputValue.trim() || isTyping}
              className="p-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed text-white rounded-lg transition-all active:scale-95"
            >
              <Send size={14} />
            </button>
          </div>
        </div>
        <div className="flex items-center justify-between mt-2 px-1">
          <p className="text-[10px] text-[#333] font-mono">
            {isRecording ? '🔴 Recording...' : 'Enter to send · Shift+Enter for new line'}
          </p>
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="text-[10px] font-mono text-[#333]">AI ready</span>
          </div>
        </div>
      </div>
    </div>
  )
}
