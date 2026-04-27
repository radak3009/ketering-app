import type { Tables } from '@/integrations/supabase/types';
import type { Meal } from './meal';

// Base types from database
export type Menu = Tables<'menus'>;
export type MenuMeal = Tables<'menu_meals'>;
export type MenuTemplate = Tables<'menu_templates'>;
export type MenuTemplateMeal = Tables<'menu_template_meals'>;

// Menu meal with full meal details
export interface MenuMealWithDetails extends MenuMeal {
  meal: Meal;
}

// Full menu with meals
export interface MenuWithMeals extends Menu {
  meals?: MenuMealWithDetails[];
}

// Menu template with full meal details
export interface MenuTemplateMealWithDetails extends MenuTemplateMeal {
  meal: Meal;
}

export interface MenuTemplateWithMeals extends MenuTemplate {
  meals?: MenuTemplateMealWithDetails[];
}

// Menu template create/update payloads
export interface MenuTemplateCreateData {
  name: string;
  description?: string | null;
  organization_tag?: string | null;
  meal_ids: string[];
}

export interface MenuTemplateUpdateData {
  name?: string;
  description?: string | null;
  organization_tag?: string | null;
  meal_ids?: string[];
}

// Menu creation data
export interface MenuCreateData {
  name: string;
  description?: string;
  menu_date: string;
  meal_ids: string[];
  organization_tag?: string | null;
  template_id?: string | null;
}

// Menu update data
export interface MenuUpdateData {
  name?: string;
  description?: string;
  menu_date?: string;
  meal_ids?: string[];
  organization_tag?: string | null;
}
