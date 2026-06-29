import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";
import { sendEmail } from "../_shared/smtp.ts";
import { assertNotDemo, assertPermission, getCallerUser } from "../_shared/auth.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting notify-menu-ready...");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify caller (lokalni JWT decode preko shared helpera)
    const { user: callerUser, error: userError } = await getCallerUser(req, supabase);
    if (userError || !callerUser) {
      throw new Error("Neautorizovan pristup");
    }

    // Granular permission check (Faza 2)
    const permBlock = await assertPermission(supabase, callerUser.id, "notifications.menu", corsHeaders);
    if (permBlock) return permBlock;
    const demoBlock = await assertNotDemo(supabase, callerUser.id, corsHeaders);
    if (demoBlock) return demoBlock;

    // Get next week date range
    const now = new Date();
    const dayOfWeek = now.getDay();
    const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
    const nextMonday = new Date(now);
    nextMonday.setDate(now.getDate() + daysUntilMonday);
    const nextFriday = new Date(nextMonday);
    nextFriday.setDate(nextMonday.getDate() + 4);

    const mondayStr = nextMonday.toLocaleDateString("sr-Latn-RS", { day: "numeric", month: "long" });
    const fridayStr = nextFriday.toLocaleDateString("sr-Latn-RS", { day: "numeric", month: "long" });
    const weekRange = `${mondayStr} - ${fridayStr}`;

    // Get all employee profiles
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("user_id, email, full_name, role")
      .eq("role", "employee");

    if (profilesError) {
      console.error("Error fetching profiles:", profilesError);
      throw profilesError;
    }

    console.log(`Found ${profiles?.length || 0} employees`);

    // Get notification preferences
    const { data: preferences } = await supabase
      .from("notification_preferences")
      .select("user_id, email_enabled, push_enabled");

    const prefsMap = new Map(preferences?.map(p => [p.user_id, p]) || []);

    const emailUsers = profiles?.filter(p => {
      if (!p.email) return false;
      const prefs = prefsMap.get(p.user_id);
      return prefs?.email_enabled ?? true; // default email enabled
    }) || [];

    const pushUsers = profiles?.filter(p => {
      const prefs = prefsMap.get(p.user_id);
      return prefs?.push_enabled ?? false;
    }) || [];

    console.log(`Sending to: ${emailUsers.length} email, ${pushUsers.length} push`);

    // Send emails
    let emailSuccess = 0;
    let emailFail = 0;

    const subject = "Novi jelovnik za sledeću nedelju je spreman!";

    for (const { email, full_name } of emailUsers) {
      try {
        const result = await sendEmail({
          to: email!,
          subject,
          html: `
            <h2>🍽️ Novi jelovnik je spreman!</h2>
            <p>Zdravo ${full_name || "korisniče"},</p>
            <p>Obaveštavamo vas da je jelovnik za sledeću nedelju (<strong>${weekRange}</strong>) sada dostupan.</p>
            <p>Prijavite se na aplikaciju i poručite obroke na vreme.</p>
            <p><strong>Rok za poručivanje: Petak u 17:00h</strong></p>
            <br>
            <p>Prijatan dan! 🙂</p>
          `,
        });

        if (result.success) {
          emailSuccess++;
        } else {
          console.error(`Failed to send to ${email}:`, result.error);
          emailFail++;
        }
      } catch (error) {
        console.error(`Exception sending to ${email}:`, error);
        emailFail++;
      }
    }

    // Send push notifications
    let pushSuccess = 0;
    let pushFail = 0;

    if (pushUsers.length > 0) {
      try {
        const pushResponse = await fetch(
          `${supabaseUrl}/functions/v1/send-push-notification`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({
              userIds: pushUsers.map(u => u.user_id),
              payload: {
                title: "Novi jelovnik je spreman!",
                body: `Jelovnik za ${weekRange} je dostupan. Poručite obroke na vreme!`,
                url: "/",
                tag: "menu-ready",
              },
            }),
          }
        );

        if (pushResponse.ok) {
          const pushResult = await pushResponse.json();
          pushSuccess = pushResult.sent || 0;
          pushFail = pushResult.failed || 0;
        } else {
          pushFail = pushUsers.length;
        }
      } catch (error) {
        console.error("Push notification error:", error);
        pushFail = pushUsers.length;
      }
    }

    console.log(`Summary - Email: ${emailSuccess}/${emailUsers.length}, Push: ${pushSuccess}/${pushUsers.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        email: { sent: emailSuccess, failed: emailFail, total: emailUsers.length },
        push: { sent: pushSuccess, failed: pushFail, total: pushUsers.length },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error in notify-menu-ready:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
