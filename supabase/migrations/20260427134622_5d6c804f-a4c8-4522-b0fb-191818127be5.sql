-- 1. Nova tabela: menu_templates
CREATE TABLE public.menu_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  organization_tag TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.menu_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage menu templates"
ON public.menu_templates
FOR ALL
USING (public.is_admin_user(auth.uid()))
WITH CHECK (public.is_admin_user(auth.uid()));

CREATE POLICY "Authenticated users can view menu templates"
ON public.menu_templates
FOR SELECT
TO authenticated
USING (true);

CREATE TRIGGER update_menu_templates_updated_at
BEFORE UPDATE ON public.menu_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Nova tabela: menu_template_meals (junction)
CREATE TABLE public.menu_template_meals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES public.menu_templates(id) ON DELETE CASCADE,
  meal_id UUID NOT NULL REFERENCES public.meals(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (template_id, meal_id)
);

CREATE INDEX idx_menu_template_meals_template ON public.menu_template_meals(template_id);
CREATE INDEX idx_menu_template_meals_meal ON public.menu_template_meals(meal_id);

ALTER TABLE public.menu_template_meals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage menu template meals"
ON public.menu_template_meals
FOR ALL
USING (public.is_admin_user(auth.uid()))
WITH CHECK (public.is_admin_user(auth.uid()));

CREATE POLICY "Authenticated users can view menu template meals"
ON public.menu_template_meals
FOR SELECT
TO authenticated
USING (true);

-- 3. Izmena tabele menus: dodavanje template_id reference
ALTER TABLE public.menus
ADD COLUMN template_id UUID REFERENCES public.menu_templates(id) ON DELETE SET NULL;

CREATE INDEX idx_menus_template_id ON public.menus(template_id);