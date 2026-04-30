import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

  try {
    const url = new URL(req.url);
    let token = url.searchParams.get('token');
    if (!token && req.method === 'POST') {
      try {
        const body = await req.json();
        token = body?.token;
      } catch (_) { /* ignore */ }
    }

    if (!token || typeof token !== 'string' || token.length < 16) {
      return jsonResponse({ error: 'Nevažeći verifikacioni token', code: 'invalid_token' }, 400);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Lookup token
    const { data: row, error: selErr } = await admin
      .from('email_verification_tokens')
      .select('id, user_id, email, expires_at, consumed_at')
      .eq('token', token)
      .maybeSingle();

    if (selErr) {
      console.error('[confirm-email] Select error:', selErr.message);
      return jsonResponse({ error: 'Greška pri proveri tokena' }, 500);
    }
    if (!row) {
      return jsonResponse({ error: 'Token ne postoji ili je nevažeći', code: 'not_found' }, 404);
    }
    if (row.consumed_at) {
      // Idempotent success: token already used
      return jsonResponse({ success: true, alreadyConfirmed: true, email: row.email });
    }
    if (new Date(row.expires_at).getTime() < Date.now()) {
      return jsonResponse({ error: 'Token je istekao. Kontaktirajte administratora.', code: 'expired' }, 410);
    }

    // Confirm email on auth.users
    const { error: updErr } = await admin.auth.admin.updateUserById(row.user_id, {
      email_confirm: true,
    });
    if (updErr) {
      console.error('[confirm-email] updateUser error:', updErr.message);
      return jsonResponse({ error: 'Greška pri potvrdi email adrese' }, 500);
    }

    // Mark token consumed
    await admin
      .from('email_verification_tokens')
      .update({ consumed_at: new Date().toISOString() })
      .eq('id', row.id);

    console.log('[confirm-email] Email confirmed for user:', row.user_id);

    return jsonResponse({ success: true, email: row.email });
  } catch (err: unknown) {
    console.error('[confirm-email] Unexpected error:', err);
    const msg = err instanceof Error ? err.message : 'Neočekivana greška';
    return jsonResponse({ error: msg }, 500);
  }
});
