

## Plan: Tag-based Kitchen Schedule Application

### Problem
Currently the kitchen weekly schedule applies to ALL users equally. The requirement is to make the schedule apply only to selected tags (organizations). Users with other tags should always bypass the kitchen schedule (treated as if kitchen is closed = always use pickup kiosk logic).

### How It Works Today
1. `kiosk-confirm-pickup` calls `isKitchenOpen()` to determine kitchen status
2. If kitchen is open → only Kitchen Kiosk can confirm pickup
3. If kitchen is closed → only Employee Kiosk (pickup) can confirm pickup
4. Fiscalization fires after confirmation regardless

### New Behavior
- Admin configures which tags the kitchen schedule applies to (via `app_settings` key `kitchen_schedule_tags`)
- In `kiosk-confirm-pickup`, after getting the pickup request, fetch the user's tag from their profile
- If the user's tag is in the configured list → apply kitchen schedule normally
- If the user's tag is NOT in the list → treat as "kitchen always closed" (employee kiosk always works, kitchen kiosk always works too — essentially no schedule restriction)

### Changes

#### 1. Database: Add `app_settings` row for `kitchen_schedule_tags`
Insert a new setting `kitchen_schedule_tags` with value `[]` (empty array = schedule applies to nobody, meaning no restrictions).

#### 2. `supabase/functions/kiosk-confirm-pickup/index.ts`
- After fetching `pickupRequest`, also fetch the user's profile tag via `profile_id`
- Fetch `kitchen_schedule_tags` from `app_settings`
- If user's tag is in the list → use `isKitchenOpen()` as before
- If not → skip kitchen status check entirely (allow both kiosk types)

#### 3. `supabase/functions/kiosk-get-kitchen-status/index.ts`
- Optionally accept `employeeTag` parameter
- If `employeeTag` is provided and not in `kitchen_schedule_tags` → return `isOpen: false` always (so pickup kiosk UI shows self-service mode)
- This keeps the frontend kiosk behavior consistent

#### 4. `src/components/admin/KitchenScheduleSettings.tsx`
- Below the "Nedeljni raspored kuhinje" card, add a new section: "Primena rasporeda po organizaciji"
- Fetch all unique tags from profiles (reuse the same pattern as SettingsTab)
- Fetch current `kitchen_schedule_tags` from `app_settings`
- Display checkboxes for each tag
- Save checked tags to `app_settings` key `kitchen_schedule_tags`

#### 5. `src/hooks/useKitchenSchedule.ts`
- Add state and functions for `scheduleTags` (which tags the schedule applies to)
- Fetch/save from `app_settings` table

### Files to modify

| File | Action |
|------|--------|
| `app_settings` table | Insert `kitchen_schedule_tags` row with `[]` |
| `supabase/functions/kiosk-confirm-pickup/index.ts` | Add tag check before kitchen status validation |
| `supabase/functions/kiosk-get-kitchen-status/index.ts` | Accept optional `employeeTag`, check against settings |
| `src/components/admin/KitchenScheduleSettings.tsx` | Add tag checkboxes section |
| `src/hooks/useKitchenSchedule.ts` | Add scheduleTags management |

### No changes needed
- `fiscalize-meal` — already has its own tag-based logic (Proizvodnja/Hogo), unrelated to kitchen schedule
- `kiosk-serve` — kitchen-only function, doesn't need tag check
- Database schema — uses existing `app_settings` table

