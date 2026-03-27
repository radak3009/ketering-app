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

    // Determine token type
    const employeeToken = Deno.env.get("KIOSK_TOKEN_EMPLOYEE");
    const kitchenToken = Deno.env.get("KIOSK_TOKEN_KITCHEN");

    const isEmployeeKiosk = employeeToken && kioskToken === employeeToken;
    const isKitchenKiosk = kitchenToken && kioskToken === kitchenToken;

    if (!isEmployeeKiosk && !isKitchenKiosk) {
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

    // Fetch the pickup request to get company_id
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

    // Determine if kitchen schedule applies to this user's tag
    let scheduleApplies = true; // default: schedule applies

    if (pickupRequest.profile_id) {
      // Fetch user's tag and kitchen_schedule_tags setting in parallel
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

      // If scheduleTags is empty → no restrictions (schedule applies to nobody specifically)
      // If scheduleTags has entries → schedule only applies to users with those tags
      if (scheduleTags.length > 0) {
        scheduleApplies = userTag !== null && scheduleTags.includes(userTag);
      } else {
        // Empty array = no tag-based restrictions, schedule applies to all
        scheduleApplies = true;
      }
    }

    if (scheduleApplies) {
      // Check kitchen status - apply schedule normally
      const kitchenStatus = await isKitchenOpen(supabase, pickupRequest.company_id);

      if (isKitchenKiosk && !kitchenStatus.isOpen) {
        return new Response(
          JSON.stringify({
            error: "Kuhinja trenutno ne radi",
            kitchenOpen: false,
            schedule: { open: kitchenStatus.openTime, close: kitchenStatus.closeTime },
          }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (isEmployeeKiosk && kitchenStatus.isOpen) {
        return new Response(
          JSON.stringify({
            error: "Kuhinja radi - preuzmite obrok na šalteru",
            kitchenOpen: true,
          }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }
    // If scheduleApplies is false → skip kitchen status check, allow both kiosk types

    // Update pickup request to served
    const { error: updateError } = await supabase
      .from("pickup_requests")
      .update({
        status: "served",
        served_at: new Date().toISOString(),
      })
      .eq("id", pickupRequestId);

    if (updateError) {
      console.error("Update error:", updateError);
      return new Response(
        JSON.stringify({ error: "Greška pri ažuriranju" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Also update order_items pickup_status if linked
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
