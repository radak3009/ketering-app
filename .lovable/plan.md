

## Plan: Persistent Update Footer for Employee Panel

### Problem
The current update prompt is a dismissible pop-up card. Users can close it and ignore the update indefinitely. The requirement is to force employees to update by showing a persistent, non-dismissible footer bar that stays visible until the update is applied.

### Approach
Replace the floating card with a sticky bottom footer bar in the EmployeeDashboard. The footer cannot be dismissed -- only clicking "Ažuriraj" will remove it (by reloading with the new SW).

### Changes

#### 1. `src/components/UpdatePrompt.tsx`
- Remove the `dismissed` state and `X` close button entirely
- Remove the "Kasnije" (Later) button
- Change layout from floating card to a full-width sticky bottom bar (`fixed bottom-0 left-0 right-0`)
- Keep the RefreshCw icon, update message text, and "Učitaj ponovo" button
- Use a prominent background (e.g., `bg-primary text-primary-foreground`) so it's clearly visible
- Set `z-[60]` so it sits above the mobile bottom nav (`z-20`) but below modals

#### 2. `src/components/EmployeeDashboard.tsx`
- Add bottom padding to the main content area when `needRefresh` is active, so the footer doesn't overlap content
- Import and use `useRegisterSW` or pass a prop/context to know if update is available
- Alternatively: the UpdatePrompt already renders globally in App.tsx, so we just need to ensure the mobile bottom nav shifts up when the footer is visible

#### 3. Coordination with mobile bottom nav
- The mobile bottom nav is `fixed bottom-0`. When the update footer is showing, add `bottom-[48px]` (or similar) to the nav so it sits above the update bar
- Expose the `needRefresh` state via a simple React context or a shared hook so EmployeeDashboard can react to it

### Implementation detail
Create a small `useUpdateAvailable` hook that wraps `useRegisterSW` and exposes `{ needRefresh, updateServiceWorker }`. Both `UpdatePrompt` and `EmployeeDashboard` import it. This avoids registering the SW twice (the hook will use a module-level singleton pattern or we move SW registration to the hook and use it in App.tsx only, passing state down via context).

Simpler alternative: Create an `UpdateContext` provider in App.tsx that wraps the `useRegisterSW` call and provides `{ needRefresh, updateServiceWorker }` to children. UpdatePrompt consumes this context. EmployeeDashboard also consumes it to adjust bottom padding/nav position.

### Files to modify

| File | Change |
|------|--------|
| `src/contexts/UpdateContext.tsx` | New context providing `needRefresh` + `updateServiceWorker` |
| `src/App.tsx` | Wrap with `UpdateProvider`, remove direct `UpdatePrompt` |
| `src/components/UpdatePrompt.tsx` | Rewrite as persistent bottom bar, consume context, remove dismiss/close |
| `src/components/EmployeeDashboard.tsx` | Consume `UpdateContext` to shift mobile nav up and add bottom padding when update bar is visible |

