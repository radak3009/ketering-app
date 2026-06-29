import { createAdminClient, getCallerUser, assertNotDemo, assertPermission } from '../_shared/auth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RoleRequest {
  userId: string;
  roleKey?: string;
  role?: 'admin' | 'employee'; // legacy fallback
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createAdminClient();

    // Use shared caller resolution (decodes JWT locally; avoids GoTrue "Auth session missing").
    const { user, error: callerError } = await getCallerUser(req, supabase);
    if (callerError || !user) {
      console.error('manage-user-role: caller resolution failed:', callerError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const permBlock = await assertPermission(supabase, user.id, 'users.assign_role', corsHeaders);
    if (permBlock) return permBlock;
    const demoBlock = await assertNotDemo(supabase, user.id, corsHeaders);
    if (demoBlock) return demoBlock;

    const { userId, roleKey, role: legacyRole }: RoleRequest = await req.json();

    if (!userId || (!roleKey && !legacyRole)) {
      return new Response(
        JSON.stringify({ error: 'userId and roleKey are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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

    // Self-demotion guard: prevent the caller from removing their own last admin role.
    if (userId === user.id && roleRow.panel !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Ne možete sami sebi skinuti administratorsku ulogu.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Caller ${user.id} updating role for ${userId} -> ${roleRow.key} (panel=${roleRow.panel})`);

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

    // Insert only role_id; trg_sync_user_role_enum populates the `role` enum from roles.panel.
    // Eksplicitno NE prosleđujemo `role` da izbegnemo bilo kakav konflikt sa trigerom.
    const { data, error: insertError } = await supabase
      .from('user_roles')
      .insert({ user_id: userId, role_id: roleRow.id })
      .select('id, user_id, role, role_id')
      .single();

    if (insertError) {
      console.error('Error inserting new role:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to assign role', details: insertError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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
