// lib/fcm.ts — FCM push notification helpers (server-side)
//
// Handles sending push notifications via Firebase Admin Messaging.
// Tokens are stored per-user as an array in users/{uid}.fcmTokens
// to support multi-device scenarios.

import admin, { adminMessaging, adminDb } from './firebase-admin'
import { FieldValue } from 'firebase-admin/firestore'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface PushPayload {
  title: string
  body: string
  url?: string   // click action — where to navigate when notification is tapped
  tag?: string   // notification tag for collapsing (same tag = replace existing)
  data?: Record<string, string>
}

// ── Send to a single user ──────────────────────────────────────────────────────
// Looks up the user's FCM tokens and fans out to all of them.
// Automatically prunes stale/invalid tokens.

export async function sendPushToUser(uid: string, payload: PushPayload): Promise<void> {
  const userDoc = await adminDb.collection('users').doc(uid).get()
  const tokens: string[] = userDoc.data()?.fcmTokens ?? []

  if (tokens.length === 0) return

  const message = buildMulticastMessage(tokens, payload)
  const response = await adminMessaging.sendEachForMulticast(message)

  // Prune tokens that are no longer valid
  const staleTokens: string[] = []
  response.responses.forEach((res, i) => {
    if (!res.success) {
      const code = res.error?.code
      if (
        code === 'messaging/registration-token-not-registered' ||
        code === 'messaging/invalid-registration-token'
      ) {
        staleTokens.push(tokens[i])
      }
    }
  })

  if (staleTokens.length > 0) {
    await adminDb.collection('users').doc(uid).update({
      fcmTokens: FieldValue.arrayRemove(...staleTokens),
    })
  }
}

// ── Send to multiple users ─────────────────────────────────────────────────────

export async function sendPushToUsers(uids: string[], payload: PushPayload): Promise<void> {
  await Promise.allSettled(uids.map((uid) => sendPushToUser(uid, payload)))
}

// ── Build multicast message ────────────────────────────────────────────────────

function buildMulticastMessage(
  tokens: string[],
  payload: PushPayload
): admin.messaging.MulticastMessage {
  return {
    tokens,
    notification: {
      title: payload.title,
      body: payload.body,
    },
    webpush: {
      notification: {
        title: payload.title,
        body: payload.body,
        icon: '/icon-192x192.png',
        badge: '/badge-72x72.png',
        tag: payload.tag,                  // collapses notifications with the same tag
        renotify: true,                    // buzz even if replacing an existing tag
        data: {
          url: payload.url ?? '/',
          ...payload.data,
        },
      },
      fcmOptions: {
        link: payload.url ?? '/',
      },
    },
    data: {
      url: payload.url ?? '/',
      ...payload.data,
    },
  }
}

// ── Chat-specific: collapsible message notification ───────────────────────────
// Called from api/chat/send. Uses a debounce document in Firestore so that
// multiple rapid messages collapse into one "X sent N messages" notification.
//
// Flow:
//   1. On each message send, upsert a pending notification doc.
//   2. Schedule a Cloud Function / API route to fire 30s later.
//   3. When the scheduled route fires, check if the recipient is active.
//      If not, send the collapsed notification and clear the pending doc.
//
// Since we don't have Cloud Functions, we simulate the delay by calling
// /api/chat/notify from the send route (fire-and-forget, delayed by 30s
// via a Vercel Edge Function or a simple setTimeout on a long-lived route).
// The notify route is idempotent — safe to call multiple times.

export interface PendingChatNotification {
  recipientId: string
  senderName: string
  senderId: string
  chatId: string
  messageCount: number
  firstPendingAt: FirebaseFirestore.Timestamp
  lastPendingAt: FirebaseFirestore.Timestamp
}

// Upsert the pending notification counter in Firestore.
// Returns the updated message count.
export async function upsertPendingChatNotification(
  chatId: string,
  recipientId: string,
  senderId: string,
  senderName: string
): Promise<number> {
  const { Timestamp, FieldValue: FV } = await import('firebase-admin/firestore')
  const docRef = adminDb
    .collection('pendingNotifications')
    .doc(`${chatId}_${recipientId}`)

  const existing = await docRef.get()
  if (existing.exists) {
    await docRef.update({
      messageCount: FV.increment(1),
      lastPendingAt: Timestamp.now(),
      senderName,
    })
    return (existing.data()!.messageCount ?? 0) + 1
  } else {
    const now = Timestamp.now()
    await docRef.set({
      recipientId,
      senderId,
      senderName,
      chatId,
      messageCount: 1,
      firstPendingAt: now,
      lastPendingAt: now,
    })
    return 1
  }
}
