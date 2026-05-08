import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { adminDb, adminAuth } from '@/lib/firebase-admin'
import { FieldValue } from 'firebase-admin/firestore'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { uid, username, fullname, email, phone } = body

    if (!uid || !username || !fullname || !email || !phone) {
      return NextResponse.json(
        { message: 'Missing required fields' },
        { status: 400 }
      )
    }

    const userDoc = {
      uid,
      username,
      fullname,
      email,
      phone,
      createdAt: new Date().toISOString(),
      roles: {
        isCreator: false,
        isAdmin: false,
      },
      restrictions: {
        isBanned: false,
        isCreatorBanned: false,
        isPaymentBanned: false,
      },
    }

    await adminDb.collection('users').doc(uid).set(userDoc)

    // ── Admin analytics — Nigerian timezone (WAT = UTC+1) ─────────────────────
    // Separate try/catch: analytics failure must never block user creation.
    //
    // createdAt must be written ONCE — on the first signup of each period —
    // and never overwritten. updatedAt is refreshed on every signup.
    //
    // Pattern: try update() first (which never touches createdAt because it's
    // not in the payload). If the doc doesn't exist yet, update() throws
    // NOT_FOUND — catch that and fall back to set() with createdAt included.
    // This costs zero reads and guarantees createdAt is immutable after first write.
    try {
      const nigerianTime = new Date(Date.now() + 60 * 60 * 1000)

      const year  = nigerianTime.getUTCFullYear().toString()
      const month = `${nigerianTime.getUTCFullYear()}-${String(nigerianTime.getUTCMonth() + 1).padStart(2, '0')}`
      const day   = `${nigerianTime.getUTCFullYear()}-${String(nigerianTime.getUTCMonth() + 1).padStart(2, '0')}-${String(nigerianTime.getUTCDate()).padStart(2, '0')}`

      const refs = [
        adminDb.collection('admin').doc('analytics').collection('daily').doc(day),
        adminDb.collection('admin').doc('analytics').collection('monthly').doc(month),
        adminDb.collection('admin').doc('analytics').collection('yearly').doc(year),
      ]

      await Promise.all(
        refs.map(async (ref) => {
          try {
            // Doc exists → update counter + updatedAt, leave createdAt untouched
            await ref.update({
              usersSignedUp: FieldValue.increment(1),
              updatedAt:     FieldValue.serverTimestamp(),
            })
          } catch (err: any) {
            const isNotFound =
              err.code === 5 ||
              err.code === 'NOT_FOUND' ||
              err.message?.includes('NOT_FOUND')

            if (isNotFound) {
              // First signup of this period — create doc and stamp createdAt once
              await ref.set({
                usersSignedUp: FieldValue.increment(1),
                createdAt:     FieldValue.serverTimestamp(),
                updatedAt:     FieldValue.serverTimestamp(),
              }, { merge: true })
            } else {
              throw err
            }
          }
        })
      )

      console.log('Signup analytics updated:', { day, month, year })
    } catch (analyticsError) {
      console.error('Error updating signup analytics:', analyticsError)
    }

    return NextResponse.json(
      { message: 'User created successfully', data: userDoc },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('Error creating user:', error)
    return NextResponse.json(
      { message: 'Failed to create user', error: error.message },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7)

      try {
        const decodedToken = await adminAuth.verifyIdToken(token)
        const uid = decodedToken.uid

        const userDoc = await adminDb.collection('users').doc(uid).get()

        if (!userDoc.exists) {
          return NextResponse.json(
            { success: false, message: 'User not found' },
            { status: 404 }
          )
        }

        return NextResponse.json(
          { success: true, data: userDoc.data() },
          { status: 200 }
        )
      } catch (error: any) {
        return NextResponse.json(
          { success: false, message: 'Invalid or expired token' },
          { status: 401 }
        )
      }
    } else {
      const uid = request.nextUrl.searchParams.get('uid')

      if (!uid) {
        return NextResponse.json(
          { success: false, message: 'Authentication required or UID parameter required' },
          { status: 400 }
        )
      }

      const userDoc = await adminDb.collection('users').doc(uid).get()

      if (!userDoc.exists) {
        return NextResponse.json(
          { success: false, message: 'User not found' },
          { status: 404 }
        )
      }

      return NextResponse.json(
        { success: true, data: userDoc.data() },
        { status: 200 }
      )
    }
  } catch (error: any) {
    console.error('Error fetching user:', error)
    return NextResponse.json(
      { success: false, message: 'Failed to fetch user', error: error.message },
      { status: 500 }
    )
  }
}