import { createClient } from "npm:@supabase/supabase-js@2.58.0";
import { sendEmail } from '../_shared/smtp.ts';
import { assertNotDemo, assertPermission, getCallerUser } from '../_shared/auth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SendMagicLinkRequest {
  email: string;
  fullName?: string;
  redirectTo?: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getSafeRedirectUrl(value?: string): string {
  const fallback = 'https://ketering-app.lovable.app/';
  if (!value) return fallback;

  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : fallback;
  } catch (_error) {
    return fallback;
  }
}

async function sendMagicLinkEmail(
  toEmail: string,
  actionLink: string,
  fullName?: string,
): Promise<{ success: boolean; error?: string; messageId?: string }> {
  const displayName = escapeHtml(fullName || 'korisniče');
  const safeEmail = escapeHtml(toEmail);
  const safeActionLink = escapeHtml(actionLink);

  const htmlContent = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Prijava u Ketering</title></head><body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;background-color:#f4f4f5;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="min-width:100%;background-color:#f4f4f5;"><tr><td align="center" style="padding:40px 20px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background-color:#ffffff;border-radius:12px;box-shadow:0 4px 6px rgba(0,0,0,0.1);"><tr><td style="padding:40px 40px 20px;text-align:center;border-bottom:1px solid #e4e4e7;"><h1 style="margin:0;color:#18181b;font-size:28px;font-weight:700;">🍽️ Ketering</h1></td></tr><tr><td style="padding:40px;"><h2 style="margin:0 0 20px;color:#18181b;font-size:22px;font-weight:600;">Dobrodošli, ${displayName}!</h2><p style="margin:0 0 12px;color:#3f3f46;font-size:16px;line-height:1.6;">Kliknite na dugme ispod da se prijavite u aplikaciju bez unosa lozinke.</p><p style="margin:0 0 24px;color:#71717a;font-size:14px;line-height:1.6;">Email adresa: <strong style="color:#18181b;">${safeEmail}</strong></p><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:24px;"><tr><td align="center"><a href="${safeActionLink}" style="display:inline-block;background-color:#f97316;color:#ffffff;text-decoration:none;font-size:16px;font-weight:600;padding:14px 32px;border-radius:8px;">Prijavite se na aplikaciju</a></td></tr></table><p style="margin:0;color:#71717a;font-size:14px;line-height:1.6;">Ako dugme ne radi, kopirajte ovaj link u browser:<br><span style="word-break:break-all;">${safeActionLink}</span></p></td></tr><tr><td style="padding:24px 40px;background-color:#f4f4f5;border-radius:0 0 12px 12px;"><p style="margin:0;color:#71717a;font-size:12px;text-align:center;">Ovaj email je automatski generisan. Molimo vas da ne odgovarate na njega.</p></td></tr></table></td></tr></table></body></html>`;

  return sendEmail({
    to: toEmail,
    subject: 'Ketering - Magični link za prijavu',
    html: htmlContent,
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { user: callerUser, error: userError } = await getCallerUser(req, supabaseAdmin);
    if (userError || !callerUser) {
      console.error('JWT validation failed:', userError);
      throw new Error('Neautorizovan pristup');
    }

    const permBlock = await assertPermission(supabaseAdmin, callerUser.id, 'users.invite', corsHeaders);
    if (permBlock) return permBlock;
    const demoBlock = await assertNotDemo(supabaseAdmin, callerUser.id, corsHeaders);
    if (demoBlock) return demoBlock;

    const body: SendMagicLinkRequest = await req.json();
    const email = body.email?.trim().toLowerCase();
    const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : undefined;
    const redirectTo = getSafeRedirectUrl(body.redirectTo);

    if (!email || !isValidEmail(email)) {
      throw new Error('Unesite ispravnu email adresu');
    }

    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: { redirectTo },
    });

    if (linkError || !linkData?.properties?.action_link) {
      console.error('Magic link generation failed:', linkError?.message);
      throw new Error('Nije moguće generisati magični link za korisnika');
    }

    const emailResult = await sendMagicLinkEmail(email, linkData.properties.action_link, fullName);

    if (!emailResult.success) {
      console.error('Failed to send magic link email:', emailResult.error);
      throw new Error('Magic link je generisan, ali email nije poslat: ' + emailResult.error);
    }

    return new Response(
      JSON.stringify({ success: true, message: `Magic link je poslat na ${email}` }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
    );
  } catch (error: unknown) {
    console.error('Error in send-magic-link function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Došlo je do greške pri slanju magic linka';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
    );
  }
});