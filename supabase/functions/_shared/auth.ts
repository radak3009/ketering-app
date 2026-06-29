// Shared auth helpers for edge functions (Faza 2 RBAC).
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { createLocalJWKSet, jwtVerify, type JWTPayload } from "https://esm.sh/jose@5.9.6";

export function createAdminClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

// Build a local JWKS resolver once per cold start from SUPABASE_JWKS env.
// This is required so we can VERIFY the JWT signature in functions where
// verify_jwt=false (kiosk/system entrypoints koje sami u kodu razdvajaju
// sistemski vs korisnički zahtev). Bez ovoga bi se mogao podmetnuti forge JWT.
let jwksResolver: ReturnType<typeof createLocalJWKSet> | null = null;
function getJwks() {
  if (jwksResolver) return jwksResolver;
  const raw = Deno.env.get("SUPABASE_JWKS");
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    const jwks = parsed?.keys ? parsed : { keys: Array.isArray(parsed) ? parsed : [parsed] };
    jwksResolver = createLocalJWKSet(jwks);
    return jwksResolver;
  } catch (e) {
    console.error("[auth] SUPABASE_JWKS parse error:", (e as Error).message);
    return null;
  }
}

async function verifyJwtSignature(token: string): Promise<JWTPayload | null> {
  const jwks = getJwks();
  if (!jwks) return null;
  try {
    const { payload } = await jwtVerify(token, jwks, { algorithms: ["ES256", "RS256", "EdDSA"] });
    return payload;
  } catch (e) {
    console.warn("[auth] jwtVerify failed:", (e as Error).message);
    return null;
  }
}

export async function getCallerUser(req: Request, admin?: SupabaseClient) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { user: null, token: null, error: "Missing authorization header" };
  }
  const token = authHeader.slice("Bearer ".length);

  // 1) Primarni put: lokalna verifikacija potpisa preko SUPABASE_JWKS (asimetricni signing keys).
  const verified = await verifyJwtSignature(token);
  if (verified && typeof verified.sub === "string") {
    const email = typeof verified.email === "string" ? verified.email : null;
    return { user: { id: verified.sub, email } as { id: string; email: string | null }, token, error: null };
  }

  // 2) Fallback: GoTrue (npr. legacy HS256 tokeni ili kada JWKS nije dostupan).
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
