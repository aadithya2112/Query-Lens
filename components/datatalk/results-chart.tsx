'use client'

import {
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

interface ResultsChartProps {
  data: any[]
}

export default function ResultsChart({ data }: ResultsChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-[#333] text-xs font-mono">
        No data to visualize
      </div>
    )
  }

  const columns = Object.keys(data[0])
  const xKey = columns.find(col => typeof data[0][col] === 'string') || columns[0]
  const yKey = columns.find(col => typeof data[0][col] === 'number') || columns[1]

  const chartData = data.map(row => ({
    ...row,
    name: String(row[xKey]).slice(0, 12),
    value: row[yKey],
  }))

  return (
    <div className="h-full bg-[#0c0c0c] rounded-xl border border-[#1c1c1c] overflow-hidden">
      <div className="px-3 py-2 border-b border-[#1c1c1c]">
        <p className="text-[10px] font-mono text-[#555]">{yKey} by {xKey}</p>
      </div>
      <div className="h-[calc(100%-34px)]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 12, right: 12, bottom: 16, left: 4 }}>
            <defs>
              <linearGradient id="barFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" />
                <stop offset="100%" stopColor="#1d4ed8" />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="0" stroke="#141414" horizontal vertical={false} />
            <XAxis
              dataKey="name"
              stroke="transparent"
              tick={{ fontSize: 9, fontFamily: 'monospace', fill: '#444' }}
              axisLine={false}
            />
            <YAxis
              stroke="transparent"
              tick={{ fontSize: 9, fontFamily: 'monospace', fill: '#444' }}
              axisLine={false}
              tickLine={false}
              width={36}
              tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}K` : v}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#0d0d0d',
                border: '1px solid #1c1c1c',
                borderRadius: '8px',
                color: '#e8e8e8',
                fontSize: '10px',
                fontFamily: 'monospace',
              }}
              cursor={{ fill: 'rgba(59, 130, 246, 0.06)' }}
            />
            <Bar
              dataKey="value"
              fill="url(#barFill)"
              isAnimationActive
              animationDuration={700}
              animationEasing="ease-out"
              radius={[3, 3, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
