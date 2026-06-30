
-- Performance: add missing indexes for employee hot paths
CREATE INDEX IF NOT EXISTS idx_orders_user_id           ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_user_delivery     ON public.orders(user_id, delivery_date);
CREATE INDEX IF NOT EXISTS idx_orders_delivery_date     ON public.orders(delivery_date);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id     ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_menus_menu_date          ON public.menus(menu_date);
CREATE INDEX IF NOT EXISTS idx_menus_active_date        ON public.menus(is_active, menu_date);
CREATE INDEX IF NOT EXISTS idx_role_permissions_allowed ON public.role_permissions(role_id, permission_key) WHERE allowed = true;

-- =====================================================================
-- Wrap auth.uid() and has_perm(...) in (SELECT ...) so Postgres treats
-- them as InitPlan (evaluated once per query) instead of per-row.
-- Logic is identical; only execution plan changes.
-- =====================================================================

-- admin_broadcasts
DROP POLICY IF EXISTS "Staff can insert broadcasts" ON public.admin_broadcasts;
CREATE POLICY "Staff can insert broadcasts" ON public.admin_broadcasts FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.has_perm('notifications.custom_email')));

-- allergens
DROP POLICY IF EXISTS "Staff can delete allergens" ON public.allergens;
CREATE POLICY "Staff can delete allergens" ON public.allergens FOR DELETE TO authenticated
  USING ((SELECT public.has_perm('settings.organization')));
DROP POLICY IF EXISTS "Staff can insert allergens" ON public.allergens;
CREATE POLICY "Staff can insert allergens" ON public.allergens FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.has_perm('settings.organization')));
DROP POLICY IF EXISTS "Staff can update allergens" ON public.allergens;
CREATE POLICY "Staff can update allergens" ON public.allergens FOR UPDATE TO authenticated
  USING ((SELECT public.has_perm('settings.organization')))
  WITH CHECK ((SELECT public.has_perm('settings.organization')));

-- app_settings
DROP POLICY IF EXISTS "Staff can delete app settings" ON public.app_settings;
CREATE POLICY "Staff can delete app settings" ON public.app_settings FOR DELETE TO authenticated
  USING ((SELECT public.has_perm('settings.organization')) OR (SELECT public.has_perm('settings.kiosk')) OR (SELECT public.has_perm('settings.kitchen')));
DROP POLICY IF EXISTS "Staff can insert app settings" ON public.app_settings;
CREATE POLICY "Staff can insert app settings" ON public.app_settings FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.has_perm('settings.organization')) OR (SELECT public.has_perm('settings.kiosk')) OR (SELECT public.has_perm('settings.kitchen')));
DROP POLICY IF EXISTS "Staff can update app settings" ON public.app_settings;
CREATE POLICY "Staff can update app settings" ON public.app_settings FOR UPDATE TO authenticated
  USING ((SELECT public.has_perm('settings.organization')) OR (SELECT public.has_perm('settings.kiosk')) OR (SELECT public.has_perm('settings.kitchen')))
  WITH CHECK ((SELECT public.has_perm('settings.organization')) OR (SELECT public.has_perm('settings.kiosk')) OR (SELECT public.has_perm('settings.kitchen')));

-- companies
DROP POLICY IF EXISTS "Staff can delete companies" ON public.companies;
CREATE POLICY "Staff can delete companies" ON public.companies FOR DELETE TO authenticated
  USING ((SELECT public.has_perm('settings.organization')));
DROP POLICY IF EXISTS "Staff can insert companies" ON public.companies;
CREATE POLICY "Staff can insert companies" ON public.companies FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.has_perm('settings.organization')));
DROP POLICY IF EXISTS "Staff can update companies" ON public.companies;
CREATE POLICY "Staff can update companies" ON public.companies FOR UPDATE TO authenticated
  USING ((SELECT public.has_perm('settings.organization')))
  WITH CHECK ((SELECT public.has_perm('settings.organization')));
DROP POLICY IF EXISTS "Staff can view all companies" ON public.companies;
CREATE POLICY "Staff can view all companies" ON public.companies FOR SELECT TO authenticated
  USING ((SELECT public.has_perm('users.view')));

-- email_verification_tokens
DROP POLICY IF EXISTS "Staff can view verification tokens" ON public.email_verification_tokens;
CREATE POLICY "Staff can view verification tokens" ON public.email_verification_tokens FOR SELECT TO authenticated
  USING ((SELECT public.has_perm('users.view')));

-- feedback
DROP POLICY IF EXISTS "Staff can update feedback" ON public.feedback;
CREATE POLICY "Staff can update feedback" ON public.feedback FOR UPDATE TO authenticated
  USING ((SELECT public.has_perm('feedback.process')))
  WITH CHECK ((SELECT public.has_perm('feedback.process')));
DROP POLICY IF EXISTS "Staff can view all feedback" ON public.feedback;
CREATE POLICY "Staff can view all feedback" ON public.feedback FOR SELECT TO authenticated
  USING (((SELECT auth.uid()) = user_id) OR (SELECT public.has_perm('feedback.view')));
DROP POLICY IF EXISTS "Users can create their own feedback" ON public.feedback;
CREATE POLICY "Users can create their own feedback" ON public.feedback FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS "Users can view their own feedback" ON public.feedback;
CREATE POLICY "Users can view their own feedback" ON public.feedback FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

-- kitchen_schedule_exceptions
DROP POLICY IF EXISTS "Staff can delete schedule exceptions" ON public.kitchen_schedule_exceptions;
CREATE POLICY "Staff can delete schedule exceptions" ON public.kitchen_schedule_exceptions FOR DELETE TO authenticated
  USING ((SELECT public.has_perm('settings.kitchen')));
DROP POLICY IF EXISTS "Staff can insert schedule exceptions" ON public.kitchen_schedule_exceptions;
CREATE POLICY "Staff can insert schedule exceptions" ON public.kitchen_schedule_exceptions FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.has_perm('settings.kitchen')));
DROP POLICY IF EXISTS "Staff can update schedule exceptions" ON public.kitchen_schedule_exceptions;
CREATE POLICY "Staff can update schedule exceptions" ON public.kitchen_schedule_exceptions FOR UPDATE TO authenticated
  USING ((SELECT public.has_perm('settings.kitchen')))
  WITH CHECK ((SELECT public.has_perm('settings.kitchen')));

-- kitchen_schedule_weekly
DROP POLICY IF EXISTS "Staff can delete weekly schedule" ON public.kitchen_schedule_weekly;
CREATE POLICY "Staff can delete weekly schedule" ON public.kitchen_schedule_weekly FOR DELETE TO authenticated
  USING ((SELECT public.has_perm('settings.kitchen')));
DROP POLICY IF EXISTS "Staff can insert weekly schedule" ON public.kitchen_schedule_weekly;
CREATE POLICY "Staff can insert weekly schedule" ON public.kitchen_schedule_weekly FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.has_perm('settings.kitchen')));
DROP POLICY IF EXISTS "Staff can update weekly schedule" ON public.kitchen_schedule_weekly;
CREATE POLICY "Staff can update weekly schedule" ON public.kitchen_schedule_weekly FOR UPDATE TO authenticated
  USING ((SELECT public.has_perm('settings.kitchen')))
  WITH CHECK ((SELECT public.has_perm('settings.kitchen')));

-- meal_groups
DROP POLICY IF EXISTS "Authenticated users can view meal groups" ON public.meal_groups;
CREATE POLICY "Authenticated users can view meal groups" ON public.meal_groups FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL);
DROP POLICY IF EXISTS "Staff can delete meal groups" ON public.meal_groups;
CREATE POLICY "Staff can delete meal groups" ON public.meal_groups FOR DELETE TO authenticated
  USING ((SELECT public.has_perm('settings.organization')));
DROP POLICY IF EXISTS "Staff can insert meal groups" ON public.meal_groups;
CREATE POLICY "Staff can insert meal groups" ON public.meal_groups FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.has_perm('settings.organization')));
DROP POLICY IF EXISTS "Staff can update meal groups" ON public.meal_groups;
CREATE POLICY "Staff can update meal groups" ON public.meal_groups FOR UPDATE TO authenticated
  USING ((SELECT public.has_perm('settings.organization')))
  WITH CHECK ((SELECT public.has_perm('settings.organization')));

-- meals
DROP POLICY IF EXISTS "Staff can delete meals" ON public.meals;
CREATE POLICY "Staff can delete meals" ON public.meals FOR DELETE TO authenticated
  USING ((SELECT public.has_perm('meals.delete')));
DROP POLICY IF EXISTS "Staff can insert meals" ON public.meals;
CREATE POLICY "Staff can insert meals" ON public.meals FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.has_perm('meals.write')));
DROP POLICY IF EXISTS "Staff can update meals" ON public.meals;
CREATE POLICY "Staff can update meals" ON public.meals FOR UPDATE TO authenticated
  USING ((SELECT public.has_perm('meals.write')))
  WITH CHECK ((SELECT public.has_perm('meals.write')));
DROP POLICY IF EXISTS "Staff can view all meals" ON public.meals;
CREATE POLICY "Staff can view all meals" ON public.meals FOR SELECT TO authenticated
  USING ((SELECT public.has_perm('meals.view')));

-- menu_meals
DROP POLICY IF EXISTS "Staff can delete menu meals" ON public.menu_meals;
CREATE POLICY "Staff can delete menu meals" ON public.menu_meals FOR DELETE TO authenticated
  USING ((SELECT public.has_perm('menus.write')));
DROP POLICY IF EXISTS "Staff can update menu meals" ON public.menu_meals;
CREATE POLICY "Staff can update menu meals" ON public.menu_meals FOR UPDATE TO authenticated
  USING ((SELECT public.has_perm('menus.write')))
  WITH CHECK ((SELECT public.has_perm('menus.write')));
DROP POLICY IF EXISTS "Staff can write menu meals" ON public.menu_meals;
CREATE POLICY "Staff can write menu meals" ON public.menu_meals FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.has_perm('menus.write')));

-- menu_template_meals
DROP POLICY IF EXISTS "Staff can delete menu template meals" ON public.menu_template_meals;
CREATE POLICY "Staff can delete menu template meals" ON public.menu_template_meals FOR DELETE TO authenticated
  USING ((SELECT public.has_perm('menus.templates')));
DROP POLICY IF EXISTS "Staff can insert menu template meals" ON public.menu_template_meals;
CREATE POLICY "Staff can insert menu template meals" ON public.menu_template_meals FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.has_perm('menus.templates')));
DROP POLICY IF EXISTS "Staff can update menu template meals" ON public.menu_template_meals;
CREATE POLICY "Staff can update menu template meals" ON public.menu_template_meals FOR UPDATE TO authenticated
  USING ((SELECT public.has_perm('menus.templates')))
  WITH CHECK ((SELECT public.has_perm('menus.templates')));

-- menu_templates
DROP POLICY IF EXISTS "Staff can delete menu templates" ON public.menu_templates;
CREATE POLICY "Staff can delete menu templates" ON public.menu_templates FOR DELETE TO authenticated
  USING ((SELECT public.has_perm('menus.templates')));
DROP POLICY IF EXISTS "Staff can insert menu templates" ON public.menu_templates;
CREATE POLICY "Staff can insert menu templates" ON public.menu_templates FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.has_perm('menus.templates')));
DROP POLICY IF EXISTS "Staff can update menu templates" ON public.menu_templates;
CREATE POLICY "Staff can update menu templates" ON public.menu_templates FOR UPDATE TO authenticated
  USING ((SELECT public.has_perm('menus.templates')))
  WITH CHECK ((SELECT public.has_perm('menus.templates')));

-- menus
DROP POLICY IF EXISTS "Staff can delete menus" ON public.menus;
CREATE POLICY "Staff can delete menus" ON public.menus FOR DELETE TO authenticated
  USING ((SELECT public.has_perm('menus.delete')));
DROP POLICY IF EXISTS "Staff can insert menus" ON public.menus;
CREATE POLICY "Staff can insert menus" ON public.menus FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.has_perm('menus.write')));
DROP POLICY IF EXISTS "Staff can update menus" ON public.menus;
CREATE POLICY "Staff can update menus" ON public.menus FOR UPDATE TO authenticated
  USING ((SELECT public.has_perm('menus.write')))
  WITH CHECK ((SELECT public.has_perm('menus.write')));
DROP POLICY IF EXISTS "Staff can view all menus" ON public.menus;
CREATE POLICY "Staff can view all menus" ON public.menus FOR SELECT TO authenticated
  USING ((SELECT public.has_perm('menus.view')));

-- notification_preferences
DROP POLICY IF EXISTS "Staff can view all preferences" ON public.notification_preferences;
CREATE POLICY "Staff can view all preferences" ON public.notification_preferences FOR SELECT TO authenticated
  USING (((SELECT auth.uid()) = user_id) OR (SELECT public.has_perm('users.view')));
DROP POLICY IF EXISTS "Users can insert their own preferences" ON public.notification_preferences;
CREATE POLICY "Users can insert their own preferences" ON public.notification_preferences FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS "Users can update their own preferences" ON public.notification_preferences;
CREATE POLICY "Users can update their own preferences" ON public.notification_preferences FOR UPDATE
  USING ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS "Users can view their own preferences" ON public.notification_preferences;
CREATE POLICY "Users can view their own preferences" ON public.notification_preferences FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

-- order_items
DROP POLICY IF EXISTS "Staff can delete order items" ON public.order_items;
CREATE POLICY "Staff can delete order items" ON public.order_items FOR DELETE TO authenticated
  USING ((SELECT public.has_perm('orders.delete')));
DROP POLICY IF EXISTS "Staff can insert order items" ON public.order_items;
CREATE POLICY "Staff can insert order items" ON public.order_items FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.has_perm('orders.create')));
DROP POLICY IF EXISTS "Staff can update order items" ON public.order_items;
CREATE POLICY "Staff can update order items" ON public.order_items FOR UPDATE TO authenticated
  USING ((SELECT public.has_perm('orders.update')) OR (SELECT public.has_perm('orders.mark_pickup')))
  WITH CHECK ((SELECT public.has_perm('orders.update')) OR (SELECT public.has_perm('orders.mark_pickup')));
DROP POLICY IF EXISTS "Staff can view all order items" ON public.order_items;
CREATE POLICY "Staff can view all order items" ON public.order_items FOR SELECT TO authenticated
  USING ((SELECT public.has_perm('orders.view')));
DROP POLICY IF EXISTS "Users can create their own order items" ON public.order_items;
CREATE POLICY "Users can create their own order items" ON public.order_items FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND orders.user_id = (SELECT auth.uid())));
DROP POLICY IF EXISTS "Users can delete their own order items" ON public.order_items;
CREATE POLICY "Users can delete their own order items" ON public.order_items FOR DELETE
  USING (EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND orders.user_id = (SELECT auth.uid())));
DROP POLICY IF EXISTS "Users can view their own order items" ON public.order_items;
CREATE POLICY "Users can view their own order items" ON public.order_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND orders.user_id = (SELECT auth.uid())));

-- orders
DROP POLICY IF EXISTS "Staff can delete orders" ON public.orders;
CREATE POLICY "Staff can delete orders" ON public.orders FOR DELETE TO authenticated
  USING ((SELECT public.has_perm('orders.delete')));
DROP POLICY IF EXISTS "Staff can insert orders" ON public.orders;
CREATE POLICY "Staff can insert orders" ON public.orders FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.has_perm('orders.create')));
DROP POLICY IF EXISTS "Staff can update orders" ON public.orders;
CREATE POLICY "Staff can update orders" ON public.orders FOR UPDATE TO authenticated
  USING ((SELECT public.has_perm('orders.update')))
  WITH CHECK ((SELECT public.has_perm('orders.update')));
DROP POLICY IF EXISTS "Staff can view all orders" ON public.orders;
CREATE POLICY "Staff can view all orders" ON public.orders FOR SELECT TO authenticated
  USING ((SELECT public.has_perm('orders.view')));
DROP POLICY IF EXISTS "Users can create their own orders" ON public.orders;
CREATE POLICY "Users can create their own orders" ON public.orders FOR INSERT
  WITH CHECK (((SELECT auth.uid()) = user_id) AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = (SELECT auth.uid())
      AND profiles.company_card_id IS NOT NULL
      AND profiles.company_card_id <> ''
  ));
DROP POLICY IF EXISTS "Users can update their own orders" ON public.orders;
CREATE POLICY "Users can update their own orders" ON public.orders FOR UPDATE
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK (((SELECT auth.uid()) = user_id)
    AND NOT (status         IS DISTINCT FROM (SELECT o.status         FROM orders o WHERE o.id = orders.id))
    AND NOT (total_amount   IS DISTINCT FROM (SELECT o.total_amount   FROM orders o WHERE o.id = orders.id))
    AND NOT (delivery_date  IS DISTINCT FROM (SELECT o.delivery_date  FROM orders o WHERE o.id = orders.id))
    AND NOT (menu_id        IS DISTINCT FROM (SELECT o.menu_id        FROM orders o WHERE o.id = orders.id))
  );
DROP POLICY IF EXISTS "Users can view their own orders" ON public.orders;
CREATE POLICY "Users can view their own orders" ON public.orders FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

-- pickup_requests
DROP POLICY IF EXISTS "Staff can insert pickup_requests" ON public.pickup_requests;
CREATE POLICY "Staff can insert pickup_requests" ON public.pickup_requests FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.has_perm('orders.create')) OR (SELECT public.has_perm('orders.mark_pickup')));
DROP POLICY IF EXISTS "Staff can update pickup_requests" ON public.pickup_requests;
CREATE POLICY "Staff can update pickup_requests" ON public.pickup_requests FOR UPDATE TO authenticated
  USING ((SELECT public.has_perm('orders.update')) OR (SELECT public.has_perm('orders.mark_pickup')))
  WITH CHECK ((SELECT public.has_perm('orders.update')) OR (SELECT public.has_perm('orders.mark_pickup')));
DROP POLICY IF EXISTS "Staff can view pickup_requests" ON public.pickup_requests;
CREATE POLICY "Staff can view pickup_requests" ON public.pickup_requests FOR SELECT TO authenticated
  USING ((SELECT public.has_perm('orders.view')));
DROP POLICY IF EXISTS "Users can view own pickup requests" ON public.pickup_requests;
CREATE POLICY "Users can view own pickup requests" ON public.pickup_requests FOR SELECT
  USING (profile_id IN (SELECT p.id FROM profiles p WHERE p.user_id = (SELECT auth.uid())));

-- profiles
DROP POLICY IF EXISTS "Staff can delete profiles" ON public.profiles;
CREATE POLICY "Staff can delete profiles" ON public.profiles FOR DELETE TO authenticated
  USING ((SELECT public.has_perm('users.delete')));
DROP POLICY IF EXISTS "Staff can update all profiles" ON public.profiles;
CREATE POLICY "Staff can update all profiles" ON public.profiles FOR UPDATE TO authenticated
  USING ((SELECT public.has_perm('users.update')))
  WITH CHECK ((SELECT public.has_perm('users.update')));
DROP POLICY IF EXISTS "Staff can view all profiles" ON public.profiles;
CREATE POLICY "Staff can view all profiles" ON public.profiles FOR SELECT TO authenticated
  USING (((SELECT auth.uid()) = user_id) OR (SELECT public.has_perm('users.view')));
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK (((SELECT auth.uid()) = user_id)
    AND NOT (company_id IS DISTINCT FROM (SELECT p.company_id FROM profiles p WHERE p.user_id = (SELECT auth.uid())))
    AND NOT (tag        IS DISTINCT FROM (SELECT p.tag        FROM profiles p WHERE p.user_id = (SELECT auth.uid())))
  );
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

-- push_subscriptions
DROP POLICY IF EXISTS "Staff can view all subscriptions" ON public.push_subscriptions;
CREATE POLICY "Staff can view all subscriptions" ON public.push_subscriptions FOR SELECT TO authenticated
  USING (((SELECT auth.uid()) = user_id) OR (SELECT public.has_perm('users.view')));
DROP POLICY IF EXISTS "Users can delete their own subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can delete their own subscriptions" ON public.push_subscriptions FOR DELETE
  USING ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS "Users can insert their own subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can insert their own subscriptions" ON public.push_subscriptions FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS "Users can view their own subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can view their own subscriptions" ON public.push_subscriptions FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

-- suggestions
DROP POLICY IF EXISTS "Staff can update suggestions" ON public.suggestions;
CREATE POLICY "Staff can update suggestions" ON public.suggestions FOR UPDATE TO authenticated
  USING ((SELECT public.has_perm('suggestions.process')))
  WITH CHECK ((SELECT public.has_perm('suggestions.process')));
DROP POLICY IF EXISTS "Staff can view all suggestions" ON public.suggestions;
CREATE POLICY "Staff can view all suggestions" ON public.suggestions FOR SELECT TO authenticated
  USING (((SELECT auth.uid()) = user_id) OR (SELECT public.has_perm('suggestions.view')));
DROP POLICY IF EXISTS "Users can create their own suggestions" ON public.suggestions;
CREATE POLICY "Users can create their own suggestions" ON public.suggestions FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS "Users can view their own suggestions" ON public.suggestions;
CREATE POLICY "Users can view their own suggestions" ON public.suggestions FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

-- user_roles
DROP POLICY IF EXISTS "Roles viewers can view all user_roles" ON public.user_roles;
CREATE POLICY "Roles viewers can view all user_roles" ON public.user_roles FOR SELECT TO authenticated
  USING ((SELECT public.has_perm('users.view')));
DROP POLICY IF EXISTS "Users can view their own role" ON public.user_roles;
CREATE POLICY "Users can view their own role" ON public.user_roles FOR SELECT
  USING ((SELECT auth.uid()) = user_id);
