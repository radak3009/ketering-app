// Shared auth helpers for edge functions (Faza 2 RBAC).
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
 * FAIL-CLOSED: ako is_demo_user RPC pukne ILI je korisnik demo, blokiraj.
 * Sloj odbrane uz RLS — koristi se za destruktivne i "slanje" akcije.
 */
export async function assertNotDemo(
  admin: SupabaseClient,
  userId: string,
  corsHeaders: Record<string, string>,
): Promise<Response | null> {
  const { data, error } = await admin.rpc("is_demo_user", { _user: userId });
  if (error) {
    console.error("[assertNotDemo] is_demo_user rpc error (FAIL-CLOSED):", error.message);
    return new Response(
      JSON.stringify({ error: "Demo provera nije uspela, akcija blokirana." }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
  if (data === true) {
    return new Response(
      JSON.stringify({ error: "Demo nalogu nije dozvoljena ova akcija." }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
  return null;
}

/**
 * FAIL-CLOSED: ako has_permission RPC pukne ILI vrati false, blokiraj sa 403.
 * Zamena za generičku is_admin_user proveru — granularno po permission_key.
 */
export async function assertPermission(
  admin: SupabaseClient,
  userId: string,
  permission: string,
  corsHeaders: Record<string, string>,
): Promise<Response | null> {
  const { data, error } = await admin.rpc("has_permission", {
    _user: userId,
    _perm: permission,
  });
  if (error) {
    console.error(
      `[assertPermission] has_permission(${permission}) rpc error (FAIL-CLOSED):`,
      error.message,
    );
    return new Response(
      JSON.stringify({ error: "Provera dozvole nije uspela." }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
  if (data !== true) {
    return new Response(
      JSON.stringify({ error: `Nemate dozvolu: ${permission}` }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
  return null;
}
