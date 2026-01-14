import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Resend } from 'npm:resend@4.0.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateUserRequest {
  email: string;
  full_name?: string;
  phone?: string;
  company_card_id?: string;
  tag?: string;
  date_of_birth?: string;
  role: 'admin' | 'employee';
  password?: string; // Optional: if provided, creates user with password instead of invite
}

// Function to send welcome email with credentials
async function sendWelcomeEmailWithCredentials(
  resend: Resend,
  toEmail: string,
  password: string,
  fullName?: string,
  appUrl?: string
): Promise<void> {
  const displayName = fullName || 'korisniče';
  const loginUrl = appUrl || 'https://ketering-app.lovable.app';
  
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Dobrodošli u Ketering</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="min-width: 100%; background-color: #f4f4f5;">
        <tr>
          <td align="center" style="padding: 40px 20px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
              <!-- Header -->
              <tr>
                <td style="padding: 40px 40px 20px 40px; text-align: center; border-bottom: 1px solid #e4e4e7;">
                  <h1 style="margin: 0; color: #18181b; font-size: 28px; font-weight: 700;">🍽️ Ketering</h1>
                </td>
              </tr>
              
              <!-- Content -->
              <tr>
                <td style="padding: 40px;">
                  <h2 style="margin: 0 0 20px 0; color: #18181b; font-size: 22px; font-weight: 600;">
                    Dobrodošli, ${displayName}!
                  </h2>
                  
                  <p style="margin: 0 0 24px 0; color: #3f3f46; font-size: 16px; line-height: 1.6;">
                    Vaš nalog u aplikaciji Ketering je uspešno kreiran. Ispod se nalaze vaši pristupni podaci za prijavu:
                  </p>
                  
                  <!-- Credentials Box -->
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f4f4f5; border-radius: 8px; margin-bottom: 24px;">
                    <tr>
                      <td style="padding: 24px;">
                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                          <tr>
                            <td style="padding: 8px 0;">
                              <span style="color: #71717a; font-size: 14px;">Email adresa:</span>
                            </td>
                          </tr>
                          <tr>
                            <td style="padding: 0 0 16px 0;">
                              <strong style="color: #18181b; font-size: 16px;">${toEmail}</strong>
                            </td>
                          </tr>
                          <tr>
                            <td style="padding: 8px 0;">
                              <span style="color: #71717a; font-size: 14px;">Lozinka:</span>
                            </td>
                          </tr>
                          <tr>
                            <td>
                              <strong style="color: #18181b; font-size: 16px; font-family: monospace; background-color: #ffffff; padding: 8px 12px; border-radius: 4px; display: inline-block;">${password}</strong>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                  
                  <!-- CTA Button -->
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
                    <tr>
                      <td align="center">
                        <a href="${loginUrl}" style="display: inline-block; background-color: #f97316; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; padding: 14px 32px; border-radius: 8px;">
                          Prijavite se na aplikaciju
                        </a>
                      </td>
                    </tr>
                  </table>
                  
                  <p style="margin: 0; color: #71717a; font-size: 14px; line-height: 1.6;">
                    💡 <em>Lozinku možete promeniti u podešavanjima profila nakon prijave.</em>
                  </p>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="padding: 24px 40px; background-color: #f4f4f5; border-radius: 0 0 12px 12px;">
                  <p style="margin: 0; color: #71717a; font-size: 12px; text-align: center;">
                    Ovaj email je automatski generisan. Molimo vas da ne odgovarate na njega.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  await resend.emails.send({
    from: 'Ketering <noreply@simpler.rs>',
    to: [toEmail],
    subject: 'Dobrodošli u Ketering - Vaši pristupni podaci',
    html: htmlContent,
  });
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
    const { email, full_name, phone, company_card_id, date_of_birth, role, password } = body;

    if (!email) {
      throw new Error('Email je obavezan');
    }

    console.log('Creating user with data:', { email, full_name, phone, company_card_id, date_of_birth, role, hasPassword: !!password });

    // Check if email already exists
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (existingProfile) {
      throw new Error('Korisnik sa ovom email adresom već postoji');
    }

    let newUser;
    let createError;

    // If password is provided, create user with password (they can login immediately)
    // Otherwise, send an invite email
    if (password) {
      // Validate password length
      if (password.length < 6) {
        throw new Error('Lozinka mora imati najmanje 6 karaktera');
      }

      const result = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true, // Auto-confirm email so user can login immediately
        user_metadata: {
          full_name: full_name || '',
          role: role || 'employee',
        },
      });
      newUser = result.data;
      createError = result.error;

      // Send custom welcome email with credentials using Resend
      if (!createError && newUser?.user) {
        const resendApiKey = Deno.env.get('RESEND_API_KEY');
        if (resendApiKey) {
          try {
            const resend = new Resend(resendApiKey);
            const appUrl = req.headers.get('origin') || 'https://ketering-app.lovable.app';
            await sendWelcomeEmailWithCredentials(resend, email, password, full_name, appUrl);
            console.log('Welcome email with credentials sent successfully to:', email);
          } catch (emailError) {
            console.error('Failed to send welcome email:', emailError);
            // Don't throw - user was created successfully, email is secondary
          }
        } else {
          console.warn('RESEND_API_KEY not configured, skipping welcome email');
        }
      }
    } else {
      // Send invite email (original behavior)
      const result = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        data: {
          full_name: full_name || '',
          role: role || 'employee',
        },
        redirectTo: `${req.headers.get('origin') || supabaseUrl}/`,
      });
      newUser = result.data;
      createError = result.error;
    }

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
    // Set password_set based on whether password was provided
    // If password provided = user can login immediately = password_set = true
    // If invite email = user needs to set password = password_set = false
    profileUpdates.password_set = !!password;

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

    // Delete existing role if any, then insert new role
    await supabaseAdmin
      .from('user_roles')
      .delete()
      .eq('user_id', userId);

    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .insert({
        user_id: userId,
        role: role || 'employee',
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
