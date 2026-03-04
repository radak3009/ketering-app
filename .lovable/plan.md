

## Plan: Admin Order Fiscalization with Checkbox

### Overview
When admin creates an order via AdminOrderDialog, add a "Izdati fiskalni račun" checkbox below the meal selector. When checked, after the order+order_item is created, the system will:
1. Create a `pickup_request` record (status=served, served_at=now)
2. Call `fiscalize-meal` edge function with that pickup request ID

### Changes

#### 1. `src/components/admin/AdminOrderDialog.tsx`
- Add `fiscalize` boolean state (default: false), reset on open
- Add Checkbox + Label below Obrok field (only in create mode, not edit)
- Pass `fiscalize` flag in `onSubmit` data

#### 2. `AdminOrderDialogProps` interface update
- Extend `onSubmit` data type to include `fiscalize: boolean`

#### 3. `src/hooks/useAdminOrders.ts` — `createAdminOrder`
- Add `fiscalize: boolean` to `CreateAdminOrderParams`
- After order_item creation, if `fiscalize` is true:
  - Fetch user's profile (id, company_card_id, full_name, company_id) from profiles where `user_id = params.userId`
  - Create a `pickup_request` row: `{ employee_identifier: company_card_id, pickup_date: deliveryDate, status: 'served', served_at: now, order_item_id, profile_id, company_id, meal_name_snapshot: meal name, fiscal_status: 'pending' }`
  - Call `supabase.functions.invoke('fiscalize-meal', { body: { pickupId } })` 
  - The existing `fiscalize-meal` function handles everything (tag check, Octopos call, PDF generation)

#### 4. Caller in `OrdersOverview.tsx` (or wherever AdminOrderDialog is used)
- Pass `fiscalize` through to `createAdminOrder`

### No edge function changes needed
The existing `fiscalize-meal` already:
- Checks user tag (Proizvodnja/Hogo) and skips others
- Calls Octopos API
- Generates PDF receipt
- Handles idempotency

### Files to modify
| File | Change |
|------|--------|
| `src/components/admin/AdminOrderDialog.tsx` | Add checkbox, pass fiscalize flag |
| `src/hooks/useAdminOrders.ts` | Create pickup_request + invoke fiscalize-meal |
| Caller component (OrdersOverview or similar) | Pass fiscalize through |

