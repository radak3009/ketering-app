-- Kreiranje tabele pickup_requests za kiosk queue
CREATE TABLE public.pickup_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  pickup_date date NOT NULL,
  employee_identifier text NOT NULL,
  company_id uuid NULL,
  profile_id uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  order_id uuid NULL REFERENCES public.orders(id) ON DELETE SET NULL,
  order_item_id uuid NULL REFERENCES public.order_items(id) ON DELETE SET NULL,
  meal_name_snapshot text NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'served')),
  served_at timestamptz NULL,
  served_by text NULL,
  note text NULL
);

-- Indeksi za performanse
CREATE INDEX idx_pickup_requests_date_status_created 
  ON public.pickup_requests(pickup_date, status, created_at);
CREATE INDEX idx_pickup_requests_date_created 
  ON public.pickup_requests(pickup_date, created_at);
CREATE INDEX idx_pickup_requests_order_item 
  ON public.pickup_requests(order_item_id, pickup_date, status);

-- RLS - zabrani direktan pristup anonimnim korisnicima
ALTER TABLE public.pickup_requests ENABLE ROW LEVEL SECURITY;

-- Samo admini mogu direktno pristupiti (za debug)
CREATE POLICY "Admins can view all pickup_requests"
  ON public.pickup_requests FOR SELECT
  USING (public.is_admin_user(auth.uid()));