// app/api/users/me/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { adminDb, adminAuth } from '@/lib/firebase-admin'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
  }

  let uid: string
  try {
    const decoded = await adminAuth.verifyIdToken(authHeader.substring(7))
    uid = decoded.uid
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid or expired token' }, { status: 401 })
  }

  try {
    const snap = await adminDb.collection('users').doc(uid).get()

    if (!snap.exists) {
      return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: snap.data() }, { status: 200 })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: 'Failed to fetch user', error: error.message },
      { status: 500 }
    )
  }
}