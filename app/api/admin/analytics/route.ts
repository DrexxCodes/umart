import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebase-admin'
import {
  getDailyIds,
  getMonthlyIds,
  getYearlyIds,
  getDailyRange,
  getMonthlyRange,
  getYearlyRange,
} from '@/hooks/useDateData'

// ── Auth helper ────────────────────────────────────────────────────────────────

async function verifyAdmin(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get('__session')?.value
  if (!token) return false
  try {
    const decoded = await adminAuth.verifyIdToken(token)
    const userDoc = await adminDb.collection('users').doc(decoded.uid).get()
    if (!userDoc.exists) return false
    return userDoc.data()?.roles?.isAdmin === true
  } catch {
    return false
  }
}

// ── Types ──────────────────────────────────────────────────────────────────────

type Period = 'daily' | 'monthly' | 'yearly'

interface AnalyticsDoc {
  id:                  string
  usersSignedUp:       number
  totalWithdrawn:      number
  totalPaid:           number
  totalPaidCount:      number
  productsCreated:     number
  totalPlatformFee:    number  // platform fee earned in this period
  updatedAt:           FirebaseFirestore.Timestamp | null
}

interface GlobalDoc {
  totalPaid:         number  // all-time escrow paid in
  totalPlatformFee:  number  // all-time platform fee earned
  totalTransactions: number  // all-time transaction count
  updatedAt:         FirebaseFirestore.Timestamp | null
}

// ── Firestore fetch helpers ────────────────────────────────────────────────────

async function fetchDocs(collection: 'daily' | 'monthly' | 'yearly', ids: string[]): Promise<AnalyticsDoc[]> {
  if (!ids.length) return []

  // Always return a doc for every requested ID — missing ones get zeroed out.
  // This ensures the UI always has a record to show even on quiet days.
  const refs  = ids.map((id) => adminDb.doc(`admin/analytics/${collection}/${id}`))
  const snaps = await adminDb.getAll(...refs)

  return snaps.map((snap, i) => ({
    id:                  ids[i],
    usersSignedUp:       snap.data()?.usersSignedUp       ?? 0,
    totalWithdrawn:      snap.data()?.totalWithdrawn      ?? 0,
    totalPaid:           snap.data()?.totalPaid           ?? 0,
    totalPaidCount:      snap.data()?.totalPaidCount      ?? 0,
    productsCreated:     snap.data()?.productsCreated     ?? 0,
    totalPlatformFee:    snap.data()?.totalPlatformFee    ?? 0,
    updatedAt:           snap.data()?.updatedAt           ?? null,
  }))
}

async function fetchGlobal(): Promise<GlobalDoc> {
  const snap = await adminDb.collection('admin').doc('global').get()
  return {
    totalPaid:       snap.data()?.totalPaid       ?? 0,
    totalPlatformFee:  snap.data()?.totalPlatformFee  ?? 0,
    totalTransactions: snap.data()?.totalTransactions ?? 0,
    updatedAt:         snap.data()?.updatedAt         ?? null,
  }
}

// ── Route handler ──────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const isAdmin = await verifyAdmin(request)
  if (!isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = request.nextUrl
  const period = searchParams.get('period') as Period | null
  const start  = searchParams.get('start')
  const end    = searchParams.get('end')

  try {
    // ── Range query (start + end provided) ──────────────────────────────────
    if (period && start && end) {
      let ids: string[] = []
      if (period === 'daily')   ids = getDailyRange(start, end)
      if (period === 'monthly') ids = getMonthlyRange(start, end)
      if (period === 'yearly')  ids = getYearlyRange(start, end)

      const [docs, global] = await Promise.all([fetchDocs(period, ids), fetchGlobal()])
      return NextResponse.json({ [period]: docs, global })
    }

    // ── Single period, current + previous ───────────────────────────────────
    if (period && !start && !end) {
      let ids: string[] = []
      if (period === 'daily')   ids = getDailyIds()
      if (period === 'monthly') ids = getMonthlyIds()
      if (period === 'yearly')  ids = getYearlyIds()

      const [docs, global] = await Promise.all([fetchDocs(period, ids), fetchGlobal()])
      return NextResponse.json({ [period]: docs, global })
    }

    // ── Default: all 3 periods + global ─────────────────────────────────────
    const [daily, monthly, yearly, global] = await Promise.all([
      fetchDocs('daily',   getDailyIds()),
      fetchDocs('monthly', getMonthlyIds()),
      fetchDocs('yearly',  getYearlyIds()),
      fetchGlobal(),
    ])

    return NextResponse.json({ daily, monthly, yearly, global })
  } catch (err) {
    console.error('[analytics API]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}