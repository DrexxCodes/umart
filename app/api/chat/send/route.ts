import { NextRequest, NextResponse } from 'next/server'
import { adminDb, adminAuth } from '@/lib/firebase-admin'
import { Timestamp, FieldValue } from 'firebase-admin/firestore'
import { upsertPendingChatNotification } from '@/lib/fcm'

export async function POST(req: NextRequest) {
  try {
    const { chatId, text } = await req.json()
    const authHeader = req.headers.get('authorization')

    if (!authHeader || !chatId || !text) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 })
    }

    const token = authHeader.replace('Bearer ', '')
    const decodedToken = await adminAuth.verifyIdToken(token)
    const userId = decodedToken.uid

    const chatSnapshot = await adminDb.collection('chats').doc(chatId).get()
    if (!chatSnapshot.exists) {
      return NextResponse.json({ success: false, error: 'Chat not found' }, { status: 404 })
    }

    const chatData = chatSnapshot.data()!
    if (!chatData.participantIds.includes(userId)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 })
    }

    const senderDoc = await adminDb.collection('users').doc(userId).get()
    const senderName = senderDoc.data()?.fullname || 'User'
    const senderRoles = senderDoc.data()?.roles || {}
    const isCreator = senderRoles.isCreator || false

    const now = Timestamp.now()
    const messageRef = adminDb.collection('chats').doc(chatId).collection('messages').doc()
    const batch = adminDb.batch()

    // ── Write message with seen: false so the recipient can track unread ──
    batch.set(messageRef, {
      senderId: userId,
      senderName,
      text: text.trim(),
      createdAt: now,
      isSystemAdmin: senderRoles.isAdmin || false,
      isCreator,
      isAI: false,
      seen: false,          // <-- NEW: unread by default
    })

    // ── Update the main chat doc ──
    batch.update(adminDb.collection('chats').doc(chatId), {
      lastMessage: text.trim(),
      lastMessageTime: now,
      lastMessageSenderName: senderName,
      updatedAt: now,
    })

    // ── Update each participant's chats sub-doc lastMessageTime so the
    //    ChatList can sort by it in real time ────────────────────────────
    for (const participantId of chatData.participantIds as string[]) {
      batch.update(
        adminDb.collection('users').doc(participantId).collection('chats').doc(chatId),
        { lastMessageTime: now }
      )
    }

    await batch.commit()

    // ── AI reply (non-blocking) ────────────────────────────────────────────
    if (!isCreator && !senderRoles.isAdmin) {
      const aiEnabled = chatData.aiEnabled ?? false
      const humanTookOver = chatData.humanTookOver ?? false
      if (aiEnabled && !humanTookOver) {
        fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/chat/ai-reply`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chatId, buyerMessage: text.trim() }),
        }).catch((err) => console.error('AI reply trigger failed:', err))
      }
    }

    // ── Push notification (non-blocking, 30-second debounce) ───────────────
    const recipientId = chatData.participantIds.find((id: string) => id !== userId)
    if (recipientId) {
      const notifDocId = `${chatId}_${recipientId}`
      upsertPendingChatNotification(chatId, recipientId, userId, senderName)
        .then((count) => {
          if (count === 1) {
            setTimeout(() => {
              fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/chat/notify`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'x-internal-secret': process.env.INTERNAL_API_SECRET || '',
                },
                body: JSON.stringify({ notifDocId }),
              }).catch((err) => console.error('Chat notify trigger failed:', err))
            }, 30_000)
          }
        })
        .catch((err) => console.error('upsertPendingChatNotification failed:', err))
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          id: messageRef.id,
          senderId: userId,
          text: text.trim(),
          createdAt: new Date(),
        },
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('Error sending message:', error)
    return NextResponse.json({ success: false, error: error.message || 'Failed to send message' }, { status: 500 })
  }
}
