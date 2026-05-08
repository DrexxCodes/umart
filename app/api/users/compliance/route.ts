// app/api/users/compliance/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { adminDb, adminAuth } from '@/lib/firebase-admin'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'

async function getUid(req: NextRequest): Promise<string | null> {
  const header = req.headers.get('authorization')
  if (!header?.startsWith('Bearer ')) return null
  try {
    const decoded = await adminAuth.verifyIdToken(header.substring(7))
    return decoded.uid
  } catch {
    return null
  }
}

// Sections required for compliance to be complete
const REQUIRED_SECTIONS = ['identification', 'passport', 'address'] as const

// ── GET — return compliance status for the logged-in user ─────────────────────
// Returns: { complete: boolean, sections: { identification, passport, address } }
export async function GET(req: NextRequest) {
  const uid = await getUid(req)
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const snap = await adminDb
      .collection('compliance_info')
      .doc(uid)
      .collection('data')
      .doc('record')
      .get()

    if (!snap.exists) {
      return NextResponse.json({
        success: true,
        complete: false,
        sections: { identification: false, passport: false, address: false },
        data: null,
      })
    }

    const d = snap.data()!

    const sections = {
      identification: Boolean(d.identificationType && (d.ninNumber || d.bvnNumber)),
      passport:       Boolean(d.faceImageUrl && d.faceWithHandImageUrl),
      address:        Boolean(d.addressText && d.addressProofUrl),
    }

    const complete = REQUIRED_SECTIONS.every((s) => sections[s])

    // Serialise Timestamps
    function ser(v: unknown): unknown {
      if (v instanceof Timestamp) return v.toDate().toISOString()
      if (Array.isArray(v)) return v.map(ser)
      if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v as any).map(([k, val]) => [k, ser(val)]))
      return v
    }

    return NextResponse.json({ success: true, complete, sections, data: ser(d) })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// ── POST — upsert one or more compliance fields ───────────────────────────────
// Body keys (all optional — send whatever section you're updating):
//   identification: { identificationType, ninNumber?, bvnNumber?, ninImageUrl?, ninImagePublicId? }
//   passport:       { faceImageUrl, faceImagePublicId, faceWithHandImageUrl, faceWithHandImagePublicId }
//   address:        { addressText, addressProofUrl, addressProofPublicId }
export async function POST(req: NextRequest) {
  const uid = await getUid(req)
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const ref = adminDb
    .collection('compliance_info')
    .doc(uid)
    .collection('data')
    .doc('record')

  const update: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() }

  // ── Identification ─────────────────────────────────────────────────────────
  if (body.section === 'identification') {
    const { identificationType, ninNumber, bvnNumber, ninImageUrl, ninImagePublicId } = body as any
    if (!identificationType || !['NIN', 'BVN'].includes(identificationType)) {
      return NextResponse.json({ error: 'identificationType must be NIN or BVN' }, { status: 400 })
    }
    if (identificationType === 'NIN' && !ninNumber) {
      return NextResponse.json({ error: 'ninNumber is required for NIN' }, { status: 400 })
    }
    if (identificationType === 'BVN' && !bvnNumber) {
      return NextResponse.json({ error: 'bvnNumber is required for BVN' }, { status: 400 })
    }
    Object.assign(update, {
      identificationType,
      ninNumber:        ninNumber        ?? null,
      bvnNumber:        bvnNumber        ?? null,
      ninImageUrl:      ninImageUrl      ?? null,
      ninImagePublicId: ninImagePublicId ?? null,
    })
  }

  // ── Passport (face + face-with-hand) ───────────────────────────────────────
  else if (body.section === 'passport') {
    const { faceImageUrl, faceImagePublicId, faceWithHandImageUrl, faceWithHandImagePublicId } = body as any
    if (!faceImageUrl || !faceWithHandImageUrl) {
      return NextResponse.json({ error: 'Both faceImageUrl and faceWithHandImageUrl are required' }, { status: 400 })
    }
    Object.assign(update, { faceImageUrl, faceImagePublicId, faceWithHandImageUrl, faceWithHandImagePublicId })
  }

  // ── Address ────────────────────────────────────────────────────────────────
  else if (body.section === 'address') {
    const { addressText, addressProofUrl, addressProofPublicId } = body as any
    if (!addressText || !addressProofUrl) {
      return NextResponse.json({ error: 'addressText and addressProofUrl are required' }, { status: 400 })
    }
    Object.assign(update, { addressText, addressProofUrl, addressProofPublicId: addressProofPublicId ?? null })
  }

  // ── Become creator — only allowed when all sections complete ───────────────
  else if (body.section === 'activate_creator') {
    // Re-check compliance
    const snap = await ref.get()
    if (!snap.exists) return NextResponse.json({ error: 'Compliance incomplete' }, { status: 400 })
    const d = snap.data()!
    const allDone =
      d.identificationType && (d.ninNumber || d.bvnNumber) &&
      d.faceImageUrl && d.faceWithHandImageUrl &&
      d.addressText && d.addressProofUrl

    if (!allDone) return NextResponse.json({ error: 'All compliance sections must be complete before becoming a creator' }, { status: 400 })

    // Set isCreator on user doc
    await adminDb.collection('users').doc(uid).update({
      'roles.isCreator': true,
      updatedAt: FieldValue.serverTimestamp(),
    })
    // Stamp compliance record
    await ref.set({ ...update, activatedAt: FieldValue.serverTimestamp() }, { merge: true })
    return NextResponse.json({ success: true, message: 'Creator status granted' })
  }

  else {
    return NextResponse.json({ error: 'section must be identification | passport | address | activate_creator' }, { status: 400 })
  }

  // First write — set createdAt once
  const existing = await ref.get()
  if (!existing.exists) update.createdAt = FieldValue.serverTimestamp()

  await ref.set(update, { merge: true })

  return NextResponse.json({ success: true })
}