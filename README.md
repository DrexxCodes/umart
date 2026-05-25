# U Mart (uHomes Mart)

A full-stack escrow marketplace built with **Next.js 16**, **Firebase**, **Credo** and **Paystack**, designed for students and communities.

---

## Tech Stack

| Layer        | Tech                                                                 |
|--------------|----------------------------------------------------------------------|
| Framework    | Next.js 16 (App Router, TypeScript)                                  |
| Styling      | Tailwind CSS v4                                                      |
| Auth         | Firebase Auth (email/password) + httpOnly JWT cookies                |
| Database     | Firestore (Firebase Admin SDK server-side, client SDK for auth only) |
| Storage      | Firebase Storage + Cloudinary (product images)                       |
| Push Notifs  | Firebase Cloud Messaging (FCM)                                       |
| Payments     | Credo (checkout), Paystack (payouts & refunds)                       |
| Charts       | Recharts                                                             |
| AI Negotiator| Claude (Anthropic) — Clara AI on product pages                      |
| Linting      | Biome                                                                |

---

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy `.env.example` to `.env.local` and fill in all values:

```bash
cp .env.example .env.local
```

See `.env.example` for the full list of required variables, including:
- Firebase (client + Admin SDK)
- Credo payment keys & webhook token
- Paystack secret key
- Cloudinary upload preset
- FCM VAPID key
- Internal API secret

### 3. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Project Structure

```
app/
├── admin/               # Admin portal (protected, isAdmin role)
│   ├── categories/      # Create & manage product categories
│   ├── disputes/        # Dispute resolution
│   ├── inventory/       # Product inventory management
│   ├── pay-queue/       # Payment queue & payouts
│   ├── referrals/       # Referral code insights dashboard
│   ├── references/      # Transaction references
│   └── users/           # User management
│
├── api/
│   ├── admin/referrals/ # Admin-only referral data API
│   ├── chat/            # Chat send + FCM push notify
│   ├── creator/
│   │   └── products/categories/  # CRUD for product categories
│   ├── fcm/register/    # Register / remove FCM device tokens
│   ├── payment/webhook/ # Credo webhook handler (SHA-512 signature verified)
│   ├── referrals/       # Create referral codes + track signups
│   └── users/           # User profile, cookies, me, logout
│
├── auth/
│   ├── login/
│   └── signup/          # Supports ?ref={refrId} URL param for referrals
│
├── chat/                # Buyer chat (with FCM permission prompt)
├── creator/             # Seller portal
├── referrals/           # Buyer referral code page
└── ...
```

---

## Key Features

### Escrow Payments
Buyers pay via Credo; funds are held until the buyer confirms receipt. Sellers then request withdrawal via Paystack.

### Credo Webhook Security
Webhook signatures are verified using `SHA-512(webhookToken + businessCode)` and compared against the `x-credo-signature` header. Configure `CREDO_WEBHOOK_TOKEN` and `CREDO_BUSINESS_CODE` in `.env.local`.

### Firebase Cloud Messaging (Push Notifications)
- **`FcmPermissionPrompt`** — shown on chat pages; asks the user to allow notifications and registers their FCM token via `/api/fcm/register`.
- **`ServiceWorkerRegistrar`** — registers both the PWA service worker (`sw.js`) and the Firebase Messaging service worker (`firebase-messaging-sw.js`), then posts the Firebase config to the messaging SW via `postMessage` (since static service workers cannot read `NEXT_PUBLIC_*` env vars).
- Foreground messages are shown as Sonner toasts; background messages trigger native push notifications.

### Product Categories
Admins create and manage product categories at `/admin/categories`. Categories are stored in `productCategories/{slug}` in Firestore.

API: `GET /api/creator/products/categories` (public) · `POST /api/creator/products/categories` (admin) · `PATCH /api/creator/products/categories?id=` (admin) · `GET/PATCH/DELETE /api/creator/products/categories/[id]` (admin)

### Referral System

#### Firestore structure
```
referrals/{refrId}
  campaignName:   string
  ownerId:        string          # uid of creator
  ownerName:      string
  signupCount:    number          # incremented on every signup
  dailySignups:   { 'YYYY-MM-DD': number }   # aggregated for graphs
  createdAt:      string
  updatedAt:      string
  signups/{userId}
    userId, fullname, email, signedUpAt
```

`users/{userId}.myrefcode` stores the user's own referral code for fast page-load lookup.

#### Buyer flow (`/referrals`)
1. On load, checks `localStorage` cache (30-day TTL) then `/api/referrals?userId=`.
2. If no code exists, the user enters a campaign name and generates one.
3. The page shows the code, a share button, stats (signups / active days / peak day) and an area chart of daily signup behaviour.

#### Signup flow (`/auth/signup`)
- Accepts `?ref={refrId}` URL param — auto-fills the referral field.
- After 5 seconds without user input, verifies the code and shows `"{campaignName} referred you!"`.
- On successful signup, calls `POST /api/referrals?action=track` (fire-and-forget) to record the signup and increment daily counts.

#### Admin view (`/admin/referrals`)
- Left panel: list of all referral codes with owner, signup count, and creation date.
- Right panel: bar chart of daily signups (peak days highlighted) + cumulative area trend chart.

### Clara AI Negotiator
Sellers can configure an AI negotiator on their product edit page — set a floor price, tone, and up to 10 FAQ entries. Clara uses Claude (Anthropic) to handle buyer negotiations automatically.

---

## API Reference (key endpoints)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/creator/products/categories` | Public | List all product categories |
| POST | `/api/creator/products/categories` | Admin | Create a new category |
| PATCH | `/api/creator/products/categories?id=` | Admin | Update a category |
| POST | `/api/payment/webhook` | Credo signature | Handle Credo payment events |
| POST | `/api/fcm/register` | Bearer | Register FCM device token |
| DELETE | `/api/fcm/register` | Bearer | Remove FCM device token |
| GET | `/api/referrals?code=` | Public | Verify referral code |
| GET | `/api/referrals?userId=` | Bearer | Fetch user's referral codes |
| POST | `/api/referrals` | Bearer | Create referral code |
| POST | `/api/referrals?action=track` | Public | Track signup under referral |
| GET | `/api/admin/referrals` | Admin | List all referral codes |
| GET | `/api/admin/referrals?id=` | Admin | Single referral + signup list |

---

## Environment Variables

See `.env.example` for the complete and documented list.

---

## Scripts

```bash
npm run dev       # Start development server
npm run build     # Production build
npm run start     # Start production server
npm run lint      # Biome lint check
npm run format    # Biome format (auto-fix)
```
