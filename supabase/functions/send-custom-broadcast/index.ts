import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";
import { sendEmail } from "../_shared/smtp.ts";
import { assertNotDemo } from "../_shared/auth.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      throw new Error("Neautorizovan pristup");
    }
    const token = authHeader.slice("Bearer ".length);
    const { data: { user: callerUser }, error: userError } =
      await supabase.auth.getUser(token);
    if (userError || !callerUser) {
      throw new Error("Neautorizovan pristup");
    }

    const { data: callerRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", callerUser.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!callerRole) {
      throw new Error("Samo administratori mogu slati obaveštenja");
    }

    // Demo nalogu nije dozvoljeno slanje obaveštenja
    const demoBlock = await assertNotDemo(supabase, callerUser.id, corsHeaders);
    if (demoBlock) return demoBlock;


    const body = await req.json();
    const subject: string = (body?.subject || "").toString().trim();
    const message: string = (body?.message || "").toString().trim();
    const tags: string[] = Array.isArray(body?.tags)
      ? body.tags.filter((t: any) => typeof t === "string" && t.trim())
      : [];

    if (!subject || !message) {
      return new Response(
        JSON.stringify({ error: "Naslov i poruka su obavezni" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let query = supabase
      .from("profiles")
      .select("user_id, email, full_name, tag, role")
      .eq("role", "employee")
      .not("email", "is", null);

    if (tags.length > 0) {
      query = query.in("tag", tags);
    }

    const { data: profiles, error: profilesError } = await query;
    if (profilesError) throw profilesError;

    const recipients = (profiles || []).filter(
      (p: any) => p.email && /.+@.+\..+/.test(p.email)
    );

    const safeMessageHtml = escapeHtml(message).replace(/\n/g, "<br/>");
    const safeSubject = escapeHtml(subject);

    let sent = 0;
    let failed = 0;

    for (const r of recipients) {
      const greetingName = r.full_name ? escapeHtml(r.full_name) : "korisniče";
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1f2937;">${safeSubject}</h2>
          <p>Zdravo ${greetingName},</p>
          <div style="background: #f9fafb; padding: 16px; border-radius: 8px; border-left: 4px solid #3b82f6; margin: 16px 0;">
            ${safeMessageHtml}
          </div>
          <p style="color: #6b7280; font-size: 12px; margin-top: 24px;">
            Ovo je automatska poruka administracije. Molimo ne odgovarajte na ovaj email.
          </p>
        </div>
      `;

      try {
        const result = await sendEmail({
          to: r.email!,
          subject: subject,
          html,
        });
        if (result.success) sent++;
        else failed++;
      } catch (err) {
        console.error(`Failed to send to ${r.email}:`, err);
        failed++;
      }
    }

    return new Response(
      JSON.stringify({ sent, failed, total: recipients.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("send-custom-broadcast error:", error);
    return new Response(
      JSON.stringify({ error: error?.message || "Greška" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
