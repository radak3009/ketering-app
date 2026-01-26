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
}

export interface GetQueueResponse {
  pending: QueueItem[];
  served: QueueItem[];
  error?: string;
}
