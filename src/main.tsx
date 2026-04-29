import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./i18n";

const PWA_RESET_PARAM = "pwa-reset";
const PWA_RECOVERED_PARAM = "pwa-recovered";

const cleanRecoveryMarker = () => {
  const url = new URL(window.location.href);
  if (!url.searchParams.has(PWA_RECOVERED_PARAM)) return;
  url.searchParams.delete(PWA_RECOVERED_PARAM);
  window.history.replaceState(window.history.state, "", url.toString());
};

const runPwaRecoveryIfRequested = async () => {
  const url = new URL(window.location.href);
  if (url.searchParams.get(PWA_RESET_PARAM) !== "1") return false;

  try {
    sessionStorage.removeItem("pwa:pre-reload-assets");
    sessionStorage.removeItem("pwa:pre-reload-ts");

    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }

    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    }
  } catch (error) {
    console.warn("[PWA] Recovery cleanup failed:", error);
  }

  url.searchParams.delete(PWA_RESET_PARAM);
  url.searchParams.set(PWA_RECOVERED_PARAM, Date.now().toString());
  window.location.replace(url.toString());
  return true;
};

const renderApp = () => {
  cleanRecoveryMarker();
  createRoot(document.getElementById("root")!).render(<App />);
};

runPwaRecoveryIfRequested().then((recoveryStarted) => {
  if (!recoveryStarted) renderApp();
});
