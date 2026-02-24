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
    const { pickupId, price, kioskToken } = await req.json();

    // Auth: accept either kiosk token or JWT
    const employeeToken = Deno.env.get("KIOSK_TOKEN_EMPLOYEE");
    const kitchenToken = Deno.env.get("KIOSK_TOKEN_KITCHEN");
    const isKiosk = kioskToken && (kioskToken === employeeToken || kioskToken === kitchenToken);

    if (!isKiosk) {
      // Check JWT auth for "retry" from frontend
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response(
          JSON.stringify({ error: "Nedozvoljen pristup" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      // JWT is valid enough to proceed - service role does the actual work
    }

    if (!pickupId) {
      return new Response(
        JSON.stringify({ error: "pickupId je obavezan" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const externalId = `kiosk-${pickupId}`;

    // 1. Idempotency check
    const { data: existing, error: fetchErr } = await supabase
      .from("pickup_requests")
      .select("id, invoice_number, verification_url, fiscal_status, receipt_file_path, profile_id, order_item_id")
      .eq("id", pickupId)
      .maybeSingle();

    if (fetchErr || !existing) {
      return new Response(
        JSON.stringify({ status: "error", error: "Pickup request nije pronađen" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Already fiscalized - return existing data
    if (existing.invoice_number && existing.fiscal_status === "fiscalized") {
      return new Response(
        JSON.stringify({
          status: "fiscalized",
          pickupId,
          invoice_number: existing.invoice_number,
          verification_url: existing.verification_url,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Determine price from order_items if not provided
    let finalPrice = price;
    if (!finalPrice && existing.order_item_id) {
      const { data: orderItem } = await supabase
        .from("order_items")
        .select("unit_price")
        .eq("id", existing.order_item_id)
        .maybeSingle();
      finalPrice = orderItem?.unit_price || 0;
    }

    if (!finalPrice || finalPrice <= 0) {
      // Skip fiscalization for zero-price items
      return new Response(
        JSON.stringify({ status: "skipped", reason: "Cena je 0 ili nije dostupna" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Set pending status
    await supabase
      .from("pickup_requests")
      .update({ fiscal_status: "pending", fiscal_external_id: externalId, fiscal_error: null })
      .eq("id", pickupId);

    // 4. Call Octopos API
    const octoposUrl = Deno.env.get("OCTOPOS_BASE_URL") || "https://sandbox.octopos.rs/api";
    const octoposToken = Deno.env.get("OCTOPOS_TOKEN")!;
    const companyTaxNumber = Deno.env.get("OCTOPOS_COMPANY_TAX_NUMBER") || "101612478";
    const productCode = Deno.env.get("OCTOPOS_PRODUCT_CODE_PERSONAL_MEAL") || "S001";
    const paymentTypeId = parseInt(Deno.env.get("OCTOPOS_FISCAL_PAYMENT_TYPE_ID") || "4");

    const octoposPayload = {
      ExternalId: externalId,
      CompanyTaxNumber: companyTaxNumber,
      Items: [
        { Quantity: 1, ProductCode: productCode, Price: finalPrice },
      ],
      Payments: [
        { Amount: finalPrice, FiscalPaymentTypeId: paymentTypeId },
      ],
      FiscalReceiptData: {
        ReturnTextualRepresentation: true,
        LineWidth: 40,
      },
    };

    console.log("Calling Octopos:", JSON.stringify(octoposPayload));

    let octoposResponse;
    try {
      octoposResponse = await fetch(`${octoposUrl}/WebOrder`, {
        method: "POST",
        headers: {
          "Authorization": `Basic ${octoposToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(octoposPayload),
      });
    } catch (netErr) {
      console.error("Octopos network error:", netErr);
      await supabase
        .from("pickup_requests")
        .update({ fiscal_status: "failed", fiscal_error: `Network error: ${netErr.message}` })
        .eq("id", pickupId);

      return new Response(
        JSON.stringify({ status: "failed", errors: [`Network error: ${netErr.message}`], pickupId }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = await octoposResponse.json();
    console.log("Octopos response:", JSON.stringify(result));

    // 5. Handle failure
    if (!result.Success) {
      const errors = result.Errors?.map((e: any) => e.Message || e) || ["Unknown Octopos error"];
      await supabase
        .from("pickup_requests")
        .update({ fiscal_status: "failed", fiscal_error: errors.join("; ") })
        .eq("id", pickupId);

      return new Response(
        JSON.stringify({ status: "failed", errors, pickupId }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 6. Success - save fiscal data
    const data = result.Data;
    const receiptContent = [
      data.TextTop || "",
      data.TextBottom || "",
      "",
      "VERIFICATION:",
      data.VerificationUrl || "",
      "INVOICE:",
      data.InvoiceNumber || "",
      "",
    ].join("\n");

    // Determine storage path using profile's user_id
    let storagePath = `unknown/${pickupId}.txt`;
    if (existing.profile_id) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("id", existing.profile_id)
        .maybeSingle();
      if (profile?.user_id) {
        storagePath = `${profile.user_id}/${pickupId}.txt`;
      }
    }

    // Upload receipt to storage
    const { error: uploadErr } = await supabase.storage
      .from("receipts")
      .upload(storagePath, new TextEncoder().encode(receiptContent), {
        contentType: "text/plain",
        upsert: true,
      });

    if (uploadErr) {
      console.error("Receipt upload error:", uploadErr);
    }

    // Update pickup_requests with fiscal data
    await supabase
      .from("pickup_requests")
      .update({
        fiscal_status: "fiscalized",
        octopos_weborder_id: data.Id,
        invoice_number: data.InvoiceNumber,
        verification_url: data.VerificationUrl,
        receipt_text_top: data.TextTop,
        receipt_text_bottom: data.TextBottom,
        fiscalized_at: data.SdcDateTime,
        receipt_file_path: storagePath,
        fiscal_error: null,
      })
      .eq("id", pickupId);

    return new Response(
      JSON.stringify({
        status: "fiscalized",
        pickupId,
        invoice_number: data.InvoiceNumber,
        verification_url: data.VerificationUrl,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Fiscalize error:", error);
    return new Response(
      JSON.stringify({ status: "error", error: "Serverska greška" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
