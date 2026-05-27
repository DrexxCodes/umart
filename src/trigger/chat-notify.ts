// trigger/chat-notify.ts
//
// Trigger.dev v3 task — debounced FCM push notification for chat messages.
//
// Flow:
//   1. api/chat/send calls tasks.trigger('chat-notify', payload) on the first
//      message in a burst (messageCount goes 0 → 1).
//   2. This task waits 20 seconds durably (survives Vercel timeouts).
//   3. Reads the pendingNotifications doc from Firestore.
//   4. If still there → recipient hasn't opened the chat → send FCM push.
//   5. If gone → recipient opened the chat, seen route cleared it → no-op.
//
// IMPORTANT — env vars required in Trigger.dev dashboard:
//   FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY

import { task, wait, logger } from '@trigger.dev/sdk/v3'
import * as admin from 'firebase-admin'

// ── Firebase Admin init ───────────────────────────────────────────────────────
// Uses the namespace import (import * as admin) — same as lib/firebase-admin.ts.
// The subpackage imports (firebase-admin/app etc.) can fail in Trigger.dev's
// bundler. The namespace import is the safe, tested pattern.

function initAdmin(): void {
  if (admin.apps.length > 0) return

  const projectId   = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const privateKey  = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      '[chat-notify] Missing Firebase Admin env vars. ' +
      'Add FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY ' +
      'to Environment Variables in your Trigger.dev project dashboard.'
    )
  }

  admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
  })
}

// ── Task payload ──────────────────────────────────────────────────────────────

export interface ChatNotifyPayload {
  /** Firestore doc ID: `${chatId}_${recipientId}` */
  notifDocId: string
  chatId: string
  recipientId: string
  senderName: string
}

// ── Task ──────────────────────────────────────────────────────────────────────

export const chatNotifyTask = task({
  id: 'chat-notify',

  retry: {
    maxAttempts: 2,
    minTimeoutInMs: 5_000,
    maxTimeoutInMs: 15_000,
  },

  run: async (payload: ChatNotifyPayload) => {
    const { notifDocId, chatId, recipientId, senderName } = payload

    logger.info('chat-notify started', { notifDocId, chatId, recipientId, senderName })

    // ── 1. Wait 20 seconds durably ────────────────────────────────────────────
    await wait.for({ seconds: 20 })
    logger.info('30s wait complete, checking pendingNotifications doc')

    // ── 2. Init Firebase Admin ────────────────────────────────────────────────
    initAdmin()
    const db = admin.firestore()

    // ── 3. Read the pendingNotifications doc ──────────────────────────────────
    const docRef = db.collection('pendingNotifications').doc(notifDocId)
    const doc    = await docRef.get()

    if (!doc.exists) {
      logger.info('Pending doc already cleared — user opened the chat before 30s', { notifDocId })
      return { sent: false, reason: 'cleared' }
    }

    // Read ALL fields from the doc — recipientId comes from the doc itself,
    // not the payload, to ensure we're using the exact value Firestore wrote.
    const docData = doc.data()!
    logger.info('Pending doc contents', { docData })

    const confirmedRecipientId: string = docData.recipientId
    const messageCount: number         = docData.messageCount ?? 1

    if (!confirmedRecipientId) {
      logger.error('pendingNotifications doc is missing recipientId field', { docData })
      await docRef.delete()
      return { sent: false, reason: 'missing-recipient-id' }
    }

    // ── 4. Look up recipient's FCM tokens from users/{uid}.fcmTokens ─────────
    // The FCM register API (app/api/fcm/register/route.ts) stores tokens at:
    //   users/{uid} → fcmTokens: string[]   (via FieldValue.arrayUnion)
    logger.info('Looking up FCM tokens', { uid: confirmedRecipientId })

    const userDoc = await db.collection('users').doc(confirmedRecipientId).get()

    if (!userDoc.exists) {
      logger.error('User doc not found', { uid: confirmedRecipientId })
      await docRef.delete()
      return { sent: false, reason: 'user-not-found' }
    }

    logger.info('User doc found', { userData: userDoc.data() })

    const tokens: string[] = userDoc.data()?.fcmTokens ?? []

    if (tokens.length === 0) {
      logger.warn('User has no FCM tokens — they have not granted notification permission', {
        uid: confirmedRecipientId,
      })
      await docRef.delete()
      return { sent: false, reason: 'no-tokens' }
    }

    logger.info('FCM tokens found', { count: tokens.length })

    // ── 5. Build the notification body ────────────────────────────────────────
    const body =
      messageCount === 1
        ? `${senderName} sent you a message`
        : `${senderName} sent you ${messageCount} messages`

    // ── 6. Send FCM multicast push ────────────────────────────────────────────
    const message: admin.messaging.MulticastMessage = {
      tokens,
      notification: {
        title: 'New message on Umart',
        body,
      },
      webpush: {
        notification: {
          title:    'New message on Umart',
          body,
          icon:     '/icon-192x192.png',
          badge:    '/badge-72x72.png',
          tag:      `chat_${chatId}`,
          renotify: true,
        },
        fcmOptions: {
          link: '/chat',
        },
      },
      // data values must all be strings
      data: {
        url:    '/chat',
        chatId: chatId,
      },
    }

    logger.info('Sending FCM multicast', { tokenCount: tokens.length })
    const response = await admin.messaging().sendEachForMulticast(message)

    logger.info('FCM response', {
      successCount: response.successCount,
      failureCount: response.failureCount,
    })

    // ── 7. Log failures and prune stale tokens ────────────────────────────────
    const stale: string[] = []
    response.responses.forEach((res, i) => {
      if (!res.success) {
        logger.warn('FCM send failed for token', {
          index:        i,
          errorCode:    res.error?.code,
          errorMessage: res.error?.message,
        })
        const code = res.error?.code
        if (
          code === 'messaging/registration-token-not-registered' ||
          code === 'messaging/invalid-registration-token'
        ) {
          stale.push(tokens[i])
        }
      }
    })

    if (stale.length > 0) {
      logger.info('Pruning stale FCM tokens', { count: stale.length })
      await db.collection('users').doc(confirmedRecipientId).update({
        fcmTokens: admin.firestore.FieldValue.arrayRemove(...stale),
      })
    }

    // ── 8. Clear the pending doc ──────────────────────────────────────────────
    await docRef.delete()
    logger.info('Pending doc cleared')

    return {
      sent:         response.successCount > 0,
      messageCount,
      recipientId:  confirmedRecipientId,
      successCount: response.successCount,
      failureCount: response.failureCount,
    }
  },
})
