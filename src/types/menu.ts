import type { Tables } from '@/integrations/supabase/types';
import type { Meal } from './meal';

// Base types from database
export type Menu = Tables<'menus'>;
export type MenuMeal = Tables<'menu_meals'>;

// Menu meal with full meal details
export interface MenuMealWithDetails extends MenuMeal {
  meal: Meal;
}

// Full menu with meals
export interface MenuWithMeals extends Menu {
  meals?: MenuMealWithDetails[];
}

// Menu creation data
export interface MenuCreateData {
  name: string;
  description?: string;
  menu_date: string;
  meal_ids: string[];
}

// Menu update data
export interface MenuUpdateData {
  name?: string;
  description?: string;
  menu_date?: string;
  meal_ids?: string[];
}
