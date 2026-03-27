export interface PickupRequest {
  id: string;
  created_at: string;
  pickup_date: string;
  employee_identifier: string;
  profile_id: string | null;
  order_id: string | null;
  order_item_id: string | null;
  meal_name_snapshot: string | null;
  status: 'pending' | 'served';
  served_at: string | null;
}

export interface QueueItem {
  id: string;
  created_at: string;
  employee_identifier: string;
  fullName: string | null;
  meal_name_snapshot: string | null;
  status: 'pending' | 'served';
  served_at: string | null;
}

export interface ShowMealResponse {
  found: boolean;
  message?: string;
  fullName?: string;
  mealName?: string;
  pickupRequestId?: string;
  alreadyServed?: boolean;
  error?: string;
  kitchenOpen?: boolean;
  confirmationRequired?: boolean;
}

export interface KitchenStatus {
  isOpen: boolean;
  openTime: string | null;
  closeTime: string | null;
  currentTime: string;
  reason: 'open' | 'exception_closed' | 'weekly_closed' | 'outside_hours';
}

export interface GetQueueResponse {
  pending: QueueItem[];
  served: QueueItem[];
  error?: string;
}

export interface PreloadMealEntry {
  fullName: string;
  mealName: string;
  orderItemId: string;
  pickupStatus: string;
  shift: string;
}

export interface PreloadMealsResponse {
  meals: Record<string, PreloadMealEntry>;
  timestamp: number;
  error?: string;
}
