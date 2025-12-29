import type { Tables } from '@/integrations/supabase/types';

// Base meal type from database
export type Meal = Tables<'meals'>;

// Types for CRUD operations
export type MealInsert = Omit<Meal, 'id' | 'created_at' | 'updated_at'>;
export type MealUpdate = Partial<MealInsert>;

// Meal with additional computed properties
export interface MealWithDetails extends Meal {
  isAvailable?: boolean;
}
