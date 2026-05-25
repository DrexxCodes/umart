// app/api/referrals/route.ts
// Handles referral code creation and signup tracking.
//
//  POST /api/referrals                     — create a new referral code
//  POST /api/referrals?action=track        — record a signup under a referral code
//  GET  /api/referrals?code={refrId}       — verify a referral code & return campaign name
//  GET  /api/referrals?userId={uid}        — fetch all referral docs owned by a user (admin or owner)

import { NextRequest, NextResponse } from 'next/server'
import { adminDb, adminAuth } from '@/lib/firebase-admin'
import { FieldValue } from 'firebase-admin/firestore'
import { randomBytes } from 'crypto'

function generateCode(len = 8): string {
  // URL-safe uppercase alphanumeric code
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = randomBytes(len)
  return Array.from(bytes).map((b) => chars[b % chars.length]).join('')
}

// ── helpers ───────────────────────────────────────────────────────────────────

async function getUid(req: NextRequest): Promise<string | null> {
  const h = req.headers.get('authorization')
  if (!h?.startsWith('Bearer ')) return null
  try {
    return (await adminAuth.verifyIdToken(h.substring(7))).uid
  } catch {
    return null
  }
}

// ── GET ───────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const code   = searchParams.get('code')
  const userId = searchParams.get('userId')

  // ── Verify a code and return campaign name ─────────────────────────────────
  if (code) {
    const snap = await adminDb.collection('referrals').doc(code).get()
    if (!snap.exists) {
      return NextResponse.json(
        { success: false, error: 'Referral code not found' },
        { status: 404 }
      )
    }
    const d = snap.data()!
    return NextResponse.json({
      success:      true,
      refrId:       snap.id,
      campaignName: d.campaignName,
      ownerName:    d.ownerName ?? null,
    })
  }

  // ── Fetch all referral docs for a user ─────────────────────────────────────
  if (userId) {
    const uid = await getUid(req)
    if (!uid) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }
    // Only allow fetching own codes unless admin
    const userSnap = await adminDb.collection('users').doc(uid).get()
    const isAdmin  = userSnap.data()?.roles?.isAdmin === true

    if (!isAdmin && uid !== userId) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const snap = await adminDb
      .collection('referrals')
      .where('ownerId', '==', userId)
      .orderBy('createdAt', 'desc')
      .get()

    const data = snap.docs.map((doc) => {
      const d = doc.data()
      return {
        refrId:       doc.id,
        campaignName: d.campaignName,
        ownerId:      d.ownerId,
        ownerName:    d.ownerName,
        signupCount:  d.signupCount  ?? 0,
        dailySignups: d.dailySignups ?? {},
        createdAt:    d.createdAt,
      }
    })

    return NextResponse.json({ success: true, data })
  }

  return NextResponse.json(
    { success: false, error: 'Provide ?code= or ?userId=' },
    { status: 400 }
  )
}

// ── POST ──────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const action = req.nextUrl.searchParams.get('action')

  // ── Track a signup under an existing referral code ────────────────────────
  if (action === 'track') {
    return handleTrackSignup(req)
  }

  // ── Create a new referral code ────────────────────────────────────────────
  return handleCreateReferral(req)
}

// ─────────────────────────────────────────────────────────────────────────────
// Create referral
// Body: { campaignName: string }
// Auth: Bearer token (must be logged in)
// ─────────────────────────────────────────────────────────────────────────────
async function handleCreateReferral(req: NextRequest) {
  const uid = await getUid(req)
  if (!uid) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  let body: any
  try { body = await req.json() } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const { campaignName } = body

  if (!campaignName || typeof campaignName !== 'string' || !campaignName.trim()) {
    return NextResponse.json(
      { success: false, error: '`campaignName` is required' },
      { status: 400 }
    )
  }

  // Check if user already has a referral code — one per user
  const existing = await adminDb
    .collection('referrals')
    .where('ownerId', '==', uid)
    .limit(1)
    .get()

  if (!existing.empty) {
    const doc = existing.docs[0]
    return NextResponse.json(
      {
        success: false,
        error:   'You already have a referral code',
        refrId:  doc.id,
        data:    { refrId: doc.id, ...doc.data() },
      },
      { status: 409 }
    )
  }

  // Fetch owner's name from users doc
  const userSnap = await adminDb.collection('users').doc(uid).get()
  const ownerName = userSnap.data()?.fullname ?? userSnap.data()?.username ?? null

  // Generate a short unique code — 8 chars, URL-safe
  const refrId = generateCode(8)

  const now = new Date().toISOString()
  const payload = {
    campaignName: campaignName.trim(),
    ownerId:      uid,
    ownerName:    ownerName,
    signupCount:  0,
    dailySignups: {},   // { 'YYYY-MM-DD': count } — incremented on each signup
    createdAt:    now,
    updatedAt:    now,
  }

  // Write referral doc + update users doc in parallel
  await Promise.all([
    adminDb.collection('referrals').doc(refrId).set(payload),
    adminDb.collection('users').doc(uid).update({ myrefcode: refrId }),
  ])

  return NextResponse.json(
    { success: true, refrId, data: { refrId, ...payload } },
    { status: 201 }
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Track signup
// Body: { refrId: string, userId: string, fullname: string, email: string }
// Called from signup flow — no auth required (user hasn't logged in yet),
// but we validate the refrId exists before writing.
// ─────────────────────────────────────────────────────────────────────────────
async function handleTrackSignup(req: NextRequest) {
  let body: any
  try { body = await req.json() } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const { refrId, userId, fullname, email } = body

  if (!refrId || !userId || !fullname || !email) {
    return NextResponse.json(
      { success: false, error: 'refrId, userId, fullname and email are all required' },
      { status: 400 }
    )
  }

  const refrRef  = adminDb.collection('referrals').doc(refrId)
  const refrSnap = await refrRef.get()

  if (!refrSnap.exists) {
    return NextResponse.json(
      { success: false, error: 'Referral code not found' },
      { status: 404 }
    )
  }

  const now    = new Date()
  const dateKey = now.toISOString().slice(0, 10) // 'YYYY-MM-DD'
  const signedUpAt = now.toISOString()

  // Firestore batch: write signup sub-doc + increment counts on parent doc
  const batch = adminDb.batch()

  const signupRef = refrRef.collection('signups').doc(userId)
  batch.set(signupRef, {
    userId,
    fullname,
    email,
    signedUpAt,
  })

  batch.update(refrRef, {
    signupCount:                           FieldValue.increment(1),
    [`dailySignups.${dateKey}`]:           FieldValue.increment(1),
    updatedAt:                             signedUpAt,
  })

  await batch.commit()

  return NextResponse.json({ success: true })
}
