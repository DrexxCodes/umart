'use client'
// app/referrals/client.tsx
// Buyer-facing referrals page.
//
// Flow:
//  1. Check localStorage for cached refrId (30-day TTL).
//  2. If not cached, check users/{uid}.myrefcode from /api/users/me.
//  3. If no code exists → show "Create" form with campaign name input.
//  4. If code exists → show the code card + insights graph.

import { useEffect, useState, useCallback } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { useRouter } from 'next/navigation'
import {
  Copy, CheckCheck, Share2, Loader2, RefreshCw,
  TrendingUp, Users, Calendar, Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ReferralData {
  refrId:       string
  campaignName: string
  signupCount:  number
  dailySignups: Record<string, number>
  createdAt:    string
}

interface ChartPoint {
  date:    string
  signups: number
}

// ── Local-storage cache (30-day TTL) ──────────────────────────────────────────

const LS_KEY     = 'umart_refr_id'
const TTL_MS     = 30 * 24 * 60 * 60 * 1000

function cacheCode(refrId: string) {
  localStorage.setItem(LS_KEY, JSON.stringify({ refrId, ts: Date.now() }))
}

function getCached(): string | null {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return null
    const { refrId, ts } = JSON.parse(raw)
    if (Date.now() - ts > TTL_MS) { localStorage.removeItem(LS_KEY); return null }
    return refrId
  } catch {
    return null
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildChartData(dailySignups: Record<string, number>): ChartPoint[] {
  const sorted = Object.entries(dailySignups)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, signups]) => ({ date: date.slice(5), signups })) // 'MM-DD'
  return sorted
}

// ── Main Component ────────────────────────────────────────────────────────────

export function ReferralsClient() {
  const router        = useRouter()
  const [uid, setUid] = useState<string | null>(null)
  const [idToken, setIdToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const [referral, setReferral]       = useState<ReferralData | null>(null)
  const [campaignInput, setCampaign]  = useState('')
  const [creating, setCreating]       = useState(false)
  const [copied, setCopied]           = useState(false)

  // ── Auth ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { router.push('/auth/login?redirect=/referrals'); return }
      const token = await user.getIdToken()
      setUid(user.uid)
      setIdToken(token)
    })
    return unsub
  }, [router])

  // ── Load referral data ────────────────────────────────────────────────────
  const loadReferral = useCallback(async (token: string, userId: string) => {
    setLoading(true)
    try {
      // 1. Check localStorage cache first
      const cached = getCached()
      if (cached) {
        const res = await fetch(`/api/referrals?code=${cached}`)
        if (res.ok) {
          // Fetch full data via userId endpoint
          const fullRes = await fetch(`/api/referrals?userId=${userId}`, {
            headers: { Authorization: `Bearer ${token}` },
          })
          if (fullRes.ok) {
            const { data } = await fullRes.json()
            const match = data.find((d: ReferralData) => d.refrId === cached)
            if (match) { setReferral(match); setLoading(false); return }
          }
        }
        // Cached code is stale — clear it
        localStorage.removeItem(LS_KEY)
      }

      // 2. Fetch from API
      const res = await fetch(`/api/referrals?userId=${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) { setLoading(false); return }

      const { data } = await res.json()
      if (data?.length > 0) {
        const refr = data[0] as ReferralData
        setReferral(refr)
        cacheCode(refr.refrId)
      }
    } catch (err) {
      console.error('[Referrals] load error', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (uid && idToken) loadReferral(idToken, uid)
  }, [uid, idToken, loadReferral])

  // ── Create referral code ──────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!campaignInput.trim() || !idToken) return
    setCreating(true)
    try {
      const res = await fetch('/api/referrals', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body:    JSON.stringify({ campaignName: campaignInput.trim() }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? 'Failed to create referral code')
        return
      }
      const refr = json.data as ReferralData
      setReferral(refr)
      cacheCode(refr.refrId)
      toast.success('Referral code created!')
    } catch {
      toast.error('Something went wrong')
    } finally {
      setCreating(false)
    }
  }

  // ── Copy code ─────────────────────────────────────────────────────────────
  const handleCopy = () => {
    if (!referral) return
    const link = `${window.location.origin}/auth/signup?ref=${referral.refrId}`
    navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast.success('Link copied to clipboard!')
  }

  // ── Share ─────────────────────────────────────────────────────────────────
  const handleShare = async () => {
    if (!referral) return
    const url = `${window.location.origin}/auth/signup?ref=${referral.refrId}`
    if (navigator.share) {
      await navigator.share({ title: referral.campaignName, url })
    } else {
      handleCopy()
    }
  }

  // ── Chart data ────────────────────────────────────────────────────────────
  const chartData = referral ? buildChartData(referral.dailySignups) : []
  const peakDay   = chartData.reduce<ChartPoint | null>(
    (best, p) => (!best || p.signups > best.signups ? p : best),
    null
  )

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">

      {/* ── Hero illustration ─────────────────────────────────────────────── */}
      <div className="flex flex-col items-center text-center gap-3">
        {/* Placeholder for referrals.svg */}
        <div className="w-40 h-40 flex items-center justify-center">
          <img
            src="/referrals.svg"
            alt="Referrals illustration"
            className="w-full h-full object-contain"
            onError={(e) => {
              // Graceful fallback if SVG not yet added
              ;(e.currentTarget as HTMLImageElement).style.display = 'none'
            }}
          />
        </div>
        <h1 className="text-2xl font-bold text-foreground">Referrals</h1>
        <p className="text-sm text-muted-foreground max-w-sm">
          Share U Mart with friends and track who joins using your personal referral link.
        </p>
      </div>

      {/* ── No code yet — create form ─────────────────────────────────────── */}
      {!referral && (
        <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <h2 className="font-semibold text-foreground">Create your referral code</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Give your campaign a name so referees know who sent them.
          </p>
          <div className="space-y-2">
            <label className="text-xs font-medium text-foreground">Campaign name</label>
            <input
              type="text"
              placeholder="e.g. Mike's Marketplace Invite"
              value={campaignInput}
              onChange={(e) => setCampaign(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
          </div>
          <Button
            className="w-full"
            onClick={handleCreate}
            disabled={creating || !campaignInput.trim()}
          >
            {creating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
            Generate my code
          </Button>
        </div>
      )}

      {/* ── Code card ─────────────────────────────────────────────────────── */}
      {referral && (
        <>
          <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Campaign</p>
                <h2 className="text-lg font-bold text-foreground mt-0.5">{referral.campaignName}</h2>
              </div>
              <Button variant="ghost" size="icon" onClick={() => loadReferral(idToken!, uid!)}>
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>

            {/* Code display */}
            <div className="flex items-center gap-3 bg-primary/5 border border-primary/20 rounded-xl px-4 py-3">
              <span className="font-mono font-bold text-xl tracking-[0.2em] text-primary flex-1">
                {referral.refrId}
              </span>
              <button
                onClick={handleCopy}
                className="text-muted-foreground hover:text-foreground transition-colors"
                title="Copy link"
              >
                {copied ? <CheckCheck className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5" />}
              </button>
            </div>

            {/* Share button */}
            <Button className="w-full gap-2" onClick={handleShare}>
              <Share2 className="w-4 h-4" />
              Share referral link
            </Button>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-3 pt-1">
              <div className="bg-muted/40 rounded-xl p-3 text-center">
                <Users className="w-4 h-4 text-primary mx-auto mb-1" />
                <p className="text-xl font-bold text-foreground">{referral.signupCount}</p>
                <p className="text-[10px] text-muted-foreground">Signups</p>
              </div>
              <div className="bg-muted/40 rounded-xl p-3 text-center">
                <TrendingUp className="w-4 h-4 text-primary mx-auto mb-1" />
                <p className="text-xl font-bold text-foreground">{chartData.length}</p>
                <p className="text-[10px] text-muted-foreground">Active days</p>
              </div>
              <div className="bg-muted/40 rounded-xl p-3 text-center">
                <Calendar className="w-4 h-4 text-primary mx-auto mb-1" />
                <p className="text-xl font-bold text-foreground">{peakDay?.signups ?? 0}</p>
                <p className="text-[10px] text-muted-foreground">Peak day</p>
              </div>
            </div>
          </div>

          {/* ── Insights graph ────────────────────────────────────────────── */}
          <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              <h3 className="font-semibold text-foreground">Signup insights</h3>
            </div>

            {chartData.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                <Users className="w-10 h-10 mb-3 opacity-30" />
                <p className="text-sm">No signups yet — share your link to get started!</p>
              </div>
            ) : (
              <>
                {peakDay && (
                  <p className="text-xs text-muted-foreground">
                    Peak day: <span className="font-semibold text-foreground">{peakDay.date}</span> with{' '}
                    <span className="font-semibold text-primary">{peakDay.signups} signup{peakDay.signups > 1 ? 's' : ''}</span>
                  </p>
                )}
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="refGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}   />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
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
                      contentStyle={{
                        background: 'hsl(var(--card))',
                        border:     '1px solid hsl(var(--border))',
                        borderRadius: '0.75rem',
                        fontSize:   12,
                      }}
                      labelStyle={{ color: 'hsl(var(--foreground))' }}
                      itemStyle={{ color: 'hsl(var(--primary))' }}
                    />
                    <Area
                      type="monotone"
                      dataKey="signups"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      fill="url(#refGrad)"
                      dot={{ r: 3, fill: 'hsl(var(--primary))' }}
                      activeDot={{ r: 5 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
