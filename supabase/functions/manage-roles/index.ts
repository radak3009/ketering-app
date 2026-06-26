// manage-roles edge function: admin-only CRUD for roles and role_permissions.
import { createAdminClient, getCallerUser, assertNotDemo } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Action =
  | { op: "list" }
  | { op: "create_role"; key: string; name: string; description?: string; panel: "admin" | "employee"; copy_from_role_id?: string }
  | { op: "update_role"; role_id: string; name?: string; description?: string; panel?: "admin" | "employee" }
  | { op: "delete_role"; role_id: string }
  | { op: "set_permissions"; role_id: string; permissions: Array<{ key: string; allowed: boolean }> };

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const admin = createAdminClient();
    const { user, error } = await getCallerUser(req, admin);
    if (!user) return json({ error: error ?? "Unauthorized" }, 401);

    const { data: isAdmin } = await admin.rpc("is_admin_user", { user_uuid: user.id });
    if (!isAdmin) return json({ error: "Samo administratori." }, 403);

    const body = (await req.json()) as Action;

    // All write ops are blocked for demo users.
    if (body.op !== "list") {
      const demoBlock = await assertNotDemo(admin, user.id, corsHeaders);
      if (demoBlock) return demoBlock;
    }

    switch (body.op) {
      case "list": {
        const [{ data: roles }, { data: permissions }, { data: rolePerms }] = await Promise.all([
          admin.from("roles").select("*").order("name"),
          admin.from("permissions").select("*").order("group_key").order("sort_order"),
          admin.from("role_permissions").select("role_id, permission_key, allowed"),
        ]);
        return json({ roles, permissions, role_permissions: rolePerms });
      }

      case "create_role": {
        if (!body.key || !body.name || !body.panel) return json({ error: "key, name, panel su obavezni" }, 400);
        const { data: role, error: insErr } = await admin
          .from("roles")
          .insert({ key: body.key, name: body.name, description: body.description ?? null, panel: body.panel, is_system: false })
          .select()
          .single();
        if (insErr) return json({ error: insErr.message }, 400);

        // Seed: copy from existing role, else all-false rows for every permission.
        const { data: perms } = await admin.from("permissions").select("key");
        const allKeys = (perms ?? []).map((p: any) => p.key as string);
        let rows: Array<{ role_id: string; permission_key: string; allowed: boolean }> = [];
        if (body.copy_from_role_id) {
          const { data: src } = await admin
            .from("role_permissions")
            .select("permission_key, allowed")
            .eq("role_id", body.copy_from_role_id);
          const srcMap = new Map((src ?? []).map((r: any) => [r.permission_key, r.allowed]));
          rows = allKeys.map((k) => ({ role_id: role.id, permission_key: k, allowed: !!srcMap.get(k) }));
        } else {
          rows = allKeys.map((k) => ({ role_id: role.id, permission_key: k, allowed: false }));
        }
        if (rows.length) await admin.from("role_permissions").insert(rows);
        return json({ role });
      }

      case "update_role": {
        const updates: Record<string, unknown> = {};
        if (body.name !== undefined) updates.name = body.name;
        if (body.description !== undefined) updates.description = body.description;
        if (body.panel !== undefined) updates.panel = body.panel;
        const { data, error: upErr } = await admin
          .from("roles")
          .update(updates)
          .eq("id", body.role_id)
          .select()
          .single();
        if (upErr) return json({ error: upErr.message }, 400);
        return json({ role: data });
      }

      case "delete_role": {
        const { data: role } = await admin.from("roles").select("is_system").eq("id", body.role_id).single();
        if (role?.is_system) return json({ error: "Sistemska uloga se ne može obrisati." }, 400);
        const { count } = await admin
          .from("user_roles")
          .select("user_id", { count: "exact", head: true })
          .eq("role_id", body.role_id);
        if ((count ?? 0) > 0) return json({ error: "Uloga je dodeljena korisnicima — prvo prebacite korisnike." }, 400);
        const { error: delErr } = await admin.from("roles").delete().eq("id", body.role_id);
        if (delErr) return json({ error: delErr.message }, 400);
        return json({ success: true });
      }

      case "set_permissions": {
        if (!Array.isArray(body.permissions)) return json({ error: "permissions mora biti niz" }, 400);
        const rows = body.permissions.map((p) => ({
          role_id: body.role_id,
          permission_key: p.key,
          allowed: !!p.allowed,
        }));
        const { error: upErr } = await admin
          .from("role_permissions")
          .upsert(rows, { onConflict: "role_id,permission_key" });
        if (upErr) return json({ error: upErr.message }, 400);
        return json({ success: true });
      }

      default:
        return json({ error: "Unknown op" }, 400);
    }
  } catch (e) {
    console.error("manage-roles error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
