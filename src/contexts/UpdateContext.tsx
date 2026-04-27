import { createContext, useContext, ReactNode } from "react";
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
        // Check immediately on load
        registration.update().catch((err) =>
          console.warn("[PWA] Initial update check failed:", err)
        );
        // Then check periodically every 15 minutes
        setInterval(() => {
          console.log("[PWA] Checking for updates...");
          registration.update().catch((err) =>
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
    <UpdateContext.Provider value={{ needRefresh, updateServiceWorker }}>
      {children}
    </UpdateContext.Provider>
  );
}
