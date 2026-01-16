import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";
import { sendEmail } from "../_shared/smtp.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailData {
  email: string;
  full_name: string;
  hasOrders: boolean;
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
    
    // Prepare email list
    const emailsToSend: EmailData[] = profiles
      ?.filter(p => p.email)
      .map(p => ({
        email: p.email!,
        full_name: p.full_name || 'Korisnik',
        hasOrders: usersWithOrders.has(p.user_id)
      })) || [];

    console.log(`Sending emails to ${emailsToSend.length} employees`);

    // Send emails
    let successCount = 0;
    let failCount = 0;

    for (const { email, full_name, hasOrders } of emailsToSend) {
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
          console.log(`Email sent to ${email}, messageId: ${result.messageId}`);
          successCount++;
        } else {
          console.error(`Failed to send email to ${email}:`, result.error);
          failCount++;
        }
      } catch (error) {
        console.error(`Exception sending email to ${email}:`, error);
        failCount++;
      }
    }

    console.log(`Sent ${successCount}/${emailsToSend.length} emails successfully, ${failCount} failed`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        sent: successCount,
        failed: failCount,
        total: emailsToSend.length 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-employee-reminder:", error);
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
