'use client'
// app/admin/referrals/page.tsx
// Admin referrals page — two-panel layout on large screens:
//   Left: scrollable list of all referral codes + campaign names
//   Right: Recharts signup-behaviour graph for selected code

import { useEffect, useState, useCallback } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { useRouter } from 'next/navigation'
import {
  Loader2, Gift, TrendingUp, Users, ChevronRight, RefreshCw, Calendar,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ReferralSummary {
  refrId:       string
  campaignName: string
  ownerId:      string
  ownerName:    string | null
  signupCount:  number
  dailySignups: Record<string, number>
  createdAt:    string
}

interface ChartPoint {
  date:    string
  signups: number
  isPeak:  boolean
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildChart(daily: Record<string, number>): ChartPoint[] {
  if (!daily || Object.keys(daily).length === 0) return []
  const sorted = Object.entries(daily)
    .sort(([a], [b]) => a.localeCompare(b))
  const max = Math.max(...sorted.map(([, v]) => v))
  return sorted.map(([date, signups]) => ({
    date:    date.slice(5), // MM-DD
    signups,
    isPeak:  signups === max && max > 0,
  }))
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function AdminReferralsPage() {
  const router = useRouter()

  const [idToken,   setIdToken]   = useState<string | null>(null)
  const [authReady, setAuthReady] = useState(false)

  const [referrals,  setReferrals]  = useState<ReferralSummary[]>([])
  const [loading,    setLoading]    = useState(true)
  const [selected,   setSelected]   = useState<ReferralSummary | null>(null)

  // ── Auth ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { router.push('/auth/login'); return }
      const token = await user.getIdToken()
      setIdToken(token)
      setAuthReady(true)
    })
    return unsub
  }, [router])

  // ── Load all referrals ────────────────────────────────────────────────────
  const load = useCallback(async (token: string) => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/referrals', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) { router.push('/admin'); return }
      const json = await res.json()
      const list: ReferralSummary[] = json.data ?? []
      setReferrals(list)
      if (list.length > 0 && !selected) setSelected(list[0])
    } catch {
      /* noop */
    } finally {
      setLoading(false)
    }
  }, [router, selected])

  useEffect(() => {
    if (authReady && idToken) load(idToken)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady, idToken])

  // ── Derived chart data ────────────────────────────────────────────────────
  const chartData = selected ? buildChart(selected.dailySignups) : []
  const peakDay   = chartData.find((p) => p.isPeak) ?? null

  // ── Render ────────────────────────────────────────────────────────────────
  if (!authReady || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 min-h-[80vh]">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Gift className="w-6 h-6 text-primary" />
          <h1 className="text-xl font-bold text-foreground">Referrals</h1>
          <span className="ml-2 text-xs bg-primary/10 text-primary font-semibold px-2 py-0.5 rounded-full">
            {referrals.length}
          </span>
        </div>
        <Button variant="outline" size="sm" onClick={() => load(idToken!)} className="gap-1.5">
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </Button>
      </div>

      {referrals.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 py-20 text-muted-foreground gap-3">
          <Gift className="w-12 h-12 opacity-20" />
          <p className="text-sm">No referral codes created yet.</p>
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-4 flex-1">

          {/* ── Left panel — list ──────────────────────────────────────────── */}
          <div className="w-full lg:w-80 xl:w-96 flex-shrink-0 space-y-2 lg:max-h-[calc(100vh-10rem)] lg:overflow-y-auto pr-1">
            {referrals.map((r) => {
              const active = selected?.refrId === r.refrId
              return (
                <button
                  key={r.refrId}
                  onClick={() => setSelected(r)}
                  className={`w-full text-left rounded-xl border px-4 py-3 transition-all ${
                    active
                      ? 'border-primary bg-primary/5 shadow-sm'
                      : 'border-border bg-card hover:bg-muted/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-sm text-foreground truncate">{r.campaignName}</p>
                      <p className="font-mono text-xs text-muted-foreground mt-0.5">{r.refrId}</p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <span className="text-xs font-bold text-primary">{r.signupCount}</span>
                      <Users className="w-3 h-3 text-muted-foreground" />
                      <ChevronRight className={`w-4 h-4 transition-colors ${active ? 'text-primary' : 'text-muted-foreground'}`} />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[10px] text-muted-foreground truncate">
                      {r.ownerName ?? r.ownerId}
                    </span>
                    <span className="text-[10px] text-muted-foreground">·</span>
                    <span className="text-[10px] text-muted-foreground">{fmtDate(r.createdAt)}</span>
                  </div>
                </button>
              )
            })}
          </div>

          {/* ── Right panel — graph & stats ────────────────────────────────── */}
          {selected && (
            <div className="flex-1 space-y-4">

              {/* Header */}
              <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="font-bold text-foreground">{selected.campaignName}</h2>
                    <p className="text-xs text-muted-foreground font-mono mt-0.5">{selected.refrId}</p>
                  </div>
                  <span className="text-xs bg-muted px-2 py-1 rounded-lg text-muted-foreground">
                    {selected.ownerName ?? selected.ownerId}
                  </span>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-muted/40 rounded-xl p-3 text-center">
                    <Users className="w-4 h-4 text-primary mx-auto mb-1" />
                    <p className="text-xl font-bold">{selected.signupCount}</p>
                    <p className="text-[10px] text-muted-foreground">Total signups</p>
                  </div>
                  <div className="bg-muted/40 rounded-xl p-3 text-center">
                    <TrendingUp className="w-4 h-4 text-primary mx-auto mb-1" />
                    <p className="text-xl font-bold">{chartData.length}</p>
                    <p className="text-[10px] text-muted-foreground">Active days</p>
                  </div>
                  <div className="bg-muted/40 rounded-xl p-3 text-center">
                    <Calendar className="w-4 h-4 text-primary mx-auto mb-1" />
                    <p className="text-xl font-bold">{peakDay?.signups ?? 0}</p>
                    <p className="text-[10px] text-muted-foreground">Peak signups</p>
                  </div>
                </div>
              </div>

              {/* Graph */}
              <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-primary" />
                    <h3 className="font-semibold text-sm text-foreground">Signup behaviour</h3>
                  </div>
                  {peakDay && (
                    <span className="text-xs text-muted-foreground">
                      Peak: <span className="text-primary font-semibold">{peakDay.date}</span>
                      {' '}({peakDay.signups} signup{peakDay.signups > 1 ? 's' : ''})
                    </span>
                  )}
                </div>

                {chartData.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Users className="w-10 h-10 mb-3 opacity-20" />
                    <p className="text-sm">No signups yet for this code</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="adminRefGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%"   stopColor="hsl(var(--primary))" stopOpacity={0.9} />
                          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
                        </linearGradient>
                        <linearGradient id="adminRefPeak" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%"   stopColor="hsl(var(--primary))" stopOpacity={1}   />
                          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.8} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        allowDecimals={false}
                        tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip
                        cursor={{ fill: 'hsl(var(--muted))', radius: 4 }}
                        contentStyle={{
                          background:   'hsl(var(--card))',
                          border:       '1px solid hsl(var(--border))',
                          borderRadius: '0.75rem',
                          fontSize:     12,
                        }}
                        labelStyle={{ color: 'hsl(var(--foreground))' }}
                        itemStyle={{ color: 'hsl(var(--primary))' }}
                        formatter={(val: number | undefined) => [`${val ?? 0} signup${(val ?? 0) !== 1 ? 's' : ''}`, '' as const]}
                      />
                      <Bar dataKey="signups" radius={[4, 4, 0, 0]}>
                        {chartData.map((entry, i) => (
                          <Cell
                            key={i}
                            fill={entry.isPeak ? 'url(#adminRefPeak)' : 'url(#adminRefGrad)'}
                            stroke={entry.isPeak ? 'hsl(var(--primary))' : 'none'}
                            strokeWidth={entry.isPeak ? 2 : 0}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Area trend chart */}
              {chartData.length > 1 && (
                <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
                  <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-primary" />
                    Cumulative trend
                  </h3>
                  <ResponsiveContainer width="100%" height={160}>
                    <AreaChart
                      data={chartData.reduce<(ChartPoint & { total: number })[]>((acc, p, i) => {
                        const prev = acc[i - 1]?.total ?? 0
                        return [...acc, { ...p, total: prev + p.signups }]
                      }, [])}
                      margin={{ top: 5, right: 5, left: -20, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="cumulGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}   />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                        tickLine={false} axisLine={false}
                      />
                      <YAxis
                        allowDecimals={false}
                        tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                        tickLine={false} axisLine={false}
                      />
                      <Tooltip
                        contentStyle={{
                          background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))',
                          borderRadius: '0.75rem', fontSize: 12,
                        }}
                        labelStyle={{ color: 'hsl(var(--foreground))' }}
                        itemStyle={{ color: 'hsl(var(--primary))' }}
                        formatter={(val: number | undefined) => [`${val ?? 0} total`, '' as const]}
                      />
                      <Area
                        type="monotone" dataKey="total"
                        stroke="hsl(var(--primary))" strokeWidth={2}
                        fill="url(#cumulGrad)"
                        dot={false} activeDot={{ r: 4 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}

            </div>
          )}
        </div>
      )}
    </div>
  )
}
