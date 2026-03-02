import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, rgb } from "https://esm.sh/pdf-lib@1.17.1";
import QRCode from "https://esm.sh/qrcode@1.5.4/lib/server.js?target=deno";
import fontkit from "https://esm.sh/@pdf-lib/fontkit@1.1.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalizeText(input: string | null | undefined): string {
  if (!input) return "";
  return input.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trimEnd();
}

function stripUnwantedFooter(textBottom: string): string {
  const lines = normalizeText(textBottom).split("\n");
  const idx = lines.findIndex(l => l.trim() === "SALES COMPANY DATA");
  const trimmed = idx >= 0 ? lines.slice(0, idx) : lines;
  const filtered = trimmed.filter(l => !l.includes("@"));
  while (filtered.length && filtered[filtered.length - 1].trim() === "") filtered.pop();
  return filtered.join("\n");
}

// Cache font bytes in memory across invocations
let cachedFontBytes: Uint8Array | null = null;

async function fetchCyrillicFont(): Promise<Uint8Array> {
  if (cachedFontBytes) return cachedFontBytes;
  
  // Use npm CDN (most reliable for Supabase Edge Runtime)
  const url = "https://cdn.jsdelivr.net/npm/dejavu-fonts-ttf@2.37.3/ttf/DejaVuSansMono.ttf";
  console.log("Fetching font from npm CDN...");
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Font fetch failed: ${resp.status}`);
  cachedFontBytes = new Uint8Array(await resp.arrayBuffer());
  console.log("Font loaded, size:", cachedFontBytes.length);
  return cachedFontBytes;
}

async function generateReceiptPdf(
  cleanTop: string,
  cleanBottom: string,
  invoiceNumber: string,
  verificationUrl: string,
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);
  const fontBytes = await fetchCyrillicFont();
  const font = await pdfDoc.embedFont(fontBytes, { subset: false });

  const fontSize = 7;
  const lineHeight = fontSize * 1.4;
  const pageWidth = 226; // ~80mm thermal slip
  const margin = 10;

  // Prepare text lines split into top and bottom blocks
  const topLines: string[] = [];
  if (cleanTop) topLines.push(...cleanTop.split("\n"));

  const bottomLines: string[] = [];
  if (cleanBottom) bottomLines.push(...cleanBottom.split("\n"));
  bottomLines.push("", "----------------------------------------");
  if (invoiceNumber) bottomLines.push(`INVOICE: ${invoiceNumber}`);
  bottomLines.push("");

  const allLines = [...topLines, ...bottomLines];

  // Generate QR code as PNG buffer
  let qrImageBytes: Uint8Array | null = null;
  const qrSize = 100;
  if (verificationUrl) {
    try {
      const pngBuffer: Buffer = await QRCode.toBuffer(verificationUrl, {
        width: qrSize * 2,
        margin: 1,
        errorCorrectionLevel: "M",
        type: "png",
      });
      qrImageBytes = new Uint8Array(pngBuffer);
    } catch (e) {
      console.error("QR generation error:", e);
    }
  }

  // Calculate page height
  const textBlockHeight = allLines.length * lineHeight;
  const qrBlockHeight = qrImageBytes ? qrSize + 20 : 0; // QR only, no URL text
  const totalHeight = margin + textBlockHeight + qrBlockHeight + margin + 20;

  const page = pdfDoc.addPage([pageWidth, totalHeight]);
  let y = totalHeight - margin;

  // Render text lines – center block on page, keep left-align inside
  const nonEmptyLines = allLines.filter(l => l.trim());
  const maxLineWidth = nonEmptyLines.length > 0
    ? Math.max(...nonEmptyLines.map(l => font.widthOfTextAtSize(l, fontSize)))
    : 0;
  const startX = Math.max(0, (pageWidth - maxLineWidth) / 2);

  // Phase 1: Render topLines
  for (const line of topLines) {
    y -= lineHeight;
    if (line.trim()) {
      page.drawText(line, { x: startX, y, size: fontSize, font, color: rgb(0, 0, 0) });
    }
  }

  // Phase 2: Embed QR code between top and bottom
  if (qrImageBytes) {
    y -= 10;
    const qrImage = await pdfDoc.embedPng(qrImageBytes);
    const qrX = (pageWidth - qrSize) / 2;
    y -= qrSize;
    page.drawImage(qrImage, { x: qrX, y, width: qrSize, height: qrSize });
    y -= 5;
  }

  // Phase 3: Render bottomLines
  for (const line of bottomLines) {
    y -= lineHeight;
    if (line.trim()) {
      page.drawText(line, { x: startX, y, size: fontSize, font, color: rgb(0, 0, 0) });
    }
  }

  return await pdfDoc.save();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pickupId, price, kioskToken, regeneratePdf } = await req.json();

    // Auth: accept either kiosk token or JWT
    const employeeToken = Deno.env.get("KIOSK_TOKEN_EMPLOYEE");
    const kitchenToken = Deno.env.get("KIOSK_TOKEN_KITCHEN");
    const isKiosk = kioskToken && (kioskToken === employeeToken || kioskToken === kitchenToken);

    if (!isKiosk) {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response(
          JSON.stringify({ error: "Nedozvoljen pristup" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
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
      .select("id, invoice_number, verification_url, fiscal_status, receipt_file_path, profile_id, order_item_id, receipt_text_top, receipt_text_bottom")
      .eq("id", pickupId)
      .maybeSingle();

    if (fetchErr || !existing) {
      return new Response(
        JSON.stringify({ status: "error", error: "Pickup request nije pronađen" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Regenerate PDF mode: already fiscalized but missing PDF file
    if (regeneratePdf && existing.fiscal_status === "fiscalized" && existing.receipt_text_top) {
      const cleanTop = normalizeText(existing.receipt_text_top);
      const cleanBottom = stripUnwantedFooter(existing.receipt_text_bottom);
      const invoiceNumber = existing.invoice_number || "";
      const verificationUrl = existing.verification_url || "";

      let storagePath = `unknown/${pickupId}.pdf`;
      if (existing.profile_id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("user_id")
          .eq("id", existing.profile_id)
          .maybeSingle();
        if (profile?.user_id) {
          storagePath = `${profile.user_id}/${pickupId}.pdf`;
        }
      }

      try {
        const pdfBytes = await generateReceiptPdf(cleanTop, cleanBottom, invoiceNumber, verificationUrl);
        const { error: uploadErr } = await supabase.storage
          .from("receipts")
          .upload(storagePath, pdfBytes, { contentType: "application/pdf", upsert: true });

        if (uploadErr) {
          console.error("PDF re-upload error:", uploadErr);
          return new Response(
            JSON.stringify({ status: "error", error: "PDF upload failed" }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        await supabase
          .from("pickup_requests")
          .update({ receipt_file_path: storagePath })
          .eq("id", pickupId);

        return new Response(
          JSON.stringify({ status: "fiscalized", pickupId, invoice_number: invoiceNumber, verification_url: verificationUrl, pdf_regenerated: true }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (pdfErr) {
        console.error("PDF regeneration error:", pdfErr);
        return new Response(
          JSON.stringify({ status: "error", error: `PDF generation failed: ${pdfErr.message}` }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
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

    // 4. Fetch profile for tag-based product code and storage path
    let profile: { user_id: string; tag: string | null } | null = null;
    if (existing.profile_id) {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("user_id, tag")
        .eq("id", existing.profile_id)
        .maybeSingle();
      profile = profileData;
    }

    // 5. Determine product code based on employee tag
    const employeeTag = profile?.tag || null;
    if (employeeTag !== "Proizvodnja" && employeeTag !== "Hogo") {
      console.log(`Skipping fiscalization: unsupported tag="${employeeTag || 'none'}"`);
      await supabase
        .from("pickup_requests")
        .update({ fiscal_status: "skipped", fiscal_error: `Tag "${employeeTag || 'none'}" ne podleže fiskalizaciji` })
        .eq("id", pickupId);

      return new Response(
        JSON.stringify({ status: "skipped", reason: `Tag "${employeeTag || 'none'}" ne podleže fiskalizaciji`, pickupId }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const octoposUrl = Deno.env.get("OCTOPOS_BASE_URL") || "https://sandbox.octopos.rs/api";
    const octoposToken = Deno.env.get("OCTOPOS_TOKEN")!;
    const companyTaxNumber = Deno.env.get("OCTOPOS_COMPANY_TAX_NUMBER") || "101612478";
    const proizvodjaProductCode = Deno.env.get("OCTOPOS_PRODUCT_CODE_PERSONAL_MEAL") || "S001";
    const hogoProductCode = Deno.env.get("OCTOPOS_PRODUCT_CODE_PERSONAL_MEAL_HOGO") || proizvodjaProductCode;
    const productCode = employeeTag === "Hogo" ? hogoProductCode : proizvodjaProductCode;
    console.log(`Product code selection: tag="${employeeTag}", code="${productCode}"`);
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

    // 6. Success - generate PDF and save fiscal data
    const data = result.Data;
    const cleanTop = normalizeText(data.TextTop);
    const cleanBottom = stripUnwantedFooter(data.TextBottom);
    const invoiceNumber = data.InvoiceNumber || "";
    const verificationUrl = data.VerificationUrl || "";

    // Determine storage path (reuse profile fetched earlier)
    let storagePath = `unknown/${pickupId}.pdf`;
    if (profile?.user_id) {
      storagePath = `${profile.user_id}/${pickupId}.pdf`;
    }

    // Generate PDF receipt with QR code
    let pdfUploaded = false;
    try {
      const pdfBytes = await generateReceiptPdf(cleanTop, cleanBottom, invoiceNumber, verificationUrl);

      const { error: uploadErr } = await supabase.storage
        .from("receipts")
        .upload(storagePath, pdfBytes, {
          contentType: "application/pdf",
          upsert: true,
        });

      if (uploadErr) {
        console.error("PDF upload error:", uploadErr);
      } else {
        pdfUploaded = true;
      }
    } catch (pdfErr) {
      console.error("PDF generation error:", pdfErr);
      // Fallback: fiscalization data still saved to DB below
    }

    // Update pickup_requests with fiscal data
    await supabase
      .from("pickup_requests")
      .update({
        fiscal_status: "fiscalized",
        octopos_weborder_id: data.Id,
        invoice_number: invoiceNumber,
        verification_url: verificationUrl,
        receipt_text_top: data.TextTop,
        receipt_text_bottom: data.TextBottom,
        fiscalized_at: data.SdcDateTime,
        receipt_file_path: pdfUploaded ? storagePath : null,
        fiscal_error: null,
      })
      .eq("id", pickupId);

    return new Response(
      JSON.stringify({
        status: "fiscalized",
        pickupId,
        invoice_number: invoiceNumber,
        verification_url: verificationUrl,
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
