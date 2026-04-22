import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isKitchenOpen } from "../_shared/kitchen-schedule.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { kioskToken, company_card_id } = await req.json();

    const expectedToken = Deno.env.get("KIOSK_TOKEN_EMPLOYEE");
    if (!expectedToken || kioskToken !== expectedToken) {
      return new Response(
        JSON.stringify({ error: "Nedozvoljen pristup" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!company_card_id || typeof company_card_id !== "string" || company_card_id.trim() === "") {
      return new Response(
        JSON.stringify({ error: "ID je obavezan" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Belgrade" });
    const cardId = company_card_id.trim();

    // Step 1: Find profile by card ID
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, user_id, full_name, company_id, tag")
      .or(`company_card_id.eq.${cardId},company_card_serial.eq.${cardId}`)
      .maybeSingle();

    if (profileError) {
      console.error("Profile error:", profileError);
      return new Response(
        JSON.stringify({ error: "Greška pri pretrazi" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!profile) {
      return new Response(
        JSON.stringify({ found: false, message: "ID nije pronađen u sistemu" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 2: Find today's order for this user (with order_items + meals in one query)
    const { data: orders, error: orderError } = await supabase
      .from("orders")
      .select(`
        id,
        order_items (
          id,
          meal_id,
          shift,
          pickup_status,
          meals ( name )
        )
      `)
      .eq("user_id", profile.user_id)
      .eq("delivery_date", today);

    if (orderError) {
      console.error("Order error:", orderError);
      return new Response(
        JSON.stringify({ error: "Greška pri pretrazi porudžbina" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!orders || orders.length === 0) {
      return new Response(
        JSON.stringify({ found: false, message: "Nema porudžbine za danas" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find first order with items
    let order: any = null;
    let orderItem: any = null;
    for (const o of orders) {
      const items = (o as any).order_items;
      if (items && items.length > 0) {
        order = o;
        orderItem = items[0];
        break;
      }
    }

    if (!order || !orderItem) {
      return new Response(
        JSON.stringify({ found: false, message: "Nema porudžbine za danas" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const mealName: string = (orderItem as any).meals?.name || "Nepoznat obrok";

    // Step 3: PRIMARY CHECK - if order_item pickup_status is already "preuzeto", meal was picked up
    if (orderItem.pickup_status === "preuzeto") {
      const kitchenStatus = await isKitchenOpen(supabase, profile.company_id);
      return new Response(
        JSON.stringify({
          found: true,
          fullName: profile.full_name || "",
          mealName,
          alreadyServed: true,
          message: "Obrok je već preuzet",
          kitchenOpen: kitchenStatus.isOpen,
          confirmationRequired: false,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 4: Check existing pickup requests + kitchen status in parallel
    const [pendingResult, servedResult, kitchenStatus] = await Promise.all([
      // Check ANY pending request for this order item today (no time limit)
      supabase
        .from("pickup_requests")
        .select("id")
        .eq("order_item_id", orderItem.id)
        .eq("pickup_date", today)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      // Check ANY served request (excluding auto-fiscal)
      supabase
        .from("pickup_requests")
        .select("id, served_at, served_by")
        .eq("order_item_id", orderItem.id)
        .eq("pickup_date", today)
        .eq("status", "served")
        .neq("served_by", "auto-fiscal")
        .order("served_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      isKitchenOpen(supabase, profile.company_id),
    ]);

    // Already served today (via pickup_requests)
    if (servedResult.data) {
      return new Response(
        JSON.stringify({
          found: true,
          fullName: profile.full_name || "",
          mealName,
          alreadyServed: true,
          message: "Obrok je već preuzet",
          kitchenOpen: kitchenStatus.isOpen,
          confirmationRequired: false,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Existing pending request (dedupe) - return existing instead of creating new
    if (pendingResult.data) {
      return new Response(
        JSON.stringify({
          found: true,
          fullName: profile.full_name || "",
          mealName,
          pickupRequestId: pendingResult.data.id,
          message: "Zahtev je već kreiran",
          kitchenOpen: kitchenStatus.isOpen,
          confirmationRequired: !kitchenStatus.isOpen,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 5: Create new pickup request
    const { data: insertData, error: insertError } = await supabase
      .from("pickup_requests")
      .insert({
        pickup_date: today,
        employee_identifier: cardId,
        company_id: profile.company_id,
        profile_id: profile.id,
        order_id: order.id,
        order_item_id: orderItem.id,
        meal_name_snapshot: mealName,
        status: "pending",
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(
        JSON.stringify({ error: "Greška pri kreiranju zahteva" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        found: true,
        fullName: profile.full_name || "",
        mealName,
        pickupRequestId: insertData.id,
        kitchenOpen: kitchenStatus.isOpen,
        confirmationRequired: !kitchenStatus.isOpen,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: "Serverska greška" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
