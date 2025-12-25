import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

    // Verify the caller is authenticated and is an admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user: caller }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !caller) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if caller is admin
    const { data: isAdmin, error: adminCheckError } = await supabaseAdmin.rpc('is_admin_user', {
      user_uuid: caller.id
    });

    if (adminCheckError || !isAdmin) {
      console.error('Admin check error:', adminCheckError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized - admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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

    // 1. Update email in auth.users
    const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { 
        email: newEmail,
        email_confirm: true // Automatically confirm the new email
      }
    );

    if (authUpdateError) {
      console.error('Auth update error:', authUpdateError);
      return new Response(
        JSON.stringify({ error: `Failed to update auth email: ${authUpdateError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Auth email updated successfully');

    // 2. Update email in profiles table
    const { error: profileUpdateError } = await supabaseAdmin
      .from('profiles')
      .update({ email: newEmail })
      .eq('user_id', userId);

    if (profileUpdateError) {
      console.error('Profile update error:', profileUpdateError);
      // Try to rollback auth email change
      return new Response(
        JSON.stringify({ error: `Failed to update profile email: ${profileUpdateError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Profile email updated successfully');

    return new Response(
      JSON.stringify({ success: true, message: 'Email updated successfully' }),
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
