'use client'

import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import type { Phase1AnalysisResponse } from "@/lib/querylens/types"

interface TrendChartProps {
  analysis: Phase1AnalysisResponse
}

export default function TrendChart({ analysis }: TrendChartProps) {
  const lastPoint = analysis.chartSpec.data.at(-1)

  return (
    <div className="ql-panel ql-glow rounded-[28px] border px-5 py-5 lg:px-7 lg:py-6">
      <div className="mb-5 flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-[var(--ql-accent)]">
            Weekly Trend
          </p>
          <h2 className="mt-2 text-xl font-semibold text-white">
            {analysis.chartSpec.title}
          </h2>
        </div>
        <p className="max-w-md text-sm leading-6 text-[var(--ql-muted)]">
          {analysis.chartSpec.explanation}
        </p>
      </div>

      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={analysis.chartSpec.data} margin={{ top: 12, right: 12, left: -18, bottom: 0 }}>
            <defs>
              <linearGradient id="qlScoreFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(201,167,106,0.34)" />
                <stop offset="100%" stopColor="rgba(201,167,106,0.02)" />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(163, 173, 185, 0.09)" vertical={false} />
            <XAxis
              axisLine={false}
              dataKey="label"
              tick={{ fill: "rgba(173, 183, 196, 0.76)", fontSize: 11, fontFamily: "IBM Plex Mono" }}
              tickLine={false}
            />
            <YAxis
              axisLine={false}
              domain={[50, 90]}
              tick={{ fill: "rgba(173, 183, 196, 0.76)", fontSize: 11, fontFamily: "IBM Plex Mono" }}
              tickLine={false}
              width={36}
            />
            <Tooltip
              contentStyle={{
                borderRadius: "16px",
                border: "1px solid rgba(201, 167, 106, 0.18)",
                background: "rgba(12, 18, 27, 0.96)",
                color: "#f7fafc",
              }}
              formatter={(value: number) => [`${value.toFixed(1)}`, "Score"]}
              labelFormatter={(label) => `Week of ${label}`}
            />
            <Area
              dataKey="score"
              fill="url(#qlScoreFill)"
              stroke="rgba(0,0,0,0)"
              type="monotone"
            />
            <Line
              dataKey="score"
              dot={{
                fill: "rgba(201, 167, 106, 1)",
                r: 3,
                stroke: "rgba(12, 18, 27, 1)",
                strokeWidth: 1.5,
              }}
              activeDot={{
                fill: "rgba(234, 214, 168, 1)",
                r: 5,
                stroke: "rgba(12, 18, 27, 1)",
                strokeWidth: 2,
              }}
              stroke="rgba(201, 167, 106, 1)"
              strokeWidth={2.5}
              type="monotone"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {lastPoint && (
        <div className="mt-4 flex items-center justify-between border-t border-[rgba(201,167,106,0.14)] pt-4">
          <p className="text-sm text-[var(--ql-muted)]">
            Latest plotted window:{" "}
            <span className="font-medium text-white">{lastPoint.label}</span>
          </p>
          <p className="font-mono text-xs text-[var(--ql-accent)]">
            score {lastPoint.score.toFixed(1)}
          </p>
        </div>
      )}
    </div>
  )
}
