'use client'

import {
  BarChart, Bar,
  LineChart, Line,
  PieChart, Pie, Cell,
  AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import type { ChartData } from '@/lib/data-engine'

const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899']

const TOOLTIP_STYLE = {
  contentStyle: {
    backgroundColor: '#0d0d0d',
    border: '1px solid #222',
    borderRadius: '8px',
    color: '#e8e8e8',
    fontSize: '11px',
    fontFamily: 'monospace',
    boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
  },
  cursor: { fill: 'rgba(59, 130, 246, 0.08)' },
}

const AXIS_STYLE = {
  tick: { fontSize: 10, fontFamily: 'monospace', fill: '#444' },
  axisLine: { stroke: '#1c1c1c' },
  tickLine: false as const,
}

interface Props {
  chartData: ChartData
}

export default function InlineChart({ chartData }: Props) {
  const { type, data, xKey, yKey } = chartData

  if (!data || data.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-[#333] text-xs font-mono">
        No chart data
      </div>
    )
  }

  if (type === 'line') {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 12, right: 16, bottom: 8, left: 0 }}>
          <defs>
            <linearGradient id="gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="0" stroke="#1a1a1a" horizontal vertical={false} />
          <XAxis dataKey={xKey} {...AXIS_STYLE} />
          <YAxis {...AXIS_STYLE} width={40} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}K` : v} />
          <Tooltip {...TOOLTIP_STYLE} />
          <Area
            type="monotone"
            dataKey={yKey}
            stroke="#3b82f6"
            strokeWidth={2}
            fill="url(#gradient)"
            dot={{ fill: '#3b82f6', strokeWidth: 0, r: 3 }}
            activeDot={{ r: 5, fill: '#60a5fa' }}
          />
        </AreaChart>
      </ResponsiveContainer>
    )
  }

  if (type === 'pie') {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey={yKey}
            nameKey={xKey}
            cx="50%"
            cy="50%"
            outerRadius={70}
            innerRadius={35}
            paddingAngle={3}
            strokeWidth={0}
          >
            {data.map((_, index) => (
              <Cell key={index} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={TOOLTIP_STYLE.contentStyle}
            formatter={(val: number) => [`${val}%`, '']}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: '10px', fontFamily: 'monospace', color: '#666' }}
          />
        </PieChart>
      </ResponsiveContainer>
    )
  }

  // Default: bar
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 12, right: 16, bottom: 8, left: 0 }}>
        <defs>
          <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#2563eb" />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="0" stroke="#1a1a1a" horizontal vertical={false} />
        <XAxis dataKey={xKey} {...AXIS_STYLE} />
        <YAxis {...AXIS_STYLE} width={40} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}K` : v} />
        <Tooltip {...TOOLTIP_STYLE} />
        <Bar
          dataKey={yKey}
          fill="url(#barGradient)"
          radius={[4, 4, 0, 0]}
          isAnimationActive
          animationDuration={600}
          animationEasing="ease-out"
        />
      </BarChart>
    </ResponsiveContainer>
  )
}
