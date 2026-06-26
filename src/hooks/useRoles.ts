import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface RoleRow {
  id: string;
  key: string;
  name: string;
  description: string | null;
  is_system: boolean;
  is_demo: boolean;
  panel: "admin" | "employee";
}

export function useRoles() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["roles-catalog"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("roles" as any)
        .select("id, key, name, description, is_system, is_demo, panel")
        .order("is_system", { ascending: false })
        .order("name", { ascending: true });
      if (error) throw error;
      return (data as any as RoleRow[]) ?? [];
    },
  });

  return { roles: data ?? [], loading: isLoading, error, refetch };
}
