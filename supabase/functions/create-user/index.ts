import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateUserRequest {
  email: string;
  full_name?: string;
  phone?: string;
  company_card_id?: string;
  date_of_birth?: string;
  role: 'admin' | 'employee';
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Create admin client
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Verify the caller is an admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Nije pronađen autorizacioni header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user: callerUser }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !callerUser) {
      throw new Error('Neautorizovan pristup');
    }

    // Check if caller is admin using user_roles table
    const { data: callerRole } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', callerUser.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (!callerRole) {
      throw new Error('Samo administratori mogu kreirati korisnike');
    }

    const body: CreateUserRequest = await req.json();
    const { email, full_name, phone, company_card_id, date_of_birth, role } = body;

    if (!email) {
      throw new Error('Email je obavezan');
    }

    console.log('Creating user with data:', { email, full_name, phone, company_card_id, date_of_birth, role });

    // Check if email already exists
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (existingProfile) {
      throw new Error('Korisnik sa ovom email adresom već postoji');
    }

    // Create user in auth.users with invite
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: {
        full_name: full_name || '',
        role: role || 'employee',
      },
      redirectTo: `${req.headers.get('origin') || supabaseUrl}/`,
    });

    if (createError) {
      console.error('Error creating user:', createError);
      throw new Error(createError.message);
    }

    if (!newUser?.user) {
      throw new Error('Greška pri kreiranju korisnika');
    }

    const userId = newUser.user.id;
    console.log('User created in auth.users:', userId);

    // Wait a moment for the trigger to create the profile
    await new Promise(resolve => setTimeout(resolve, 500));

    // Update profile with additional data
    const profileUpdates: Record<string, any> = {};
    if (full_name) profileUpdates.full_name = full_name;
    if (phone) profileUpdates.phone = phone;
    if (company_card_id) profileUpdates.company_card_id = company_card_id;
    if (date_of_birth) profileUpdates.date_of_birth = date_of_birth;
    profileUpdates.role = role || 'employee';

    if (Object.keys(profileUpdates).length > 0) {
      const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .update(profileUpdates)
        .eq('user_id', userId);

      if (updateError) {
        console.error('Error updating profile:', updateError);
        // Don't throw, profile was created, just log the error
      } else {
        console.log('Profile updated successfully');
      }
    }

    // Insert or update role in user_roles table
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .upsert({
        user_id: userId,
        role: role || 'employee',
      }, {
        onConflict: 'user_id',
      });

    if (roleError) {
      console.error('Error setting user role:', roleError);
      // Don't throw, try to continue
    } else {
      console.log('User role set successfully:', role);
    }

    // Fetch the created profile to return
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    console.log('User creation completed successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        user: newUser.user,
        profile: profile 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error: unknown) {
    console.error('Error in create-user function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Došlo je do greške pri kreiranju korisnika';
    return new Response(
      JSON.stringify({ 
        error: errorMessage 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    );
  }
});
