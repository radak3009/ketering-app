import { createClient } from "npm:@supabase/supabase-js@2.58.0";
import { sendEmail } from '../_shared/smtp.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SendInvitationRequest {
  userId: string;
  email: string;
  fullName?: string;
}

// Function to generate a temporary password
function generateTemporaryPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  let password = '';
  for (let i = 0; i < 10; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

// Function to send welcome email with credentials via SMTP
async function sendWelcomeEmailWithCredentials(
  toEmail: string,
  password: string,
  fullName?: string,
  appUrl?: string
): Promise<{ success: boolean; error?: string; messageId?: string }> {
  const displayName = fullName || 'korisniče';
  const loginUrl = appUrl || 'https://ketering-app.lovable.app';
  
  // Minified HTML to avoid quoted-printable encoding issues (=20 characters)
  const htmlContent = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Dobrodošli u Ketering</title></head><body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="min-width: 100%; background-color: #f4f4f5;"><tr><td align="center" style="padding: 40px 20px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);"><tr><td style="padding: 40px 40px 20px 40px; text-align: center; border-bottom: 1px solid #e4e4e7;"><h1 style="margin: 0; color: #18181b; font-size: 28px; font-weight: 700;">🍽️ Ketering</h1></td></tr><tr><td style="padding: 40px;"><h2 style="margin: 0 0 20px 0; color: #18181b; font-size: 22px; font-weight: 600;">Dobrodošli, ${displayName}!</h2><p style="margin: 0 0 24px 0; color: #3f3f46; font-size: 16px; line-height: 1.6;">Vaš nalog u aplikaciji Ketering je uspešno kreiran. Ispod se nalaze vaši pristupni podaci za prijavu:</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f4f4f5; border-radius: 8px; margin-bottom: 24px;"><tr><td style="padding: 24px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td style="padding: 8px 0;"><span style="color: #71717a; font-size: 14px;">Email adresa:</span></td></tr><tr><td style="padding: 0 0 16px 0;"><strong style="color: #18181b; font-size: 16px;">${toEmail}</strong></td></tr><tr><td style="padding: 8px 0;"><span style="color: #71717a; font-size: 14px;">Lozinka:</span></td></tr><tr><td><strong style="color: #18181b; font-size: 16px; font-family: monospace; background-color: #ffffff; padding: 8px 12px; border-radius: 4px; display: inline-block;">${password}</strong></td></tr></table></td></tr></table><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;"><tr><td align="center"><a href="${loginUrl}" style="display: inline-block; background-color: #f97316; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; padding: 14px 32px; border-radius: 8px;">Prijavite se na aplikaciju</a></td></tr></table><p style="margin: 0; color: #71717a; font-size: 14px; line-height: 1.6;">💡 <em>Lozinku možete promeniti u podešavanjima profila nakon prijave.</em></p></td></tr><tr><td style="padding: 24px 40px; background-color: #f4f4f5; border-radius: 0 0 12px 12px;"><p style="margin: 0; color: #71717a; font-size: 12px; text-align: center;">Ovaj email je automatski generisan. Molimo vas da ne odgovarate na njega.</p></td></tr></table></td></tr></table></body></html>`;

  console.log('Attempting to send invitation email to:', toEmail);
  
  const result = await sendEmail({
    to: toEmail,
    subject: 'Dobrodošli u Ketering - Vaši pristupni podaci',
    html: htmlContent,
  });

  return result;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Create admin client for privileged operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Verify the caller is an admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      console.error('Missing or invalid Authorization header');
      throw new Error('Neautorizovan pristup');
    }

    const token = authHeader.slice('Bearer '.length);
    const { data: { user: callerUser }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !callerUser) {
      console.error('JWT validation failed:', userError?.message);
      throw new Error('Neautorizovan pristup');
    }
    
    console.log('User validated:', callerUser.id, callerUser.email);

    // Check if caller is admin using user_roles table
    const { data: callerRole } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', callerUser.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (!callerRole) {
      throw new Error('Samo administratori mogu slati pozivnice');
    }

    const body: SendInvitationRequest = await req.json();
    const { userId, email, fullName } = body;

    if (!userId || !email) {
      throw new Error('User ID i email su obavezni');
    }

    console.log('Sending invitation with credentials to:', { userId, email, fullName });

    // Generate a new temporary password
    const temporaryPassword = generateTemporaryPassword();

    // Update user's password in auth.users
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: temporaryPassword,
      email_confirm: true, // Ensure email is confirmed
    });

    if (updateError) {
      console.error('Error updating user password:', updateError);
      throw new Error('Greška pri resetovanju lozinke: ' + updateError.message);
    }

    console.log('Password updated successfully for user:', userId);

    // Update password_set flag in profiles
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ password_set: true })
      .eq('user_id', userId);

    if (profileError) {
      console.error('Error updating profile:', profileError);
      // Don't throw, this is not critical
    }

    // Send welcome email with credentials
    const appUrl = req.headers.get('origin') || 'https://ketering-app.lovable.app';
    const emailResult = await sendWelcomeEmailWithCredentials(email, temporaryPassword, fullName, appUrl);
    
    if (!emailResult.success) {
      console.error('Failed to send invitation email:', emailResult.error);
      throw new Error('Lozinka je resetovana, ali email nije poslat: ' + emailResult.error);
    }

    console.log('Invitation email sent successfully to:', email, 'MessageId:', emailResult.messageId);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Pozivnica sa novim kredencijalima je poslata na ${email}`
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error: unknown) {
    console.error('Error in send-invitation function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Došlo je do greške pri slanju pozivnice';
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
