

## Plan: Split SettingsTab into Sub-Tabs

### Overview
Replace the single scrollable settings page with a `Tabs` component containing three sub-tabs, eliminating the need to scroll through all sections.

### Sub-tabs

| Tab | Label | Content |
|-----|-------|---------|
| `kiosk` | Kiosk postavke | Kiosk paneli card (tokens, links, QR codes) |
| `kitchen` | Kuhinja | Radno vreme kuhinje card (KitchenScheduleSettings) |
| `organization` | Organizacija | Employee/tag settings card |

### Changes

**`src/components/admin/SettingsTab.tsx`**
- Import `Tabs, TabsList, TabsTrigger, TabsContent` from `@/components/ui/tabs`
- Wrap the three Card sections in `TabsContent` components with corresponding values
- Add a `TabsList` at the top with three triggers (with icons: MonitorSmartphone, Clock, Users)
- Default tab: `kiosk`
- Move `AppVersionBadge` outside tabs (always visible at bottom)
- TabsList will use `w-full` to span full width on mobile

### Files to modify
| File | Change |
|------|--------|
| `src/components/admin/SettingsTab.tsx` | Wrap sections in Tabs/TabsContent, add TabsList with 3 triggers |

