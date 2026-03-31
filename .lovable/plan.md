## Plan: Add RFID card serial support (company_card_serial)

### Overview

Add `company_card_serial` ("Broj kartice") field to Admin user management and enable Kiosk pickup by either `company_card_id` (ID) or `company_card_serial` (RFID card serial).

### Changes

#### 1. Admin Panel — UsersManagement.tsx

**Create user form**: Add "Broj kartice" input field below the ID field. Free-text, optional, no validation constraints.

**Edit user form**: Add "Broj kartice" input below the ID field in the edit sheet.

**Mobile cards**: Show `company_card_serial` alongside `company_card_id` if present.

**CSV template/import**: Add "Broj kartice" to template and import logic.

#### 2. Kiosk Preload — `kiosk-preload-meals/index.ts`

Update profiles query to also fetch `company_card_serial`. Build a **second key** in the meals map: if a profile has `company_card_serial`, also map `serial → meal entry`. This way the local cache supports lookup by either identifier.

#### 3. Kiosk Show Meal — `kiosk-show-meal/index.ts`

Change the profile lookup from `.eq("company_card_id", cardId)` to an `.or()` filter:

```
.or(`company_card_id.eq.${cardId},company_card_serial.eq.${cardId}`)
```

This finds the user whether they scan an RFID card (serial) or type their numeric ID.

#### 4. Kiosk Pickup UI — `KioskPickup.tsx`

- Change`pattern="[0-9]*"` constraint to [0-11]
- Update placeholder to `"Unesite ID ili skenirajte karticu"`
- Update subtitle text accordingly
- Cache lookup: check both `cacheRef.current[trimmedId]` keys (already handled by preload changes)

#### 5. useUsers hook — `src/hooks/useUsers.ts`

Already includes `company_card_serial` in the select query. No changes needed.

#### 6. Types — `src/integrations/supabase/types.ts`

Already has `company_card_serial` in the profiles type (confirmed from previous edits). No changes needed.

### Files modified


| File                                              | Change                                                                       |
| ------------------------------------------------- | ---------------------------------------------------------------------------- |
| `src/components/admin/UsersManagement.tsx`        | Add Broj kartice field to create/edit forms, table column, mobile cards, CSV |
| `supabase/functions/kiosk-preload-meals/index.ts` | Fetch serial, dual-key cache map                                             |
| `supabase/functions/kiosk-show-meal/index.ts`     | OR-based profile lookup                                                      |
| `src/pages/KioskPickup.tsx`                       | Update input constraints and placeholder                                     |
