# Umart — Push Notifications & Chat Seen Receipts

## Overview of changes in this update

| Area | What changed |
|---|---|
| `public/firebase-messaging-sw.js` | Simplified init logic — `initIfNeeded` calls `setupMessaging()` immediately after Firebase init. Removed unreliable polling interval. |
| `components/service-worker-registrar.tsx` | **FCM SW now registered at scope `/firebase-messaging-sw/`** — unique scope prevents conflict with the PWA cache SW at `/`. |
| `components/fcm-permission-prompt.tsx` | `getToken()` now passes the explicit `serviceWorkerRegistration` so Firebase uses the correct FCM SW on iOS. |
| `app/api/chat/send/route.ts` | Each new message gets `seen: false`. Also updates `lastMessageTime` on both users' `/users/{uid}/chats/{chatId}` sub-docs so the list sorts correctly. |
| `app/api/chat/seen/route.ts` | **New route** — marks all unseen messages as seen and clears the debounce push-notification doc. |
| `app/chat/components/ChatList.tsx` | Sorts by `lastMessageTime` desc (newest conversation first). Shows unread badge and eye icon per conversation. Listens to unseen message count in real time. |
| `app/chat/components/ChatArea.tsx` | Calls `/api/chat/seen` when a chat is opened. Passes `seen` prop to `ChatSenderBubble`. |
| `app/chat/components/ChatSenderBubble.tsx` | Shows eye icon + "Seen"/"Sent" label under timestamp. |

---

## Part 1 — FCM Push Notifications on iOS PWA

### Why notifications weren't working

**Root cause: two service workers fighting over the same scope.**

Both `sw.js` (PWA cache) and `firebase-messaging-sw.js` were registered at `scope: '/'`. On iOS Safari's WebKit engine, only one service worker can control a given scope at a time. The result was that the FCM service worker either didn't activate, or its push handler was never set up.

A secondary issue: `getToken()` was called without specifying _which_ SW registration to use, so Firebase would pick the wrong one (the cache SW, which has no messaging handler).

### Fix summary

1. The FCM SW is now registered at `scope: '/firebase-messaging-sw/'` — a unique path it alone controls.
2. `getToken()` is called with `serviceWorkerRegistration` pointing at the FCM SW's registration.
3. The FCM SW's `initIfNeeded()` now calls `setupMessaging()` immediately after `firebase.initializeApp()`.

---

## Part 2 — Complete Setup Guide

### Prerequisites

- Firebase project with Cloud Messaging enabled
- VAPID key generated in Firebase Console → Project Settings → Cloud Messaging → Web Push certificates
- App deployed to HTTPS (required for service workers and push on iOS)

---

### Step 1 — Environment variables

Add these to `.env.local` (and your Vercel/deployment env):

```env
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
NEXT_PUBLIC_FIREBASE_VAPID_KEY=...   ← required for push

INTERNAL_API_SECRET=some-long-random-secret   ← used by /api/chat/notify
```

> **VAPID key:** Firebase Console → Project Settings → Cloud Messaging tab → Web Push certificates → Generate key pair. Copy the Key pair value.

---

### Step 2 — Firebase Admin service account

Push notifications are sent server-side via `firebase-admin`. Ensure your server env has:

```env
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@project.iam.gserviceaccount.com
FIREBASE_PROJECT_ID=your-project-id
```

Or store the full JSON as `FIREBASE_SERVICE_ACCOUNT_JSON` and parse it in `lib/firebase-admin.ts`.

---

### Step 3 — Deploy the service workers

Both service worker files live in `/public` and are served as static files — no build step needed.

| File | Scope | Purpose |
|---|---|---|
| `/public/sw.js` | `/` | PWA install, offline caching |
| `/public/firebase-messaging-sw.js` | `/firebase-messaging-sw/` | FCM background push |

After deploying, verify both are served at their paths:
```
https://yourdomain.com/sw.js
https://yourdomain.com/firebase-messaging-sw.js
```

---

### Step 4 — iOS-specific: Add to Home Screen

iOS Safari only supports push notifications for **installed PWAs** (Added to Home Screen). Standalone browser tabs do NOT receive push.

**Requirements for iOS push to work:**
1. iOS 16.4 or later
2. App must be **added to the Home Screen** (Share → Add to Home Screen)
3. User must **grant notification permission** from inside the installed PWA
4. App must be served over **HTTPS** with a valid SSL certificate

**To verify iOS push is working:**
1. Open Safari on iPhone → navigate to your app URL
2. Tap Share → Add to Home Screen
3. Open the installed app from Home Screen (not Safari)
4. The permission prompt should appear after 1.5 seconds
5. Tap Allow → confirm in the iOS system prompt
6. Send a message from another device
7. Lock the phone — within ~30 seconds the notification should appear

---

### Step 5 — Firestore security rules

Add these rules for the new `seen` field and `pendingNotifications` collection:

```js
// chats/{chatId}/messages
match /chats/{chatId}/messages/{messageId} {
  allow read: if isParticipant(chatId);
  allow create: if isParticipant(chatId);
  // Allow participants to mark messages as seen
  allow update: if isParticipant(chatId)
    && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['seen']);
}

// pendingNotifications — server-only (Admin SDK bypasses rules)
match /pendingNotifications/{docId} {
  allow read, write: if false; // server-side only
}
```

---

### Step 6 — Firestore indexes

The new ChatList query uses `orderBy('lastMessageTime', 'desc')` on `users/{uid}/chats`. Add this composite index if Firestore complains:

```
Collection: users/{uid}/chats   (subcollection)
Fields: lastMessageTime DESC
```

The unread count query in ChatList uses:
```
Collection: chats/{chatId}/messages
Fields: seen ASC, senderId ASC
```

Create these indexes in Firebase Console → Firestore → Indexes → Composite, or follow the link in the browser console error when the query first runs.

---

### Step 7 — Verify token registration

After a user grants permission, their FCM token is saved to `users/{uid}.fcmTokens` (array). You can verify this in Firestore Console.

**Debug push in browser:**
```js
// In browser console (with notification permission granted)
navigator.serviceWorker.getRegistrations().then(regs => {
  console.log('Registered SWs:', regs.map(r => r.scope))
})
// Expected output:
// ["https://yourdomain.com/", "https://yourdomain.com/firebase-messaging-sw/"]
```

---

### Step 8 — Test end-to-end

1. Open two browsers (or incognito + normal) logged in as different users
2. Start a chat between them
3. User A sends a message to User B
4. Within 30 seconds, User B should receive a push notification titled "New message on Umart"
5. If User B has the app open, they see a toast instead

**Debug checklist if push isn't received:**
- [ ] Check `users/{uid}.fcmTokens` array is non-empty in Firestore
- [ ] Verify `NEXT_PUBLIC_FIREBASE_VAPID_KEY` is set correctly in production env
- [ ] Confirm `INTERNAL_API_SECRET` matches between `send` route and `notify` route
- [ ] On iOS: confirm app was launched from Home Screen (not Safari address bar)
- [ ] Check Vercel function logs for `/api/chat/notify` errors
- [ ] Open Firebase Console → Cloud Messaging → Send test message to a specific token

---

## Part 3 — Chat Seen Receipts

### How it works

**On send:** Every new message is written with `seen: false`.

**On open:** When User B opens a conversation, `POST /api/chat/seen` fires and batch-updates all messages where `seen == false AND senderId != userId` to `seen: true`. It also deletes the `pendingNotifications` debounce doc so User B doesn't get a late push for messages they already read.

**In the UI:**
- `ChatSenderBubble` shows a small eye icon + label under the timestamp:
  - Grey eye + "Sent" = recipient hasn't opened the chat yet
  - Blue eye + "Seen" = recipient has opened the chat
- `ChatList` shows a blue unread count badge (e.g. `3`) on conversations with unread messages
- The eye icon in the conversation list row shows when all messages are read
- Conversations with unread messages sort to the top automatically

### Firestore structure

```
chats/{chatId}/messages/{messageId}
  senderId: string
  senderName: string
  text: string
  createdAt: Timestamp
  seen: boolean        ← NEW
  isAI: boolean
  isCreator: boolean
  isSystemAdmin: boolean

users/{uid}/chats/{chatId}
  chatId: string
  participantId: string
  participantName: string
  createdAt: Timestamp
  lastMessageTime: Timestamp   ← NEW (written by send API for both participants)
```

---

## Part 4 — Conversation ordering

Previously the ChatList ordered by `createdAt` on the user's chats sub-doc — this is the time the conversation was **created**, not when the last message was sent. So new conversations would not bubble to the top.

**Fix:** The `send` route now updates `lastMessageTime` on **both** participants' `/users/{uid}/chats/{chatId}` sub-docs. The ChatList orders by `lastMessageTime DESC`, so whichever conversation had the most recent message always appears first — matching the behaviour of WhatsApp, iMessage, etc.

---

## Known limitations

- **iOS push requires iOS 16.4+.** Older versions simply don't support Web Push for PWAs — there is no workaround.
- **The 30-second debounce** means the recipient gets one notification per burst of messages, not one per message. This is intentional to avoid spam but means there's a ~30 second lag. You can reduce `30_000` in `send/route.ts` if needed.
- **`seen` is per-message, not per-conversation.** If a user opens the chat and then the sender sends more messages before the next open, those new messages will show as unread.
