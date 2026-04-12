'use client'

import { useId } from "react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  Pie,
  PieChart as RechartsPieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import type { ChartDatum, Phase1AnalysisResponse } from "@/lib/querylens/types"

interface TrendChartProps {
  analysis: Phase1AnalysisResponse
  compact?: boolean
}

const PIE_COLORS = [
  "rgba(201, 167, 106, 0.92)",
  "rgba(102, 153, 204, 0.88)",
  "rgba(120, 184, 140, 0.84)",
  "rgba(214, 114, 86, 0.82)",
  "rgba(155, 135, 214, 0.82)",
  "rgba(230, 200, 120, 0.78)",
]

function formatNumericValue(value: number) {
  return Number.isInteger(value)
    ? value.toLocaleString()
    : value.toLocaleString(undefined, {
        maximumFractionDigits: 2,
      })
}

function getDatumValue(
  datum: ChartDatum | undefined,
  key: string
): string | number | undefined {
  if (!datum) {
    return undefined
  }

  const value = datum[key]
  return typeof value === "string" || typeof value === "number" ? value : undefined
}

export default function TrendChart({ analysis, compact = false }: TrendChartProps) {
  const gradientId = useId().replace(/:/g, "")

  if (!analysis.chartSpec) {
    return null
  }

  const chartSpec = analysis.chartSpec
  const isBarChart = chartSpec.type === "bar"
  const isPieChart = chartSpec.type === "pie"
  const isCompare = Boolean(analysis.comparisonSummary)
  const featuredPoint = isPieChart
    ? chartSpec.data[0]
    : isBarChart
      ? chartSpec.data[0]
      : chartSpec.data.at(-1)
  const featuredLabel = featuredPoint
    ? String(
        getDatumValue(
          featuredPoint,
          isPieChart ? chartSpec.labelKey : chartSpec.xKey
        ) ?? ""
      )
    : undefined
  const featuredValue = featuredPoint
    ? getDatumValue(
        featuredPoint,
        isPieChart ? chartSpec.valueKey : chartSpec.yKey
      )
    : undefined

  return (
    <div
      className={`ql-panel ql-glow rounded-[28px] border ${
        compact ? "px-4 py-4" : "px-5 py-5 lg:px-7 lg:py-6"
      }`}
    >
      <div className={`flex flex-col gap-2 ${compact ? "mb-4" : "mb-5"} lg:flex-row lg:items-end lg:justify-between`}>
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-[var(--ql-accent)]">
            {isPieChart
              ? "Composition View"
              : isCompare
                ? "Compare View"
                : isBarChart
                  ? "Breakdown View"
                  : "Weekly Trend"}
          </p>
          <h2 className={`mt-2 font-semibold text-white ${compact ? "text-lg" : "text-xl"}`}>
            {chartSpec.title}
          </h2>
        </div>
        <p className={`max-w-md leading-6 text-[var(--ql-muted)] ${compact ? "text-xs" : "text-sm"}`}>
          {chartSpec.explanation}
        </p>
      </div>

      <div className={compact ? "h-56 w-full" : "h-72 w-full"}>
        <ResponsiveContainer width="100%" height="100%">
          {isPieChart ? (
            <RechartsPieChart>
              <Tooltip
                contentStyle={{
                  borderRadius: "16px",
                  border: "1px solid rgba(201, 167, 106, 0.18)",
                  background: "rgba(12, 18, 27, 0.6)",
                  backdropFilter: "blur(12px)",
                  WebkitBackdropFilter: "blur(12px)",
                  color: "#f7fafc",
                }}
                formatter={(value: number) => [formatNumericValue(value), "Value"]}
              />
              <Pie
                data={chartSpec.data}
                dataKey={chartSpec.valueKey}
                nameKey={chartSpec.labelKey}
                cx="50%"
                cy="50%"
                innerRadius={compact ? 38 : 54}
                outerRadius={compact ? 74 : 98}
                paddingAngle={2}
              >
                {chartSpec.data.map((entry, index) => (
                  <Cell
                    key={`${getDatumValue(entry, chartSpec.labelKey) ?? index}`}
                    fill={PIE_COLORS[index % PIE_COLORS.length]}
                  />
                ))}
              </Pie>
            </RechartsPieChart>
          ) : isBarChart ? (
            <BarChart
              data={chartSpec.data}
              margin={{ top: 12, right: 12, left: -18, bottom: 0 }}
            >
              <defs>
                <linearGradient id={`${gradientId}-bar`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgba(201,167,106,0.4)" />
                  <stop offset="100%" stopColor="rgba(201,167,106,0.05)" />
                </linearGradient>
              </defs>
              <CartesianGrid
                stroke="rgba(163, 173, 185, 0.09)"
                vertical={false}
              />
              <XAxis
                axisLine={false}
                dataKey={chartSpec.xKey}
                tick={{
                  fill: "rgba(173, 183, 196, 0.76)",
                  fontSize: compact ? 10 : 11,
                  fontFamily: "IBM Plex Mono",
                }}
                tickLine={false}
              />
              <YAxis
                allowDecimals
                axisLine={false}
                tick={{
                  fill: "rgba(173, 183, 196, 0.76)",
                  fontSize: compact ? 10 : 11,
                  fontFamily: "IBM Plex Mono",
                }}
                tickLine={false}
                width={44}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: "16px",
                  border: "1px solid rgba(201, 167, 106, 0.18)",
                  background: "rgba(12, 18, 27, 0.6)",
                  backdropFilter: "blur(12px)",
                  WebkitBackdropFilter: "blur(12px)",
                  color: "#f7fafc",
                }}
                formatter={(value: number) => [formatNumericValue(value), chartSpec.yKey]}
                labelFormatter={(label) => `${label}`}
                cursor={{ fill: "rgba(255, 255, 255, 0.04)" }}
              />
              <Bar
                dataKey={chartSpec.yKey}
                fill={`url(#${gradientId}-bar)`}
                stroke="rgba(201, 167, 106, 0.6)"
                strokeWidth={1.5}
                radius={[6, 6, 0, 0]}
              />
            </BarChart>
          ) : (
            <AreaChart
              data={chartSpec.data}
              margin={{ top: 12, right: 12, left: -18, bottom: 0 }}
            >
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgba(201,167,106,0.34)" />
                  <stop offset="100%" stopColor="rgba(201,167,106,0.02)" />
                </linearGradient>
              </defs>
              <CartesianGrid
                stroke="rgba(163, 173, 185, 0.09)"
                vertical={false}
              />
              <XAxis
                axisLine={false}
                dataKey={chartSpec.xKey}
                tick={{
                  fill: "rgba(173, 183, 196, 0.76)",
                  fontSize: compact ? 10 : 11,
                  fontFamily: "IBM Plex Mono",
                }}
                tickLine={false}
              />
              <YAxis
                axisLine={false}
                tick={{
                  fill: "rgba(173, 183, 196, 0.76)",
                  fontSize: compact ? 10 : 11,
                  fontFamily: "IBM Plex Mono",
                }}
                tickLine={false}
                width={44}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: "16px",
                  border: "1px solid rgba(201, 167, 106, 0.18)",
                  background: "rgba(12, 18, 27, 0.6)",
                  backdropFilter: "blur(12px)",
                  WebkitBackdropFilter: "blur(12px)",
                  color: "#f7fafc",
                }}
                formatter={(value: number) => [formatNumericValue(value), chartSpec.yKey]}
                labelFormatter={(label) => `${label}`}
                cursor={{ stroke: "rgba(255, 255, 255, 0.1)", strokeWidth: 1, strokeDasharray: "4 4" }}
              />
              <Area
                dataKey={chartSpec.yKey}
                fill={`url(#${gradientId})`}
                stroke="rgba(0,0,0,0)"
                type="monotone"
              />
              <Line
                dataKey={chartSpec.yKey}
                dot={{
                  fill: "rgba(201, 167, 106, 1)",
                  r: compact ? 2.5 : 3,
                  stroke: "rgba(12, 18, 27, 1)",
                  strokeWidth: 1.5,
                }}
                activeDot={{
                  fill: "rgba(234, 214, 168, 1)",
                  r: compact ? 4 : 5,
                  stroke: "rgba(12, 18, 27, 1)",
                  strokeWidth: 2,
                }}
                stroke="rgba(201, 167, 106, 1)"
                strokeWidth={2.5}
                type="monotone"
              />
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>

      {featuredPoint && featuredLabel && featuredValue !== undefined && (
        <div className="mt-4 flex items-center justify-between border-t border-[rgba(201,167,106,0.14)] pt-4">
          <p className={`text-[var(--ql-muted)] ${compact ? "text-xs" : "text-sm"}`}>
            {isPieChart
              ? "Leading slice:"
              : isCompare
                ? "Leading side:"
                : isBarChart
                  ? "Largest bucket:"
                  : "Latest plotted window:"}{" "}
            <span className="font-medium text-white">{featuredLabel}</span>
          </p>
          <p className="font-mono text-xs text-[var(--ql-accent)]">
            {typeof featuredValue === "number"
              ? formatNumericValue(featuredValue)
              : String(featuredValue)}
          </p>
        </div>
      )}
    </div>
  )
}
