// app/api/chat/seen/route.ts
// Called when the recipient opens a chat. Marks all messages with
// seen: false that were NOT sent by the current user as seen: true.
// Also clears the pendingNotifications debounce doc so a push isn't
// sent for messages the user already read.

import { NextRequest, NextResponse } from 'next/server'
import { adminDb, adminAuth } from '@/lib/firebase-admin'

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { chatId } = await req.json()
    if (!chatId) {
      return NextResponse.json({ success: false, error: 'Missing chatId' }, { status: 400 })
    }

    const token = authHeader.replace('Bearer ', '')
    const decodedToken = await adminAuth.verifyIdToken(token)
    const userId = decodedToken.uid

    // Verify the user is a participant
    const chatSnap = await adminDb.collection('chats').doc(chatId).get()
    if (!chatSnap.exists) {
      return NextResponse.json({ success: false, error: 'Chat not found' }, { status: 404 })
    }
    const chatData = chatSnap.data()!
    if (!chatData.participantIds.includes(userId)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 })
    }

    // Find all unseen messages NOT sent by this user
    const unseenSnap = await adminDb
      .collection('chats')
      .doc(chatId)
      .collection('messages')
      .where('seen', '==', false)
      .where('senderId', '!=', userId)
      .get()

    if (!unseenSnap.empty) {
      // Firestore batch limit is 500 writes
      const BATCH_SIZE = 500
      const docs = unseenSnap.docs
      for (let i = 0; i < docs.length; i += BATCH_SIZE) {
        const batch = adminDb.batch()
        docs.slice(i, i + BATCH_SIZE).forEach((d) => batch.update(d.ref, { seen: true }))
        await batch.commit()
      }
    }

    // Clear any pending push notification for this user + chat so they
    // don't get a late-firing notification for messages they already read.
    // Also reset the unreadCount counter on the userChats sub-doc so the
    // badge clears instantly on the sender's view of the recipient's chat.
    const notifDocId = `${chatId}_${userId}`
    await Promise.all([
      adminDb.collection('pendingNotifications').doc(notifDocId).delete().catch(() => {}),
      adminDb
        .collection('users')
        .doc(userId)
        .collection('chats')
        .doc(chatId)
        .update({ unreadCount: 0 })
        .catch(() => {}),
    ])

    return NextResponse.json({ success: true, marked: unseenSnap.size })
  } catch (error: any) {
    console.error('[chat/seen] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to mark messages as seen' },
      { status: 500 }
    )
  }
}
