// app/api/admin/compliance/route.ts
//
// GET /api/admin/compliance?uid=...
// Admin-only — fetches any user's compliance record directly via adminDb.
// Auth: __session cookie (same pattern as all other admin API routes).

import { NextRequest, NextResponse } from 'next/server'
import { adminDb, adminAuth } from '@/lib/firebase-admin'
import { Timestamp } from 'firebase-admin/firestore'

function ser(v: unknown): unknown {
  if (v instanceof Timestamp) return v.toDate().toISOString()
  if (Array.isArray(v)) return v.map(ser)
  if (v && typeof v === 'object')
    return Object.fromEntries(Object.entries(v as any).map(([k, val]) => [k, ser(val)]))
  return v
}

async function verifyAdmin(req: NextRequest): Promise<string | null> {
  const token = req.cookies.get('__session')?.value
  if (!token) return null
  try {
    const decoded = await adminAuth.verifyIdToken(token)
    const snap    = await adminDb.collection('users').doc(decoded.uid).get()
    if (!snap.exists || snap.data()?.roles?.isAdmin !== true) return null
    return decoded.uid
  } catch {
    return null
  }
}

export async function GET(req: NextRequest) {
  const callerUid = await verifyAdmin(req)
  if (!callerUid) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const targetUid = req.nextUrl.searchParams.get('uid')?.trim()
  if (!targetUid) {
    return NextResponse.json({ success: false, error: 'uid query param is required' }, { status: 400 })
  }

  try {
    const snap = await adminDb
      .collection('compliance_info')
      .doc(targetUid)
      .collection('data')
      .doc('record')
      .get()

    if (!snap.exists) {
      return NextResponse.json({
        success:  true,
        complete: false,
        sections: { identification: false, passport: false, address: false },
        data:     null,
      })
    }

    const d = snap.data()!

    const sections = {
      identification: Boolean(d.identificationType && (d.ninNumber || d.bvnNumber)),
      passport:       Boolean(d.faceImageUrl && d.faceWithHandImageUrl),
      address:        Boolean(d.addressText && d.addressProofUrl),
    }

    return NextResponse.json({
      success:  true,
      complete: Object.values(sections).every(Boolean),
      sections,
      data:     ser(d),
    })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}