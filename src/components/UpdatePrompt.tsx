import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { RefreshCw, X } from "lucide-react";
import { useUpdate } from "@/contexts/UpdateContext";

export const UpdatePrompt = () => {
  const { t } = useTranslation();
  const { needRefresh, updateServiceWorker, dismissUpdate } = useUpdate();

  if (!needRefresh) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[60] bg-primary text-primary-foreground shadow-lg">
      <div className="container mx-auto px-4 py-2.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <RefreshCw className="h-4 w-4 shrink-0 animate-spin" />
          <p className="text-sm font-medium truncate">
            {t("pwa.updateAvailable")}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              console.log("[PWA] User triggered update from banner");
              updateServiceWorker(true);
            }}
          >
            {t("pwa.reloadNow")}
          </Button>
          <Button
            size="icon"
            variant="ghost"
            aria-label={t("common.close", { defaultValue: "Zatvori" })}
            onClick={() => {
              console.log("[PWA] User dismissed update banner");
              dismissUpdate();
            }}
            className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/10"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};
