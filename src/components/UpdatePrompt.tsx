import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { useUpdate } from "@/contexts/UpdateContext";
import { toast } from "sonner";

const TOAST_ID = "pwa-update-available";

export const UpdatePrompt = () => {
  const { t } = useTranslation();
  const { needRefresh, updateServiceWorker } = useUpdate();
  const shownRef = useRef(false);

  useEffect(() => {
    if (needRefresh && !shownRef.current) {
      shownRef.current = true;
      toast(t("pwa.updateAvailable"), {
        id: TOAST_ID,
        description: t("pwa.updateBody"),
        duration: Infinity,
        action: {
          label: t("pwa.reloadNow"),
          onClick: () => {
            console.log("[PWA] User triggered update from toast");
            updateServiceWorker(true);
          },
        },
      });
    } else if (!needRefresh && shownRef.current) {
      shownRef.current = false;
      toast.dismiss(TOAST_ID);
    }
  }, [needRefresh, t, updateServiceWorker]);

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
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            console.log("[PWA] User triggered update from banner");
            updateServiceWorker(true);
          }}
          className="shrink-0"
        >
          {t("pwa.reloadNow")}
        </Button>
      </div>
    </div>
  );
};
