import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export type PermissionKey = string;

interface UsePermissionsResult {
  permissions: Set<PermissionKey>;
  panel: "admin" | "employee";
  isDemo: boolean;
  loading: boolean;
  has: (perm: PermissionKey) => boolean;
  hasAny: (...perms: PermissionKey[]) => boolean;
}

export function usePermissions(): UsePermissionsResult {
  const { user, profile } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["user-permissions", user?.id],
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const [permsRes, panelRes, demoRes] = await Promise.all([
        supabase.rpc("get_user_permissions", { _user: user!.id }),
        supabase.rpc("get_user_panel", { _user: user!.id }),
        supabase.rpc("is_demo_user", { _user: user!.id }),
      ]);
      const permList = ((permsRes.data ?? []) as string[]) || [];
      return {
        permissions: new Set(permList),
        panel: (panelRes.data as "admin" | "employee") ?? (profile?.role === "admin" ? "admin" : "employee"),
        isDemo: !!demoRes.data,
      };
    },
  });

  // Sensible fallback while loading: derive from legacy enum role so UI doesn't flash empty.
  const fallbackPanel: "admin" | "employee" = profile?.role === "admin" ? "admin" : "employee";

  return {
    permissions: data?.permissions ?? new Set<string>(),
    panel: data?.panel ?? fallbackPanel,
    isDemo: data?.isDemo ?? false,
    loading: isLoading,
    has: (perm) => {
      if (data?.permissions) return data.permissions.has(perm);
      // Loading fallback: admin sees all, employee only self.*
      if (fallbackPanel === "admin") return true;
      return perm.startsWith("self.");
    },
    hasAny: (...perms) => perms.some((p) => (data?.permissions?.has(p) ?? (fallbackPanel === "admin"))),
  };
}
