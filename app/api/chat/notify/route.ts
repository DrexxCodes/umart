// app/api/chat/notify/route.ts
//
// Manual/debug trigger for sending a pending chat push notification.
// In production, Trigger.dev's 'chat-notify' task handles all push delivery
// automatically with a 30-second debounce window (see trigger/chat-notify.ts).
//
// This route is kept as a fallback for local dev (where Trigger.dev may not
// be running) and for manual retries from admin tooling.
//
// POST body: { notifDocId: string }
// Header:    x-internal-secret: <INTERNAL_API_SECRET>

import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { sendPushToUser } from '@/lib/fcm'

export async function POST(req: NextRequest) {
  // Protect with a shared internal secret
  const secret = req.headers.get('x-internal-secret')
  if (secret !== process.env.INTERNAL_API_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let notifDocId: string | undefined
  try {
    const body = await req.json()
    notifDocId = body.notifDocId
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

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

  const body =
    messageCount === 1
      ? `${senderName} sent you a message`
      : `${senderName} sent you ${messageCount} messages`

  try {
    await sendPushToUser(recipientId, {
      title: 'New message on Umart',
      body,
      url: '/chat',
      tag: `chat_${chatId}`,
      data: { chatId },
    })
  } catch (err) {
    console.error('[chat/notify] FCM error:', err)
  }

  await docRef.delete()

  return NextResponse.json({ sent: true, messageCount })
}
