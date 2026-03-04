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
    onRegisteredSW(swUrl, registration) {
      console.log("[PWA] SW registered:", swUrl);
      if (registration) {
        setInterval(() => {
          console.log("[PWA] Checking for updates...");
          registration.update();
        }, 60 * 60 * 1000);
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
