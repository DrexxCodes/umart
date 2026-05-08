import { NextRequest, NextResponse } from 'next/server'
import { adminDb, adminAuth } from '@/lib/firebase-admin'
import { Timestamp, type QuerySnapshot, type DocumentData } from 'firebase-admin/firestore'

function serialise(val: unknown): unknown {
  if (val instanceof Timestamp) return val.toDate().toISOString()
  if (Array.isArray(val)) return val.map(serialise)
  if (val && typeof val === 'object') {
    return Object.fromEntries(
      Object.entries(val as Record<string, unknown>).map(([k, v]) => [k, serialise(v)])
    )
  }
  return val
}

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    const sessionCookie = req.cookies.get('__session')?.value

    let userId: string | null = null
    let isAdmin = false

    if (authHeader?.startsWith('Bearer ')) {
      try {
        const decoded = await adminAuth.verifyIdToken(authHeader.substring(7))
        userId = decoded.uid
        const userDoc = await adminDb.collection('users').doc(userId).get()
        isAdmin = userDoc.data()?.roles?.isAdmin === true
      } catch {
        return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 })
      }
    } else if (sessionCookie) {
      try {
        const decoded = await adminAuth.verifyIdToken(sessionCookie)
        userId = decoded.uid
        const userDoc = await adminDb.collection('users').doc(userId).get()
        isAdmin = userDoc.data()?.roles?.isAdmin === true
        if (!isAdmin) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
      } catch {
        return NextResponse.json({ success: false, error: 'Invalid session' }, { status: 401 })
      }
    } else {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = req.nextUrl
    const role = searchParams.get('role')

    let snap: QuerySnapshot<DocumentData>

    if (isAdmin || role === 'admin') {
      snap = await adminDb.collection('disputes').orderBy('createdAt', 'desc').get()
    } else if (role === 'creator') {
      snap = await adminDb
        .collection('disputes')
        .where('creatorUID', '==', userId)
        .orderBy('createdAt', 'desc')
        .get()
    } else {
      snap = await adminDb
        .collection('disputes')
        .where('buyerId', '==', userId)
        .orderBy('createdAt', 'desc')
        .get()
    }

    const disputes = snap.docs.map((doc) => serialise({ id: doc.id, ...doc.data() }))
    return NextResponse.json({ success: true, data: disputes })
  } catch (error: any) {
    console.error('[dispute/list] Error:', error)
    return NextResponse.json({ success: false, error: error.message || 'Failed to fetch disputes' }, { status: 500 })
  }
}
