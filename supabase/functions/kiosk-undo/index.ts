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
    const { kioskToken, pickupRequestId } = await req.json();

    // Validate kiosk token (kitchen token)
    const expectedToken = Deno.env.get("KIOSK_TOKEN_KITCHEN");
    if (!expectedToken || kioskToken !== expectedToken) {
      return new Response(
        JSON.stringify({ error: "Nedozvoljen pristup" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!pickupRequestId) {
      return new Response(
        JSON.stringify({ error: "ID zahteva je obavezan" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase with service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get today's date for validation
    const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Belgrade" });

    // Check if pickup request exists and is for today
    const { data: pickupRequest, error: fetchError } = await supabase
      .from("pickup_requests")
      .select("id, pickup_date, status, order_item_id")
      .eq("id", pickupRequestId)
      .maybeSingle();

    if (fetchError || !pickupRequest) {
      return new Response(
        JSON.stringify({ error: "Zahtev nije pronađen" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (pickupRequest.pickup_date !== today) {
      return new Response(
        JSON.stringify({ error: "Zahtev nije za današnji dan" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (pickupRequest.status === "pending") {
      return new Response(
        JSON.stringify({ success: true, message: "Već je u statusu pending" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update pickup request back to pending
    const { error: updateError } = await supabase
      .from("pickup_requests")
      .update({
        status: "pending",
        served_at: null
      })
      .eq("id", pickupRequestId);

    if (updateError) {
      console.error("Update error:", updateError);
      return new Response(
        JSON.stringify({ error: "Greška pri ažuriranju" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Optionally update order_items pickup_status back
    if (pickupRequest.order_item_id) {
      await supabase
        .from("order_items")
        .update({ pickup_status: "nije_preuzeto", pickup_time: null })
        .eq("id", pickupRequest.order_item_id);
    }

    return new Response(
      JSON.stringify({ success: true }),
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
