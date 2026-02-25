import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify user JWT
    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await anonClient.auth.getUser(token);
    if (claimsError || !claimsData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.user.id;

    // Parse pickupId from query string
    const url = new URL(req.url);
    const pickupId = url.searchParams.get("pickupId");
    if (!pickupId) {
      return new Response(JSON.stringify({ error: "pickupId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role for DB and storage access
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch pickup request
    const { data: pickup, error: pickupErr } = await serviceClient
      .from("pickup_requests")
      .select("id, profile_id, fiscal_status, receipt_file_path, invoice_number")
      .eq("id", pickupId)
      .maybeSingle();

    if (pickupErr || !pickup) {
      return new Response(JSON.stringify({ error: "Receipt not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (pickup.fiscal_status !== "fiscalized" || !pickup.receipt_file_path) {
      return new Response(JSON.stringify({ error: "Receipt not available" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check ownership: pickup.profile_id -> profiles.user_id must match auth user
    // Admin bypass via has_role check
    const { data: isAdmin } = await serviceClient.rpc("is_admin_user", { user_uuid: userId });

    if (!isAdmin && pickup.profile_id) {
      const { data: profile } = await serviceClient
        .from("profiles")
        .select("user_id")
        .eq("id", pickup.profile_id)
        .maybeSingle();

      if (!profile || profile.user_id !== userId) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Download file from storage
    const { data: fileData, error: downloadErr } = await serviceClient.storage
      .from("receipts")
      .download(pickup.receipt_file_path);

    if (downloadErr || !fileData) {
      console.error("Storage download error:", downloadErr);
      return new Response(JSON.stringify({ error: "File not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const filename = `racun-${pickup.invoice_number || pickupId}.pdf`;

    return new Response(fileData, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("receipt-download error:", error);
    return new Response(JSON.stringify({ error: "Server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
