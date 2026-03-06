

## Plan: Organization-based Menu Sub-tabs (Proizvodnja / Hogo)

### Overview
Split the Admin > Jelovnici section into two sub-tabs based on organization. Each tab filters meals and menus accordingly. Employees see only menus matching their profile tag.

### Database Change

Add `organization_tag` column to `menus` table:
```sql
ALTER TABLE menus ADD COLUMN organization_tag TEXT DEFAULT NULL;
```

This column stores which organization a menu belongs to (e.g., `'Proizvodnja'` or `NULL`/other for Hogo).

### Admin: MenusManagement.tsx

Add `Tabs` component with two sub-tabs:

| Tab | Label | Menu filter | Meal filter in create form |
|-----|-------|-------------|---------------------------|
| `proizvodnja` | Proizvodnja | `organization_tag = 'Proizvodnja'` | Meals where `allowed_tags` includes `'Proizvodnja'` |
| `hogo` | Hogo | `organization_tag IS NULL OR organization_tag != 'Proizvodnja'` | Meals where `allowed_tags` does NOT include `'Proizvodnja'` (or has no tags) |

Changes:
- Wrap existing content in `Tabs` with two `TabsContent` sections
- Each tab renders the same menu list/create/clone UI but filtered by active tab
- When creating a menu, auto-set `organization_tag` based on active tab (`'Proizvodnja'` or `NULL`)
- When cloning, cloned menus inherit the source tab's `organization_tag`
- Meal selection in create/edit form filters by the active tab's organization rules

### Hook: useMenus.ts

- Add `organization_tag` to `createMenu` and `cloneWeekMenus` data
- Update `MenuCreateData` type to include optional `organization_tag`

### Types: menu.ts

- Add `organization_tag?: string | null` to `MenuCreateData` and `MenuUpdateData`

### Employee Side

**OrderMealDialog.tsx**: When fetching menus for next week, also filter by the employee's profile tag:
- If user tag is `'Proizvodnja'` → fetch menus where `organization_tag = 'Proizvodnja'`
- Otherwise → fetch menus where `organization_tag IS NULL` or `organization_tag != 'Proizvodnja'`

**EmployeeDashboard.tsx / fetchTotalMenuDays**: Apply same filter logic when counting available menu days.

### Files to modify

| File | Change |
|------|--------|
| DB migration | Add `organization_tag TEXT` to `menus` |
| `src/types/menu.ts` | Add `organization_tag` to create/update types |
| `src/hooks/useMenus.ts` | Pass `organization_tag` in create/clone operations |
| `src/components/admin/MenusManagement.tsx` | Add Tabs (Proizvodnja/Hogo), filter menus and meals per tab, pass org tag on create/clone |
| `src/components/employee/OrderMealDialog.tsx` | Filter menus by user's profile tag |
| `src/components/EmployeeDashboard.tsx` | Filter `fetchTotalMenuDays` by user's tag |

