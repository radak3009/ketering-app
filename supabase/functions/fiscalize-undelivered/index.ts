import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const kioskToken = Deno.env.get("KIOSK_TOKEN_KITCHEN");
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Today's date in Belgrade timezone
    const now = new Date();
    const belgradeOffset = 1; // CET (adjust for DST if needed)
    const utcHours = now.getUTCHours();
    const belgradeDate = new Date(now);
    if (utcHours + belgradeOffset >= 24) {
      belgradeDate.setUTCDate(belgradeDate.getUTCDate() + 1);
    }
    const today = belgradeDate.toISOString().split("T")[0];

    console.log(`[fiscalize-undelivered] Running for date: ${today}`);

    // Find all order_items for today that were NOT picked up
    const { data: orderItems, error: oiError } = await supabase
      .from("order_items")
      .select(`
        id,
        order_id,
        meal_id,
        shift,
        meals (id, name, code, price, allowed_tags),
        orders!inner (id, user_id, delivery_date)
      `)
      .eq("pickup_status", "nije_preuzeto")
      .eq("orders.delivery_date", today);

    if (oiError) {
      console.error("Error fetching order items:", oiError);
      return new Response(
        JSON.stringify({ error: "Greška pri dohvatanju stavki" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!orderItems || orderItems.length === 0) {
      console.log("[fiscalize-undelivered] No undelivered items found for today");
      return new Response(
        JSON.stringify({ status: "ok", message: "Nema nepreuzetih obroka za danas", processed: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[fiscalize-undelivered] Found ${orderItems.length} undelivered items`);

    // Check which order_items already have a pickup_request
    const orderItemIds = orderItems.map((oi: any) => oi.id);
    const { data: existingPickups } = await supabase
      .from("pickup_requests")
      .select("order_item_id")
      .in("order_item_id", orderItemIds);

    const existingSet = new Set((existingPickups || []).map((p: any) => p.order_item_id));

    // Get profiles for all users involved
    const userIds = [...new Set(orderItems.map((oi: any) => (oi as any).orders.user_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, user_id, full_name, company_card_id, company_id, tag")
      .in("user_id", userIds);

    const profileByUserId: Record<string, any> = {};
    (profiles || []).forEach((p: any) => {
      profileByUserId[p.user_id] = p;
    });

    const results: { orderItemId: string; status: string; error?: string }[] = [];

    for (const oi of orderItems) {
      const orderItem = oi as any;

      // Skip if pickup_request already exists
      if (existingSet.has(orderItem.id)) {
        console.log(`[fiscalize-undelivered] Skipping ${orderItem.id} - pickup_request exists`);
        results.push({ orderItemId: orderItem.id, status: "skipped" });
        continue;
      }

      const userId = orderItem.orders.user_id;
      const profile = profileByUserId[userId];
      if (!profile) {
        console.warn(`[fiscalize-undelivered] No profile for user ${userId}`);
        results.push({ orderItemId: orderItem.id, status: "skipped", error: "no_profile" });
        continue;
      }

      // Create pickup_request
      const { data: newPickup, error: insertErr } = await supabase
        .from("pickup_requests")
        .insert({
          order_item_id: orderItem.id,
          order_id: orderItem.order_id,
          profile_id: profile.id,
          company_id: profile.company_id,
          employee_identifier: profile.company_card_id || profile.full_name || "unknown",
          meal_name_snapshot: orderItem.meals?.name || "Obrok",
          pickup_date: today,
          status: "served",
          served_by: "auto-fiscal",
          served_at: new Date().toISOString(),
          fiscal_status: "pending",
        })
        .select("id")
        .single();

      if (insertErr || !newPickup) {
        console.error(`[fiscalize-undelivered] Insert error for ${orderItem.id}:`, insertErr);
        results.push({ orderItemId: orderItem.id, status: "error", error: insertErr?.message });
        continue;
      }

      console.log(`[fiscalize-undelivered] Created pickup_request ${newPickup.id} for order_item ${orderItem.id}`);

      // Call fiscalize-meal
      try {
        const resp = await fetch(`${supabaseUrl}/functions/v1/fiscalize-meal`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pickupId: newPickup.id, kioskToken }),
        });
        const result = await resp.json();
        results.push({ orderItemId: orderItem.id, status: result.status || "unknown" });
      } catch (e) {
        console.error(`[fiscalize-undelivered] Fiscalize error for ${orderItem.id}:`, e);
        results.push({ orderItemId: orderItem.id, status: "fiscal_error", error: (e as Error).message });
      }
    }

    const processed = results.filter(r => r.status !== "skipped").length;
    console.log(`[fiscalize-undelivered] Done. Processed: ${processed}, Total: ${results.length}`);

    return new Response(
      JSON.stringify({ status: "ok", processed, total: results.length, results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[fiscalize-undelivered] Fatal error:", error);
    return new Response(
      JSON.stringify({ error: "Serverska greška" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
