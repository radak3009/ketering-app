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
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find failed fiscalizations with retry_count < 3
    const { data: failedPickups, error } = await supabase
      .from("pickup_requests")
      .select("id, order_item_id, fiscal_retry_count")
      .eq("fiscal_status", "failed")
      .lt("fiscal_retry_count", 3)
      .order("created_at", { ascending: true })
      .limit(20);

    if (error) {
      console.error("Query error:", error);
      return new Response(
        JSON.stringify({ error: "Greška pri dohvatanju podataka" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!failedPickups || failedPickups.length === 0) {
      return new Response(
        JSON.stringify({ status: "ok", message: "Nema neuspelih fiskalizacija za retry", retried: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${failedPickups.length} failed fiscalizations to retry`);

    const results: { pickupId: string; status: string; error?: string }[] = [];
    const kioskToken = Deno.env.get("KIOSK_TOKEN_KITCHEN");

    for (const pickup of failedPickups) {
      // Increment retry count
      await supabase
        .from("pickup_requests")
        .update({ fiscal_retry_count: pickup.fiscal_retry_count + 1 })
        .eq("id", pickup.id);

      // Call fiscalize-meal
      try {
        const resp = await fetch(`${supabaseUrl}/functions/v1/fiscalize-meal`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pickupId: pickup.id, kioskToken }),
        });
        const result = await resp.json();
        results.push({ pickupId: pickup.id, status: result.status || "unknown" });
      } catch (e) {
        console.error(`Retry failed for ${pickup.id}:`, e);
        results.push({ pickupId: pickup.id, status: "error", error: e.message });
      }
    }

    return new Response(
      JSON.stringify({ status: "ok", retried: results.length, results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Retry cron error:", error);
    return new Response(
      JSON.stringify({ error: "Serverska greška" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
