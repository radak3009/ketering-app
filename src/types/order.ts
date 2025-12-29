import type { Tables } from '@/integrations/supabase/types';
import type { Meal } from './meal';
import type { Profile, ProfileBasic } from './user';

// Base types from database
export type Order = Tables<'orders'>;
export type OrderItem = Tables<'order_items'>;

// Order item with meal details
export interface OrderItemWithMeal extends OrderItem {
  meal: Meal;
}

// Full order with items and profile
export interface OrderWithItems extends Order {
  order_items?: OrderItemWithMeal[];
  profile?: ProfileBasic;
}

// Order item for week view (employee dashboard)
export interface OrderItemForWeekView {
  id: string;
  order_id: string;
  meal_id: string;
  shift: string;
  pickup_status: string;
  pickup_time: string | null;
  delivery_date: string;
  meal: {
    id: string;
    name: string;
    description: string;
    image_url: string | null;
    category: string;
    allergens: string[] | null;
  };
}

// Week order grouping
export interface WeekOrder {
  date: string;
  items: OrderItemForWeekView[];
}

// Meal order summary for reports
export interface MealOrderSummary {
  meal_id: string;
  meal_name: string;
  meal_image_url: string | null;
  total_orders: number;
}
