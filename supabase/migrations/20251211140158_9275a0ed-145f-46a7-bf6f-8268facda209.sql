-- Dodati kolonu purchase_price (nabavna cena)
ALTER TABLE public.meals ADD COLUMN purchase_price numeric;

-- Dodati komentar
COMMENT ON COLUMN public.meals.purchase_price IS 'Nabavna cena obroka';