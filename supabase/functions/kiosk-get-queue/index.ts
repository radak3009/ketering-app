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
    const { kioskToken, date } = await req.json();

    // Validate kiosk token (kitchen token)
    const expectedToken = Deno.env.get("KIOSK_TOKEN_KITCHEN");
    if (!expectedToken || kioskToken !== expectedToken) {
      return new Response(
        JSON.stringify({ error: "Nedozvoljen pristup" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase with service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get today's date in local timezone (Serbia - Europe/Belgrade) or use provided date
    const targetDate = date || new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Belgrade" });

    // Fetch pending requests ordered by created_at ASC
    const { data: pendingData, error: pendingError } = await supabase
      .from("pickup_requests")
      .select(`
        id,
        created_at,
        employee_identifier,
        profile_id,
        meal_name_snapshot,
        status,
        served_at
      `)
      .eq("pickup_date", targetDate)
      .eq("status", "pending")
      .order("created_at", { ascending: true });

    if (pendingError) {
      console.error("Pending error:", pendingError);
      return new Response(
        JSON.stringify({ error: "Greška pri učitavanju queue-a" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch served requests ordered by served_at DESC (exclude auto-fiscal and employee-kiosk)
    const { data: servedData, error: servedError } = await supabase
      .from("pickup_requests")
      .select(`
        id,
        created_at,
        employee_identifier,
        profile_id,
        meal_name_snapshot,
        status,
        served_at
      `)
      .eq("pickup_date", targetDate)
      .eq("status", "served")
      .or("served_by.is.null,served_by.eq.kitchen")
      .order("served_at", { ascending: false });

    if (servedError) {
      console.error("Served error:", servedError);
      return new Response(
        JSON.stringify({ error: "Greška pri učitavanju izdatih" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get all unique profile IDs to fetch names
    const allItems = [...(pendingData || []), ...(servedData || [])];
    const profileIds = [...new Set(allItems.filter(item => item.profile_id).map(item => item.profile_id))];

    // Fetch profile names and tags - filter to only Proizvodnja organization
    let profileMap: Record<string, string> = {};
    const allowedProfileIds = new Set<string>();
    if (profileIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, tag")
        .in("id", profileIds);

      if (profiles) {
        for (const p of profiles) {
          // Only include profiles with tag 'Proizvodnja' (case-insensitive)
          if (p.tag && p.tag.toLowerCase() === "proizvodnja") {
            profileMap[p.id] = p.full_name || "";
            allowedProfileIds.add(p.id);
          }
        }
      }
    }

    // Filter items to only Proizvodnja users, then map
    const filterAndMap = (items: typeof pendingData) =>
      (items || [])
        .filter(item => item.profile_id && allowedProfileIds.has(item.profile_id))
        .map(item => ({
          id: item.id,
          created_at: item.created_at,
          employee_identifier: item.employee_identifier,
          fullName: item.profile_id ? profileMap[item.profile_id] || null : null,
          meal_name_snapshot: item.meal_name_snapshot,
          status: item.status,
          served_at: item.served_at
        }));

    return new Response(
      JSON.stringify({
        pending: filterAndMap(pendingData),
        served: filterAndMap(servedData)
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
