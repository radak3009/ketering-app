
## Plan: Dodavanje taba "Postavke" u Admin Dashboard

### Pregled izmena

Kreiraćemo novi tab "Postavke" u Admin Dashboard-u i u njega premestiti:
1. Kiosk paneli sekciju (pristup kiosk ekranima sa tokenima i QR kodovima)
2. Radno vreme kuhinje (KitchenScheduleSettings komponenta)

### Fajlovi za izmenu/kreiranje

| Fajl | Akcija | Opis |
|------|--------|------|
| `src/components/admin/SettingsTab.tsx` | CREATE | Nova komponenta sa premešenim sadržajem |
| `src/components/AdminDashboard.tsx` | UPDATE | Dodati novi tab "Postavke" |
| `src/components/admin/ReportsTab.tsx` | UPDATE | Ukloniti Kiosk panele i KitchenScheduleSettings |
| `src/i18n/locales/sr.json` | UPDATE | Dodati prevod za "settings" tab |
| `src/i18n/locales/en.json` | UPDATE | Dodati prevod za "settings" tab |

---

### Detalji implementacije

#### 1. Kreiranje `SettingsTab.tsx`

Nova komponenta koja će sadržati:
- **Kiosk paneli** - unos tokena, QR kodovi, linkovi ka kioscima
- **Radno vreme kuhinje** - KitchenScheduleSettings komponenta

Struktura komponente:
```text
SettingsTab
├── Kiosk paneli Card
│   ├── Token input sekcija (employee + kitchen)
│   ├── Kiosk linkovi sa QR kodovima
│   └── Napomena o korišćenju
└── Radno vreme kuhinje Card
    └── KitchenScheduleSettings komponenta
```

#### 2. Izmena `AdminDashboard.tsx`

- Dodati lazy import za `SettingsTab`
- Dodati novi `TabsTrigger` za "settings" tab sa ikonom `Settings`
- Dodati `TabsContent` koji renderuje `SettingsTab`
- Ažurirati grid kolone sa 7 na 8 tabova

Izmena TabsList:
```typescript
// Promena grid-cols-7 na grid-cols-8
<TabsList className="grid w-full grid-cols-4 md:grid-cols-8 h-auto gap-1 p-1">
  // ... postojeći tabovi ...
  <TabsTrigger value="settings" className="text-xs md:text-sm py-2">
    <Settings className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
    <span className="hidden sm:inline">{t('admin.tabs.settings')}</span>
    <span className="sm:hidden">Pod.</span>
  </TabsTrigger>
</TabsList>
```

#### 3. Izmena `ReportsTab.tsx`

Ukloniti sledeće sekcije:
- Kiosk paneli Card (linije ~261-412)
- Kitchen Schedule Settings Card (linije ~414-428)
- Ukloniti nepotrebne importee (`KitchenScheduleSettings`, `Clock`, `QRCodeSVG`, `Dialog` komponente, `MonitorSmartphone`, `ChefHat` ikone ako se više ne koriste)
- Ukloniti state za tokene (`employeeToken`, `kitchenToken`)

Nakon izmena, ReportsTab će sadržati samo:
- Generisanje izveštaja (CSV export)
- Brze statistike

Grid layout se menja sa `lg:grid-cols-2` na jednostavan `grid gap-6 md:grid-cols-2`.

#### 4. Ažuriranje i18n prevoda

**sr.json:**
```json
"admin": {
  "tabs": {
    // ... postojeći tabovi ...
    "settings": "Postavke"
  }
}
```

**en.json:**
```json
"admin": {
  "tabs": {
    // ... existing tabs ...
    "settings": "Settings"
  }
}
```

---

### Vizuelni prikaz nove strukture tabova

```text
Admin Dashboard Tabs (8 tabova):
┌──────────┬────────┬──────────┬──────────┬──────────┬─────────────┬──────────┬──────────┐
│ Porudž.  │ Obroci │ Jelovnici│ Korisnici│ Povratne │ Obaveštenja │ Izveštaji│ Postavke │
└──────────┴────────┴──────────┴──────────┴──────────┴─────────────┴──────────┴──────────┘
                                                                               ▲
                                                                               │
                                                                          NOV TAB

Sadržaj taba "Postavke":
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ Kiosk paneli                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────────────────┐ │
│ │ Token inputs: [Employee Token] [Kitchen Token]                                      │ │
│ │ Kiosk linkovi: [Ulaz u kantinu] [QR] [Otvori]  |  [Kuhinja] [QR] [Otvori]          │ │
│ │ Napomena: Tokeni se čuvaju lokalno...                                               │ │
│ └─────────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                          │
│ Radno vreme kuhinje                                                                      │
│ ┌─────────────────────────────────────────────────────────────────────────────────────┐ │
│ │ <KitchenScheduleSettings />                                                          │ │
│ │ - Nedeljni raspored (Pon-Ned)                                                        │ │
│ │ - Izuzeci (praznici, posebni dani)                                                   │ │
│ └─────────────────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### Tehnički detalji

**Importi za SettingsTab.tsx:**
```typescript
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ExternalLink, MonitorSmartphone, ChefHat, QrCode, Clock } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { KitchenScheduleSettings } from "./KitchenScheduleSettings";
```

**Mobilni prikaz:**
- Na mobilnim uređajima, skraćenica za tab: "Pod." (Postavke)
- Responsive grid za kiosk linkove: `grid md:grid-cols-2 gap-4`
