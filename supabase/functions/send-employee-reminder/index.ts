import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";
import { sendEmail } from "../_shared/smtp.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface UserData {
  user_id: string;
  email: string;
  full_name: string;
  hasOrders: boolean;
  email_enabled: boolean;
  push_enabled: boolean;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting employee reminder process...");
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Get start and end of next week
    const now = new Date();
    const dayOfWeek = now.getDay();
    const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
    const nextMonday = new Date(now);
    nextMonday.setDate(now.getDate() + daysUntilMonday);
    nextMonday.setHours(0, 0, 0, 0);
    
    const nextSunday = new Date(nextMonday);
    nextSunday.setDate(nextMonday.getDate() + 6);
    nextSunday.setHours(23, 59, 59, 999);

    // Check if there are active menus for next week — skip reminders if none exist
    const { data: nextWeekMenus, error: menusCheckError } = await supabase
      .from('menus')
      .select('id')
      .eq('is_active', true)
      .gte('menu_date', nextMonday.toISOString().split('T')[0])
      .lte('menu_date', nextSunday.toISOString().split('T')[0])
      .limit(1);

    if (menusCheckError) {
      console.error("Error checking menus:", menusCheckError);
      throw menusCheckError;
    }

    if (!nextWeekMenus || nextWeekMenus.length === 0) {
      console.log("No active menus for next week — skipping reminder send");
      return new Response(
        JSON.stringify({
          success: true,
          skipped: true,
          reason: "Nema kreiranih jelovnika za sledeću nedelju",
          email: { sent: 0, failed: 0, total: 0 },
          push: { sent: 0, failed: 0, total: 0 },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Get all employee profiles
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('user_id, email, full_name, role')
      .eq('role', 'employee');

    if (profilesError) {
      console.error("Error fetching profiles:", profilesError);
      throw profilesError;
    }

    console.log(`Found ${profiles?.length || 0} employees`);

    // Get notification preferences for all users
    const { data: preferences, error: prefsError } = await supabase
      .from('notification_preferences')
      .select('user_id, email_enabled, push_enabled');

    if (prefsError) {
      console.error("Error fetching preferences:", prefsError);
      // Continue with default preferences (email enabled)
    }

    const prefsMap = new Map(preferences?.map(p => [p.user_id, p]) || []);

    // Check which employees have orders for next week
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('user_id')
      .gte('delivery_date', nextMonday.toISOString().split('T')[0])
      .lte('delivery_date', nextSunday.toISOString().split('T')[0]);

    if (ordersError) {
      console.error("Error fetching orders:", ordersError);
      throw ordersError;
    }

    const usersWithOrders = new Set(orders?.map(o => o.user_id) || []);
    
    // Prepare user data with preferences
    const userData: UserData[] = profiles
      ?.filter(p => p.email)
      .map(p => {
        const prefs = prefsMap.get(p.user_id);
        return {
          user_id: p.user_id,
          email: p.email!,
          full_name: p.full_name || 'Korisnik',
          hasOrders: usersWithOrders.has(p.user_id),
          // Default to email enabled if no preferences set
          email_enabled: prefs?.email_enabled ?? true,
          push_enabled: prefs?.push_enabled ?? false,
        };
      }) || [];

    // Split users by notification preference
    const emailUsers = userData.filter(u => u.email_enabled);
    const pushUsers = userData.filter(u => u.push_enabled);

    console.log(`Users: ${userData.length} total, ${emailUsers.length} email, ${pushUsers.length} push`);

    // Send emails
    let emailSuccess = 0;
    let emailFail = 0;

    for (const { email, full_name, hasOrders } of emailUsers) {
      const subject = hasOrders 
        ? "Podsetnik: Imate porudžbine za sledeću nedelju"
        : "Podsetnik: Poručite obroke za sledeću nedelju";
      
      const message = hasOrders
        ? `Zdravo ${full_name},\n\nImate porudžbine za sledeću nedelju. Rok za izmene je petak u 17:00h.\n\nPrijatan dan!`
        : `Zdravo ${full_name},\n\nJoš uvek niste poručili obroke za sledeću nedelju. Rok za poručivanje je petak u 17:00h.\n\nPrijatan dan!`;

      try {
        const result = await sendEmail({
          to: email,
          subject,
          html: `
            <h2>${subject}</h2>
            <p>${message.replace(/\n/g, '<br>')}</p>
            <p><strong>Rok za poručivanje: Petak 17:00h</strong></p>
          `,
        });

        if (result.success) {
          console.log(`Email sent to ${email}`);
          emailSuccess++;
        } else {
          console.error(`Failed to send email to ${email}:`, result.error);
          emailFail++;
        }
      } catch (error) {
        console.error(`Exception sending email to ${email}:`, error);
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
                title: "Podsetnik za poručivanje",
                body: "Ne zaboravite da poručite obroke za sledeću nedelju! Rok je petak u 17:00h.",
                url: "/",
                tag: "meal-reminder",
              },
            }),
          }
        );

        if (pushResponse.ok) {
          const pushResult = await pushResponse.json();
          pushSuccess = pushResult.sent || 0;
          pushFail = pushResult.failed || 0;
          console.log(`Push notifications: ${pushSuccess} sent, ${pushFail} failed`);
        } else {
          const errorText = await pushResponse.text();
          console.error("Push notification error:", errorText);
          pushFail = pushUsers.length;
        }
      } catch (error) {
        console.error("Error calling push notification function:", error);
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
    console.error("Error in send-employee-reminder:", errorMessage);
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
