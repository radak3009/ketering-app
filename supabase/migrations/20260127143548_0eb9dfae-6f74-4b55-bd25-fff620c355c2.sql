-- Kreiranje tabele za nedeljni raspored kuhinje
CREATE TABLE public.kitchen_schedule_weekly (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  enabled BOOLEAN NOT NULL DEFAULT true,
  open_time TIME NOT NULL,
  close_time TIME NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, day_of_week)
);

-- Kreiranje tabele za izuzetke (praznici, posebni dani)
CREATE TABLE public.kitchen_schedule_exceptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  exception_date DATE NOT NULL,
  closed_all_day BOOLEAN NOT NULL DEFAULT false,
  open_time TIME,
  close_time TIME,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, exception_date)
);

-- Uključi RLS
ALTER TABLE public.kitchen_schedule_weekly ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kitchen_schedule_exceptions ENABLE ROW LEVEL SECURITY;

-- RLS politike - samo admini mogu upravljati
CREATE POLICY "Admins can manage weekly schedule" 
  ON public.kitchen_schedule_weekly FOR ALL
  USING (public.is_admin_user(auth.uid()));

CREATE POLICY "Admins can manage exceptions" 
  ON public.kitchen_schedule_exceptions FOR ALL
  USING (public.is_admin_user(auth.uid()));

-- Trigger za updated_at
CREATE TRIGGER update_kitchen_schedule_weekly_updated_at
  BEFORE UPDATE ON public.kitchen_schedule_weekly
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_kitchen_schedule_exceptions_updated_at
  BEFORE UPDATE ON public.kitchen_schedule_exceptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default raspored (Pon-Sub 06:00-22:00, Ned 06:00-14:00)
INSERT INTO public.kitchen_schedule_weekly (company_id, day_of_week, enabled, open_time, close_time)
VALUES
  (NULL, 1, true, '06:00:00', '22:00:00'),
  (NULL, 2, true, '06:00:00', '22:00:00'),
  (NULL, 3, true, '06:00:00', '22:00:00'),
  (NULL, 4, true, '06:00:00', '22:00:00'),
  (NULL, 5, true, '06:00:00', '22:00:00'),
  (NULL, 6, true, '06:00:00', '22:00:00'),
  (NULL, 0, true, '06:00:00', '14:00:00');