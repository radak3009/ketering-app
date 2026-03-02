

## Plan: Admin Order Management (Create, Edit, Delete)

### Overview
Add a complete order management workflow for admins on the Orders tab, allowing them to create orders on behalf of employees, edit existing orders, and delete any order — without the Friday 17:00 restriction.

### Database Changes
**New RLS policy needed**: Admins currently cannot INSERT orders for other users or DELETE orders/order_items. Need to add:
- `orders`: Admin INSERT policy (admin can create orders for any user)
- `orders`: Admin DELETE policy
- `order_items`: Admin INSERT policy (bypass the user_id ownership check)
- `order_items`: Admin UPDATE policy (for editing shift/meal)
- `order_items`: Admin DELETE policy

### Frontend Changes

#### 1. New Component: `AdminOrderDialog.tsx`
A dialog for creating/editing orders with fields:
- **Korisnik** (User): Select dropdown listing all employees (from `useUsers`)
- **Datum dostave** (Delivery date): Date picker — any date allowed, no restrictions
- **Smena** (Shift): Select — prva/druga/treća
- **Obrok** (Meal): Select from all active meals (from `useMeals`), not restricted to menu

For **edit mode**: pre-populate fields from existing order item, allow changing shift and meal.

#### 2. Modify `OrdersOverview.tsx`
- Add "Nova porudžbina" button in top-right of card header
- Add edit/delete action buttons per order item in both pivot table views (or via a detail sheet)

#### 3. Modify `UserOrderPivotTable.tsx` and/or `OrderPivotTable.tsx`
- Add edit (pencil) and delete (trash) icons per order item cell
- Edit opens `AdminOrderDialog` in edit mode
- Delete shows confirmation dialog, then removes the order item

#### 4. Extend `useOrders.ts`
Add functions:
- `createAdminOrder(userId, deliveryDate, shift, mealId)` — creates order + order_item
- `updateOrderItem(orderItemId, updates)` — updates shift/meal
- `deleteOrderItem(orderItemId)` — deletes an order item (cleanup_empty_orders trigger handles empty orders)

### Flow
1. Admin clicks "Nova porudžbina" → Dialog opens
2. Selects employee, date, shift, meal → Saves
3. System creates/reuses order for that user+date, inserts order_item
4. For edit: Admin clicks edit icon on any order item → Dialog opens pre-filled → Save updates
5. For delete: Admin clicks delete icon → Confirmation → Deletes order item

### Technical Details
- The `cleanup_empty_orders` trigger already handles deleting empty orders when last item is removed
- Meal price is fetched from `meals` table to set `unit_price`/`total_price`
- No date/time restrictions for admin (unlike employee's Friday 17:00 cutoff)
- All meals shown (not just menu-assigned ones), giving admin full flexibility

