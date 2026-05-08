# Umart — Refactor Changelog

## Summary of Changes

### 1. Rate Limiting (`lib/rate-limit.ts`)
A lightweight, in-memory sliding-window rate limiter was added. It is applied across all mutating API routes:

| Route | Limit |
|---|---|
| `POST /api/payment/create` | 20 req / 60 s |
| `POST /api/payment/withdraw` | 5 req / 60 s |
| `POST /api/dispute/create` | 10 req / 60 s |
| `PATCH /api/dispute/status` | 20 req / 60 s |
| `GET /api/transactions` | 60 req / 60 s |
| `POST /api/users` | 10 req / 60 s |
| `POST /api/creator/products` | 30 req / 60 s |
| `POST /api/products` | 30 req / 60 s |

All rate-limited responses return `429` with `X-RateLimit-*` headers.

---

### 2. Payment System → Paystack (`lib/paystack.ts`)
Monnify has been fully replaced with Paystack across the entire codebase:

- **`components/payment.tsx`** — `PaystackPop.setup()` inline popup; Paystack script loaded on demand.
- **`app/api/payment/webhook/route.ts`** — Validates `x-paystack-signature` (HMAC-SHA512). Handles:
  - `charge.success` → marks reference paid, updates escrow + analytics
  - `transfer.success` → marks `payQueue` entry as paid (seller payout) **or** marks dispute as refunded (buyer refund)
  - `transfer.failed` / `transfer.reversed` → reverts `withdrawn` flag (payout) or logs failure (refund)
- **`app/api/payment/withdraw/route.ts`** — Creates Paystack transfer recipient, initiates transfer via API; transfer reason is `"Payment for {productName}"`.
- **`app/api/dispute/status/route.ts`** — When status is set to `refunded`, initiates Paystack transfer to buyer; transfer reason is `"Refund for {productName}"`.
- **`.env`** — Monnify keys replaced with:
  ```
  NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=pk_test_...
  PAYSTACK_SECRET_KEY=sk_test_...
  ```

---

### 3. Generic Slug / Keyword System (`lib/slugify.ts`)
`generateSearchKeywords()` now works for **any** brand and model — phones, laptops, shoes, clothing, gadgets, etc. It:
- Always generates keywords from brand alone (so search works even without a model)
- Extracts numbers, word tokens, and known variant suffixes (`pro`, `ultra`, `plus`, `max`, etc.)
- Has brand-specific expansions for Apple (iPhone), Samsung (Galaxy), and common shoe brands
- **`Step1-Category.tsx`** — Brand is now **required**; model is optional with a hint explaining it improves discoverability
- **`client.tsx`** (create product) — Keywords are generated for ALL categories, not just phones

---

### 4. Dispute System

#### Firestore Schema
```
disputes/{txnId}
  ├── txnId, buyerId, sellerId, creatorUID
  ├── title, details
  ├── attachments: [{ url, type }]
  ├── status: 'open' | 'resolving' | 'closed' | 'refunded'
  ├── productName, grandPrice, sellerPayout
  ├── buyerBankCode, buyerBankName, buyerAccountNumber, buyerAccountName
  ├── buyerRecipientCode (set when refund is first processed)
  └── createdAt, updatedAt

references/{txnId}
  └── status: ... | 'disputing' | 'refunded'  ← two new states
```

#### API Routes
| Route | Method | Auth | Description |
|---|---|---|---|
| `/api/dispute/create` | POST | Bearer token | Creates dispute, sets txn status → `disputing` |
| `/api/dispute/list` | GET | Bearer or session cookie | Returns disputes filtered by `role=buyer|creator|admin` |
| `/api/dispute/status` | PATCH | Admin session cookie | Updates status; triggers Paystack refund on `refunded` |

#### `app/disputes` (buyer)
- Lists all paid transactions with a **Dispute** button on each
- Opens `DisputeDialog` (dispute title, details, file uploads, **bank account for refund**)
- Uploads go to Cloudinary — images ≤ 5 MB, videos ≤ 20 MB
- On submit → success toast: *"Umart and the seller have received your dispute, we shall send you an email to continue the claim"*

#### `app/creator/disputes` (seller)
- Lists disputes where the creator's UID matches
- Shows status badge + human-readable interpretation per status:
  - **Open** — dispute logged, will be contacted
  - **Resolving** — under investigation
  - **Closed** — insufficient evidence
  - **Refunded** — claim valid, buyer refunded

#### `app/admin/disputes` (admin)
- Full list with filter tabs (All / Open / Resolving / Closed / Refunded)
- Click any dispute to open `AdminDisputeDialog`:
  - Shows full dispute details, attachments (linked to Cloudinary), buyer bank account
  - Status selector; if admin picks **Refunded**: a confirmation warning appears explaining that **₦X will be immediately transferred to the buyer's account via Paystack** before they can confirm
  - On confirm → triggers Paystack transfer; webhook updates status asynchronously

#### Navigation
- **Buyer nav** — Disputes link already present (`/disputes`)
- **Creator nav** — Disputes link already present (`/creator/disputes`)
- **Admin sidebar** — Disputes link already present (`/admin/disputes`)

---

### 5. Seller Withdrawal Flow (Paystack)
- **`components/withdraw.tsx`** — New **account picker** dialog view:
  1. Shows previously saved bank accounts (loaded from `bankInfo` collection)
  2. Option to add a new account (original form, now navigated to via "Use a different account")
  3. Selecting a saved account and confirming calls the withdraw API with `savedAccountId`
- **`app/api/payment/withdraw/route.ts`**:
  - On new account: saves to `bankInfo/{id}` with `uid`, bank details, `recipientCode: null`
  - Creates Paystack recipient → stores `recipientCode` back on the `bankInfo` doc
  - Subsequent withdrawals reuse the stored `recipientCode` (no duplicate recipient creation)
  - Initiates transfer immediately; `payQueue` entry created with `status: 'pending'`
  - Webhook (`transfer.success`) updates to `paid`; (`transfer.failed`) reverts `withdrawn = false` so seller can retry

#### Firestore Schema
```
bankInfo/{accountInfoRef}
  ├── uid (creator UID)
  ├── bankCode, bankName, accountNumber, accountName
  ├── recipientCode (null until first Paystack call; then stored)
  └── createdAt
```

---

### 6. Buyer Value Confirmation Dialog Update
`app/transactions/client.tsx` — The "Confirm Value Received" dialog already contained the payout warning and dispute redirect. The messaging reads:
> *"We will pay out the seller immediately. Only confirm if you have gotten what you ordered, otherwise create a dispute."*
This is wired to redirect to `/disputes` if the buyer chooses "Create Dispute Instead".

---

## Environment Variables Required

See `.env.example` for the full list. Key new variables:

```env
NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=pk_test_...
PAYSTACK_SECRET_KEY=sk_test_...
```

Register your Paystack webhook at:
`https://dashboard.paystack.com/#/settings/developer`

Point it to: `https://yourdomain.com/api/payment/webhook`

Events to enable:
- `charge.success`
- `transfer.success`
- `transfer.failed`
- `transfer.reversed`
