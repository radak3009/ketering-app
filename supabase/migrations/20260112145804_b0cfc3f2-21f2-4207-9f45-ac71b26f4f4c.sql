-- Add CHECK constraint to ensure company_card_id does not contain @ symbol
-- This prevents confusion between email and ID during login
ALTER TABLE public.profiles 
ADD CONSTRAINT company_card_id_no_at_symbol 
CHECK (company_card_id !~ '@');