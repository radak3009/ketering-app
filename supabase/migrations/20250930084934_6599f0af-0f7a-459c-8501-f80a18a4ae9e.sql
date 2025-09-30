-- Add pickup_status field to order_items table
ALTER TABLE public.order_items 
ADD COLUMN pickup_status text NOT NULL DEFAULT 'nije_preuzeto' 
CHECK (pickup_status IN ('preuzeto', 'nije_preuzeto'));

-- Add pickup_time field to track when the meal was picked up
ALTER TABLE public.order_items 
ADD COLUMN pickup_time timestamp with time zone;

-- Add shift field to order_items to track which shift the meal is for
ALTER TABLE public.order_items 
ADD COLUMN shift text NOT NULL DEFAULT 'prva' 
CHECK (shift IN ('prva', 'druga', 'treća'));

-- Create index for faster queries on pickup_status
CREATE INDEX idx_order_items_pickup_status ON public.order_items(pickup_status);

-- Create index for faster queries on shift
CREATE INDEX idx_order_items_shift ON public.order_items(shift);

-- Add company_card_id to profiles table for NFC mapping
ALTER TABLE public.profiles 
ADD COLUMN company_card_id text UNIQUE;

-- Create index for faster NFC lookups
CREATE INDEX idx_profiles_company_card_id ON public.profiles(company_card_id) WHERE company_card_id IS NOT NULL;