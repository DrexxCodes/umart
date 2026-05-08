import { NextRequest, NextResponse } from 'next/server'
import { adminDb, adminAuth } from '@/lib/firebase-admin'
import { FieldValue } from 'firebase-admin/firestore'

// ── GET /admin/api/users ────────────────────────────────────────────────────
// Query params:
//   ?email=...     → search by email (exact match)
//   ?phone=...     → search by phone (exact match)
//   ?fullname=...  → search by fullname (case-insensitive prefix)
//   ?count=true    → return only the total user count (single read)
// ───────────────────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl

    // ── User count (single read via count()) ──────────────────────────────
    if (searchParams.get('count') === 'true') {
      const snapshot = await adminDb.collection('users').count().get()
      return NextResponse.json({ success: true, count: snapshot.data().count }, { status: 200 })
    }

    const email    = searchParams.get('email')?.trim()
    const phone    = searchParams.get('phone')?.trim()
    const fullname = searchParams.get('fullname')?.trim()

    if (!email && !phone && !fullname) {
      return NextResponse.json(
        { success: false, message: 'Provide at least one search param: email, phone, or fullname' },
        { status: 400 }
      )
    }

    let query: FirebaseFirestore.Query = adminDb.collection('users')

    if (email) {
      query = query.where('email', '==', email)
    } else if (phone) {
      query = query.where('phone', '==', phone)
    } else if (fullname) {
      // Prefix search: fullname >= term AND fullname < term + '\uf8ff'
      query = query
        .where('fullname', '>=', fullname)
        .where('fullname', '<', fullname + '\uf8ff')
        .limit(20)
    }

    const snapshot = await query.get()

    if (snapshot.empty) {
      return NextResponse.json({ success: false, message: 'No users found' }, { status: 404 })
    }

    const users = snapshot.docs.map((doc) => doc.data())

    return NextResponse.json({ success: true, data: users }, { status: 200 })
  } catch (error: any) {
    console.error('Admin GET /api/users error:', error)
    return NextResponse.json(
      { success: false, message: 'Failed to fetch users', error: error.message },
      { status: 500 }
    )
  }
}

// ── POST /admin/api/users ───────────────────────────────────────────────────
// Body must include `uid` and `action`.
//
// Actions:
//   creator_status         → toggle roles.isCreator          (requires `value: boolean`)
//   user_status            → toggle restrictions.isBanned     (requires `value: boolean`)
//   admin_status           → toggle roles.isAdmin             (requires `value: boolean`)
//   creator_banned_status  → toggle restrictions.isCreatorBanned  (requires `value: boolean`)
//   payment_banned_status  → toggle restrictions.isPaymentBanned  (requires `value: boolean`)
//   delete_user            → delete Firestore doc + Firebase Auth account
//   password_reset         → generate a password-reset link and return it
// ───────────────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { uid, action, value } = body

    if (!uid || !action) {
      return NextResponse.json(
        { success: false, message: 'uid and action are required' },
        { status: 400 }
      )
    }

    const userRef = adminDb.collection('users').doc(uid)

    switch (action) {
      // ── Role / restriction toggles ─────────────────────────────────────
      case 'creator_status': {
        if (typeof value !== 'boolean') {
          return NextResponse.json({ success: false, message: 'value must be a boolean' }, { status: 400 })
        }
        await userRef.update({ 'roles.isCreator': value, updatedAt: FieldValue.serverTimestamp() })
        return NextResponse.json({ success: true, message: `Creator status set to ${value}` }, { status: 200 })
      }

      case 'user_status': {
        if (typeof value !== 'boolean') {
          return NextResponse.json({ success: false, message: 'value must be a boolean' }, { status: 400 })
        }
        await userRef.update({ 'restrictions.isBanned': value, updatedAt: FieldValue.serverTimestamp() })
        // Also disable / enable the Firebase Auth account
        await adminAuth.updateUser(uid, { disabled: value })
        return NextResponse.json({ success: true, message: `User ban status set to ${value}` }, { status: 200 })
      }

      case 'admin_status': {
        if (typeof value !== 'boolean') {
          return NextResponse.json({ success: false, message: 'value must be a boolean' }, { status: 400 })
        }
        await userRef.update({ 'roles.isAdmin': value, updatedAt: FieldValue.serverTimestamp() })
        return NextResponse.json({ success: true, message: `Admin status set to ${value}` }, { status: 200 })
      }

      case 'creator_banned_status': {
        if (typeof value !== 'boolean') {
          return NextResponse.json({ success: false, message: 'value must be a boolean' }, { status: 400 })
        }
        await userRef.update({ 'restrictions.isCreatorBanned': value, updatedAt: FieldValue.serverTimestamp() })
        return NextResponse.json({ success: true, message: `Creator ban status set to ${value}` }, { status: 200 })
      }

      case 'payment_banned_status': {
        if (typeof value !== 'boolean') {
          return NextResponse.json({ success: false, message: 'value must be a boolean' }, { status: 400 })
        }
        await userRef.update({ 'restrictions.isPaymentBanned': value, updatedAt: FieldValue.serverTimestamp() })
        return NextResponse.json({ success: true, message: `Payment ban status set to ${value}` }, { status: 200 })
      }

      // ── Delete user ────────────────────────────────────────────────────
      case 'delete_user': {
        await userRef.delete()
        await adminAuth.deleteUser(uid)
        return NextResponse.json({ success: true, message: 'User deleted from Firestore and Auth' }, { status: 200 })
      }

      // ── Password reset link ────────────────────────────────────────────
      case 'password_reset': {
        // Fetch the email from Firestore so the caller doesn't have to pass it
        const userDoc = await userRef.get()
        if (!userDoc.exists) {
          return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 })
        }
        const email = userDoc.data()?.email
        if (!email) {
          return NextResponse.json({ success: false, message: 'User has no email on record' }, { status: 400 })
        }
        const resetLink = await adminAuth.generatePasswordResetLink(email)
        return NextResponse.json({ success: true, resetLink }, { status: 200 })
      }

      default:
        return NextResponse.json(
          { success: false, message: `Unknown action: ${action}` },
          { status: 400 }
        )
    }
  } catch (error: any) {
    console.error('Admin POST /api/users error:', error)
    return NextResponse.json(
      { success: false, message: 'Action failed', error: error.message },
      { status: 500 }
    )
  }
}