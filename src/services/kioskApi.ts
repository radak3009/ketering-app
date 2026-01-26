import type { ShowMealResponse, GetQueueResponse } from "@/types/kiosk";

const SUPABASE_URL = "https://qqrvezuesxaappslfvrh.supabase.co";

export const kioskApi = {
  async showMeal(token: string, company_card_id: string): Promise<ShowMealResponse> {
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/kiosk-show-meal`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kioskToken: token, company_card_id }),
      }
    );

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || "Greška pri učitavanju");
    }
    
    return data;
  },

  async getQueue(token: string, date?: string): Promise<GetQueueResponse> {
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/kiosk-get-queue`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kioskToken: token, date }),
      }
    );

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || "Greška pri učitavanju");
    }
    
    return data;
  },

  async serve(token: string, pickupRequestId: string): Promise<{ success: boolean }> {
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/kiosk-serve`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kioskToken: token, pickupRequestId }),
      }
    );

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || "Greška pri izdavanju");
    }
    
    return data;
  },

  async undo(token: string, pickupRequestId: string): Promise<{ success: boolean }> {
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/kiosk-undo`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kioskToken: token, pickupRequestId }),
      }
    );

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || "Greška pri poništavanju");
    }
    
    return data;
  },

  async delete(token: string, pickupRequestId: string): Promise<{ success: boolean }> {
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/kiosk-delete`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kioskToken: token, pickupRequestId }),
      }
    );

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || "Greška pri brisanju");
    }
    
    return data;
  },
};
