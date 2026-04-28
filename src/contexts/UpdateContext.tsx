import { createContext, useContext, ReactNode, useCallback, useRef, useState } from "react";
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

const SW_URL = "/sw.js";

const isCurrentServiceWorker = (worker: ServiceWorker | null | undefined) => {
  if (!worker) return false;
  return new URL(worker.scriptURL).pathname === SW_URL;
};

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

  const waitForInstall = (worker: ServiceWorker, timeoutMs = 15000): Promise<boolean> =>
    new Promise((resolve) => {
      const timer = setTimeout(() => {
        worker.removeEventListener("statechange", onChange);
        resolve(false);
      }, timeoutMs);
      const onChange = () => {
        if (worker.state === "installed" || worker.state === "activated") {
          clearTimeout(timer);
          worker.removeEventListener("statechange", onChange);
          resolve(true);
        } else if (worker.state === "redundant") {
          clearTimeout(timer);
          worker.removeEventListener("statechange", onChange);
          resolve(false);
        }
      };
      worker.addEventListener("statechange", onChange);
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

      // Already has a waiting worker (previous update not consumed yet)
      if (detectWaitingWorker(registration)) return "update-available";

      // Trigger update check (this fetches the new SW script)
      console.log("[PWA] Manual update: calling registration.update()");
      await registration.update();

      // After update(), the browser may have started installing a new worker
      const installing = registration.installing;
      if (installing) {
        console.log("[PWA] Manual update: installing worker found, waiting...");
        watchInstallingWorker(installing);
        const installed = await waitForInstall(installing);
        if (installed && detectWaitingWorker(registration)) {
          return "update-available";
        }
        // If it activated without waiting, it's likely the first SW (no controller yet)
        return navigator.serviceWorker.controller ? "up-to-date" : "update-available";
      }

      // No new worker triggered — poll briefly in case browser is slow
      for (let i = 0; i < 10; i++) {
        await new Promise((r) => setTimeout(r, 300));
        if (registration.installing) {
          const installed = await waitForInstall(registration.installing);
          if (installed && detectWaitingWorker(registration)) {
            return "update-available";
          }
          break;
        }
        if (detectWaitingWorker(registration)) return "update-available";
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
