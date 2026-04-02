import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isKitchenOpen } from "../_shared/kitchen-schedule.ts";

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
      .select("id, pickup_date, status, order_item_id, company_id, profile_id")
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

    if (pickupRequest.status === "served") {
      return new Response(
        JSON.stringify({ success: true, message: "Već je označeno kao izdato" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if order_item is already picked up (prevents duplicates from any source)
    if (pickupRequest.order_item_id) {
      const { data: orderItem } = await supabase
        .from("order_items")
        .select("pickup_status")
        .eq("id", pickupRequest.order_item_id)
        .maybeSingle();
      
      if (orderItem?.pickup_status === "preuzeto") {
        // Cancel this pending request since meal was already picked up
        await supabase
          .from("pickup_requests")
          .update({ status: "served", served_at: new Date().toISOString(), note: "duplikat-odbijen" })
          .eq("id", pickupRequestId);
        
        return new Response(
          JSON.stringify({ success: true, message: "Obrok je već preuzet" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Check kitchen schedule - kitchen kiosk should only serve during operating hours
    let scheduleApplies = true;

    if (pickupRequest.profile_id) {
      const [profileRes, settingRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("tag")
          .eq("id", pickupRequest.profile_id)
          .maybeSingle(),
        supabase
          .from("app_settings")
          .select("value")
          .eq("key", "kitchen_schedule_tags")
          .maybeSingle(),
      ]);

      const userTag = profileRes.data?.tag || null;
      const scheduleTags: string[] = (settingRes.data?.value as string[]) || [];

      if (scheduleTags.length > 0) {
        scheduleApplies = userTag !== null && scheduleTags.includes(userTag);
      }
    }

    if (scheduleApplies) {
      const kitchenStatus = await isKitchenOpen(supabase, pickupRequest.company_id);

      if (!kitchenStatus.isOpen) {
        return new Response(
          JSON.stringify({
            error: "Kuhinja trenutno ne radi",
            kitchenOpen: false,
            schedule: { open: kitchenStatus.openTime, close: kitchenStatus.closeTime },
          }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Update pickup request to served (kitchen kiosk)
    const { error: updateError } = await supabase
      .from("pickup_requests")
      .update({
        status: "served",
        served_at: new Date().toISOString(),
        served_by: "kitchen"
      })
      .eq("id", pickupRequestId);

    if (updateError) {
      console.error("Update error:", updateError);
      return new Response(
        JSON.stringify({ error: "Greška pri ažuriranju" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Optionally update order_items pickup_status
    if (pickupRequest.order_item_id) {
      await supabase
        .from("order_items")
        .update({ pickup_status: "preuzeto", pickup_time: new Date().toISOString() })
        .eq("id", pickupRequest.order_item_id);
    }

    // Fire-and-forget fiscalization
    try {
      const fiscalizeUrl = `${supabaseUrl}/functions/v1/fiscalize-meal`;
      fetch(fiscalizeUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pickupId: pickupRequestId,
          kioskToken: kioskToken,
        }),
      }).catch((err) => console.error("Fiscalize fire-and-forget error:", err));
    } catch (e) {
      console.error("Fiscalize dispatch error:", e);
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
