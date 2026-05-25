// app/api/fcm/register/route.ts
// Saves or removes an FCM token for the authenticated user.
// POST  { token } — registers a token
// DELETE { token } — removes a token (e.g. when user logs out)

import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebase-admin'
import { FieldValue } from 'firebase-admin/firestore'

async function getUid(req: NextRequest): Promise<string | null> {
  const h = req.headers.get('authorization')
  if (!h?.startsWith('Bearer ')) return null
  try {
    return (await adminAuth.verifyIdToken(h.substring(7))).uid
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  const uid = await getUid(req)
  if (!uid) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  const { token } = await req.json()
  if (!token || typeof token !== 'string') {
    return NextResponse.json({ success: false, error: 'Missing token' }, { status: 400 })
  }

  await adminDb.collection('users').doc(uid).update({
    fcmTokens: FieldValue.arrayUnion(token),
  })

  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest) {
  const uid = await getUid(req)
  if (!uid) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  const { token } = await req.json()
  if (!token) return NextResponse.json({ success: false, error: 'Missing token' }, { status: 400 })

  await adminDb.collection('users').doc(uid).update({
    fcmTokens: FieldValue.arrayRemove(token),
  })

  return NextResponse.json({ success: true })
}
