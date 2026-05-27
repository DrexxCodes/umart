import { NextRequest, NextResponse } from 'next/server'
import { adminDb, adminAuth } from '@/lib/firebase-admin'
import { Timestamp, FieldValue } from 'firebase-admin/firestore'
import { upsertPendingChatNotification } from '@/lib/fcm'
import { tasks } from '@trigger.dev/sdk/v3'
import type { ChatNotifyPayload } from '@/src/trigger/chat-notify'

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

    // Fetch sender info in parallel with the chat read already done above
    const senderDoc = await adminDb.collection('users').doc(userId).get()
    const senderName = senderDoc.data()?.fullname || 'User'
    const senderRoles = senderDoc.data()?.roles || {}
    const isCreator = senderRoles.isCreator || false

    const recipientId = (chatData.participantIds as string[]).find((id) => id !== userId)

    const now = Timestamp.now()
    const messageRef = adminDb.collection('chats').doc(chatId).collection('messages').doc()
    const batch = adminDb.batch()

    // ── Write message ─────────────────────────────────────────────────────────
    batch.set(messageRef, {
      senderId: userId,
      senderName,
      text: text.trim(),
      createdAt: now,
      isSystemAdmin: senderRoles.isAdmin || false,
      isCreator,
      isAI: false,
      seen: false,
    })

    // ── Update the main chat doc ──────────────────────────────────────────────
    batch.update(adminDb.collection('chats').doc(chatId), {
      lastMessage: text.trim(),
      lastMessageTime: now,
      lastMessageSenderName: senderName,
      updatedAt: now,
    })

    // ── Update each participant's chats sub-doc so ChatList sorts correctly ───
    // Also increment unreadCount on the RECIPIENT so the badge appears instantly
    // without waiting for the Firestore unseen-messages query to settle.
    for (const participantId of chatData.participantIds as string[]) {
      const isRecipient = participantId !== userId
      batch.update(
        adminDb.collection('users').doc(participantId).collection('chats').doc(chatId),
        {
          lastMessageTime: now,
          ...(isRecipient ? { unreadCount: FieldValue.increment(1) } : {}),
        }
      )
    }

    await batch.commit()

    // ── AI reply (non-blocking, fire-and-forget) ──────────────────────────────
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

    // ── Push notification via Trigger.dev (immediate, durable) ───────────────
    // upsertPendingChatNotification sets up the doc that chat-notify reads.
    // We ALWAYS trigger a new job — tasks.trigger is idempotent from the
    // sender's perspective and Trigger.dev deduplication handles race conditions.
    // The task fires immediately (no wait.for) so the push lands in seconds.
    if (recipientId) {
      const notifDocId = `${chatId}_${recipientId}`

      upsertPendingChatNotification(chatId, recipientId, userId, senderName)
        .then(async (count) => {
          // Only trigger a new Trigger.dev job on the FIRST message in the
          // debounce window (count === 1). Subsequent rapid messages just
          // increment the counter on the pendingNotifications Firestore doc —
          // the single already-queued job reads the final count when it runs.
          //
          // The task fires IMMEDIATELY (no wait.for), so the push still lands
          // in seconds. This prevents double-push when multiple messages are sent.
          if (count === 1) {
            await tasks.trigger('chat-notify', {
              notifDocId,
              chatId,
              recipientId,
              senderName,
            })
          }
        })
        .catch((err) => console.error('Push notification scheduling failed:', err))
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
