import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendEmail } from "../_shared/smtp.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALERT_EMAIL = "support@simpler.rs";

async function sendFiscalAlert(
  subject: string,
  items: { pickupId: string; mealName: string; employee: string; error: string; retryCount: number }[]
) {
  const rows = items
    .map(
      (i) =>
        `<tr>
          <td style="padding:6px 10px;border:1px solid #ddd;">${i.employee}</td>
          <td style="padding:6px 10px;border:1px solid #ddd;">${i.mealName}</td>
          <td style="padding:6px 10px;border:1px solid #ddd;">${i.retryCount}/3</td>
          <td style="padding:6px 10px;border:1px solid #ddd;color:#c00;">${i.error}</td>
          <td style="padding:6px 10px;border:1px solid #ddd;font-size:11px;">${i.pickupId}</td>
        </tr>`
    )
    .join("");

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:700px;">
      <h2 style="color:#c00;">⚠️ ${subject}</h2>
      <p>Sledeće stavke zahtevaju pažnju:</p>
      <table style="border-collapse:collapse;width:100%;font-size:13px;">
        <thead>
          <tr style="background:#f5f5f5;">
            <th style="padding:6px 10px;border:1px solid #ddd;text-align:left;">Zaposleni</th>
            <th style="padding:6px 10px;border:1px solid #ddd;text-align:left;">Obrok</th>
            <th style="padding:6px 10px;border:1px solid #ddd;text-align:left;">Pokušaji</th>
            <th style="padding:6px 10px;border:1px solid #ddd;text-align:left;">Greška</th>
            <th style="padding:6px 10px;border:1px solid #ddd;text-align:left;">Pickup ID</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="color:#666;font-size:12px;margin-top:16px;">
        Ove stavke zahtevaju ručnu intervenciju u admin panelu.
      </p>
    </div>
  `;

  try {
    const result = await sendEmail({ to: ALERT_EMAIL, subject, html });
    if (!result.success) {
      console.error("Alert email failed:", result.error);
    } else {
      console.log("Alert email sent to", ALERT_EMAIL);
    }
  } catch (e) {
    console.error("Alert email error:", e);
  }
}

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
      .select("id, order_item_id, fiscal_retry_count, fiscal_error, meal_name_snapshot, employee_identifier")
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
    const exhaustedItems: { pickupId: string; mealName: string; employee: string; error: string; retryCount: number }[] = [];
    const kioskToken = Deno.env.get("KIOSK_TOKEN_KITCHEN");

    for (const pickup of failedPickups) {
      const newRetryCount = pickup.fiscal_retry_count + 1;

      // Increment retry count
      await supabase
        .from("pickup_requests")
        .update({ fiscal_retry_count: newRetryCount })
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

        // If still failed after this retry and retries exhausted (3/3)
        if (result.status === "failed" && newRetryCount >= 3) {
          exhaustedItems.push({
            pickupId: pickup.id,
            mealName: pickup.meal_name_snapshot || "Nepoznat obrok",
            employee: pickup.employee_identifier || "Nepoznat",
            error: result.errors?.join("; ") || pickup.fiscal_error || "Nepoznata greška",
            retryCount: newRetryCount,
          });
        }
      } catch (e) {
        console.error(`Retry failed for ${pickup.id}:`, e);
        results.push({ pickupId: pickup.id, status: "error", error: e.message });

        // Network error on final retry
        if (newRetryCount >= 3) {
          exhaustedItems.push({
            pickupId: pickup.id,
            mealName: pickup.meal_name_snapshot || "Nepoznat obrok",
            employee: pickup.employee_identifier || "Nepoznat",
            error: e.message || "Network error",
            retryCount: newRetryCount,
          });
        }
      }
    }

    // Send alert email if any retries exhausted
    if (exhaustedItems.length > 0) {
      const today = new Date().toLocaleDateString("sr-Latn-RS", { timeZone: "Europe/Belgrade" });
      await sendFiscalAlert(
        `Fiskalizacija - ${exhaustedItems.length} neuspešnih nakon svih pokušaja (${today})`,
        exhaustedItems
      );
    }

    return new Response(
      JSON.stringify({ status: "ok", retried: results.length, exhausted: exhaustedItems.length, results }),
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
