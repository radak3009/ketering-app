import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

const buildDate = new Date();
const buildId = `b${buildDate.getTime().toString(36)}`;

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version || "0.0.0"),
    __APP_BUILD_DATE__: JSON.stringify(
      buildDate.toLocaleString("sr-Latn-RS", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/Belgrade",
      })
    ),
    __APP_BUILD_ID__: JSON.stringify(buildId),
  },
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    {
      name: "emit-version-json",
      apply: "build" as const,
      generateBundle(this: any) {
        this.emitFile({
          type: "asset",
          fileName: "version.json",
          source: JSON.stringify({
            buildId,
            buildDate: buildDate.toISOString(),
            version: process.env.npm_package_version || "0.0.0",
          }),
        });
      },
    },
    VitePWA({
      registerType: "prompt",
      injectRegister: false,
      includeAssets: ["favicon.ico", "robots.txt"],
      manifest: {
        name: "Ketering Hogo",
        short_name: "Ketering",
        description: "Moderna platforma za upravljanje keteringom u kompanijama. Jednostavno naručivanje obroka, administracija menija i detaljni izveštaji.",
        theme_color: "#f97316",
        background_color: "#ffffff",
        display: "standalone",
        scope: "/",
        start_url: `/?source=pwa&build=${buildId}`,
        orientation: "portrait-primary",
        icons: [
          {
            src: "/icons/icon-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/icons/icon-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "/icons/icon-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        // vite-plugin-pwa defaults this to "index.html". It must be explicitly
        // disabled, otherwise Workbox registers a cache-first NavigationRoute
        // before our NetworkFirst navigation route and PWA users can stay stuck
        // on an old app shell.
        navigateFallback: undefined,
        // Let the fixed service worker take control as soon as the browser
        // discovers it, so devices already stuck behind the old fallback can
        // recover on the next app launch without waiting for all old clients.
        skipWaiting: true,
        clientsClaim: true,
        // Exclude index.html from precache so the shell is always fetched fresh.
        globPatterns: ["**/*.{js,css,ico,png,svg,woff2}"],
        // We handle navigation via the NetworkFirst rule below.
        runtimeCaching: [
          {
            urlPattern: ({ request, url }) =>
              request.mode === "navigate" && !/^\/~oauth/.test(url.pathname),
            handler: "NetworkFirst",
            options: {
              cacheName: `html-shell-cache-${buildId}`,
              networkTimeoutSeconds: 5,
              expiration: {
                maxEntries: 5,
                maxAgeSeconds: 60 * 60 * 24,
              },
            },
          },
          {
            urlPattern: /\/index\.html(\?.*)?$/i,
            handler: "NetworkFirst",
            options: {
              cacheName: `html-shell-cache-${buildId}`,
              networkTimeoutSeconds: 5,
              expiration: {
                maxEntries: 5,
                maxAgeSeconds: 60 * 60 * 24,
              },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-cache",
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-webfonts",
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
            },
          },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
