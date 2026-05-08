'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

export interface AnalyticsDoc {
  id:                  string
  usersSignedUp:       number
  totalWithdrawn:      number
  totalPaid:           number
  totalPaidCount:      number
  productsCreated:     number
  totalPlatformFee:    number  // platform fee earned in this period
  updatedAt:           { seconds: number; nanoseconds: number } | null
}

export interface GlobalDoc {
  totalPaid:       number  // all-time escrow paid in 
  totalPlatformFee:  number  // all-time platform fee earned
  totalTransactions: number  // all-time transaction count
  updatedAt:         { seconds: number; nanoseconds: number } | null
}

export interface AnalyticsData {
  daily:   AnalyticsDoc[]
  monthly: AnalyticsDoc[]
  yearly:  AnalyticsDoc[]
  global:  GlobalDoc
}

const DEFAULT_GLOBAL: GlobalDoc = {
  totalPaid:       0,
  totalPlatformFee:  0,
  totalTransactions: 0,
  updatedAt:         null,
}

interface UseAnalyticsOptions {
  /** Poll interval in ms. Default: 30 000 */
  interval?: number
  /** Only fetch a specific period */
  period?: 'daily' | 'monthly' | 'yearly'
  /** Range start (YYYY-MM-DD for daily, YYYY-MM for monthly, YYYY for yearly) */
  start?: string
  /** Range end */
  end?: string
}

export function useAnalytics(options: UseAnalyticsOptions = {}) {
  const { interval = 30_000, period, start, end } = options

  const [data, setData]       = useState<Partial<AnalyticsData>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const timerRef              = useRef<ReturnType<typeof setInterval> | null>(null)

  const buildUrl = useCallback(() => {
    const params = new URLSearchParams()
    if (period) params.set('period', period)
    if (start)  params.set('start', start)
    if (end)    params.set('end', end)
    const qs = params.toString()
    return `/api/admin/analytics${qs ? `?${qs}` : ''}`
  }, [period, start, end])

  const fetch_ = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true)
    setError(null)
    try {
      const res = await fetch(buildUrl())
      if (res.status === 403) { setError('Forbidden'); return }
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json: Partial<AnalyticsData> = await res.json()
      setData(json)
    } catch (e: any) {
      setError(e?.message ?? 'Unknown error')
    } finally {
      if (isInitial) setLoading(false)
    }
  }, [buildUrl])

  useEffect(() => {
    fetch_(true)
    timerRef.current = setInterval(() => fetch_(false), interval)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [fetch_, interval])

  return {
    daily:   data.daily   ?? [],
    monthly: data.monthly ?? [],
    yearly:  data.yearly  ?? [],
    global:  data.global  ?? DEFAULT_GLOBAL,
    loading,
    error,
    refresh: () => fetch_(false),
  }
}