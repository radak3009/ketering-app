
-- Fix RLS policies to use is_admin_user() instead of profiles.role checks
-- This ensures consistency with user_roles table as single source of truth

-- 1. MEALS table - drop old policies, create new ones
DROP POLICY IF EXISTS "Admins can manage meals" ON public.meals;
DROP POLICY IF EXISTS "Admins can view all meals" ON public.meals;

CREATE POLICY "Admins can manage meals"
ON public.meals FOR ALL
USING (is_admin_user(auth.uid()));

CREATE POLICY "Admins can view all meals"
ON public.meals FOR SELECT
USING (is_admin_user(auth.uid()));

-- 2. MENUS table
DROP POLICY IF EXISTS "Admins can manage menus" ON public.menus;

CREATE POLICY "Admins can manage menus"
ON public.menus FOR ALL
USING (is_admin_user(auth.uid()));

-- 3. ORDERS table
DROP POLICY IF EXISTS "Admins can view all orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can update all orders" ON public.orders;

CREATE POLICY "Admins can view all orders"
ON public.orders FOR SELECT
USING (is_admin_user(auth.uid()));

CREATE POLICY "Admins can update all orders"
ON public.orders FOR UPDATE
USING (is_admin_user(auth.uid()));

-- 4. ORDER_ITEMS table
DROP POLICY IF EXISTS "Admins can view all order items" ON public.order_items;

CREATE POLICY "Admins can view all order items"
ON public.order_items FOR SELECT
USING (is_admin_user(auth.uid()));

-- 5. MENU_MEALS table
DROP POLICY IF EXISTS "Admins can manage menu meals" ON public.menu_meals;

CREATE POLICY "Admins can manage menu meals"
ON public.menu_meals FOR ALL
USING (is_admin_user(auth.uid()));

-- 6. COMPANIES table
DROP POLICY IF EXISTS "Admins can manage companies" ON public.companies;

CREATE POLICY "Admins can manage companies"
ON public.companies FOR ALL
USING (is_admin_user(auth.uid()));
