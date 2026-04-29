import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version || "0.0.0"),
    __APP_BUILD_DATE__: JSON.stringify(new Date().toLocaleDateString("sr-Latn-RS", { year: "numeric", month: "short", day: "numeric" })),
  },
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
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
        start_url: "/",
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
        // Exclude index.html from precache so the shell is always fetched fresh.
        globPatterns: ["**/*.{js,css,ico,png,svg,woff2}"],
        // IMPORTANT: do NOT set navigateFallback here. It would create a Workbox
        // NavigationRoute that takes precedence over our NetworkFirst handler
        // and serves a cached index.html, causing PWA users to get stuck on
        // an old shell. We handle navigation via the NetworkFirst rule below.
        runtimeCaching: [
          {
            urlPattern: ({ request, url }) =>
              request.mode === "navigate" && !/^\/~oauth/.test(url.pathname),
            handler: "NetworkFirst",
            options: {
              cacheName: "html-shell-cache",
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
              cacheName: "html-shell-cache",
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
