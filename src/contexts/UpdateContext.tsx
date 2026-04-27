import { createContext, useContext, ReactNode, useRef, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";

interface UpdateContextType {
  needRefresh: boolean;
  updateServiceWorker: (reloadPage?: boolean) => Promise<void>;
  checkForUpdates: () => Promise<"update-available" | "up-to-date" | "unsupported" | "error">;
  checking: boolean;
}

const UpdateContext = createContext<UpdateContextType>({
  needRefresh: false,
  updateServiceWorker: async () => {},
  checkForUpdates: async () => "unsupported",
  checking: false,
});

export const useUpdate = () => useContext(UpdateContext);

export function UpdateProvider({ children }: { children: ReactNode }) {
  const [manualNeedRefresh, setManualNeedRefresh] = useState(false);
  const [checking, setChecking] = useState(false);
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);

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
        registrationRef.current = registration;
        detectWaitingWorker(registration);
        watchInstallingWorker(registration.installing);
        registration.addEventListener("updatefound", () => {
          watchInstallingWorker(registration.installing);
        });

        registration
          .update()
          .then(() => detectWaitingWorker(registration))
          .catch((err) =>
            console.warn("[PWA] Initial update check failed:", err)
          );
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

  const checkForUpdates = async (): Promise<
    "update-available" | "up-to-date" | "unsupported" | "error"
  > => {
    if (!("serviceWorker" in navigator)) return "unsupported";
    setChecking(true);
    try {
      let registration = registrationRef.current;
      if (!registration) {
        registration = (await navigator.serviceWorker.getRegistration()) ?? null;
        registrationRef.current = registration;
      }
      if (!registration) return "unsupported";

      await registration.update();

      // Give the browser a tick to surface waiting worker
      await new Promise((r) => setTimeout(r, 300));

      if (detectWaitingWorker(registration)) return "update-available";
      if (registration.installing) {
        watchInstallingWorker(registration.installing);
        return "update-available";
      }
      return "up-to-date";
    } catch (err) {
      console.error("[PWA] Manual update check failed:", err);
      return "error";
    } finally {
      setChecking(false);
    }
  };

  return (
    <UpdateContext.Provider
      value={{
        needRefresh: needRefresh || manualNeedRefresh,
        updateServiceWorker,
        checkForUpdates,
        checking,
      }}
    >
      {children}
    </UpdateContext.Provider>
  );
}
