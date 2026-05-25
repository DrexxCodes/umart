// app/api/chat/notify/route.ts
//
// Called fire-and-forget from api/chat/send after a 30-second delay.
// Reads the pending notification document and sends a collapsed FCM push
// if the recipient hasn't cleared it by opening the chat.
//
// The route is idempotent — if already sent (doc deleted), it's a no-op.

import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { sendPushToUser } from '@/lib/fcm'
import { Timestamp } from 'firebase-admin/firestore'

export async function POST(req: NextRequest) {
  // Protect with a shared internal secret so this route can't be spammed publicly
  const secret = req.headers.get('x-internal-secret')
  if (secret !== process.env.INTERNAL_API_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { notifDocId } = await req.json()
  if (!notifDocId) {
    return NextResponse.json({ error: 'Missing notifDocId' }, { status: 400 })
  }

  const docRef = adminDb.collection('pendingNotifications').doc(notifDocId)
  const doc = await docRef.get()

  if (!doc.exists) {
    // Already cleared — user opened the chat, nothing to send
    return NextResponse.json({ sent: false, reason: 'cleared' })
  }

  const data = doc.data()!
  const { recipientId, senderName, chatId, messageCount } = data

  // Build collapsed notification body
  const body =
    messageCount === 1
      ? `${senderName} sent you a message`
      : `${senderName} sent you ${messageCount} messages`

  try {
    await sendPushToUser(recipientId, {
      title: 'New message on Umart',
      body,
      url: '/chat',
      tag: `chat_${chatId}`,   // collapses — one notif per chat thread
      data: { chatId },
    })
  } catch (err) {
    console.error('[chat/notify] FCM error:', err)
    // Don't throw — delete the doc regardless so we don't retry infinitely
  }

  // Clear the pending doc after sending
  await docRef.delete()

  return NextResponse.json({ sent: true, messageCount })
}
