"use client"

import { ChevronDown, Check, Loader2, Sparkles } from "lucide-react"
import { useEffect, useState, useRef } from "react"

/* ─── step definitions ───────────────────────────────────── */

interface ThinkingStep {
  label: string
  detail: string
  durationMs: number          // how long before starting the next step
}

const THINKING_STEPS: ThinkingStep[] = [
  {
    label: "Parsing query intent",
    detail: "Extracting entities, timeframe, and metric focus from the question",
    durationMs: 1800,
  },
  {
    label: "Resolving active scope",
    detail: "Mapping query to the right data slice & region filters",
    durationMs: 2200,
  },
  {
    label: "Running analytical pipeline",
    detail: "Querying upstream datasets and computing weekly deltas",
    durationMs: 3000,
  },
  {
    label: "Corroborating evidence",
    detail: "Cross-checking drivers against source data for consistency",
    durationMs: 2400,
  },
  {
    label: "Assembling response",
    detail: "Generating summary, evidence cards, and follow-up suggestions",
    durationMs: 2000,
  },
]

/* ─── hook: animated step progression ────────────────────── */

function useStepProgression(isActive: boolean) {
  const [activeStepIndex, setActiveStepIndex] = useState(0)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!isActive) {
      setActiveStepIndex(0)
      return
    }

    let current = 0
    const advance = () => {
      if (current < THINKING_STEPS.length - 1) {
        current++
        setActiveStepIndex(current)
        timeoutRef.current = setTimeout(advance, THINKING_STEPS[current].durationMs)
      }
    }

    timeoutRef.current = setTimeout(advance, THINKING_STEPS[0].durationMs)

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [isActive])

  return activeStepIndex
}

/* ─── orbital spinner ────────────────────────────────────── */

function OrbitalSpinner() {
  return (
    <div className="ql-orbital-wrap">
      <div className="ql-orbital-core" />
      <div className="ql-orbital-ring ql-ring-1" />
      <div className="ql-orbital-ring ql-ring-2" />
      <div className="ql-orbital-ring ql-ring-3" />
    </div>
  )
}

/* ─── main component ─────────────────────────────────────── */

export default function ThinkingLoader({ isActive }: { isActive: boolean }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const activeStep = useStepProgression(isActive)

  if (!isActive) return null

  return (
    <div className="ql-enter ql-thinking-root">
      {/* ── header row ─────────────────────────────────── */}
      <div className="ql-thinking-header">
        <div className="ql-thinking-header-left">
          <OrbitalSpinner />
          <div className="ql-thinking-label-group">
            <p className="ql-thinking-title">
              <Sparkles size={13} className="ql-thinking-sparkle" />
              QueryLens is thinking
            </p>
            <p className="ql-thinking-subtitle">
              {THINKING_STEPS[activeStep].label}
              <span className="ql-thinking-dots" />
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          className="ql-thinking-toggle"
          aria-label={isExpanded ? "Collapse steps" : "Expand steps"}
        >
          <span className="ql-thinking-toggle-label">
            {activeStep + 1}/{THINKING_STEPS.length}
          </span>
          <ChevronDown
            size={14}
            className={`ql-thinking-chevron ${isExpanded ? "ql-chevron-open" : ""}`}
          />
        </button>
      </div>

      {/* ── mini progress bar ──────────────────────────── */}
      <div className="ql-thinking-progress-track">
        <div
          className="ql-thinking-progress-bar"
          style={{
            width: `${((activeStep + 1) / THINKING_STEPS.length) * 100}%`,
          }}
        />
      </div>

      {/* ── expandable steps ───────────────────────────── */}
      <div
        className={`ql-thinking-steps-wrapper ${isExpanded ? "ql-steps-open" : ""}`}
      >
        <div className="ql-thinking-steps">
          {THINKING_STEPS.map((step, index) => {
            const isCompleted = index < activeStep
            const isCurrent = index === activeStep
            const isPending = index > activeStep

            return (
              <div
                key={step.label}
                className={`ql-step ${
                  isCompleted
                    ? "ql-step-done"
                    : isCurrent
                      ? "ql-step-active"
                      : "ql-step-pending"
                }`}
              >
                <div className="ql-step-icon">
                  {isCompleted ? (
                    <Check size={12} className="ql-step-check" />
                  ) : isCurrent ? (
                    <Loader2 size={12} className="ql-step-spin" />
                  ) : (
                    <div className="ql-step-dot" />
                  )}
                </div>
                <div className="ql-step-content">
                  <p className="ql-step-label">{step.label}</p>
                  {(isCurrent || isCompleted) && (
                    <p className="ql-step-detail">{step.detail}</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
