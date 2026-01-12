import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface LoginRequest {
  identifier: string;
  password: string;
}

// Rate limiting configuration
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_ATTEMPTS_PER_WINDOW = 5;

// In-memory rate limit store (resets on function cold start)
const rateLimitStore = new Map<string, { attempts: number; windowStart: number }>();

function getClientIP(req: Request): string {
  // Try various headers that might contain the real IP
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  
  const realIP = req.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }
  
  const cfConnectingIP = req.headers.get('cf-connecting-ip');
  if (cfConnectingIP) {
    return cfConnectingIP;
  }
  
  // Fallback - use a hash of user-agent + some headers as identifier
  const userAgent = req.headers.get('user-agent') || 'unknown';
  return `ua-${userAgent.substring(0, 50)}`;
}

function checkRateLimit(clientIP: string): { allowed: boolean; remainingAttempts: number; resetInSeconds: number } {
  const now = Date.now();
  const record = rateLimitStore.get(clientIP);
  
  // Clean up old entries periodically
  if (rateLimitStore.size > 10000) {
    const cutoff = now - RATE_LIMIT_WINDOW_MS;
    for (const [ip, data] of rateLimitStore.entries()) {
      if (data.windowStart < cutoff) {
        rateLimitStore.delete(ip);
      }
    }
  }
  
  if (!record) {
    // First attempt from this IP
    rateLimitStore.set(clientIP, { attempts: 1, windowStart: now });
    return { allowed: true, remainingAttempts: MAX_ATTEMPTS_PER_WINDOW - 1, resetInSeconds: 60 };
  }
  
  const windowAge = now - record.windowStart;
  
  if (windowAge > RATE_LIMIT_WINDOW_MS) {
    // Window expired, reset
    rateLimitStore.set(clientIP, { attempts: 1, windowStart: now });
    return { allowed: true, remainingAttempts: MAX_ATTEMPTS_PER_WINDOW - 1, resetInSeconds: 60 };
  }
  
  if (record.attempts >= MAX_ATTEMPTS_PER_WINDOW) {
    // Rate limit exceeded
    const resetInSeconds = Math.ceil((RATE_LIMIT_WINDOW_MS - windowAge) / 1000);
    return { allowed: false, remainingAttempts: 0, resetInSeconds };
  }
  
  // Increment attempts
  record.attempts++;
  rateLimitStore.set(clientIP, record);
  
  const resetInSeconds = Math.ceil((RATE_LIMIT_WINDOW_MS - windowAge) / 1000);
  return { 
    allowed: true, 
    remainingAttempts: MAX_ATTEMPTS_PER_WINDOW - record.attempts, 
    resetInSeconds 
  };
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const clientIP = getClientIP(req);
  
  // Check rate limit
  const rateLimit = checkRateLimit(clientIP);
  
  if (!rateLimit.allowed) {
    console.log('[login-with-id] Rate limit exceeded for IP:', clientIP);
    return new Response(
      JSON.stringify({ 
        error: `Previše pokušaja prijave. Pokušajte ponovo za ${rateLimit.resetInSeconds} sekundi.`,
        retryAfter: rateLimit.resetInSeconds
      }),
      { 
        status: 429, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'Retry-After': rateLimit.resetInSeconds.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': rateLimit.resetInSeconds.toString()
        } 
      }
    );
  }

  try {
    const { identifier, password }: LoginRequest = await req.json();

    // Validate input
    if (!identifier || !password) {
      console.log('[login-with-id] Missing identifier or password');
      return new Response(
        JSON.stringify({ error: 'Identifier and password are required' }),
        { 
          status: 400, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'X-RateLimit-Remaining': rateLimit.remainingAttempts.toString()
          } 
        }
      );
    }

    console.log('[login-with-id] Login attempt with identifier:', identifier, 'from IP:', clientIP);

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
        { 
          status: 404, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'X-RateLimit-Remaining': rateLimit.remainingAttempts.toString()
          } 
        }
      );
    }

    if (!profile.email) {
      console.log('[login-with-id] User found but has no email:', identifier);
      return new Response(
        JSON.stringify({ error: 'Korisnik nema podešenu email adresu' }),
        { 
          status: 400, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'X-RateLimit-Remaining': rateLimit.remainingAttempts.toString()
          } 
        }
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
          { 
            status: 401, 
            headers: { 
              ...corsHeaders, 
              'Content-Type': 'application/json',
              'X-RateLimit-Remaining': rateLimit.remainingAttempts.toString()
            } 
          }
        );
      }
      
      if (signInError.message.includes('Email not confirmed')) {
        return new Response(
          JSON.stringify({ error: 'Email adresa nije potvrđena' }),
          { 
            status: 401, 
            headers: { 
              ...corsHeaders, 
              'Content-Type': 'application/json',
              'X-RateLimit-Remaining': rateLimit.remainingAttempts.toString()
            } 
          }
        );
      }

      return new Response(
        JSON.stringify({ error: signInError.message }),
        { 
          status: 401, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'X-RateLimit-Remaining': rateLimit.remainingAttempts.toString()
          } 
        }
      );
    }

    console.log('[login-with-id] Sign in successful for user:', profile.full_name);

    // Return the session data
    return new Response(
      JSON.stringify({
        session: authData.session,
        user: authData.user
      }),
      { 
        status: 200, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'X-RateLimit-Remaining': rateLimit.remainingAttempts.toString()
        } 
      }
    );

  } catch (error) {
    console.error('[login-with-id] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Došlo je do greške pri prijavi' }),
      { 
        status: 500, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
  }
});
