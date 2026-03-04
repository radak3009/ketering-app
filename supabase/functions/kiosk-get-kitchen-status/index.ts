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
    const { kioskToken, companyId, employeeTag } = await req.json();

    // Validate kiosk token (accept either employee or kitchen token)
    const employeeToken = Deno.env.get("KIOSK_TOKEN_EMPLOYEE");
    const kitchenToken = Deno.env.get("KIOSK_TOKEN_KITCHEN");

    const isValidToken =
      (employeeToken && kioskToken === employeeToken) ||
      (kitchenToken && kioskToken === kitchenToken);

    if (!isValidToken) {
      return new Response(
        JSON.stringify({ error: "Nedozvoljen pristup" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase with service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // If employeeTag is provided, check if schedule applies to this tag
    if (employeeTag) {
      const { data: setting } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "kitchen_schedule_tags")
        .maybeSingle();

      const scheduleTags: string[] = (setting?.value as string[]) || [];

      // If scheduleTags has entries and this tag is NOT in the list → kitchen is "closed" for them
      if (scheduleTags.length > 0 && !scheduleTags.includes(employeeTag)) {
        return new Response(
          JSON.stringify({
            isOpen: false,
            openTime: null,
            closeTime: null,
            currentTime: new Date().toLocaleTimeString("en-GB", {
              timeZone: "Europe/Belgrade",
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            }),
            reason: "tag_excluded",
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Get kitchen status
    const kitchenStatus = await isKitchenOpen(supabase, companyId || null);

    return new Response(
      JSON.stringify(kitchenStatus),
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
