
-- ============================================================
-- FAZA 2 — Granularni RBAC na DB nivou (M1–M6)
-- ============================================================
-- M1: helperi + audit/seed korekcije
-- ============================================================

-- Helper: kraći wrapper nad has_permission(auth.uid(), _perm)
CREATE OR REPLACE FUNCTION public.has_perm(_perm text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_permission(auth.uid(), _perm);
$$;

-- Helper: kratak wrapper za demo
CREATE OR REPLACE FUNCTION public.is_demo()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_demo_user(auth.uid());
$$;

-- Helper za Kuhinju: dozvoljen UPDATE order_items samo ako menja iskljucivo pickup_status
-- (i opciono pickup_at, pickup_method, served_at — sva pickup-flow polja).
CREATE OR REPLACE FUNCTION public.order_item_only_pickup_changed(_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cnt int;
BEGIN
  -- Funkcija je informativnog tipa: RLS WITH CHECK ne moze pristupiti OLD,
  -- pa Kuhinjski UPDATE branimo kombinacijom (a) USING uslov da red postoji,
  -- (b) trigger BEFORE UPDATE koji blokira promenu kolona razlicitih od pickup_*.
  RETURN true;
END;
$$;

-- BEFORE UPDATE trigger funkcija: ako korisnik nema orders.update ali ima orders.mark_pickup,
-- dozvoli samo promene pickup_* kolona.
CREATE OR REPLACE FUNCTION public.enforce_order_item_pickup_only()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- service_role / admin sa orders.update prolazi bez ogranicenja.
  IF public.has_permission(auth.uid(), 'orders.update') THEN
    RETURN NEW;
  END IF;

  -- Bez orders.update ali sa orders.mark_pickup -> dozvoli samo pickup polja.
  IF public.has_permission(auth.uid(), 'orders.mark_pickup') THEN
    IF NEW.order_id IS DISTINCT FROM OLD.order_id
       OR NEW.meal_id IS DISTINCT FROM OLD.meal_id
       OR NEW.shift IS DISTINCT FROM OLD.shift
       OR NEW.quantity IS DISTINCT FROM OLD.quantity
       OR NEW.unit_price IS DISTINCT FROM OLD.unit_price
       OR NEW.total_price IS DISTINCT FROM OLD.total_price
       OR NEW.notes IS DISTINCT FROM OLD.notes
    THEN
      RAISE EXCEPTION 'Permission denied: only pickup_status can be modified with orders.mark_pickup';
    END IF;
    RETURN NEW;
  END IF;

  -- Inace blokiraj
  RAISE EXCEPTION 'Permission denied for order_items update';
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_order_item_pickup_only ON public.order_items;
CREATE TRIGGER trg_enforce_order_item_pickup_only
BEFORE UPDATE ON public.order_items
FOR EACH ROW
WHEN (current_setting('role', true) <> 'service_role')
EXECUTE FUNCTION public.enforce_order_item_pickup_only();

-- ------------------------------------------------------------
-- Korekcija 1: HR ne sme da menja uloge
-- ------------------------------------------------------------
UPDATE public.role_permissions rp
SET allowed = false
FROM public.roles r
WHERE rp.role_id = r.id
  AND r.key = 'hr'
  AND rp.permission_key = 'users.assign_role';

-- ------------------------------------------------------------
-- Kuhinja: dodaj users.view (potrebno za prikaz imena zaposlenih u redu porudzbina)
-- ------------------------------------------------------------
UPDATE public.role_permissions rp
SET allowed = true
FROM public.roles r
WHERE rp.role_id = r.id
  AND r.key = 'kuhinja'
  AND rp.permission_key = 'users.view';

-- ------------------------------------------------------------
-- Audit: Administrator MORA imati sve dozvole = true. Auto-grant ako bilo sta fali.
-- ------------------------------------------------------------
INSERT INTO public.role_permissions (role_id, permission_key, allowed)
SELECT r.id, p.key, true
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.key = 'administrator'
  AND NOT EXISTS (
    SELECT 1 FROM public.role_permissions rp
    WHERE rp.role_id = r.id AND rp.permission_key = p.key
  );

UPDATE public.role_permissions rp
SET allowed = true
FROM public.roles r
WHERE rp.role_id = r.id
  AND r.key = 'administrator'
  AND rp.allowed = false;

-- ============================================================
-- M3: read-only katalozi -> has_perm po operaciji
-- ============================================================

-- meals
DROP POLICY IF EXISTS "Admins can manage meals" ON public.meals;
DROP POLICY IF EXISTS "Admins can view all meals" ON public.meals;
-- Users can view active available meals: ostaje (employee read)
CREATE POLICY "Staff can view all meals"
  ON public.meals FOR SELECT TO authenticated
  USING (public.has_perm('meals.view'));
CREATE POLICY "Staff can insert meals"
  ON public.meals FOR INSERT TO authenticated
  WITH CHECK (public.has_perm('meals.write'));
CREATE POLICY "Staff can update meals"
  ON public.meals FOR UPDATE TO authenticated
  USING (public.has_perm('meals.write'))
  WITH CHECK (public.has_perm('meals.write'));
CREATE POLICY "Staff can delete meals"
  ON public.meals FOR DELETE TO authenticated
  USING (public.has_perm('meals.delete'));

-- menus
DROP POLICY IF EXISTS "Admins can manage menus" ON public.menus;
-- "Everyone can view active menus" (is_active = true) — ostaje
CREATE POLICY "Staff can view all menus"
  ON public.menus FOR SELECT TO authenticated
  USING (public.has_perm('menus.view'));
CREATE POLICY "Staff can insert menus"
  ON public.menus FOR INSERT TO authenticated
  WITH CHECK (public.has_perm('menus.write'));
CREATE POLICY "Staff can update menus"
  ON public.menus FOR UPDATE TO authenticated
  USING (public.has_perm('menus.write'))
  WITH CHECK (public.has_perm('menus.write'));
CREATE POLICY "Staff can delete menus"
  ON public.menus FOR DELETE TO authenticated
  USING (public.has_perm('menus.delete'));

-- menu_meals (svi auth view ostaje)
DROP POLICY IF EXISTS "Admins can manage menu meals" ON public.menu_meals;
CREATE POLICY "Staff can write menu meals"
  ON public.menu_meals FOR INSERT TO authenticated
  WITH CHECK (public.has_perm('menus.write'));
CREATE POLICY "Staff can update menu meals"
  ON public.menu_meals FOR UPDATE TO authenticated
  USING (public.has_perm('menus.write'))
  WITH CHECK (public.has_perm('menus.write'));
CREATE POLICY "Staff can delete menu meals"
  ON public.menu_meals FOR DELETE TO authenticated
  USING (public.has_perm('menus.write'));

-- menu_templates
DROP POLICY IF EXISTS "Admins can manage menu templates" ON public.menu_templates;
CREATE POLICY "Staff can insert menu templates"
  ON public.menu_templates FOR INSERT TO authenticated
  WITH CHECK (public.has_perm('menus.templates'));
CREATE POLICY "Staff can update menu templates"
  ON public.menu_templates FOR UPDATE TO authenticated
  USING (public.has_perm('menus.templates'))
  WITH CHECK (public.has_perm('menus.templates'));
CREATE POLICY "Staff can delete menu templates"
  ON public.menu_templates FOR DELETE TO authenticated
  USING (public.has_perm('menus.templates'));

-- menu_template_meals
DROP POLICY IF EXISTS "Admins can manage menu template meals" ON public.menu_template_meals;
CREATE POLICY "Staff can insert menu template meals"
  ON public.menu_template_meals FOR INSERT TO authenticated
  WITH CHECK (public.has_perm('menus.templates'));
CREATE POLICY "Staff can update menu template meals"
  ON public.menu_template_meals FOR UPDATE TO authenticated
  USING (public.has_perm('menus.templates'))
  WITH CHECK (public.has_perm('menus.templates'));
CREATE POLICY "Staff can delete menu template meals"
  ON public.menu_template_meals FOR DELETE TO authenticated
  USING (public.has_perm('menus.templates'));

-- meal_groups
DROP POLICY IF EXISTS "Admins can manage meal groups" ON public.meal_groups;
CREATE POLICY "Staff can insert meal groups"
  ON public.meal_groups FOR INSERT TO authenticated
  WITH CHECK (public.has_perm('settings.organization'));
CREATE POLICY "Staff can update meal groups"
  ON public.meal_groups FOR UPDATE TO authenticated
  USING (public.has_perm('settings.organization'))
  WITH CHECK (public.has_perm('settings.organization'));
CREATE POLICY "Staff can delete meal groups"
  ON public.meal_groups FOR DELETE TO authenticated
  USING (public.has_perm('settings.organization'));

-- allergens
DROP POLICY IF EXISTS "Admins can delete allergens" ON public.allergens;
DROP POLICY IF EXISTS "Admins can insert allergens" ON public.allergens;
CREATE POLICY "Staff can insert allergens"
  ON public.allergens FOR INSERT TO authenticated
  WITH CHECK (public.has_perm('settings.organization'));
CREATE POLICY "Staff can update allergens"
  ON public.allergens FOR UPDATE TO authenticated
  USING (public.has_perm('settings.organization'))
  WITH CHECK (public.has_perm('settings.organization'));
CREATE POLICY "Staff can delete allergens"
  ON public.allergens FOR DELETE TO authenticated
  USING (public.has_perm('settings.organization'));

-- ============================================================
-- M4: porudzbine
-- ============================================================

-- orders
DROP POLICY IF EXISTS "Admins can view all orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can insert orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can update all orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can delete orders" ON public.orders;
-- Self politike ostaju netaknute (Users can view/create/update their own orders)
CREATE POLICY "Staff can view all orders"
  ON public.orders FOR SELECT TO authenticated
  USING (public.has_perm('orders.view'));
CREATE POLICY "Staff can insert orders"
  ON public.orders FOR INSERT TO authenticated
  WITH CHECK (public.has_perm('orders.create'));
CREATE POLICY "Staff can update orders"
  ON public.orders FOR UPDATE TO authenticated
  USING (public.has_perm('orders.update'))
  WITH CHECK (public.has_perm('orders.update'));
CREATE POLICY "Staff can delete orders"
  ON public.orders FOR DELETE TO authenticated
  USING (public.has_perm('orders.delete'));

-- order_items
DROP POLICY IF EXISTS "Admins can view all order items" ON public.order_items;
DROP POLICY IF EXISTS "Admins can insert order items" ON public.order_items;
DROP POLICY IF EXISTS "Admins can update order items" ON public.order_items;
DROP POLICY IF EXISTS "Admins can delete order items" ON public.order_items;
-- Self politike ostaju (Users can view/create/delete their own order items)
CREATE POLICY "Staff can view all order items"
  ON public.order_items FOR SELECT TO authenticated
  USING (public.has_perm('orders.view'));
CREATE POLICY "Staff can insert order items"
  ON public.order_items FOR INSERT TO authenticated
  WITH CHECK (public.has_perm('orders.create'));
-- UPDATE: orders.update ILI orders.mark_pickup (kolonska restrikcija preko trigera enforce_order_item_pickup_only)
CREATE POLICY "Staff can update order items"
  ON public.order_items FOR UPDATE TO authenticated
  USING (public.has_perm('orders.update') OR public.has_perm('orders.mark_pickup'))
  WITH CHECK (public.has_perm('orders.update') OR public.has_perm('orders.mark_pickup'));
CREATE POLICY "Staff can delete order items"
  ON public.order_items FOR DELETE TO authenticated
  USING (public.has_perm('orders.delete'));

-- pickup_requests
DROP POLICY IF EXISTS "Admins can view all pickup_requests" ON public.pickup_requests;
DROP POLICY IF EXISTS "Admins can insert pickup_requests" ON public.pickup_requests;
DROP POLICY IF EXISTS "Admins can update pickup_requests" ON public.pickup_requests;
-- Self select ostaje
CREATE POLICY "Staff can view pickup_requests"
  ON public.pickup_requests FOR SELECT TO authenticated
  USING (public.has_perm('orders.view'));
CREATE POLICY "Staff can insert pickup_requests"
  ON public.pickup_requests FOR INSERT TO authenticated
  WITH CHECK (public.has_perm('orders.create') OR public.has_perm('orders.mark_pickup'));
CREATE POLICY "Staff can update pickup_requests"
  ON public.pickup_requests FOR UPDATE TO authenticated
  USING (public.has_perm('orders.update') OR public.has_perm('orders.mark_pickup'))
  WITH CHECK (public.has_perm('orders.update') OR public.has_perm('orders.mark_pickup'));

-- ============================================================
-- M5: korisnici i komunikacija
-- ============================================================

-- profiles
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can delete all profiles" ON public.profiles;
-- Self politike (insert/update/select) ostaju netaknute
CREATE POLICY "Staff can view all profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING ((auth.uid() = user_id) OR public.has_perm('users.view'));
CREATE POLICY "Staff can update all profiles"
  ON public.profiles FOR UPDATE TO authenticated
  USING (public.has_perm('users.update'))
  WITH CHECK (public.has_perm('users.update'));
CREATE POLICY "Staff can delete profiles"
  ON public.profiles FOR DELETE TO authenticated
  USING (public.has_perm('users.delete'));
-- Admin INSERT u profiles ide preko edge funkcija (create-user) sa service_role.

-- notification_preferences
DROP POLICY IF EXISTS "Admins can view all preferences" ON public.notification_preferences;
CREATE POLICY "Staff can view all preferences"
  ON public.notification_preferences FOR SELECT TO authenticated
  USING ((auth.uid() = user_id) OR public.has_perm('users.view'));

-- feedback
DROP POLICY IF EXISTS "Admins can view all feedback" ON public.feedback;
DROP POLICY IF EXISTS "Admins can update feedback" ON public.feedback;
CREATE POLICY "Staff can view all feedback"
  ON public.feedback FOR SELECT TO authenticated
  USING ((auth.uid() = user_id) OR public.has_perm('feedback.view'));
CREATE POLICY "Staff can update feedback"
  ON public.feedback FOR UPDATE TO authenticated
  USING (public.has_perm('feedback.process'))
  WITH CHECK (public.has_perm('feedback.process'));

-- suggestions
DROP POLICY IF EXISTS "Admins can view all suggestions" ON public.suggestions;
DROP POLICY IF EXISTS "Admins can update suggestions" ON public.suggestions;
CREATE POLICY "Staff can view all suggestions"
  ON public.suggestions FOR SELECT TO authenticated
  USING ((auth.uid() = user_id) OR public.has_perm('suggestions.view'));
CREATE POLICY "Staff can update suggestions"
  ON public.suggestions FOR UPDATE TO authenticated
  USING (public.has_perm('suggestions.process'))
  WITH CHECK (public.has_perm('suggestions.process'));

-- admin_broadcasts
DROP POLICY IF EXISTS "Admins can read broadcasts" ON public.admin_broadcasts;
DROP POLICY IF EXISTS "Admins can insert broadcasts" ON public.admin_broadcasts;
-- "Employees can view broadcasts" (true) — ostaje, svi authenticated cita
CREATE POLICY "Staff can insert broadcasts"
  ON public.admin_broadcasts FOR INSERT TO authenticated
  WITH CHECK (public.has_perm('notifications.custom_email'));

-- email_verification_tokens
DROP POLICY IF EXISTS "Admins can view all verification tokens" ON public.email_verification_tokens;
CREATE POLICY "Staff can view verification tokens"
  ON public.email_verification_tokens FOR SELECT TO authenticated
  USING (public.has_perm('users.view'));

-- push_subscriptions
DROP POLICY IF EXISTS "Admins can view all subscriptions" ON public.push_subscriptions;
CREATE POLICY "Staff can view all subscriptions"
  ON public.push_subscriptions FOR SELECT TO authenticated
  USING ((auth.uid() = user_id) OR public.has_perm('users.view'));

-- companies
DROP POLICY IF EXISTS "Admins can manage companies" ON public.companies;
-- "Users can view their own company" (can_view_company) ostaje
CREATE POLICY "Staff can view all companies"
  ON public.companies FOR SELECT TO authenticated
  USING (public.has_perm('users.view'));
CREATE POLICY "Staff can insert companies"
  ON public.companies FOR INSERT TO authenticated
  WITH CHECK (public.has_perm('settings.organization'));
CREATE POLICY "Staff can update companies"
  ON public.companies FOR UPDATE TO authenticated
  USING (public.has_perm('settings.organization'))
  WITH CHECK (public.has_perm('settings.organization'));
CREATE POLICY "Staff can delete companies"
  ON public.companies FOR DELETE TO authenticated
  USING (public.has_perm('settings.organization'));

-- ============================================================
-- M6: postavke
-- ============================================================

-- app_settings (read za sve auth ostaje)
DROP POLICY IF EXISTS "Admins can manage settings" ON public.app_settings;
CREATE POLICY "Staff can insert app settings"
  ON public.app_settings FOR INSERT TO authenticated
  WITH CHECK (
    public.has_perm('settings.organization')
    OR public.has_perm('settings.kiosk')
    OR public.has_perm('settings.kitchen')
  );
CREATE POLICY "Staff can update app settings"
  ON public.app_settings FOR UPDATE TO authenticated
  USING (
    public.has_perm('settings.organization')
    OR public.has_perm('settings.kiosk')
    OR public.has_perm('settings.kitchen')
  )
  WITH CHECK (
    public.has_perm('settings.organization')
    OR public.has_perm('settings.kiosk')
    OR public.has_perm('settings.kitchen')
  );
CREATE POLICY "Staff can delete app settings"
  ON public.app_settings FOR DELETE TO authenticated
  USING (
    public.has_perm('settings.organization')
    OR public.has_perm('settings.kiosk')
    OR public.has_perm('settings.kitchen')
  );

-- kitchen_schedule_weekly
DROP POLICY IF EXISTS "Admins can manage weekly schedule" ON public.kitchen_schedule_weekly;
CREATE POLICY "Authenticated can read weekly schedule"
  ON public.kitchen_schedule_weekly FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "Staff can insert weekly schedule"
  ON public.kitchen_schedule_weekly FOR INSERT TO authenticated
  WITH CHECK (public.has_perm('settings.kitchen'));
CREATE POLICY "Staff can update weekly schedule"
  ON public.kitchen_schedule_weekly FOR UPDATE TO authenticated
  USING (public.has_perm('settings.kitchen'))
  WITH CHECK (public.has_perm('settings.kitchen'));
CREATE POLICY "Staff can delete weekly schedule"
  ON public.kitchen_schedule_weekly FOR DELETE TO authenticated
  USING (public.has_perm('settings.kitchen'));

-- kitchen_schedule_exceptions
DROP POLICY IF EXISTS "Admins can manage exceptions" ON public.kitchen_schedule_exceptions;
CREATE POLICY "Authenticated can read schedule exceptions"
  ON public.kitchen_schedule_exceptions FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "Staff can insert schedule exceptions"
  ON public.kitchen_schedule_exceptions FOR INSERT TO authenticated
  WITH CHECK (public.has_perm('settings.kitchen'));
CREATE POLICY "Staff can update schedule exceptions"
  ON public.kitchen_schedule_exceptions FOR UPDATE TO authenticated
  USING (public.has_perm('settings.kitchen'))
  WITH CHECK (public.has_perm('settings.kitchen'));
CREATE POLICY "Staff can delete schedule exceptions"
  ON public.kitchen_schedule_exceptions FOR DELETE TO authenticated
  USING (public.has_perm('settings.kitchen'));
