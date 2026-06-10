import { createClient } from "npm:@supabase/supabase-js@2.58.0";
import { sendEmail } from '../_shared/smtp.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SignupRequest {
  email: string;
  password: string;
  full_name: string;
  company_card_id: string;
  tag?: string;
  date_of_birth?: string;
}

const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_ATTEMPTS_PER_WINDOW = 5;
const rateLimitStore = new Map<string, { attempts: number; windowStart: number }>();

function getClientIP(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  const real = req.headers.get('x-real-ip');
  if (real) return real;
  return `ua-${(req.headers.get('user-agent') || 'unknown').substring(0, 50)}`;
}

function checkRateLimit(ip: string): { allowed: boolean; resetInSeconds: number } {
  const now = Date.now();
  const rec = rateLimitStore.get(ip);
  if (!rec) {
    rateLimitStore.set(ip, { attempts: 1, windowStart: now });
    return { allowed: true, resetInSeconds: 60 };
  }
  const age = now - rec.windowStart;
  if (age > RATE_LIMIT_WINDOW_MS) {
    rateLimitStore.set(ip, { attempts: 1, windowStart: now });
    return { allowed: true, resetInSeconds: 60 };
  }
  if (rec.attempts >= MAX_ATTEMPTS_PER_WINDOW) {
    return { allowed: false, resetInSeconds: Math.ceil((RATE_LIMIT_WINDOW_MS - age) / 1000) };
  }
  rec.attempts++;
  return { allowed: true, resetInSeconds: Math.ceil((RATE_LIMIT_WINDOW_MS - age) / 1000) };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function buildVerificationEmail(fullName: string, verifyUrl: string): string {
  const displayName = fullName || 'korisniče';
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Potvrdite email</title></head><body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;background-color:#f4f4f5;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f4f4f5;"><tr><td align="center" style="padding:40px 20px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background-color:#ffffff;border-radius:12px;box-shadow:0 4px 6px rgba(0,0,0,0.1);"><tr><td style="padding:40px 40px 20px 40px;text-align:center;border-bottom:1px solid #e4e4e7;"><h1 style="margin:0;color:#18181b;font-size:28px;font-weight:700;">🍽️ Ketering</h1></td></tr><tr><td style="padding:40px;"><h2 style="margin:0 0 20px 0;color:#18181b;font-size:22px;font-weight:600;">Zdravo, ${displayName}!</h2><p style="margin:0 0 24px 0;color:#3f3f46;font-size:16px;line-height:1.6;">Hvala što ste se registrovali na Ketering aplikaciju. Da biste aktivirali svoj nalog i počeli da naručujete obroke, molimo potvrdite svoju email adresu klikom na dugme ispod:</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:24px;"><tr><td align="center"><a href="${verifyUrl}" style="display:inline-block;background-color:#f97316;color:#ffffff;text-decoration:none;font-size:16px;font-weight:600;padding:14px 32px;border-radius:8px;">Potvrdi email adresu</a></td></tr></table><p style="margin:0 0 12px 0;color:#71717a;font-size:14px;line-height:1.6;">Ako dugme ne radi, kopirajte ovaj link u browser:</p><p style="margin:0 0 24px 0;color:#3f3f46;font-size:13px;line-height:1.6;word-break:break-all;background-color:#f4f4f5;padding:12px;border-radius:6px;">${verifyUrl}</p><p style="margin:0;color:#71717a;font-size:13px;line-height:1.6;">⏱️ <em>Link važi 24 sata. Ako niste vi pokrenuli registraciju, slobodno ignorišite ovaj email.</em></p></td></tr><tr><td style="padding:24px 40px;background-color:#f4f4f5;border-radius:0 0 12px 12px;"><p style="margin:0;color:#71717a;font-size:12px;text-align:center;">Ovaj email je automatski generisan. Molimo ne odgovarajte na njega.</p></td></tr></table></td></tr></table></body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const ip = getClientIP(req);
  const rl = checkRateLimit(ip);
  if (!rl.allowed) {
    return jsonResponse(
      { error: `Previše pokušaja registracije. Pokušajte ponovo za ${rl.resetInSeconds} sekundi.`, retryAfter: rl.resetInSeconds },
      429
    );
  }

  try {
    const body = (await req.json()) as SignupRequest;
    const email = (body.email || '').trim().toLowerCase();
    const password = body.password || '';
    const full_name = (body.full_name || '').trim();
    const company_card_id = (body.company_card_id || '').trim();
    const tag = (body.tag || '').trim();
    const date_of_birth = (body.date_of_birth || '').trim();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return jsonResponse({ error: 'Neispravna email adresa' }, 400);
    }
    if (!password || password.length < 6) {
      return jsonResponse({ error: 'Lozinka mora imati najmanje 6 karaktera' }, 400);
    }
    if (!full_name || full_name.length < 2) {
      return jsonResponse({ error: 'Ime i prezime mora imati najmanje 2 karaktera' }, 400);
    }
    if (!company_card_id || !/^\d{1,10}$/.test(company_card_id)) {
      return jsonResponse({ error: 'ID zaposlenog mora biti numerički, 1-10 cifara' }, 400);
    }
    if (tag && tag !== 'Proizvodnja' && tag !== 'Hogo') {
      return jsonResponse({ error: 'Nevažeća organizacija' }, 400);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: emailExists } = await supabaseAdmin.rpc('email_exists', { check_email: email });
    if (emailExists) {
      return jsonResponse({ error: 'Korisnik sa ovom email adresom već postoji', code: 'email_taken' }, 200);
    }

    const { data: idExists } = await supabaseAdmin.rpc('company_card_id_exists', { check_id: company_card_id });
    if (idExists) {
      return jsonResponse({ error: 'ID zaposlenog je već dodeljen drugom korisniku. Molimo proverite uneti ID ili se obratite administratoru.', code: 'id_taken' }, 200);
    }

    const userMetadata: Record<string, string> = {
      full_name,
      role: 'employee',
      company_card_id,
    };
    if (tag) userMetadata.tag = tag;
    if (date_of_birth) userMetadata.date_of_birth = date_of_birth;

    // Create user with email NOT confirmed - we send our own verification email
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: false,
      user_metadata: userMetadata,
    });

    if (createErr) {
      console.error('[signup-employee] createUser error:', createErr.message);
      if (createErr.message.toLowerCase().includes('already')) {
        return jsonResponse({ error: 'Korisnik sa ovom email adresom već postoji', code: 'email_taken' }, 409);
      }
      if ((createErr as any).code === '23505' || createErr.message.includes('23505')) {
        return jsonResponse({ error: 'ID zaposlenog ili email su već dodeljeni', code: 'duplicate' }, 409);
      }
      return jsonResponse({ error: createErr.message }, 400);
    }

    if (!created?.user) {
      return jsonResponse({ error: 'Neuspešno kreiranje naloga' }, 500);
    }

    const userId = created.user.id;

    // Ensure user_roles row
    await supabaseAdmin.from('user_roles').delete().eq('user_id', userId);
    await supabaseAdmin.from('user_roles').insert({ user_id: userId, role: 'employee' });

    // Generate verification token
    const token = generateToken();
    const { error: tokenErr } = await supabaseAdmin
      .from('email_verification_tokens')
      .insert({ user_id: userId, email, token });

    if (tokenErr) {
      console.error('[signup-employee] Token insert error:', tokenErr.message);
      return jsonResponse({ error: 'Greška pri kreiranju verifikacionog tokena' }, 500);
    }

    // Build verification URL
    const origin = req.headers.get('origin') || 'https://ketering-app.lovable.app';
    const verifyUrl = `${origin}/auth/confirm?token=${token}`;

    // Send verification email via SMTP
    const emailResult = await sendEmail({
      to: email,
      subject: 'Potvrdite svoju email adresu - Ketering',
      html: buildVerificationEmail(full_name, verifyUrl),
    });

    if (!emailResult.success) {
      console.error('[signup-employee] Email send failed:', emailResult.error);
      return jsonResponse({
        success: true,
        requiresEmailConfirmation: true,
        emailSent: false,
        message: 'Nalog je kreiran, ali slanje verifikacionog emaila nije uspelo. Obratite se administratoru.',
      });
    }

    console.log('[signup-employee] Verification email sent to:', email);

    return jsonResponse({
      success: true,
      requiresEmailConfirmation: true,
      emailSent: true,
      message: 'Nalog je kreiran. Proverite email da potvrdite registraciju.',
    });
  } catch (err: unknown) {
    console.error('[signup-employee] Unexpected error:', err);
    const msg = err instanceof Error ? err.message : 'Neočekivana greška pri registraciji';
    return jsonResponse({ error: msg }, 500);
  }
});
