

## Plan: PWA Update UX Flow

The current setup uses `vite-plugin-pwa` with `registerType: "autoUpdate"` and `injectRegister: "script-defer"`, which auto-updates silently. We need to switch to manual `prompt` mode so users see an "Update available" notification.

### Changes

#### 1. `vite.config.ts` — Switch to prompt registration
- Change `registerType` from `"autoUpdate"` to `"prompt"`
- Change `injectRegister` to `false` (we handle registration ourselves)
- Add `skipWaiting` and `clientsClaim` message handler injection via `workbox.skipWaiting: false` and `workbox.clientsClaim: false` (we control these manually)

#### 2. New file: `src/lib/pwa-update.ts` — SW registration + update detection module
- Register SW using the VitePWA-generated path (`/sw.js`)
- Listen for `registration.updatefound` and `statechange` on installing worker
- Check `registration.waiting` on startup (already-waiting SW)
- Guard against first install (skip prompt if `registration.active` is null)
- Expose a callback `onUpdateAvailable` and a `skipWaitingAndReload()` function
- Add `controllerchange` listener with `hasRefreshed` guard to prevent reload loops
- Post `{ type: 'SKIP_WAITING' }` message to waiting SW on user action
- Console log lifecycle events

#### 3. New file: `src/components/UpdatePrompt.tsx` — UI component
- Uses `useState` to track `updateAvailable` and `dismissed`
- Renders a fixed bottom-right toast-style card (matches app design with shadcn Card)
- Title: "Ažuriranje dostupno" / Body: "Nova verzija je spremna. Ponovo učitajte da biste ažurirali."
- Buttons: "Učitaj ponovo" (primary) and "Kasnije" (ghost/secondary)
- "Kasnije" sets `dismissed = true` for the session
- "Učitaj ponovo" calls `skipWaitingAndReload()`

#### 4. `src/App.tsx` — Mount `<UpdatePrompt />`
- Import and render `<UpdatePrompt />` alongside `<Toaster />` and `<Sonner />`

#### 5. SW message handler
- Since VitePWA generates the SW, we configure it via the plugin's `workbox` options or by using `injectManifest` strategy. However, the simpler approach: VitePWA with `registerType: "prompt"` and `injectRegister: false` already supports this pattern — we use `registerSW` from `virtual:pwa-register` which handles the `SKIP_WAITING` message internally via Workbox's built-in `messageSkipWaiting`.

**Revised approach**: Use VitePWA's built-in `virtual:pwa-register` module which already handles all the SW lifecycle (skip_waiting message, controller change reload). This avoids custom SW code entirely.

#### Final file list:
1. **`vite.config.ts`** — `registerType: "prompt"`, `injectRegister: false`
2. **`src/vite-env.d.ts`** — Add `virtual:pwa-register` type reference
3. **`src/components/UpdatePrompt.tsx`** — UI + registration using `registerSW` from `virtual:pwa-register`
4. **`src/App.tsx`** — Add `<UpdatePrompt />`
5. **`src/i18n/locales/sr.json`** + **`en.json`** — Add `pwa.updateAvailable`, `pwa.updateBody`, `pwa.reloadNow`, `pwa.later` keys

