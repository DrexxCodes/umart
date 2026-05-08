# Umart Refactor — Change Log

## 1. Rate Limiting (`lib/rate-limit.ts`)
Added a lightweight in-memory sliding-window rate limiter used across all key API routes:

| Route | Limit |
|---|---|
| `POST /api/payment/create` | 20 req/min |
| `POST /api/payment/withdraw` | 5 req/min |
| `POST /api/dispute/create` | 10 req/min |
| `GET /api/transactions` | 60 req/min |
| `POST /api/users` | 10 req/min |

Rate-limited responses return HTTP 429 with `X-RateLimit-*` headers.

---

## 2. Paystack Payment System
Replaced Monnify with Paystack throughout:

- **`lib/paystack.ts`** — server-side utility covering: transaction verification, bank listing, account resolution, recipient creation, transfer initiation, refund, and webhook signature verification.
- **`components/payment.tsx`** — Paystack Inline JS popup replaces previous payment modal. Loads the Paystack JS SDK lazily on first click.
- **`app/api/payment/webhook/route.ts`** — Rewrote for Paystack events:
  - `charge.success` — marks reference paid, updates analytics.
  - `transfer.success` — handles both seller payouts (`withdraw-*`) and buyer refunds (`refund-*`).
  - `transfer.failed` / `transfer.reversed` — reverts `withdrawn` flag on payouts; marks dispute refund failed.
- **`app/api/payment/withdraw/route.ts`** — Full Paystack transfer flow:
  - Saves bank account to `bankInfo/{id}` with UID.
  - Creates Paystack `transferrecipient` if no `recipientCode` exists; caches it.
  - Initiates transfer with reason `"Payment for {productName}"`.
  - Subsequent calls can use `savedAccountId` to reuse a stored account.
  - GET `?savedAccounts=true` returns all saved accounts for the creator.

---

## 3. Generic Brand/Model Keyword Generation (`lib/slugify.ts`)
- **`generateSearchKeywords(brand, model?)`** now works for any product category — phones, laptops, shoes, clothing, gadgets, etc.
- Extracts numeric tokens, variant keywords (Pro, Ultra, Plus…), and brand-specific expansions (Apple → iphone, Samsung → galaxy, shoe brands → shoes/sneakers).

### `app/creator/product/create/components/Step1-Category.tsx`
- **Brand** field is now required (`*`).
- **Model** field is optional, with an informational tip explaining it improves search discoverability.
- Keyword generation runs for **all categories**, not just phones.

---

## 4. Disputes System

### API routes
| Route | Method | Description |
|---|---|---|
| `/api/dispute/create` | POST | Creates dispute in `disputes/{txnId}`, sets reference status to `disputing` |
| `/api/dispute/list` | GET | Returns disputes filtered by `?role=buyer\|creator\|admin` |
| `/api/dispute/status` | PATCH | Admin-only; changes status; triggers Paystack refund when `status=refunded` |

### Firestore structure
```
disputes/{txnId}
  txnId, buyerId, sellerId, creatorUID
  title, details, attachments[]
  status: open | resolving | closed | refunded
  productName, grandPrice, sellerPayout
  buyerBankCode, buyerBankName, buyerAccountNumber, buyerAccountName, buyerRecipientCode
  createdAt, updatedAt
```

Transaction reference gains two new statuses: `disputing` and `refunded`.

### `components/disputes/DisputeDialog.tsx`
- Buyer fills in title, details, and uploads supporting evidence (images ≤5 MB, videos ≤20 MB via Cloudinary).
- Buyer provides their **refund bank account** (bank dropdown + account number with live Paystack resolution) inside the same dialog.
- On success, shows: _"Umart and the seller have received your dispute, we shall send you an email to continue the claim."_

### `app/disputes/` — Buyer
- Lists all paid transactions.
- Dispute button opens `DisputeDialog`.
- Already-disputed transactions show their current status badge.

### `app/creator/disputes/` — Seller
- Lists disputes where `creatorUID === uid`.
- Shows status badge + plain-English status interpretation:
  - **Open** — logged, will be contacted.
  - **Resolving** — being investigated.
  - **Closed** — insufficient evidence.
  - **Refunded** — claim valid, buyer refunded.

### `app/admin/disputes/` — Admin
- Full dispute list with filter tabs (All / Open / Resolving / Closed / Refunded).
- `AdminDisputeDialog` — view full dispute details, attachments, and buyer bank details.
- Status change dropdown (open → resolving → closed → refunded).
- **Refund requires a two-step confirmation**: admin first selects "Refunded", sees a warning showing the exact amount and buyer account, then confirms. Paystack transfer is initiated immediately (`refund-{txnId}-{ts}`).

---

## 5. Navigation Updates
- **Buyer nav** — `Disputes` link added (protected, requires login).
- **Creator nav** — `Disputes` link added.
- **Admin sidebar** — `Disputes` entry added between Pay Queue and Inventory.

---

## 6. Transactions — Value Received Dialog
The "Confirm Value Received" dialog now:
- Warns buyer that the seller will be **paid immediately**.
- Offers a **"Create Dispute Instead"** shortcut button that routes to `/disputes`.
- Action button text updated to _"Yes, I Got It — Confirm"_ to reduce accidental confirmations.

---

## 7. Withdraw — Saved Bank Accounts
- On opening the withdraw dialog, previously saved accounts are fetched (`GET /api/payment/withdraw?savedAccounts=true`).
- Saved accounts are displayed as selectable cards above the manual entry form.
- Selecting a saved account pre-fills all fields and skips the bank dropdown; selecting again de-selects.
- New accounts are saved to `bankInfo/{id}` and their Paystack `recipientCode` is cached on first use.

---

## Environment Variables Required

```env
# Paystack
PAYSTACK_SECRET_KEY=sk_live_...
NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=pk_live_...

# Cloudinary (dispute attachments)
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your_cloud_name
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=umart_disputes
```

> **Cloudinary preset** must be created as an **unsigned** upload preset in your Cloudinary dashboard, with allowed resource types set to `image` and `video`, and the folder set to `umart_disputes`.
