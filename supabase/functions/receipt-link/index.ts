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
    // Authenticate user via JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Nedozvoljen pristup" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify user
    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await anonClient.auth.getClaims(token);
    if (claimsErr || !claims?.claims?.sub) {
      return new Response(
        JSON.stringify({ error: "Nevažeći token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = claims.claims.sub as string;

    // Get pickupId from body or query
    let pickupId: string | null = null;
    const url = new URL(req.url);
    pickupId = url.searchParams.get("pickupId");

    if (!pickupId && req.method === "POST") {
      const body = await req.json();
      pickupId = body.pickupId;
    }

    if (!pickupId) {
      return new Response(
        JSON.stringify({ error: "pickupId je obavezan" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Service role client for data access
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get pickup request and verify ownership
    const { data: pickup, error: pickupErr } = await supabase
      .from("pickup_requests")
      .select("id, profile_id, fiscal_status, receipt_file_path")
      .eq("id", pickupId)
      .maybeSingle();

    if (pickupErr || !pickup) {
      return new Response(
        JSON.stringify({ url: null }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify ownership: profile_id -> profiles.user_id must match auth user
    if (pickup.profile_id) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("id", pickup.profile_id)
        .maybeSingle();

      if (!profile || profile.user_id !== userId) {
        return new Response(
          JSON.stringify({ error: "Nedozvoljen pristup" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else {
      return new Response(
        JSON.stringify({ url: null }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check fiscal status
    if (pickup.fiscal_status !== "fiscalized" || !pickup.receipt_file_path) {
      return new Response(
        JSON.stringify({ url: null }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate signed URL (5 min TTL)
    const { data: signedUrl, error: signErr } = await supabase.storage
      .from("receipts")
      .createSignedUrl(pickup.receipt_file_path, 300);

    if (signErr || !signedUrl) {
      console.error("Signed URL error:", signErr);
      return new Response(
        JSON.stringify({ url: null }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ url: signedUrl.signedUrl }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Receipt-link error:", error);
    return new Response(
      JSON.stringify({ error: "Serverska greška" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
