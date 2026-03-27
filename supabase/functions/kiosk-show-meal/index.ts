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

    // Single JOIN query: profile + order + order_item + meal
    const { data: rows, error: joinError } = await supabase
      .from("profiles")
      .select(`
        id,
        user_id,
        full_name,
        company_id,
        orders!inner (
          id,
          delivery_date,
          order_items (
            id,
            meal_id,
            shift,
            pickup_status,
            meals!inner ( name )
          )
        )
      `)
      .eq("company_card_id", cardId)
      .eq("orders.delivery_date", today);

    // If join error, fall back to checking if profile exists at all
    if (joinError) {
      console.error("Join error:", joinError);
      return new Response(
        JSON.stringify({ error: "Greška pri pretrazi" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // No profile found at all — check if card ID exists without the inner join filter
    if (!rows || rows.length === 0) {
      const { data: profileOnly } = await supabase
        .from("profiles")
        .select("id")
        .eq("company_card_id", cardId)
        .maybeSingle();

      if (!profileOnly) {
        return new Response(
          JSON.stringify({ found: false, message: "ID nije pronađen u sistemu" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Profile exists but no order for today
      return new Response(
        JSON.stringify({ found: false, message: "Nema porudžbine za danas" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const profile = rows[0];
    const order = (profile as any).orders?.[0];
    const orderItems = order?.order_items;

    if (!orderItems || orderItems.length === 0) {
      return new Response(
        JSON.stringify({ found: false, message: "Nema porudžbine za danas" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const orderItem = orderItems[0];
    const mealName: string = (orderItem as any).meals?.name || "Nepoznat obrok";

    // Check existing pickup requests (pending + served) in parallel
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();

    const [pendingResult, servedResult] = await Promise.all([
      supabase
        .from("pickup_requests")
        .select("id")
        .eq("order_item_id", orderItem.id)
        .eq("pickup_date", today)
        .eq("status", "pending")
        .gte("created_at", twoMinutesAgo)
        .maybeSingle(),
      supabase
        .from("pickup_requests")
        .select("id, served_at, served_by")
        .eq("order_item_id", orderItem.id)
        .eq("pickup_date", today)
        .eq("status", "served")
        .neq("served_by", "auto-fiscal")
        .maybeSingle(),
    ]);

    // Existing pending request (dedupe)
    if (pendingResult.data) {
      const kitchenStatus = await isKitchenOpen(supabase, profile.company_id);
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

    // Already served today
    if (servedResult.data) {
      const kitchenStatus = await isKitchenOpen(supabase, profile.company_id);
      return new Response(
        JSON.stringify({
          found: true,
          fullName: profile.full_name || "",
          mealName,
          alreadyServed: true,
          message: "Obrok je već preuzet",
          kitchenOpen: kitchenStatus.isOpen,
          confirmationRequired: !kitchenStatus.isOpen,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create new pickup request + check kitchen status in parallel
    const [insertResult, kitchenStatus] = await Promise.all([
      supabase
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
        .single(),
      isKitchenOpen(supabase, profile.company_id),
    ]);

    if (insertResult.error) {
      console.error("Insert error:", insertResult.error);
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
        pickupRequestId: insertResult.data.id,
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
