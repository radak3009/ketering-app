

## Plan: Disable "Poruči obrok" when no menus exist

### Approach
Your tooltip idea is good. The component already has a `totalMenuDays` prop and uses tooltip pattern for `profileIncomplete`. We just add a third condition: `totalMenuDays === 0` → disabled button with tooltip saying no menus are available.

### Changes

**`src/components/employee/NextWeekView.tsx`** (lines ~79-109)

Add a new condition before `profileIncomplete` check: when `totalMenuDays === 0`, show disabled button wrapped in tooltip with message like "Nema definisanih jelovnika za iduću nedelju".

Priority order for the button states:
1. `totalMenuDays === 0` → disabled + tooltip "no menus defined"
2. `profileIncomplete` → disabled + tooltip "profile incomplete"  
3. `isAllOrdered` → disabled, label changes to "all ordered"
4. Normal → enabled

**`src/i18n/locales/sr.json`** + **`src/i18n/locales/en.json`**

Add translation key `orders.noMenusForNextWeek`:
- SR: `"Nema definisanih jelovnika za iduću nedelju"`
- EN: `"No menus defined for next week"`

### Single file edit, minimal change — reuses existing tooltip pattern already in the component.

