'use client'

import {
  ResponsiveContainer, ComposedChart, Area, Bar, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'

export interface ChartDataPoint {
  label:           string
  usersSignedUp:   number
  totalPaid:     number
  totalWithdrawn:  number
  productsCreated: number
}

interface PeriodChartProps {
  data:    ChartDataPoint[]
  height?: number
}

// Uses your chart-1..5 CSS variables (all oklch hue-240 blues)
// We reference them as inline style values via getComputedStyle at runtime —
// but for SSR safety we provide fallback oklch values that match your palette.
const MONETARY = [
  { key: 'totalEscrow',    name: 'Escrow Paid In', cssVar: '--chart-1', fallback: 'oklch(0.5 0.17 240)' },
  { key: 'totalWithdrawn', name: 'Withdrawn',       cssVar: '--chart-3', fallback: 'oklch(0.7 0.17 240)' },
]
const COUNTS = [
  { key: 'usersSignedUp',   name: 'Signups',          cssVar: '--chart-2', fallback: 'oklch(0.6 0.17 240)' },
  { key: 'productsCreated', name: 'Products Created',  cssVar: '--chart-4', fallback: 'oklch(0.4 0.17 240)' },
]

// Resolve CSS variables client-side so chart colors follow theme switches
function resolveColor(cssVar: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback
  return getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim() || fallback
}

function fmtMoney(v: number) {
  if (v >= 1_000_000) return `₦${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000)     return `₦${(v / 1_000).toFixed(0)}k`
  return `₦${v}`
}
function fmtCount(v: number) {
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}k`
  return `${v}`
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-border bg-popover px-3 py-2.5 shadow-xl text-xs z-50 min-w-[180px]">
      <p className="font-semibold text-foreground mb-2 border-b border-border pb-1.5">{label}</p>
      {payload.map((entry: any) => (
        <div key={entry.dataKey} className="flex items-center justify-between gap-4 py-0.5">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="w-2 h-2 rounded-full inline-block shrink-0" style={{ background: entry.color }} />
            {entry.name}
          </span>
          <span className="font-mono font-semibold" style={{ color: entry.color }}>
            {entry.dataKey.startsWith('total')
              ? `₦${Number(entry.value).toLocaleString()}`
              : Number(entry.value).toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  )
}

export function PeriodChart({ data, height = 280 }: PeriodChartProps) {
  if (!data.length) {
    return (
      <div className="flex items-center justify-center text-muted-foreground text-sm" style={{ height }}>
        No data available yet
      </div>
    )
  }

  // Resolve at render time so theme switches are reflected immediately
  const monetaryColors = MONETARY.map(s => ({ ...s, color: resolveColor(s.cssVar, s.fallback) }))
  const countColors    = COUNTS.map(s   => ({ ...s, color: resolveColor(s.cssVar, s.fallback) }))
  const twoPoints      = data.length <= 2
  const gridColor      = typeof window !== 'undefined'
    ? getComputedStyle(document.documentElement).getPropertyValue('--border').trim()
    : 'oklch(0.25 0 0)'

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 4, right: 48, bottom: 0, left: 0 }}>
        <defs>
          {!twoPoints && monetaryColors.map(s => (
            <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={s.color} stopOpacity={0.25} />
              <stop offset="95%" stopColor={s.color} stopOpacity={0.02} />
            </linearGradient>
          ))}
        </defs>

        <CartesianGrid strokeDasharray="3 3" stroke={`oklch(from ${gridColor} l c h / 0.4)`} vertical={false} />

        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fontFamily: 'var(--font-mono)' }}
          tickLine={false}
          axisLine={{ strokeOpacity: 0.2 }}
          stroke="currentColor"
          className="text-muted-foreground"
        />
        <YAxis
          yAxisId="money"
          orientation="left"
          tickFormatter={fmtMoney}
          tick={{ fontSize: 10, fontFamily: 'var(--font-mono)' }}
          axisLine={false}
          tickLine={false}
          width={52}
          stroke="currentColor"
          className="text-muted-foreground"
        />
        <YAxis
          yAxisId="count"
          orientation="right"
          tickFormatter={fmtCount}
          tick={{ fontSize: 10, fontFamily: 'var(--font-mono)' }}
          axisLine={false}
          tickLine={false}
          width={36}
          stroke="currentColor"
          className="text-muted-foreground"
        />

        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{ paddingTop: '12px' }}
          formatter={(value) => (
            <span className="text-muted-foreground" style={{ fontFamily: 'var(--font-mono)', fontSize: '10px' }}>
              {value}
            </span>
          )}
        />

        {monetaryColors.map(s =>
          twoPoints ? (
            <Bar key={s.key} yAxisId="money" dataKey={s.key} name={s.name}
              fill={s.color} fillOpacity={0.8} radius={[3,3,0,0]}
              isAnimationActive animationDuration={500} animationEasing="ease-out" />
          ) : (
            <Area key={s.key} yAxisId="money" type="monotone" dataKey={s.key} name={s.name}
              stroke={s.color} strokeWidth={2} fill={`url(#grad-${s.key})`}
              dot={false} activeDot={{ r: 4, strokeWidth: 0, fill: s.color }}
              isAnimationActive animationDuration={600} animationEasing="ease-out" />
          )
        )}

        {countColors.map(s => (
          <Line key={s.key} yAxisId="count" type="monotone" dataKey={s.key} name={s.name}
            stroke={s.color} strokeWidth={twoPoints ? 2 : 1.5}
            dot={twoPoints ? { r: 4, fill: s.color, strokeWidth: 0 } : false}
            activeDot={{ r: 4, strokeWidth: 0, fill: s.color }}
            isAnimationActive animationDuration={600} animationEasing="ease-out" />
        ))}
      </ComposedChart>
    </ResponsiveContainer>
  )
}