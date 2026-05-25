// app/api/admin/referrals/route.ts
// Admin-only — fetch all referral codes with full data, including signups.
//
// GET /api/admin/referrals                 — list all referral codes
// GET /api/admin/referrals?id={refrId}     — single referral with signup list

import { NextRequest, NextResponse } from 'next/server'
import { adminDb, adminAuth } from '@/lib/firebase-admin'

async function requireAdmin(req: NextRequest): Promise<string | null> {
  const h = req.headers.get('authorization')
  if (!h?.startsWith('Bearer ')) return null
  try {
    const decoded = await adminAuth.verifyIdToken(h.substring(7))
    const snap    = await adminDb.collection('users').doc(decoded.uid).get()
    if (snap.data()?.roles?.isAdmin !== true) return null
    return decoded.uid
  } catch {
    return null
  }
}

export async function GET(req: NextRequest) {
  const uid = await requireAdmin(req)
  if (!uid) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const refrId = req.nextUrl.searchParams.get('id')

  // ── Single referral detail with signup list ──────────────────────────────
  if (refrId) {
    const refrSnap = await adminDb.collection('referrals').doc(refrId).get()
    if (!refrSnap.exists) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
    }

    const d         = refrSnap.data()!
    const signSnap  = await adminDb
      .collection('referrals')
      .doc(refrId)
      .collection('signups')
      .orderBy('signedUpAt', 'asc')
      .get()

    const signups = signSnap.docs.map((doc) => {
      const s = doc.data()
      return {
        userId:     doc.id,
        fullname:   s.fullname,
        email:      s.email,
        signedUpAt: s.signedUpAt,
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        refrId:       refrSnap.id,
        campaignName: d.campaignName,
        ownerId:      d.ownerId,
        ownerName:    d.ownerName,
        signupCount:  d.signupCount  ?? 0,
        dailySignups: d.dailySignups ?? {},
        createdAt:    d.createdAt,
        signups,
      },
    })
  }

  // ── All referral codes ────────────────────────────────────────────────────
  const snap = await adminDb
    .collection('referrals')
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
