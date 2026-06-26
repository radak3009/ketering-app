// Shared auth helpers for edge functions.
// IMPORTANT: assertNotDemo blocks destructive/sending actions for demo users.
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

export function createAdminClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export async function getCallerUser(req: Request, admin?: SupabaseClient) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { user: null, token: null, error: "Missing authorization header" };
  }
  const token = authHeader.slice("Bearer ".length);
  const client = admin ?? createAdminClient();
  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user) return { user: null, token, error: "Invalid token" };
  return { user: data.user, token, error: null };
}

/**
 * Throws JSON 403 Response if caller is a demo user.
 * Use in any edge function that performs destructive or outbound (email/notification) actions.
 */
export async function assertNotDemo(
  admin: SupabaseClient,
  userId: string,
  corsHeaders: Record<string, string>,
): Promise<Response | null> {
  const { data, error } = await admin.rpc("is_demo_user", { _user: userId });
  if (error) {
    // Fail-open with log: do not block on transient errors, but log loudly.
    console.warn("[assertNotDemo] is_demo_user rpc error:", error.message);
    return null;
  }
  if (data === true) {
    return new Response(
      JSON.stringify({ error: "Demo nalogu nije dozvoljena ova akcija." }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
  return null;
}
