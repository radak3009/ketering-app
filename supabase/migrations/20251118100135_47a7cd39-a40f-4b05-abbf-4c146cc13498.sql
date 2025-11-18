-- Dodati CHECK constraint za dužinu (max 10 karaktera)
ALTER TABLE profiles 
ADD CONSTRAINT company_card_id_length 
CHECK (company_card_id IS NULL OR length(company_card_id) <= 10);

-- Dodati CHECK constraint da vrednost mora biti numerička
ALTER TABLE profiles 
ADD CONSTRAINT company_card_id_numeric 
CHECK (company_card_id IS NULL OR company_card_id ~ '^[0-9]+$');

-- Dodati komentar na kolonu za dokumentaciju
COMMENT ON COLUMN profiles.company_card_id IS 'Identifikacioni broj korisnika (ID) - numerički, max 10 cifara, obavezan i jedinstven';