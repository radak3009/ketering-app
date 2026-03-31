

## Plan: Disable automatic end-of-day fiscalization workflow

### Overview

Remove the `fiscalize-undelivered` edge function and its associated cron job. This function automatically creates pickup requests with `served_by: 'auto-fiscal'` and fiscalizes all undelivered meals at 23:30 daily. The existing Kiosk-based fiscalization (real-time at pickup) and admin-initiated fiscalization remain completely unaffected.

### Impact analysis

Components that reference `auto-fiscal` and will need cleanup:

| Location | What it does | Action |
|---|---|---|
| `fiscalize-undelivered/index.ts` | Creates fake pickup_requests and calls fiscalize-meal | **Delete** |
| `supabase/config.toml` | JWT config for the function | **Remove entry** |
| `kiosk-show-meal/index.ts` | Filters out `auto-fiscal` records when checking pickup | **Keep** (harmless, defensive) |
| `kiosk-get-queue/index.ts` | Excludes `auto-fiscal` from kitchen queue display | **Keep** (harmless, defensive) |
| `useAdminStats.ts` | Excludes `auto-fiscal` from picked-up count | **Keep** (harmless, defensive) |
| `retry-failed-fiscalizations/index.ts` | Retries failed fiscalizations (including auto-fiscal ones) | **Keep** (still needed for kiosk/admin failures) |

The `auto-fiscal` filters in kiosk and admin stats are safe to keep — they act as defensive guards and cost nothing. Removing them would be riskier if any old `auto-fiscal` records exist in the database.

### Changes

#### 1. Remove cron job (SQL via Supabase)
Unschedule the `fiscalize-undelivered` cron job if it exists:
```sql
SELECT cron.unschedule('fiscalize-undelivered-daily');
```
Note: Need to verify the exact job name first. If no cron job exists for this function (none was found in migrations), this step is skipped.

#### 2. Delete edge function
Remove `supabase/functions/fiscalize-undelivered/index.ts` entirely.

#### 3. Update `supabase/config.toml`
Remove the `[functions.fiscalize-undelivered]` section.

#### 4. Fix existing build error
The current build is failing. Will investigate and fix alongside these changes (likely a type issue in `useUsers.ts` missing `company_card_serial` in the select query on line 17).

### What remains untouched
- **Kiosk fiscalization**: `kiosk-serve` → `fiscalize-meal` flow (real-time at pickup)
- **Admin fiscalization**: `useAdminOrders` → `fiscalize-meal` flow
- **Retry mechanism**: `retry-failed-fiscalizations` cron (every 15 min)
- **Receipt generation**: `fiscalize-meal`, `receipt-download`, `receipt-link`

