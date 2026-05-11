import { createContext, useContext, ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";

interface UpdateContextType {
  needRefresh: boolean;
  updateServiceWorker: (reloadPage?: boolean) => Promise<void>;
  checkForUpdates: () => Promise<"update-available" | "up-to-date" | "unsupported" | "error">;
  checking: boolean;
  dismissUpdate: () => void;
}

const UpdateContext = createContext<UpdateContextType>({
  needRefresh: false,
  updateServiceWorker: async () => {},
  checkForUpdates: async () => "unsupported",
  checking: false,
  dismissUpdate: () => {},
});

export const useUpdate = () => useContext(UpdateContext);

const SW_URL = "/sw.js";

const isCurrentServiceWorker = (worker: ServiceWorker | null | undefined) => {
  if (!worker) return false;
  return new URL(worker.scriptURL).pathname === SW_URL;
};

export function UpdateProvider({ children }: { children: ReactNode }) {
  const [manualNeedRefresh, setManualNeedRefresh] = useState(false);
  const [forceReloadNeeded, setForceReloadNeeded] = useState(false);
  const [checking, setChecking] = useState(false);
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);

  const markUpdateAvailable = useCallback((reason: string) => {
    console.log(`[PWA] New content available, need refresh (${reason})`);
    setManualNeedRefresh(true);
  }, []);

  const watchInstallingWorker = useCallback((worker: ServiceWorker | null) => {
    if (!isCurrentServiceWorker(worker)) return;

    worker.addEventListener("statechange", () => {
      if (worker.state === "installed" && navigator.serviceWorker.controller) {
        markUpdateAvailable("installed worker");
      }
    });
  }, [markUpdateAvailable]);

  const detectWaitingWorker = useCallback((registration: ServiceWorkerRegistration) => {
    if (isCurrentServiceWorker(registration.waiting) && navigator.serviceWorker.controller) {
      setForceReloadNeeded(false);
      markUpdateAvailable("waiting worker");
      return true;
    }
    return false;
  }, [markUpdateAvailable]);

  const detectExternalWaitingWorker = useCallback(async () => {
    const registrations = await navigator.serviceWorker.getRegistrations();
    const registration = registrations.find((candidate) =>
      isCurrentServiceWorker(candidate.waiting)
    );
    if (registration && navigator.serviceWorker.controller) {
      registrationRef.current = registration;
      setForceReloadNeeded(false);
      markUpdateAvailable("external waiting worker");
      return true;
    }
    return false;
  }, [markUpdateAvailable]);

  const detectPublishedShellUpdate = useCallback(async () => {
    const currentScripts = Array.from(
      document.querySelectorAll<HTMLScriptElement>('script[type="module"][src*="/assets/"]')
    ).map((script) => new URL(script.src).pathname);

    if (currentScripts.length === 0) return false;

    const response = await fetch(`/index.html?pwa-check=${Date.now()}`, {
      cache: "no-store",
      headers: { "Cache-Control": "no-cache" },
    });

    if (!response.ok) return false;

    const html = await response.text();
    const publishedScripts = Array.from(
      html.matchAll(/<script[^>]+type=["']module["'][^>]+src=["']([^"']+)["']/g)
    ).map((match) => new URL(match[1], window.location.origin).pathname);

    return publishedScripts.some((script) => !currentScripts.includes(script));
  }, []);

  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    immediate: true,
    onNeedRefresh() {
      console.log("[PWA] New content available, need refresh");
      markUpdateAvailable("workbox waiting event");
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

  const runBackgroundCheck = useCallback(
    (reason: string) => {
      if (!("serviceWorker" in navigator)) return;
      console.log(`[PWA] Background update check (${reason})`);
      detectExternalWaitingWorker().catch((err) =>
        console.warn("[PWA] External waiting worker check failed:", err)
      );
      detectPublishedShellUpdate()
        .then((hasUpdate) => {
          if (hasUpdate) {
            setForceReloadNeeded(true);
            markUpdateAvailable(`published shell changed (${reason})`);
          }
        })
        .catch((err) =>
          console.warn("[PWA] Published shell update check failed:", err)
        );
      const reg = registrationRef.current;
      if (reg) {
        reg
          .update()
          .then(() => detectWaitingWorker(reg))
          .catch((err) => console.warn("[PWA] reg.update() failed:", err));
      }
    },
    [
      detectExternalWaitingWorker,
      detectPublishedShellUpdate,
      detectWaitingWorker,
      markUpdateAvailable,
    ]
  );

  useEffect(() => {
    runBackgroundCheck("mount");
  }, [runBackgroundCheck]);

  useEffect(() => {
    const onFocus = () => runBackgroundCheck("focus");
    const onOnline = () => runBackgroundCheck("online");
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        runBackgroundCheck("visibility");
      }
    };
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [runBackgroundCheck]);

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

  const clearUpdateState = useCallback(() => {
    setManualNeedRefresh(false);
    setForceReloadNeeded(false);
  }, []);

  const checkForUpdates = async (): Promise<
    "update-available" | "up-to-date" | "unsupported" | "error"
  > => {
    if (!("serviceWorker" in navigator)) return "unsupported";
    setChecking(true);
    try {
      if (await detectExternalWaitingWorker()) return "update-available";
      if (await detectPublishedShellUpdate()) {
        setForceReloadNeeded(true);
        markUpdateAvailable("manual published shell check");
        return "update-available";
      }

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

      if (await detectExternalWaitingWorker()) return "update-available";
      if (await detectPublishedShellUpdate()) {
        setForceReloadNeeded(true);
        markUpdateAvailable("manual published shell check after sw update");
        return "update-available";
      }

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
        if (navigator.serviceWorker.controller) {
          clearUpdateState();
          return "up-to-date";
        }
        return "update-available";
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

      // Genuinely up-to-date — clear any stale update flags from earlier checks
      clearUpdateState();
      return "up-to-date";
    } catch (err) {
      console.error("[PWA] Manual update check failed:", err);
      return "error";
    } finally {
      setChecking(false);
    }
  };

  const getCurrentAssetSignature = () =>
    Array.from(
      document.querySelectorAll<HTMLScriptElement>('script[type="module"][src*="/assets/"]')
    )
      .map((s) => new URL(s.src).pathname)
      .sort()
      .join("|");

  const hardReload = async () => {
    console.warn("[PWA] Reload watchdog: forcing hard reload");
    try {
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      const regs = await navigator.serviceWorker?.getRegistrations?.();
      await Promise.all((regs ?? []).map((r) => r.unregister()));
    } catch (err) {
      console.warn("[PWA] Hard reload cleanup failed:", err);
    }
    const url = new URL(window.location.href);
    url.searchParams.delete("pwa-recovered");
    url.searchParams.set("pwa-reset", "1");
    url.searchParams.set("pwa-reload", Date.now().toString());
    window.location.replace(url.toString());
  };

  const armReloadWatchdog = () => {
    try {
      sessionStorage.setItem("pwa:pre-reload-assets", getCurrentAssetSignature());
      sessionStorage.setItem("pwa:pre-reload-ts", Date.now().toString());
    } catch {
      // sessionStorage unavailable — watchdog skipped
    }
  };

  const applyUpdate = async (reloadPage = true) => {
    armReloadWatchdog();
    if (forceReloadNeeded) {
      window.location.reload();
      return;
    }
    await updateServiceWorker(reloadPage);
  };

  // Reload watchdog: after a triggered update, if the page comes back with the
  // same asset hashes within 2s, force a hard reload (cache+SW wipe).
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const prev = sessionStorage.getItem("pwa:pre-reload-assets");
      const prevTs = Number(sessionStorage.getItem("pwa:pre-reload-ts") || "0");
      if (!prev || !prevTs) return;
      // Stale marker (>30s) — discard
      if (Date.now() - prevTs > 30_000) {
        sessionStorage.removeItem("pwa:pre-reload-assets");
        sessionStorage.removeItem("pwa:pre-reload-ts");
        return;
      }
      const current = getCurrentAssetSignature();
      if (current && current !== prev) {
        // Update succeeded — clear marker
        sessionStorage.removeItem("pwa:pre-reload-assets");
        sessionStorage.removeItem("pwa:pre-reload-ts");
        return;
      }
      // Same assets after reload — wait 2s then hard reload
      timer = setTimeout(() => {
        if (cancelled) return;
        sessionStorage.removeItem("pwa:pre-reload-assets");
        sessionStorage.removeItem("pwa:pre-reload-ts");
        hardReload();
      }, 2000);
    } catch {
      // ignore
    }
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <UpdateContext.Provider
      value={{
        needRefresh: needRefresh || manualNeedRefresh,
        updateServiceWorker: applyUpdate,
        checkForUpdates,
        checking,
      }}
    >
      {children}
    </UpdateContext.Provider>
  );
}
