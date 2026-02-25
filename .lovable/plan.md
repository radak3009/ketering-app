

## Plan: Receipt Download Fix — Remove URL from PDF + Server-Side Download

### Problem 1: VerificationUrl text printed in PDF
Lines 120-132 of `fiscalize-meal/index.ts` draw the `verificationUrl` as plain text below the QR code.

### Problem 2: Signed URL blocked by ad blockers
UI fetches a signed URL from `receipt-link` and opens it via `window.open()`. Chrome extensions block these Supabase storage signed URLs.

---

### A. Remove VerificationUrl text from PDF (`fiscalize-meal/index.ts`)

Delete lines 120-132 in `generateReceiptPdf()` — the block that draws `verificationUrl` as text below the QR code. The QR code itself (which encodes the URL) remains.

Also update the page height calculation to remove `urlTextHeight`:
- Line 82: remove `const urlTextHeight = verificationUrl ? lineHeight * 2 : 0;`
- Line 83: remove `urlTextHeight` from `totalHeight` calculation

| Line range | Change |
|---|---|
| 80-83 | Remove `urlTextHeight` from height calc |
| 120-132 | Remove `drawText(verificationUrl, ...)` block |

---

### B. New Edge Function: `receipt-download`

Create `supabase/functions/receipt-download/index.ts`:

1. Accept `GET ?pickupId=...`
2. Extract JWT from `Authorization` header, verify user via `auth.getUser(token)`
3. Fetch `pickup_requests` row by `pickupId` using service role client
4. Verify ownership: `pickup.profile_id` → `profiles.user_id` must match `auth.uid()`
5. Check `fiscal_status === 'fiscalized'` and `receipt_file_path` exists
6. Download PDF from Storage using service role: `storage.from('receipts').download(path)`
7. Return PDF bytes with headers:
   - `Content-Type: application/pdf`
   - `Content-Disposition: inline; filename="racun-{invoiceNumber}.pdf"`
   - `Cache-Control: no-store`
   - CORS headers

Also add admin bypass: if user has admin role, skip ownership check.

Add to `supabase/config.toml`:
```toml
[functions.receipt-download]
verify_jwt = false
```
(JWT validated manually in code)

---

### C. UI Change: MealCard `handleDownloadReceipt` (`src/components/employee/MealCard.tsx`)

Replace the current flow (fetch signed URL → window.open) with:

1. `fetch` to `receipt-download?pickupId=...` with `Authorization: Bearer <token>`
2. Get response as `blob`
3. Create `URL.createObjectURL(blob)`
4. `window.open(objectUrl, '_blank')`
5. Revoke object URL after timeout

This avoids ad-blocker issues since the URL is a local blob, not an external storage URL.

---

### Files to change

| File | Action |
|---|---|
| `supabase/functions/fiscalize-meal/index.ts` | Remove verificationUrl text rendering from PDF |
| `supabase/functions/receipt-download/index.ts` | **New** — server-side PDF download endpoint |
| `supabase/config.toml` | Add `receipt-download` config |
| `src/components/employee/MealCard.tsx` | Change download handler to use `receipt-download` + blob |

### Files NOT changed

| File | Reason |
|---|---|
| `supabase/functions/receipt-link/index.ts` | Keep as-is (may be used elsewhere); UI no longer calls it for download |
| Database schema | No changes needed |

