
## Plan: Konfigurabilni radni kalendar za Kitchen Kiosk

### Pregled sistema

Ovaj plan implementira konfigurabilan radni kalendar koji kontroliše kada je Kitchen kiosk aktivan. Kada kuhinja radi (`kitchenOpen=true`), samo Kitchen kiosk može potvrditi preuzimanje. Kada kuhinja ne radi (`kitchenOpen=false`), Pickup kiosk preuzima potvrdu uz confirm prompt.

---

### Arhitektura rešenja

```text
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              Admin Dashboard                                     │
│  ┌─────────────────────────────┐    ┌─────────────────────────────┐             │
│  │   Weekly Schedule Editor    │    │    Exceptions Calendar      │             │
│  │   (Pon-Ned, open/close)     │    │    (Praznici, posebni dani) │             │
│  └──────────────┬──────────────┘    └──────────────┬──────────────┘             │
│                 │                                   │                            │
└─────────────────┼───────────────────────────────────┼────────────────────────────┘
                  │                                   │
                  ▼                                   ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Supabase Database                                      │
│  ┌─────────────────────────────┐    ┌─────────────────────────────┐             │
│  │  kitchen_schedule_weekly    │    │  kitchen_schedule_exceptions│             │
│  │  day_of_week | open | close │    │  date | closed | open/close │             │
│  └─────────────────────────────┘    └─────────────────────────────┘             │
└─────────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         Edge Functions (Europe/Belgrade TZ)                      │
│  ┌──────────────────────┐                                                       │
│  │   isKitchenOpen()    │◄── Helper function shared across edge functions       │
│  │   - Check exceptions │                                                        │
│  │   - Check weekly     │                                                        │
│  │   - Return boolean   │                                                        │
│  └──────────┬───────────┘                                                        │
│             │                                                                    │
│  ┌──────────┴───────────────────────────────────────────────────────────────┐   │
│  │                                                                           │   │
│  ▼                             ▼                              ▼              │   │
│  kiosk-show-meal       kiosk-confirm-pickup          kiosk-get-kitchen-status│   │
│  + kitchenOpen         + validates token type         (optional status API)  │   │
│  + confirmationRequired  vs kitchen status                                   │   │
│                                                                               │   │
└───────────────────────────────────────────────────────────────────────────────────┘
                          │                    │
          ┌───────────────┴───────┐    ┌───────┴───────────────┐
          ▼                       ▼    ▼                       ▼
┌─────────────────────┐    ┌─────────────────────┐
│   Pickup Kiosk      │    │   Kitchen Kiosk     │
│   - if !kitchenOpen │    │   - if kitchenOpen  │
│   - shows confirm   │    │   - normal serve    │
│   - 8s timeout      │    │   - if closed: msg  │
└─────────────────────┘    └─────────────────────┘
```

---

### Faza 1: Database migracije

#### 1.1 Kreiranje tabela

**`kitchen_schedule_weekly`** - Nedeljni raspored
```sql
CREATE TABLE public.kitchen_schedule_weekly (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Nedelja, 6=Subota (JS standard)
  enabled BOOLEAN NOT NULL DEFAULT true,
  open_time TIME NOT NULL,
  close_time TIME NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, day_of_week)
);
```

**`kitchen_schedule_exceptions`** - Izuzeci po datumu
```sql
CREATE TABLE public.kitchen_schedule_exceptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  exception_date DATE NOT NULL,
  closed_all_day BOOLEAN NOT NULL DEFAULT false,
  open_time TIME, -- null ako closed_all_day=true
  close_time TIME, -- null ako closed_all_day=true
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, exception_date)
);
```

#### 1.2 RLS Politike

```sql
-- Uključi RLS
ALTER TABLE public.kitchen_schedule_weekly ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kitchen_schedule_exceptions ENABLE ROW LEVEL SECURITY;

-- Samo admini mogu upravljati
CREATE POLICY "Admins can manage weekly schedule" 
  ON public.kitchen_schedule_weekly FOR ALL
  USING (public.is_admin_user(auth.uid()));

CREATE POLICY "Admins can manage exceptions" 
  ON public.kitchen_schedule_exceptions FOR ALL
  USING (public.is_admin_user(auth.uid()));

-- Nema direktnog pristupa za kiosk - samo preko Edge Functions
```

#### 1.3 Seed podaci (default raspored)

```sql
-- Ponedeljak-Subota: 06:00-22:00
-- Nedelja: 06:00-14:00

INSERT INTO public.kitchen_schedule_weekly (company_id, day_of_week, enabled, open_time, close_time)
VALUES
  (NULL, 1, true, '06:00:00', '22:00:00'), -- Ponedeljak
  (NULL, 2, true, '06:00:00', '22:00:00'), -- Utorak
  (NULL, 3, true, '06:00:00', '22:00:00'), -- Sreda
  (NULL, 4, true, '06:00:00', '22:00:00'), -- Četvrtak
  (NULL, 5, true, '06:00:00', '22:00:00'), -- Petak
  (NULL, 6, true, '06:00:00', '22:00:00'), -- Subota
  (NULL, 0, true, '06:00:00', '14:00:00'); -- Nedelja
```

---

### Faza 2: Edge Functions

#### 2.1 Shared helper: `_shared/kitchen-schedule.ts`

Nova shared funkcija za proveru da li je kuhinja otvorena.

```typescript
// supabase/functions/_shared/kitchen-schedule.ts

interface KitchenStatus {
  isOpen: boolean;
  openTime: string | null;  // HH:mm format
  closeTime: string | null;
  reason: string;           // "exception_closed" | "weekly_closed" | "outside_hours" | "open"
}

export async function isKitchenOpen(
  supabase: SupabaseClient,
  companyId: string | null = null
): Promise<KitchenStatus> {
  // Dobij trenutno vreme u Europe/Belgrade timezone
  const now = new Date();
  const belgradeTime = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Belgrade',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).formatToParts(now);
  
  const dateStr = /* parse to YYYY-MM-DD */;
  const timeStr = /* parse to HH:mm:ss */;
  const dayOfWeek = new Date(dateStr).getDay(); // 0-6

  // 1. Proveri izuzetke za današnji datum
  const { data: exception } = await supabase
    .from('kitchen_schedule_exceptions')
    .select('closed_all_day, open_time, close_time, note')
    .eq('exception_date', dateStr)
    .eq('company_id', companyId) // ili is null
    .maybeSingle();

  if (exception) {
    if (exception.closed_all_day) {
      return { isOpen: false, openTime: null, closeTime: null, reason: 'exception_closed' };
    }
    // Override vremena iz izuzetka
    const isInRange = timeStr >= exception.open_time && timeStr < exception.close_time;
    return {
      isOpen: isInRange,
      openTime: exception.open_time,
      closeTime: exception.close_time,
      reason: isInRange ? 'open' : 'outside_hours'
    };
  }

  // 2. Proveri nedeljni raspored
  const { data: schedule } = await supabase
    .from('kitchen_schedule_weekly')
    .select('enabled, open_time, close_time')
    .eq('day_of_week', dayOfWeek)
    .eq('company_id', companyId) // ili is null
    .maybeSingle();

  if (!schedule || !schedule.enabled) {
    return { isOpen: false, openTime: null, closeTime: null, reason: 'weekly_closed' };
  }

  const isInRange = timeStr >= schedule.open_time && timeStr < schedule.close_time;
  return {
    isOpen: isInRange,
    openTime: schedule.open_time,
    closeTime: schedule.close_time,
    reason: isInRange ? 'open' : 'outside_hours'
  };
}
```

#### 2.2 Izmene `kiosk-show-meal`

Dodati `kitchenOpen` i `confirmationRequired` u response:

```typescript
// Postojeći response + novo:
{
  found: true,
  fullName: "...",
  mealName: "...",
  pickupRequestId: "...",
  kitchenOpen: true/false,          // NOVO
  confirmationRequired: true/false   // NOVO: = !kitchenOpen
}
```

**Logika:**
```typescript
import { isKitchenOpen } from "../_shared/kitchen-schedule.ts";

// ... postojeći kod ...

// Pre vraćanja response-a:
const kitchenStatus = await isKitchenOpen(supabase, profile.company_id);

return new Response(
  JSON.stringify({
    found: true,
    fullName: profile.full_name || "",
    mealName,
    pickupRequestId: pickupRequest.id,
    kitchenOpen: kitchenStatus.isOpen,
    confirmationRequired: !kitchenStatus.isOpen
  }),
  // ...
);
```

#### 2.3 Nova funkcija `kiosk-confirm-pickup`

Zamenjuje direktno korišćenje `kiosk-serve` za self-service potvrdu.

```typescript
// supabase/functions/kiosk-confirm-pickup/index.ts

Deno.serve(async (req) => {
  const { kioskToken, pickupRequestId } = await req.json();
  
  // Odredi tip tokena
  const employeeToken = Deno.env.get("KIOSK_TOKEN_EMPLOYEE");
  const kitchenToken = Deno.env.get("KIOSK_TOKEN_KITCHEN");
  
  const isEmployeeKiosk = kioskToken === employeeToken;
  const isKitchenKiosk = kioskToken === kitchenToken;
  
  if (!isEmployeeKiosk && !isKitchenKiosk) {
    return new Response(
      JSON.stringify({ error: "Nedozvoljen pristup" }),
      { status: 403 }
    );
  }

  // Proveri status kuhinje
  const kitchenStatus = await isKitchenOpen(supabase, companyId);
  
  // Validacija:
  // - Kitchen kiosk može potvrditi SAMO kad je kitchenOpen=true
  // - Employee/Pickup kiosk može potvrditi SAMO kad je kitchenOpen=false
  
  if (isKitchenKiosk && !kitchenStatus.isOpen) {
    return new Response(
      JSON.stringify({ 
        error: "Kuhinja trenutno ne radi",
        kitchenOpen: false,
        schedule: { open: kitchenStatus.openTime, close: kitchenStatus.closeTime }
      }),
      { status: 403 }
    );
  }
  
  if (isEmployeeKiosk && kitchenStatus.isOpen) {
    return new Response(
      JSON.stringify({ 
        error: "Kuhinja radi - preuzmite obrok na šalteru",
        kitchenOpen: true
      }),
      { status: 403 }
    );
  }

  // Izvrši potvrdu (postojeća logika iz kiosk-serve)
  // ... update pickup_request status = 'served' ...
  
  return new Response(JSON.stringify({ success: true }), { status: 200 });
});
```

#### 2.4 Opciono: `kiosk-get-kitchen-status`

Za prikaz statusa na frontend-u (npr. header Kitchen kioska).

```typescript
// GET kitchen status za bilo koji kiosk
{
  isOpen: true,
  openTime: "06:00",
  closeTime: "22:00",
  currentTime: "14:35",
  reason: "open"
}
```

---

### Faza 3: Frontend izmene

#### 3.1 Admin Settings komponenta

Nova komponenta za upravljanje rasporedom.

**Fajl:** `src/components/admin/KitchenScheduleSettings.tsx`

**UI elementi:**

1. **Weekly Schedule Grid**
   - Tabela sa 7 redova (Pon-Ned)
   - Kolone: Dan | Enabled switch | Open time | Close time
   - Time picker (HH:mm format)

2. **Exceptions List**
   - Kalendar za odabir datuma
   - Za svaki izuzetak:
     - Datum
     - Toggle: "Zatvoreno ceo dan"
     - Ako nije zatvoreno: open/close time
     - Napomena (tekst)
   - CRUD operacije

```typescript
// Struktura state-a
interface WeeklySchedule {
  dayOfWeek: number;
  enabled: boolean;
  openTime: string; // "HH:mm"
  closeTime: string;
}

interface ScheduleException {
  id: string;
  date: string;
  closedAllDay: boolean;
  openTime: string | null;
  closeTime: string | null;
  note: string | null;
}
```

#### 3.2 Integracija u AdminDashboard

Dodati nov tab "Podešavanja" ili ugraditi u "Izveštaji" tab pored Kiosk panela.

```typescript
// Option A: Nov tab
<TabsTrigger value="settings">
  <Settings className="h-4 w-4 mr-2" />
  Podešavanja
</TabsTrigger>

// Option B: Sekcija u ReportsTab
<Card>
  <CardHeader>
    <CardTitle>Radno vreme kuhinje</CardTitle>
  </CardHeader>
  <CardContent>
    <KitchenScheduleSettings />
  </CardContent>
</Card>
```

#### 3.3 Hook: `useKitchenSchedule`

```typescript
// src/hooks/useKitchenSchedule.ts

export function useKitchenSchedule() {
  const fetchWeeklySchedule = async () => { /* ... */ };
  const updateWeeklySchedule = async (schedule: WeeklySchedule[]) => { /* ... */ };
  const fetchExceptions = async () => { /* ... */ };
  const addException = async (exception: Omit<ScheduleException, 'id'>) => { /* ... */ };
  const updateException = async (id: string, exception: Partial<ScheduleException>) => { /* ... */ };
  const deleteException = async (id: string) => { /* ... */ };
  
  return {
    weeklySchedule,
    exceptions,
    loading,
    fetchWeeklySchedule,
    updateWeeklySchedule,
    fetchExceptions,
    addException,
    updateException,
    deleteException
  };
}
```

#### 3.4 Izmene `KioskPickup.tsx`

Dodati novi screen state za potvrdu i logiku timeout-a.

```typescript
type ScreenState = 
  | "input" 
  | "loading" 
  | "success"           // Samo prikaz (kuhinja radi)
  | "confirm"           // NOVO: Potvrda potrebna (kuhinja ne radi)
  | "confirming"        // NOVO: U toku potvrde
  | "confirmed"         // NOVO: Uspešno potvrđeno
  | "error" 
  | "already-served" 
  | "unauthorized";
```

**Novi flow:**

```text
1. Korisnik unese ID
2. showMeal() vraća response
3. Ako confirmationRequired=true:
   a. Prikaži "confirm" screen sa promptom
   b. Dugme "DA, PREUZIMAM" + "ODUSTANI"
   c. Countdown 8 sekundi
   d. Ako istekne → reset bez potvrde
   e. Ako klikne "DA" → pozovi kiosk-confirm-pickup
   f. Ako uspešno → prikaži "confirmed" screen
4. Ako confirmationRequired=false:
   a. Prikaži "success" screen (samo info)
   b. Korisnik preuzima na šalteru
```

**Confirm Screen UI:**

```typescript
{screenState === "confirm" && result && (
  <Card className="w-full max-w-lg border-warning/50">
    <CardContent className="pt-8 pb-8">
      <div className="text-center">
        <AlertCircle className="h-20 w-20 text-warning mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-4">POTVRDA PREUZIMANJA</h1>
        
        <p className="text-xl font-semibold mb-2">{result.fullName}</p>
        <p className="text-lg text-primary mb-6">{result.mealName}</p>
        
        <p className="text-muted-foreground mb-6">
          Potvrđujete preuzimanje obroka?
        </p>

        <div className="flex gap-4">
          <Button variant="outline" onClick={handleReset} className="flex-1 h-14">
            ODUSTANI
          </Button>
          <Button 
            variant="success" 
            onClick={handleConfirmPickup} 
            className="flex-1 h-14"
          >
            DA, PREUZIMAM
          </Button>
        </div>

        <p className="text-sm text-muted-foreground mt-4">
          Automatski odustanak za {countdown}s
        </p>
      </div>
    </CardContent>
  </Card>
)}
```

#### 3.5 Izmene `KioskKitchen.tsx`

Dodati prikaz kada kuhinja ne radi.

```typescript
// U handleServe funkciji:
const handleServe = async (item: QueueItem) => {
  try {
    await kioskApi.confirmPickup(token, item.id); // Nova metoda
    // ... optimistic update ...
  } catch (error) {
    if (error.message.includes("Kuhinja trenutno ne radi")) {
      toast({
        title: "Kuhinja zatvorena",
        description: "Izdavanje obroka nije moguće van radnog vremena.",
        variant: "destructive"
      });
    }
    // ...
  }
};
```

**Opciono: Status indikator u headeru**

```typescript
// Pored ConnectionIndicator
const KitchenStatusIndicator = () => {
  const { kitchenOpen, schedule } = useKitchenStatus();
  
  if (kitchenOpen) {
    return (
      <div className="flex items-center gap-2 text-sm text-success">
        <Store className="h-4 w-4" />
        <span>Radi do {schedule.closeTime}</span>
      </div>
    );
  }
  
  return (
    <div className="flex items-center gap-2 text-sm text-destructive">
      <StoreClosed className="h-4 w-4" />
      <span>Zatvoreno</span>
    </div>
  );
};
```

#### 3.6 Ažuriranje tipova

**Fajl:** `src/types/kiosk.ts`

```typescript
export interface ShowMealResponse {
  found: boolean;
  message?: string;
  fullName?: string;
  mealName?: string;
  pickupRequestId?: string;
  alreadyServed?: boolean;
  error?: string;
  kitchenOpen?: boolean;          // NOVO
  confirmationRequired?: boolean;  // NOVO
}

export interface KitchenStatus {
  isOpen: boolean;
  openTime: string | null;
  closeTime: string | null;
  currentTime: string;
  reason: 'open' | 'exception_closed' | 'weekly_closed' | 'outside_hours';
}
```

#### 3.7 Ažuriranje `kioskApi.ts`

```typescript
export const kioskApi = {
  // ... postojeće metode ...
  
  async confirmPickup(token: string, pickupRequestId: string): Promise<{ success: boolean }> {
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/kiosk-confirm-pickup`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kioskToken: token, pickupRequestId }),
      }
    );

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || "Greška pri potvrdi");
    }
    
    return data;
  },

  async getKitchenStatus(token: string): Promise<KitchenStatus> {
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/kiosk-get-kitchen-status`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kioskToken: token }),
      }
    );

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || "Greška pri učitavanju statusa");
    }
    
    return data;
  }
};
```

---

### Faza 4: Konfiguracija

#### 4.1 Supabase config.toml

```toml
[functions.kiosk-confirm-pickup]
verify_jwt = false

[functions.kiosk-get-kitchen-status]
verify_jwt = false
```

---

### Test scenariji

| # | Scenario | Očekivano ponašanje |
|---|----------|---------------------|
| 1 | Standardni dan 10:00 | `kitchenOpen=true`, Kitchen potvrđuje, Pickup prikazuje info bez confirm |
| 2 | Nedelja 16:00 (raspored 06-14) | `kitchenOpen=false`, Pickup prikazuje confirm prompt, Kitchen dobija 403 |
| 3 | Exception `closed_all_day=true` | `kitchenOpen=false` ceo dan, Pickup potvrđuje |
| 4 | Exception sa custom vremenom (08-12) u 13:00 | `kitchenOpen=false`, Pickup potvrđuje |
| 5 | Pickup confirm timeout (8s) | Reset bez potvrde, korisnik mora ponovo |
| 6 | Kitchen kiosk kad je zatvoren | Toast "Kuhinja zatvorena", akcija blokirana |

---

### Fajlovi za kreiranje/izmenu

| Fajl | Akcija | Opis |
|------|--------|------|
| `supabase/migrations/[ts]_kitchen_schedule.sql` | CREATE | Kreiranje tabela + RLS + seed |
| `supabase/functions/_shared/kitchen-schedule.ts` | CREATE | Helper za proveru statusa |
| `supabase/functions/kiosk-confirm-pickup/index.ts` | CREATE | Nova edge funkcija za potvrdu |
| `supabase/functions/kiosk-get-kitchen-status/index.ts` | CREATE | Opciona funkcija za status |
| `supabase/functions/kiosk-show-meal/index.ts` | UPDATE | Dodati kitchenOpen, confirmationRequired |
| `supabase/functions/kiosk-serve/index.ts` | UPDATE | Dodati proveru kitchenOpen za Kitchen token |
| `supabase/config.toml` | UPDATE | Dodati nove funkcije |
| `src/types/kiosk.ts` | UPDATE | Dodati nove tipove |
| `src/services/kioskApi.ts` | UPDATE | Dodati confirmPickup, getKitchenStatus |
| `src/hooks/useKitchenSchedule.ts` | CREATE | Hook za admin CRUD |
| `src/components/admin/KitchenScheduleSettings.tsx` | CREATE | Admin UI za raspored |
| `src/components/admin/ReportsTab.tsx` | UPDATE | Integracija KitchenScheduleSettings |
| `src/pages/KioskPickup.tsx` | UPDATE | Dodati confirm flow + timeout |
| `src/pages/KioskKitchen.tsx` | UPDATE | Dodati status indikator + error handling |

---

### Redosled implementacije

1. **Migracija baze** - Tabele, RLS, seed
2. **Shared helper** - `_shared/kitchen-schedule.ts`
3. **Edge funkcije** - Update `kiosk-show-meal`, kreiranje `kiosk-confirm-pickup`
4. **Frontend tipovi** - `kiosk.ts`, `kioskApi.ts`
5. **Pickup kiosk** - Confirm flow sa timeout-om
6. **Kitchen kiosk** - Status indikator + error handling
7. **Admin UI** - `KitchenScheduleSettings` komponenta
8. **Testiranje** - Svi scenariji
