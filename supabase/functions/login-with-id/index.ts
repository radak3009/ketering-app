import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface LoginRequest {
  identifier: string;
  password: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { identifier, password }: LoginRequest = await req.json();

    // Validate input
    if (!identifier || !password) {
      console.log('[login-with-id] Missing identifier or password');
      return new Response(
        JSON.stringify({ error: 'Identifier and password are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[login-with-id] Login attempt with identifier:', identifier);

    // Create Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Look up user by company_card_id
    const { data: profile, error: lookupError } = await supabaseAdmin
      .from('profiles')
      .select('email, user_id, full_name')
      .eq('company_card_id', identifier)
      .single();

    if (lookupError || !profile) {
      console.log('[login-with-id] User not found for identifier:', identifier, lookupError?.message);
      return new Response(
        JSON.stringify({ error: 'Korisnik sa ovim ID-om nije pronađen' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!profile.email) {
      console.log('[login-with-id] User found but has no email:', identifier);
      return new Response(
        JSON.stringify({ error: 'Korisnik nema podešenu email adresu' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[login-with-id] Found user:', profile.full_name, 'with email:', profile.email);

    // Sign in with the found email and provided password
    const { data: authData, error: signInError } = await supabaseAdmin.auth.signInWithPassword({
      email: profile.email,
      password: password
    });

    if (signInError) {
      console.log('[login-with-id] Sign in failed:', signInError.message);
      
      // Return generic error to prevent user enumeration
      if (signInError.message.includes('Invalid login credentials')) {
        return new Response(
          JSON.stringify({ error: 'Neispravna lozinka' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (signInError.message.includes('Email not confirmed')) {
        return new Response(
          JSON.stringify({ error: 'Email adresa nije potvrđena' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ error: signInError.message }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[login-with-id] Sign in successful for user:', profile.full_name);

    // Return the session data
    return new Response(
      JSON.stringify({
        session: authData.session,
        user: authData.user
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[login-with-id] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Došlo je do greške pri prijavi' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
