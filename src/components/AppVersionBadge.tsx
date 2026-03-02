import { Info } from "lucide-react";

const APP_VERSION = __APP_VERSION__;
const BUILD_DATE = __APP_BUILD_DATE__;

export function AppVersionBadge() {
  return (
    <div className="flex items-center justify-center gap-1.5 py-3 text-xs text-muted-foreground/60">
      <Info className="h-3 w-3" />
      <span>v{APP_VERSION} · {BUILD_DATE}</span>
    </div>
  );
}
