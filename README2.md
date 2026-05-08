# Umart Patch — Change Summary

Drop all files in this archive into the root of your project, preserving directory structure. No dependency changes required.

---

## 1. Disputes — Buyer sees disputing transactions (`app/disputes/client.tsx`)
- Transactions with `status === 'disputing'` now appear on the buyer's dispute page alongside `paid` ones.
- A "Disputing / Under Review" badge is shown; the dispute button is replaced with a status chip.
- If `confirmedValue === true` on the reference, the transaction **cannot** be disputed — a note is shown.
- Up to **5 optional attachments** (images/videos) can be uploaded per dispute.
- If the buyer tries to submit with **zero attachments**, a warning dialog appears before the dispute is filed: *"Disputes without at least one attachment may not likely go in your favour…"*

## 2. Dispute Create API (`app/api/dispute/create/route.ts`)
- Fetches `email` from `users/{buyerId}` and `users/{sellerId}` and stores `buyerEmail` / `sellerEmail` in the disputes doc.
- Guards against `confirmedValue === true` — throws 400 if buyer already confirmed.
- Caps attachments array at 5.

## 3. Dispute Status API (`app/api/dispute/status/route.ts`)
- **Closed:** sets the reference `status` back to `'paid'` and `confirmedValue` to `true` (seller wins, can withdraw).
- **Refunded:** existing Paystack transfer flow unchanged.

## 4. Admin Dispute Dialog (`app/admin/disputes/components/AdminDisputeDialog.tsx`)
- Shows **buyer email** and **seller email** in a Parties section.
- **Compose Communication** panel: pre-filled subject ("Umart Dispute"), free-text body, "Create Mail" button opens the system mail app with both emails in `mailto:`.
- **Closing a dispute** now shows an info confirmation: *"By closing this dispute the seller has won and can now withdraw the funds. Is that the intended action?"*

## 5. Transactions API (`app/api/transactions/route.ts`)
- Buyer list now returns both `paid` and `disputing` references.
- `confirmedValue` field is included in all responses.

## 6. Buyer Transactions List (`app/transactions/client.tsx`)
- Disputing transactions show a "Disputing" status badge; confirm button is hidden.
- No seller-withdrawal info shown to buyer.
- **Review button** appears after value is confirmed; opens a review dialog (star rating required, topic/description optional).

## 7. Buyer Transaction Detail (`app/transactions/[id]/client.tsx`)
- Disputing status disables the confirm-value button and shows an amber notice.
- `withdrawn` field removed from buyer-facing view.
- **Leave a Review** button appears once value is confirmed; same dialog as list page.

## 8. Creator Transactions List (`app/creator/transactions/client.tsx`)
- Disputing transactions show amber notice: *"Withdrawing is currently halted for this transaction as there's an ongoing dispute."*
- Withdraw button hidden when disputing.

## 9. Creator Transaction Detail (`app/creator/transactions/[id]/client.tsx`)
- Disputing status replaces the withdrawal card with the same amber halt notice.
- "Disputing" added to StatusBadge map.

## 10. Admin Stat Cards (`app/admin/components/Statcard.tsx`)
- Numbers under ₦1,000,000 now display with full commas (e.g. **₦200,000**, **₦10,300**).
- Only millions (M) and billions (B) are abbreviated — thousands never show "k" on stat cards.
- Graph tooltips are unaffected (those use their own formatter).

## 11. Catalogue API (`app/api/catalogue/route.ts`)
- `GET ?userId=` or `GET ?catalogueId=` — fetch catalogue data.
- `POST` — create catalogue; stores `catalogueId` on `users/{uid}`, sets `hasCatalogueEnabled: true`.
- `PATCH` — update `bio`, `profilePhoto`, `coverPhoto`.

## 12. Catalogue Products API (`app/api/catalogue/products/route.ts`)
- `GET ?userId=` — returns all `status === 'active'` products for a seller.

## 13. Catalogue Reviews APIs
- `POST /api/catalogue/review` — submit/update a review. Requires confirmed transaction. Recalculates `averageReview` and `reviewsCount` on `catalogue/{id}`. Stored at `catalogue/{id}/reviews/{buyerId}_{txnRefId}`.
- `GET /api/catalogue/reviews?catalogueId=` — list reviews for a catalogue.

## 14. Creator Catalogue Page (`app/creator/catalogue/`)
- If no catalogue exists: shows `NewCatalogue.svg`, description, and a creation form (cover photo, profile photo, bio → Cloudinary → POST `/api/catalogue`).
- If catalogue exists: shows profile preview, share link with copy/open buttons, stats (review count + average), and an Edit mode for updating bio and photos.
- Linked from creator nav as **Catalogue**.

## 15. Public Seller Catalogue (`app/seller/[catalogueId]/`)
- Public page showing seller profile photo, cover photo, bio, average rating.
- Grid of active product cards (image + name + price) linking to `/product/[id]`.
- Customer reviews listed below, each showing buyer username, stars, topic, description, and purchased product names.

## 16. About the Seller component (`components/catalogue/AboutTheSeller.tsx`)
- Shown in the product detail sidebar for any product whose seller has a catalogue.
- Displays profile photo, username, average stars, review count, and a "View Seller Catalogue" link.
- Hidden if seller has no catalogue.

## 17. Seller Upgrade — Catalogue Step (`app/seller/upgrade/`)
- `CatalogueSection` added as a 4th required step in the upgrade flow.
- Seller enters profile photo, cover photo (both optional, uploaded to Cloudinary) and a bio.
- Progress bar and completion count updated to reflect 4 steps.

## 18. Creator Nav (`components/nav/creator-nav.tsx`)
- "Catalogue" link added pointing to `/creator/catalogue`.

---

## New Routes Summary

| Route | Description |
|---|---|
| `GET /api/catalogue` | Fetch catalogue by userId or catalogueId |
| `POST /api/catalogue` | Create catalogue |
| `PATCH /api/catalogue` | Update catalogue |
| `GET /api/catalogue/products` | Active products for a seller |
| `GET /api/catalogue/reviews` | Reviews for a catalogue |
| `POST /api/catalogue/review` | Submit/update a review |
| `/creator/catalogue` | Creator manages their catalogue |
| `/seller/[catalogueId]` | Public buyer-facing catalogue page |

## New Firestore Fields

| Collection | New Fields |
|---|---|
| `catalogue/{id}` | `userId`, `username`, `bio`, `profilePhoto`, `coverPhoto`, `enabled`, `reviewsCount`, `averageReview`, `createdAt`, `updatedAt` |
| `catalogue/{id}/reviews/{buyerId_refId}` | `buyerId`, `buyerUsername`, `txnRefId`, `rating`, `topic`, `description`, `products[]`, `createdAt`, `updatedAt` |
| `disputes/{txnId}` | `buyerEmail`, `sellerEmail` (added at creation) |
| `users/{uid}` | `catalogueId`, `hasCatalogueEnabled` (set on catalogue creation) |
| `references/{refId}` | `confirmedValue` (set to `true` when closed in dispute or buyer confirms) |
