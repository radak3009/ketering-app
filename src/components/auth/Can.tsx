import { ReactNode } from "react";
import { usePermissions, PermissionKey } from "@/hooks/usePermissions";

interface CanProps {
  permission?: PermissionKey;
  anyOf?: PermissionKey[];
  fallback?: ReactNode;
  children: ReactNode;
}

/**
 * Renders children only when the current user has the required permission(s).
 * UI-level gating. Server-side enforcement comes in Faza 2.
 */
export function Can({ permission, anyOf, fallback = null, children }: CanProps) {
  const { has, hasAny } = usePermissions();
  const allowed = permission ? has(permission) : anyOf ? hasAny(...anyOf) : true;
  return <>{allowed ? children : fallback}</>;
}
