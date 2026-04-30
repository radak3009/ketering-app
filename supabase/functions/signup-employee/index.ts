import { createClient } from "npm:@supabase/supabase-js@2.58.0";

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

// Rate limiting (per-instance, resets on cold start)
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

    // Validate
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

    // Pre-flight uniqueness checks (DB constraints will also catch this on race)
    const { data: emailExists } = await supabaseAdmin.rpc('email_exists', { check_email: email });
    if (emailExists) {
      return jsonResponse({ error: 'Korisnik sa ovom email adresom već postoji', code: 'email_taken' }, 409);
    }

    const { data: idExists } = await supabaseAdmin.rpc('company_card_id_exists', { check_id: company_card_id });
    if (idExists) {
      return jsonResponse({ error: 'ID zaposlenog je već dodeljen drugom korisniku', code: 'id_taken' }, 409);
    }

    // Create auth user with email confirmation required
    const userMetadata: Record<string, string> = {
      full_name,
      role: 'employee',
      company_card_id,
    };
    if (tag) userMetadata.tag = tag;
    if (date_of_birth) userMetadata.date_of_birth = date_of_birth;

    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: false, // require confirmation
      user_metadata: userMetadata,
    });

    if (createErr) {
      console.error('[signup-employee] createUser error:', createErr.message);
      // Map common errors
      if (createErr.message.toLowerCase().includes('already')) {
        return jsonResponse({ error: 'Korisnik sa ovom email adresom već postoji', code: 'email_taken' }, 409);
      }
      // 23505 = unique_violation from trigger insert
      if ((createErr as any).code === '23505' || createErr.message.includes('23505')) {
        return jsonResponse({ error: 'ID zaposlenog ili email su već dodeljeni', code: 'duplicate' }, 409);
      }
      return jsonResponse({ error: createErr.message }, 400);
    }

    if (!created?.user) {
      return jsonResponse({ error: 'Neuspešno kreiranje naloga' }, 500);
    }

    // Send confirmation email via Supabase generateLink + standard auth email template
    // (admin.createUser with email_confirm: false sends confirmation email automatically when SMTP is configured)
    // Ensure user_roles row exists
    await supabaseAdmin.from('user_roles').delete().eq('user_id', created.user.id);
    await supabaseAdmin.from('user_roles').insert({ user_id: created.user.id, role: 'employee' });

    return jsonResponse({
      success: true,
      requiresEmailConfirmation: true,
      message: 'Nalog je kreiran. Proverite email da potvrdite registraciju.',
    });
  } catch (err: unknown) {
    console.error('[signup-employee] Unexpected error:', err);
    const msg = err instanceof Error ? err.message : 'Neočekivana greška pri registraciji';
    return jsonResponse({ error: msg }, 500);
  }
});
