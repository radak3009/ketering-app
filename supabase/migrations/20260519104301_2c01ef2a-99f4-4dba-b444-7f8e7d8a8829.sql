-- Restore full SELECT on meals to authenticated; purchase_price stays hidden from employees via meals_secure view (used in employee-facing code paths).
GRANT SELECT ON public.meals TO authenticated;