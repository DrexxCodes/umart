# Deploying Trigger.dev to Production

This guide covers everything you need to go from local dev to a live production
deployment of the `chat-notify` task on Trigger.dev.

---

## Understanding the two environments

Your Umart app has two completely separate deployment targets:

| What | Where | How it deploys |
|---|---|---|
| Next.js app (pages, API routes) | Vercel | `git push` — automatic |
| Trigger.dev tasks (`trigger/` folder) | Trigger.dev cloud | Manual CLI command |

**These are independent.** Pushing to GitHub does NOT deploy your Trigger.dev
tasks. You must run the deploy command separately every time you change anything
inside the `trigger/` folder.

---

## Step 1 — Create a Production environment in Trigger.dev

1. Open [cloud.trigger.dev](https://cloud.trigger.dev)
2. Select your project (the one you created during setup)
3. In the left sidebar, you'll see two environments: **Development** and **Production**
4. Click **Production** — this is where your live tasks will run

---

## Step 2 — Get your Production API key

1. In the Trigger.dev dashboard, go to **Production** environment
2. Click **API Keys** in the left sidebar
3. Copy the key that starts with `tr_prod_...`
4. Keep this safe — treat it like a password

---

## Step 3 — Add environment variables to Trigger.dev Production

This is the most important step. Trigger.dev workers run in their own cloud and
have **zero access** to your Vercel environment variables. You must add them
manually in the Trigger.dev dashboard.

Go to: **Trigger.dev dashboard → Your Project → Production → Environment Variables**

Add each of these:

### Firebase Admin (required for Firestore + FCM)

| Key | Value | Where to find it |
|---|---|---|
| `FIREBASE_PROJECT_ID` | e.g. `my-project-abc` | Firebase Console → Project Settings → General → Project ID |
| `FIREBASE_CLIENT_EMAIL` | e.g. `firebase-adminsdk-xxx@project.iam.gserviceaccount.com` | Firebase Console → Project Settings → Service accounts → Generate new private key → `client_email` field in the downloaded JSON |
| `FIREBASE_PRIVATE_KEY` | `-----BEGIN PRIVATE KEY-----\nMIIE...` | Same JSON file → `private_key` field |

> **`FIREBASE_PRIVATE_KEY` formatting — read carefully:**
>
> Open the downloaded service account JSON. The `private_key` field looks like:
> ```
> "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQ...\n-----END PRIVATE KEY-----\n"
> ```
> Copy that entire string value **including the `\n` sequences**. In the
> Trigger.dev dashboard env var field, paste it exactly as-is with the literal
> `\n` characters — do NOT press Enter to create real newlines.
>
> The task code calls `.replace(/\\n/g, '\n')` at runtime to expand them.
> This matches exactly how `lib/firebase-admin.ts` handles the same key on Vercel.

---

## Step 4 — Set your Production secret key in Vercel

Your Next.js app uses `TRIGGER_SECRET_KEY` to call `tasks.trigger(...)` from
`api/chat/send`. In production this must be the **production** key.

1. Go to your Vercel project → Settings → Environment Variables
2. Find `TRIGGER_SECRET_KEY`
3. Change the value to your `tr_prod_...` key (the one from Step 2)
4. Make sure it is set for the **Production** environment

> If you have separate Vercel Preview deployments, add a separate
> `tr_dev_...` key scoped to Preview environments so those hit the
> Development Trigger.dev environment.

---

## Step 5 — Deploy the tasks

In your project root, run:

```bash
npx trigger.dev@latest deploy --env prod
```

You will see output like:

```
✓ Building tasks...
✓ Bundling trigger/chat-notify.ts
✓ Uploading bundle to Trigger.dev
✓ Deployed to Production

  Tasks deployed:
  ✓ chat-notify
```

**That's it.** Your task is now live.

---

## Step 6 — Verify the deployment

1. Go to Trigger.dev dashboard → **Production** → **Tasks**
2. You should see `chat-notify` listed with status **Active**
3. Send a test chat message in your live app
4. Go to Trigger.dev dashboard → **Production** → **Runs**
5. You should see a new run appear immediately with status **Waiting** (the 20s debounce)
6. After 20 seconds it transitions to **Completed**
7. The recipient's device should receive the push notification

---

## Redeploying after changes

Any time you edit a file inside the `trigger/` folder, you must redeploy:

```bash
npx trigger.dev@latest deploy --env prod
```

You do NOT need to redeploy for changes to API routes, pages, or anything
outside the `trigger/` folder — those deploy via Vercel as normal.

A suggested workflow:

```bash
# 1. Push your Next.js changes
git add .
git commit -m "your message"
git push  # Vercel deploys automatically

# 2. If trigger/ was changed, deploy tasks separately
npx trigger.dev@latest deploy --env prod
```

---

## Monitoring in production

### View live runs
Trigger.dev dashboard → Production → Runs

Each run shows:
- Status (Waiting / Running / Completed / Failed)
- Duration
- Full structured logs from every `logger.info/warn/error` call in the task
- The exact return value

### What the logs tell you

| Log message | Meaning |
|---|---|
| `chat-notify started` | Task triggered successfully, about to wait 20s |
| `30s wait complete...` | Debounce window passed, checking Firestore |
| `Pending doc already cleared` | User opened the chat within 20s — no push sent (correct behaviour) |
| `User has no FCM tokens` | User hasn't granted notification permission on any device |
| `FCM response { successCount: 1, failureCount: 0 }` | Push delivered to FCM successfully |
| `FCM send failed for token` | FCM rejected this token — it gets pruned automatically |

### Firebase Console — delivery receipts
Firebase Console → Cloud Messaging → Reporting

This shows delivery stats for your FCM sends. If Trigger.dev says
`successCount: 1` but no notification appeared, check here — it will show
whether FCM accepted the message and whether the device confirmed receipt.

### Checking Firestore
The `pendingNotifications` collection in Firestore shows pending jobs.
- If a doc exists after 20s it means the task hasn't fired yet (or failed)
- If a doc was created but the task never ran, check Trigger.dev → Runs for errors

---

## Environment variables summary

### Vercel (for the Next.js app)

```env
TRIGGER_SECRET_KEY=tr_prod_xxxxxxxxxxxx   # prod key
TRIGGER_PROJECT_ID=proj_xxxxxxxxxx
```

### Trigger.dev dashboard → Production → Environment Variables

```
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n
```

> Remember: these two sets of env vars are completely separate and must both
> be set. Vercel cannot see Trigger.dev's vars and vice versa.

---

## Common production issues

**Runs appear in dashboard but no notification shows**
- Check the run logs — look for `no-tokens` (user hasn't granted permission)
  or individual FCM token failures
- Check Firebase Console → Cloud Messaging for delivery receipts
- If FCM shows delivery but browser shows nothing, the token was orphaned —
  the user needs to re-grant notification permission so a fresh token is saved

**`tasks.trigger()` throws in Vercel logs**
- `TRIGGER_SECRET_KEY` on Vercel is still set to the dev key (`tr_dev_...`)
- Replace it with the prod key (`tr_prod_...`) in Vercel environment variables

**Runs show `Firebase Admin env vars missing`**
- The Firebase vars are not set in the Trigger.dev **Production** environment
- Go to Trigger.dev dashboard → Production → Environment Variables and add them
- Note: setting them in Development does NOT carry over to Production — you
  must add them to each environment separately

**Task deployed but shows as `Inactive` in dashboard**
- Re-run `npx trigger.dev@latest deploy --env prod`
- Check that `TRIGGER_PROJECT_ID` in your local `.env` matches the project in the dashboard
