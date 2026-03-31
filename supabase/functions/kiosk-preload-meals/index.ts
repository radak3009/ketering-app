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
    const { kioskToken } = await req.json();

    const expectedToken = Deno.env.get("KIOSK_TOKEN_EMPLOYEE");
    if (!expectedToken || kioskToken !== expectedToken) {
      return new Response(
        JSON.stringify({ error: "Nedozvoljen pristup" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Belgrade" });

    // Fetch all today's orders with profile info and meal names in one query
    const { data: orders, error: orderError } = await supabase
      .from("orders")
      .select(`
        id,
        user_id,
        order_items (
          id,
          meal_id,
          shift,
          pickup_status,
          meals ( name )
        )
      `)
      .eq("delivery_date", today);

    if (orderError) {
      console.error("Orders error:", orderError);
      return new Response(
        JSON.stringify({ error: "Greška pri učitavanju" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!orders || orders.length === 0) {
      return new Response(
        JSON.stringify({ meals: {}, timestamp: Date.now() }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Collect unique user_ids
    const userIds = [...new Set(orders.map((o: any) => o.user_id))];

    // Fetch profiles for these users
    const { data: profiles, error: profileError } = await supabase
      .from("profiles")
      .select("id, user_id, full_name, company_card_id, company_card_serial")
      .in("user_id", userIds);

    if (profileError) {
      console.error("Profiles error:", profileError);
      return new Response(
        JSON.stringify({ error: "Greška pri učitavanju profila" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build user_id -> profile map
    const profileMap = new Map<string, any>();
    for (const p of (profiles || [])) {
      if (p.company_card_id || p.company_card_serial) {
        profileMap.set(p.user_id, p);
      }
    }

    // Build card_id -> meal info map
    const meals: Record<string, {
      fullName: string;
      mealName: string;
      orderItemId: string;
      pickupStatus: string;
      shift: string;
    }> = {};

    for (const order of orders) {
      const profile = profileMap.get((order as any).user_id);
      if (!profile) continue;
      if (!profile.company_card_id && !profile.company_card_serial) continue;

      const items = (order as any).order_items;
      if (!items || items.length === 0) continue;

      const item = items[0];
      const mealName = item.meals?.name || "Nepoznat obrok";

      const entry = {
        fullName: profile.full_name || "",
        mealName,
        orderItemId: item.id,
        pickupStatus: item.pickup_status,
        shift: item.shift,
      };

      // Map by company_card_id
      if (profile.company_card_id) {
        meals[profile.company_card_id] = entry;
      }
      // Also map by company_card_serial for RFID lookup
      if (profile.company_card_serial) {
        meals[profile.company_card_serial] = entry;
      }
    }

    return new Response(
      JSON.stringify({ meals, timestamp: Date.now() }),
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
