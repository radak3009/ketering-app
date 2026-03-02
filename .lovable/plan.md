

## Plan: Server-side order validation + Admin form required fields + Employee UI blocking

### Problem
1. Users without `company_card_id` and `tag` can still create orders (no server-side check)
2. Admin user creation form doesn't require `company_card_id` or `tag`
3. Employee "order meal" button should be visually disabled with tooltip when profile is incomplete

### Changes

#### 1. Database: RLS policy on `orders` INSERT for employees
Add a validation trigger (or modify RLS) on `orders` table to prevent employees without `company_card_id` from inserting orders.

**Approach**: Add a new RLS policy that replaces the current employee INSERT policy. The new policy checks that the user has a `company_card_id` set in their profile before allowing order creation.

```sql
-- Drop existing employee insert policy
DROP POLICY IF EXISTS "Users can create their own orders" ON public.orders;

-- New policy: employees must have company_card_id to create orders
CREATE POLICY "Users can create their own orders" ON public.orders
FOR INSERT WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.company_card_id IS NOT NULL
    AND profiles.company_card_id <> ''
  )
);
```

#### 2. Edge Function: `create-user` - require `company_card_id`
In `supabase/functions/create-user/index.ts`, add validation after parsing the request body:
- If `company_card_id` is missing or empty, return error "ID zaposlenog je obavezan"

#### 3. Admin form: Make `company_card_id` required
In `src/components/admin/UsersManagement.tsx`, in `handleCreateUser`:
- Add check: if `company_card_id` is empty, show error toast "ID zaposlenog je obavezan"

#### 4. Employee UI: Disable order button with tooltip
In `src/components/employee/NextWeekView.tsx`:
- Accept new prop `profileIncomplete: boolean`
- When `profileIncomplete` is true, disable the "Order Meal" button and wrap it in a `Tooltip` explaining they need to set ID and organization first

In `src/components/EmployeeDashboard.tsx`:
- Pass `profileIncomplete={requiresIdSetup}` to `NextWeekView`

#### 5. i18n: Add translation keys
- `orders.profileIncomplete`: "Morate uneti ID i organizaciju u profilu pre nego što možete poručiti obrok" / "You must set your ID and organization in your profile before ordering meals"
- `users.companyCardIdRequired`: "ID zaposlenog je obavezan" / "Employee ID is required"

### Technical Details

- The RLS policy change is the critical server-side enforcement -- even if UI is bypassed, orders cannot be created
- The `order_items` INSERT policy already requires a valid `order_id` owned by the user, so blocking `orders` INSERT is sufficient
- Admin orders are covered by separate admin INSERT policies and are unaffected
- The tooltip uses the existing shadcn Tooltip component already in the project

