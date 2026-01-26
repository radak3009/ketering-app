import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { kioskToken, company_card_id } = await req.json();

    // Validate kiosk token
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

    // Initialize Supabase with service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get today's date in local timezone (Serbia - Europe/Belgrade)
    const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Belgrade" });

    // Find profile by company_card_id
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, user_id, full_name, company_id")
      .eq("company_card_id", company_card_id.trim())
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

    // Find today's order for this user
    const { data: orders, error: ordersError } = await supabase
      .from("orders")
      .select(`
        id,
        delivery_date,
        order_items (
          id,
          meal_id,
          shift,
          pickup_status
        )
      `)
      .eq("user_id", profile.user_id)
      .eq("delivery_date", today);

    if (ordersError) {
      console.error("Orders error:", ordersError);
      return new Response(
        JSON.stringify({ error: "Greška pri pretrazi porudžbine" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if there are any orders for today
    if (!orders || orders.length === 0 || !orders[0].order_items || orders[0].order_items.length === 0) {
      return new Response(
        JSON.stringify({ found: false, message: "Nema porudžbine za danas" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const order = orders[0];
    const orderItem = order.order_items[0]; // Take first order item

    // Get meal name
    const { data: meal, error: mealError } = await supabase
      .from("meals")
      .select("name")
      .eq("id", orderItem.meal_id)
      .single();

    if (mealError) {
      console.error("Meal error:", mealError);
      return new Response(
        JSON.stringify({ error: "Greška pri pronalaženju obroka" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const mealName = meal?.name || "Nepoznat obrok";

    // Check for existing pending request in last 2 minutes (dedupe)
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    const { data: existingPending } = await supabase
      .from("pickup_requests")
      .select("id")
      .eq("order_item_id", orderItem.id)
      .eq("pickup_date", today)
      .eq("status", "pending")
      .gte("created_at", twoMinutesAgo)
      .maybeSingle();

    if (existingPending) {
      return new Response(
        JSON.stringify({
          found: true,
          fullName: profile.full_name || "",
          mealName,
          pickupRequestId: existingPending.id,
          message: "Zahtev je već kreiran"
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if already served today
    const { data: existingServed } = await supabase
      .from("pickup_requests")
      .select("id, served_at")
      .eq("order_item_id", orderItem.id)
      .eq("pickup_date", today)
      .eq("status", "served")
      .maybeSingle();

    if (existingServed) {
      return new Response(
        JSON.stringify({
          found: true,
          fullName: profile.full_name || "",
          mealName,
          alreadyServed: true,
          message: "Obrok je već preuzet"
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create new pickup request
    const { data: pickupRequest, error: insertError } = await supabase
      .from("pickup_requests")
      .insert({
        pickup_date: today,
        employee_identifier: company_card_id.trim(),
        company_id: profile.company_id,
        profile_id: profile.id,
        order_id: order.id,
        order_item_id: orderItem.id,
        meal_name_snapshot: mealName,
        status: "pending"
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
        pickupRequestId: pickupRequest.id
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
