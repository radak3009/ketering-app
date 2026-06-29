import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { assertNotDemo, assertPermission, getCallerUser } from '../_shared/auth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface UpdateEmailRequest {
  userId: string;
  newEmail: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create admin client with service role key
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Verify the caller is authenticated (lokalni JWT decode preko shared helpera).
    const { user: caller, error: authError } = await getCallerUser(req, supabaseAdmin);
    if (authError || !caller) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const permBlock = await assertPermission(supabaseAdmin, caller.id, 'users.update', corsHeaders);
    if (permBlock) return permBlock;
    const demoBlock = await assertNotDemo(supabaseAdmin, caller.id, corsHeaders);
    if (demoBlock) return demoBlock;

    // Parse request body
    const { userId, newEmail }: UpdateEmailRequest = await req.json();

    if (!userId || !newEmail) {
      return new Response(
        JSON.stringify({ error: 'Missing userId or newEmail' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Updating email for user ${userId} to ${newEmail}`);

    // Check if email already exists
    const { data: emailExists, error: emailCheckError } = await supabaseAdmin.rpc('email_exists', {
      check_email: newEmail
    });

    if (emailCheckError) {
      console.error('Email check error:', emailCheckError);
      return new Response(
        JSON.stringify({ error: 'Failed to check email availability' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (emailExists) {
      return new Response(
        JSON.stringify({ error: 'Email adresa već postoji u sistemu' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get current user email to use as redirect context
    const { data: currentUser, error: getUserError } = await supabaseAdmin.auth.admin.getUserById(userId);
    
    if (getUserError || !currentUser?.user) {
      console.error('Get user error:', getUserError);
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const oldEmail = currentUser.user.email;
    console.log(`Initiating email change from ${oldEmail} to ${newEmail} for user ${userId}`);

    // Update email in auth.users with email_confirm: false
    // This will trigger Supabase to send a confirmation email to the NEW address
    const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { 
        email: newEmail,
        email_confirm: false // Require email confirmation - sends verification email
      }
    );

    if (authUpdateError) {
      console.error('Auth update error:', authUpdateError);
      return new Response(
        JSON.stringify({ error: `Failed to initiate email change: ${authUpdateError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Email verification sent to new address');

    // Note: We do NOT update profiles table yet - this will be done after user confirms
    // The profiles.email will be synced when user confirms via the email link
    // For now, store pending email in user metadata for reference
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        requiresConfirmation: true,
        message: 'Email za potvrdu je poslat na novu adresu. Korisnik mora da potvrdi promenu klikom na link u emailu.' 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unexpected error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
