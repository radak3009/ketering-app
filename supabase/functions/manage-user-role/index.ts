import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
import { assertNotDemo, assertPermission } from '../_shared/auth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RoleRequest {
  userId: string;
  roleKey?: string;
  // Legacy fallback (admin/employee enum); still accepted for backward-compat.
  role?: 'admin' | 'employee';
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase client with service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('No authorization header provided');
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the caller is an admin
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      console.error('Failed to get user:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Granular: only roles with users.assign_role can mutate user_roles (HR no longer has it).
    const permBlock = await assertPermission(supabase, user.id, 'users.assign_role', corsHeaders);
    if (permBlock) return permBlock;
    const demoBlock = await assertNotDemo(supabase, user.id, corsHeaders);
    if (demoBlock) return demoBlock;

    // Parse request body
    const { userId, roleKey, role: legacyRole }: RoleRequest = await req.json();

    if (!userId || (!roleKey && !legacyRole)) {
      return new Response(
        JSON.stringify({ error: 'userId and roleKey are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Resolve role: prefer roleKey, fallback to legacy enum mapping.
    let resolvedKey = roleKey;
    if (!resolvedKey && legacyRole) {
      resolvedKey = legacyRole === 'admin' ? 'administrator' : 'zaposleni';
    }

    const { data: roleRow, error: roleLookupError } = await supabase
      .from('roles')
      .select('id, key, name, panel')
      .eq('key', resolvedKey!)
      .maybeSingle();

    if (roleLookupError || !roleRow) {
      return new Response(
        JSON.stringify({ error: `Uloga "${resolvedKey}" ne postoji` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Admin ${user.email} is updating role for user ${userId} -> ${roleRow.key} (panel=${roleRow.panel})`);

    // Delete existing roles for this user
    const { error: deleteError } = await supabase
      .from('user_roles')
      .delete()
      .eq('user_id', userId);

    if (deleteError) {
      console.error('Error deleting old role:', deleteError);
      return new Response(
        JSON.stringify({ error: 'Failed to update role', details: deleteError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Insert new role. Provide enum `role` as fallback (trigger also syncs it from role_id).
    const enumRole = roleRow.panel === 'admin' ? 'admin' : 'employee';
    const { data, error: insertError } = await supabase
      .from('user_roles')
      .insert({ user_id: userId, role_id: roleRow.id, role: enumRole })
      .select('id, user_id, role, role_id')
      .single();

    if (insertError) {
      console.error('Error inserting new role:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to assign role', details: insertError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Successfully updated role for user ${userId} to ${roleRow.key}`);

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          ...data,
          role_key: roleRow.key,
          role_name: roleRow.name,
          panel: roleRow.panel,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
