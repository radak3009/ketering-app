import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";
import { sendEmail } from "../_shared/smtp.ts";

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
    console.log("Checking for next week menu...");
    
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

    // Check if there are active menus for next week
    const { data: menus, error: menusError } = await supabase
      .from('menus')
      .select('id, name, menu_date')
      .eq('is_active', true)
      .gte('menu_date', nextMonday.toISOString().split('T')[0])
      .lte('menu_date', nextSunday.toISOString().split('T')[0]);

    if (menusError) {
      console.error("Error fetching menus:", menusError);
      throw menusError;
    }

    const menuCount = menus?.length || 0;
    console.log(`Found ${menuCount} menus for next week`);

    // If there are menus, no need to send alert
    if (menuCount >= 5) {
      console.log("Next week menu is complete (5+ days)");
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Menu is complete",
          menuCount 
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Get all admin emails via user_roles join (roles.panel='admin').
    const { data: adminRoleRows, error: adminRolesError } = await supabase
      .from('user_roles')
      .select('user_id, roles:role_id!inner(panel)')
      .eq('roles.panel', 'admin');
    if (adminRolesError) {
      console.error("Error fetching admin user_roles:", adminRolesError);
      throw adminRolesError;
    }
    const adminIds = (adminRoleRows ?? []).map((r: any) => r.user_id).filter(Boolean);

    const { data: admins, error: adminsError } = adminIds.length > 0
      ? await supabase
          .from('profiles')
          .select('email, full_name')
          .in('user_id', adminIds)
      : { data: [], error: null } as any;

    if (adminsError) {
      console.error("Error fetching admins:", adminsError);
      throw adminsError;
    }

    const adminEmails = admins?.filter(a => a.email).map(a => a.email!) || [];
    console.log(`Sending alert to ${adminEmails.length} admins`);

    if (adminEmails.length === 0) {
      console.log("No admin emails found");
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "No admins to notify" 
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Send emails to admins
    const subject = menuCount === 0 
      ? "Upozorenje: Jelovnik za sledeću nedelju nije definisan"
      : `Upozorenje: Jelovnik za sledeću nedelju je nepotpun (${menuCount}/5 dana)`;

    const message = menuCount === 0
      ? "Jelovnik za sledeću nedelju još uvek nije definisan. Molimo vas da što pre kreirate jelovnik kako bi zaposleni mogli da poručuju obroke."
      : `Trenutno je definisan jelovnik samo za ${menuCount} dan${menuCount === 1 ? '' : 'a'} sledeće nedelje. Preporučujemo da kompletnu nedelju (5 radnih dana).`;

    let successCount = 0;
    let failCount = 0;

    for (const email of adminEmails) {
      try {
        const result = await sendEmail({
          to: email,
          subject,
          html: `
            <h2>${subject}</h2>
            <p>${message}</p>
            <p><strong>Rok za kreiranje jelovnika: Pre petka u 17:00h</strong></p>
            <p>Zaposleni moraju imati mogućnost da poruče obroke do petka.</p>
          `,
        });

        if (result.success) {
          console.log(`Alert sent to ${email}, messageId: ${result.messageId}`);
          successCount++;
        } else {
          console.error(`Failed to send alert to ${email}:`, result.error);
          failCount++;
        }
      } catch (error) {
        console.error(`Exception sending alert to ${email}:`, error);
        failCount++;
      }
    }

    console.log(`Sent ${successCount}/${adminEmails.length} alerts successfully, ${failCount} failed`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        sent: successCount,
        failed: failCount,
        total: adminEmails.length,
        menuCount 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-admin-menu-alert:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
