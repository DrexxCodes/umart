'use client'

import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface StatCardProps {
  label:          string
  value:          string | number
  previousValue?: number
  currentValue?:  number
  prefix?:        string
  suffix?:        string
  isCurrency?:    boolean
  accent?: 'primary' | 'success' | 'info' | 'destructive' | 'secondary'
}

const ACCENT = {
  primary:     { border: 'border-primary/20',     icon: 'text-primary',           bg: 'bg-primary/8'      },
  success:     { border: 'border-emerald-500/25',  icon: 'text-emerald-500',       bg: 'bg-emerald-500/8'  },
  info:        { border: 'border-chart-2/30',      icon: 'text-chart-2',           bg: 'bg-chart-2/8'      },
  destructive: { border: 'border-destructive/20',  icon: 'text-destructive',       bg: 'bg-destructive/8'  },
  secondary:   { border: 'border-secondary/30',    icon: 'text-secondary',         bg: 'bg-secondary/8'    },
}

/**
 * Format a value for stat cards:
 * - Billions: always shorten (e.g. ₦1.2B)
 * - Millions: always shorten (e.g. ₦2.5M)
 * - Thousands and below: show full number with commas (e.g. ₦10,300 not ₦10.3k)
 */
function formatValue(val: number, isCurrency: boolean, prefix = '', suffix = ''): string {
  const currencySign = isCurrency ? '₦' : ''

  if (val >= 1_000_000_000) {
    return `${prefix}${currencySign}${(val / 1_000_000_000).toFixed(1)}B${suffix}`
  }
  if (val >= 1_000_000) {
    return `${prefix}${currencySign}${(val / 1_000_000).toFixed(1)}M${suffix}`
  }
  // Under 1 million: always show full number
  return `${prefix}${currencySign}${val.toLocaleString('en-NG')}${suffix}`
}

export function StatCard({
  label, value, previousValue, currentValue,
  prefix = '', suffix = '', isCurrency = false, accent = 'primary',
}: StatCardProps) {
  const ac = ACCENT[accent]

  let pct: number | null = null
  let direction: 'up' | 'down' | 'flat' = 'flat'
  if (previousValue !== undefined && currentValue !== undefined && previousValue > 0) {
    pct = ((currentValue - previousValue) / previousValue) * 100
    direction = pct > 0.5 ? 'up' : pct < -0.5 ? 'down' : 'flat'
  }

  const displayValue = typeof value === 'number'
    ? formatValue(value, isCurrency, prefix, suffix)
    : value

  return (
    <div className={`relative rounded-xl border ${ac.border} bg-card p-4 xl:p-5 overflow-hidden hover:bg-muted/40 transition-colors duration-200`}>
      <div className={`absolute top-0 left-4 right-4 h-px ${ac.bg}`} />
      <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-muted-foreground mb-2">{label}</p>
      <p className="font-mono text-2xl xl:text-3xl font-bold text-foreground tracking-tight leading-none mb-3">{displayValue}</p>
      {pct !== null && (
        <div className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.65rem] font-semibold border ${
          direction === 'up'
            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
            : direction === 'down'
            ? 'bg-destructive/10 text-destructive border-destructive/20'
            : 'bg-muted text-muted-foreground border-border'
        }`}>
          {direction === 'up'   && <TrendingUp  className="w-2.5 h-2.5" />}
          {direction === 'down' && <TrendingDown className="w-2.5 h-2.5" />}
          {direction === 'flat' && <Minus        className="w-2.5 h-2.5" />}
          {direction === 'flat' ? 'No change' : `${Math.abs(pct).toFixed(1)}% vs prev`}
        </div>
      )}
    </div>
  )
}
