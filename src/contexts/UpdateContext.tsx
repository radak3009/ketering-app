import { createContext, useContext, ReactNode, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";

interface UpdateContextType {
  needRefresh: boolean;
  updateServiceWorker: (reloadPage?: boolean) => Promise<void>;
}

const UpdateContext = createContext<UpdateContextType>({
  needRefresh: false,
  updateServiceWorker: async () => {},
});

export const useUpdate = () => useContext(UpdateContext);

export function UpdateProvider({ children }: { children: ReactNode }) {
  const [manualNeedRefresh, setManualNeedRefresh] = useState(false);

  const markUpdateAvailable = (reason: string) => {
    console.log(`[PWA] New content available, need refresh (${reason})`);
    setManualNeedRefresh(true);
  };

  const watchInstallingWorker = (worker: ServiceWorker | null) => {
    if (!worker) return;

    worker.addEventListener("statechange", () => {
      if (worker.state === "installed" && navigator.serviceWorker.controller) {
        markUpdateAvailable("installed worker");
      }
    });
  };

  const detectWaitingWorker = (registration: ServiceWorkerRegistration) => {
    if (registration.waiting && navigator.serviceWorker.controller) {
      markUpdateAvailable("waiting worker");
      return true;
    }
    return false;
  };

  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    immediate: true,
    onNeedRefresh() {
      console.log("[PWA] New content available, need refresh");
    },
    onOfflineReady() {
      console.log("[PWA] App ready to work offline");
    },
    onRegisteredSW(swUrl, registration) {
      console.log("[PWA] SW registered:", swUrl);
      if (registration) {
        detectWaitingWorker(registration);
        watchInstallingWorker(registration.installing);
        registration.addEventListener("updatefound", () => {
          watchInstallingWorker(registration.installing);
        });

        // Check immediately on load
        registration
          .update()
          .then(() => detectWaitingWorker(registration))
          .catch((err) =>
            console.warn("[PWA] Initial update check failed:", err)
          );
        // Then check periodically every 15 minutes
        setInterval(() => {
          console.log("[PWA] Checking for updates...");
          registration
            .update()
            .then(() => detectWaitingWorker(registration))
            .catch((err) =>
              console.warn("[PWA] Update check failed:", err)
            );
        }, 15 * 60 * 1000);
      }
    },
    onRegisterError(error) {
      console.error("[PWA] SW registration error:", error);
    },
  });

  return (
    <UpdateContext.Provider value={{ needRefresh: needRefresh || manualNeedRefresh, updateServiceWorker }}>
      {children}
    </UpdateContext.Provider>
  );
}
