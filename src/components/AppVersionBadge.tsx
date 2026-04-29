import { Info, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { useUpdate } from "@/contexts/UpdateContext";
import { toast } from "sonner";

const APP_VERSION = __APP_VERSION__;
const BUILD_DATE = __APP_BUILD_DATE__;
const BUILD_ID = __APP_BUILD_ID__;

export function AppVersionBadge() {
  const { t } = useTranslation();
  const { checkForUpdates, checking, updateServiceWorker } = useUpdate();

  const handleCheck = async () => {
    const result = await checkForUpdates();
    if (result === "update-available") {
      toast.success(t("pwa.updateFound"), {
        description: t("pwa.updateBody"),
        duration: 10000,
        action: {
          label: t("pwa.reloadNow"),
          onClick: () => updateServiceWorker(true),
        },
      });
    } else if (result === "up-to-date") {
      toast.info(t("pwa.upToDate"));
    } else if (result === "error") {
      toast.error(t("pwa.checkError"));
    }
  };

  return (
    <div className="flex flex-col items-center justify-center gap-2 py-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground/60">
        <Info className="h-3 w-3" />
        <span>v{APP_VERSION} · {BUILD_DATE} · {BUILD_ID}</span>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleCheck}
        disabled={checking}
        className="h-7 text-xs text-muted-foreground"
      >
        <RefreshCw className={`h-3 w-3 ${checking ? "animate-spin" : ""}`} />
        {checking ? t("pwa.checking") : t("pwa.checkForUpdates")}
      </Button>
    </div>
  );
}
