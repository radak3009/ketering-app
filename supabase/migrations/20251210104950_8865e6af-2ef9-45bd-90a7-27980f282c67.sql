-- Dodati kolonu code (šifra obroka)
ALTER TABLE public.meals ADD COLUMN code text;

-- Dodati UNIQUE constraint
ALTER TABLE public.meals ADD CONSTRAINT meals_code_unique UNIQUE (code);

-- Dodati CHECK constraint za dužinu (max 8 karaktera)
ALTER TABLE public.meals ADD CONSTRAINT meals_code_length 
CHECK (code IS NULL OR length(code) <= 8);

-- Dodati CHECK constraint za alfanumerički format
ALTER TABLE public.meals ADD CONSTRAINT meals_code_alphanumeric 
CHECK (code IS NULL OR code ~ '^[a-zA-Z0-9]+$');

-- Dodati komentar
COMMENT ON COLUMN public.meals.code IS 'Šifra obroka - alfanumerička, max 8 karaktera, jedinstvena';