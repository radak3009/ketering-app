
## Plan: Implementacija "Meal Pickup" Kiosk Sistema

### Opis
Kompletna implementacija sistema za preuzimanje obroka sa dva kiosk ekrana (ulaz u kantinu i kuhinja), novom tabelom za queue, i 5 edge funkcija za kiosk operacije.

---

### 1. Baza podataka: Nova tabela `pickup_requests`

#### SQL Migracija

```sql
-- Kreiranje tabele pickup_requests
CREATE TABLE public.pickup_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  pickup_date date NOT NULL,
  employee_identifier text NOT NULL,
  company_id uuid NULL,
  profile_id uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  order_id uuid NULL REFERENCES public.orders(id) ON DELETE SET NULL,
  order_item_id uuid NULL REFERENCES public.order_items(id) ON DELETE SET NULL,
  meal_name_snapshot text NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'served')),
  served_at timestamptz NULL,
  served_by text NULL,
  note text NULL
);

-- Indeksi za performanse
CREATE INDEX idx_pickup_requests_date_status_created 
  ON public.pickup_requests(pickup_date, status, created_at);
CREATE INDEX idx_pickup_requests_date_created 
  ON public.pickup_requests(pickup_date, created_at);
CREATE INDEX idx_pickup_requests_order_item 
  ON public.pickup_requests(order_item_id, pickup_date, status);

-- RLS - zabrani direktan pristup anonimnim korisnicima
ALTER TABLE public.pickup_requests ENABLE ROW LEVEL SECURITY;

-- Samo admini mogu direktno pristupiti (za debug)
CREATE POLICY "Admins can view all pickup_requests"
  ON public.pickup_requests FOR SELECT
  USING (public.is_admin_user(auth.uid()));

-- Blokiraj sve ostale operacije za obične korisnike
-- (Edge functions koriste service role)
```

---

### 2. Supabase Secrets: Kiosk Tokeni

Potrebno je dodati dva nova secret-a:

| Secret Name | Opis |
|-------------|------|
| `KIOSK_TOKEN_EMPLOYEE` | Token za employee kiosk (ulaz u kantinu) |
| `KIOSK_TOKEN_KITCHEN` | Token za kitchen kiosk (kuhinja) |

Vrednosti tokena mogu biti nasumični UUID-ovi ili dugački alfanumerički stringovi.

---

### 3. Edge Functions (5 funkcija)

#### 3.1 `kiosk-show-meal`

**Lokacija:** `supabase/functions/kiosk-show-meal/index.ts`

**Input:** `{ kioskToken, company_card_id }`

**Logika:**
1. Validiraj `kioskToken` == `KIOSK_TOKEN_EMPLOYEE`
2. Pronađi profil po `company_card_id`
3. Pronađi današnju porudžbinu (`orders.delivery_date = today`)
4. Spoji sa `meals` da dobiješ naziv
5. **Dedupe provera:**
   - Ako postoji `pending` za isti `order_item_id` kreiran u poslednjih 2 min → vrati postojeći
   - Ako je već `served` za isti `order_item_id` danas → vrati "Već preuzeto"
6. Insert u `pickup_requests` sa statusom `pending`
7. Vrati `{ found, fullName, mealName, pickupRequestId }`

```typescript
// Struktura odgovora
interface ShowMealResponse {
  found: boolean;
  message?: string;
  fullName?: string;
  mealName?: string;
  pickupRequestId?: string;
  alreadyServed?: boolean;
}
```

#### 3.2 `kiosk-get-queue`

**Lokacija:** `supabase/functions/kiosk-get-queue/index.ts`

**Input:** `{ kioskToken, date? }`

**Logika:**
1. Validiraj `kioskToken` == `KIOSK_TOKEN_KITCHEN`
2. Query `pickup_requests` za datum (default today)
3. Vrati:
   - `pending`: ORDER BY `created_at` ASC
   - `served`: ORDER BY `served_at` DESC
4. Za svaki item, join sa `profiles` za `full_name`

```typescript
interface QueueItem {
  id: string;
  created_at: string;
  employee_identifier: string;
  fullName: string | null;
  meal_name_snapshot: string | null;
  status: 'pending' | 'served';
  served_at: string | null;
}

interface GetQueueResponse {
  pending: QueueItem[];
  served: QueueItem[];
}
```

#### 3.3 `kiosk-serve`

**Lokacija:** `supabase/functions/kiosk-serve/index.ts`

**Input:** `{ kioskToken, pickupRequestId }`

**Logika:**
1. Validiraj `kioskToken` == `KIOSK_TOKEN_KITCHEN`
2. Update `pickup_requests` SET `status='served'`, `served_at=now()`
3. Opciono: Update `order_items.pickup_status = 'preuzeto'`

#### 3.4 `kiosk-undo`

**Lokacija:** `supabase/functions/kiosk-undo/index.ts`

**Input:** `{ kioskToken, pickupRequestId }`

**Logika:**
1. Validiraj `kioskToken` == `KIOSK_TOKEN_KITCHEN`
2. Update `pickup_requests` SET `status='pending'`, `served_at=NULL`
3. Opciono: Update `order_items.pickup_status = 'nije_preuzeto'`

#### 3.5 `kiosk-delete`

**Lokacija:** `supabase/functions/kiosk-delete/index.ts`

**Input:** `{ kioskToken, pickupRequestId }`

**Logika:**
1. Validiraj `kioskToken` == `KIOSK_TOKEN_KITCHEN`
2. DELETE from `pickup_requests` WHERE `id = pickupRequestId`

#### Config.toml Update

```toml
[functions.kiosk-show-meal]
verify_jwt = false

[functions.kiosk-get-queue]
verify_jwt = false

[functions.kiosk-serve]
verify_jwt = false

[functions.kiosk-undo]
verify_jwt = false

[functions.kiosk-delete]
verify_jwt = false
```

---

### 4. Frontend: Kiosk Servis

**Lokacija:** `src/services/kioskApi.ts`

```typescript
const SUPABASE_URL = "https://qqrvezuesxaappslfvrh.supabase.co";

export const kioskApi = {
  async showMeal(token: string, company_card_id: string) {
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/kiosk-show-meal`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kioskToken: token, company_card_id })
      }
    );
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Greška');
    }
    return response.json();
  },
  
  async getQueue(token: string, date?: string) { /* ... */ },
  async serve(token: string, pickupRequestId: string) { /* ... */ },
  async undo(token: string, pickupRequestId: string) { /* ... */ },
  async delete(token: string, pickupRequestId: string) { /* ... */ }
};
```

---

### 5. Frontend: Nove Stranice

#### 5.1 `src/pages/KioskPickup.tsx` (Employee Kiosk)

**URL:** `/kiosk/pickup?t=<KIOSK_TOKEN_EMPLOYEE>`

**UI Flow:**

```
┌─────────────────────────────────────────────────────────────┐
│                    🍽️ KETERING                              │
│                                                             │
│              ┌───────────────────────────┐                  │
│              │     UNESI SVOJ ID         │                  │
│              │  ┌─────────────────────┐  │                  │
│              │  │                     │  │                  │
│              │  └─────────────────────┘  │                  │
│              │                           │                  │
│              │   [  PRIKAŽI OBROK  ]     │                  │
│              └───────────────────────────┘                  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼ (uspešno)
┌─────────────────────────────────────────────────────────────┐
│                    ✅ OBROK PRONAĐEN                        │
│                                                             │
│                    Marko Marković                           │
│                                                             │
│           Današnji obrok: Pileći file sa povrćem           │
│                                                             │
│                    [ ZATVORI ]                              │
│                                                             │
│              Automatsko zatvaranje za 8s                    │
└─────────────────────────────────────────────────────────────┘
```

**Funkcionalnosti:**
- Veliki input za ID (optimizovan za dodir)
- Auto-focus na input
- Loading state tokom API poziva
- Error prikaz (npr. "Nema porudžbine za danas")
- Success ekran sa timeout-om od 8 sekundi
- Auto-reset na početni ekran

#### 5.2 `src/pages/KioskKitchen.tsx` (Kitchen Kiosk)

**URL:** `/kiosk/kitchen?t=<KIOSK_TOKEN_KITCHEN>`

**UI Flow:**

```
┌─────────────────────────────────────────────────────────────┐
│  🍳 KUHINJA                          Danas: 26.01.2026.    │
├─────────────────────────────────────────────────────────────┤
│  [ Za izdavanje ]  [ Izdato danas (15) ]                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 12345 │ Marko Marković │ Pileći file    │ 09:15  ✅ │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 67890 │ Ana Anić       │ Veganska salata│ 09:16  ✅ │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 11111 │ Petar Petrović │ Pasta Carbonara│ 09:17  ✅ │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Tab "Izdato danas":**
```
┌─────────────────────────────────────────────────────────────┐
│  [ Za izdavanje (3) ]  [ Izdato danas ]                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 54321 │ Jovana Jovanović │ Pileći file │ 09:05 ↩️ 🗑️ │  │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 99999 │ Milan Milanović  │ Riba na žaru │ 09:02 ↩️ 🗑️ │  │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Funkcionalnosti:**
- Dva taba: "Za izdavanje" i "Izdato danas"
- Polling svakih 2-3 sekunde za osvežavanje
- Optimistički UI update pri kliku na dugme
- Confirm dijalog za brisanje
- Veliki touch-friendly elementi
- Broj itema u tab badge-u

---

### 6. Routing Update

**Lokacija:** `src/App.tsx`

```typescript
// Lazy load kiosk pages
const KioskPickup = lazy(() => import("./pages/KioskPickup"));
const KioskKitchen = lazy(() => import("./pages/KioskKitchen"));

// U Routes komponenti, IZVAN AuthProvider-a za kiosk rute
<Routes>
  <Route path="/" element={<Index />} />
  <Route path="/auth" element={<Auth />} />
  <Route path="/kiosk/pickup" element={<KioskPickup />} />
  <Route path="/kiosk/kitchen" element={<KioskKitchen />} />
  <Route path="*" element={<NotFound />} />
</Routes>
```

---

### 7. Admin Panel: Kiosk Paneli Kartica

**Lokacija:** `src/components/admin/ReportsTab.tsx`

Dodati novu karticu sa linkovima do kiosk panela:

```tsx
<Card>
  <CardHeader>
    <CardTitle>Kiosk paneli</CardTitle>
    <CardDescription>Pristup kiosk ekranima za preuzimanje obroka</CardDescription>
  </CardHeader>
  <CardContent className="space-y-4">
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between p-3 border rounded-lg">
        <div>
          <p className="font-medium">Kiosk - Ulaz u kantinu</p>
          <p className="text-sm text-muted-foreground">
            Za zaposlene da prikažu današnji obrok
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <a href="/kiosk/pickup?t=TOKEN" target="_blank">
            <ExternalLink className="h-4 w-4 mr-2" />
            Otvori
          </a>
        </Button>
      </div>
      
      <div className="flex items-center justify-between p-3 border rounded-lg">
        <div>
          <p className="font-medium">Kiosk - Kuhinja</p>
          <p className="text-sm text-muted-foreground">
            Za kuhinjsko osoblje da izdaju obroke
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <a href="/kiosk/kitchen?t=TOKEN" target="_blank">
            <ExternalLink className="h-4 w-4 mr-2" />
            Otvori
          </a>
        </Button>
      </div>
    </div>
    
    <div className="text-xs text-muted-foreground mt-4 p-3 bg-muted rounded-lg">
      💡 Linkovi sadrže sigurnosne tokene. Koristite Full Screen (F11) 
      za kiosk mod na tabletima.
    </div>
  </CardContent>
</Card>
```

---

### 8. Tipovi

**Lokacija:** `src/types/kiosk.ts`

```typescript
export interface PickupRequest {
  id: string;
  created_at: string;
  pickup_date: string;
  employee_identifier: string;
  profile_id: string | null;
  order_id: string | null;
  order_item_id: string | null;
  meal_name_snapshot: string | null;
  status: 'pending' | 'served';
  served_at: string | null;
}

export interface QueueItem {
  id: string;
  created_at: string;
  employee_identifier: string;
  fullName: string | null;
  meal_name_snapshot: string | null;
  status: 'pending' | 'served';
  served_at: string | null;
}

export interface ShowMealResponse {
  found: boolean;
  message?: string;
  fullName?: string;
  mealName?: string;
  pickupRequestId?: string;
  alreadyServed?: boolean;
}

export interface GetQueueResponse {
  pending: QueueItem[];
  served: QueueItem[];
}
```

---

### 9. Dijagram arhitekture

```
┌──────────────────┐    ┌──────────────────┐
│ Employee Kiosk   │    │  Kitchen Kiosk   │
│ /kiosk/pickup    │    │  /kiosk/kitchen  │
└────────┬─────────┘    └────────┬─────────┘
         │                       │
         │ ?t=EMPLOYEE_TOKEN     │ ?t=KITCHEN_TOKEN
         │                       │
         ▼                       ▼
┌─────────────────────────────────────────────┐
│           Supabase Edge Functions           │
│  ┌─────────────┐  ┌─────────────────────┐  │
│  │kiosk-show-  │  │  kiosk-get-queue    │  │
│  │   meal      │  │  kiosk-serve        │  │
│  └──────┬──────┘  │  kiosk-undo         │  │
│         │         │  kiosk-delete       │  │
│         │         └──────────┬──────────┘  │
└─────────┼────────────────────┼─────────────┘
          │                    │
          │ SERVICE_ROLE_KEY   │
          ▼                    ▼
┌─────────────────────────────────────────────┐
│              Supabase Database              │
│  ┌─────────────────────────────────────┐   │
│  │         pickup_requests             │   │
│  │  - id, pickup_date, status          │   │
│  │  - employee_identifier              │   │
│  │  - meal_name_snapshot               │   │
│  │  - served_at, created_at            │   │
│  └─────────────────────────────────────┘   │
│                     ▲                       │
│                     │ FK                    │
│  ┌─────────┐  ┌─────┴───┐  ┌───────────┐   │
│  │profiles │  │orders   │  │order_items│   │
│  └─────────┘  └─────────┘  └───────────┘   │
└─────────────────────────────────────────────┘
```

---

### 10. Fajlovi za kreiranje/izmenu

| Fajl | Akcija | Opis |
|------|--------|------|
| `supabase/migrations/XXXXXX_create_pickup_requests.sql` | Kreirati | Nova tabela + indeksi + RLS |
| `supabase/functions/kiosk-show-meal/index.ts` | Kreirati | Employee kiosk API |
| `supabase/functions/kiosk-get-queue/index.ts` | Kreirati | Kitchen queue API |
| `supabase/functions/kiosk-serve/index.ts` | Kreirati | Označi kao izdato |
| `supabase/functions/kiosk-undo/index.ts` | Kreirati | Poništi izdavanje |
| `supabase/functions/kiosk-delete/index.ts` | Kreirati | Obriši zapis |
| `supabase/config.toml` | Izmeniti | Dodati 5 novih funkcija |
| `src/services/kioskApi.ts` | Kreirati | Frontend API servis |
| `src/types/kiosk.ts` | Kreirati | TypeScript tipovi |
| `src/pages/KioskPickup.tsx` | Kreirati | Employee kiosk UI |
| `src/pages/KioskKitchen.tsx` | Kreirati | Kitchen kiosk UI |
| `src/App.tsx` | Izmeniti | Dodati kiosk rute |
| `src/components/admin/ReportsTab.tsx` | Izmeniti | Dodati Kiosk paneli karticu |

---

### 11. Potrebni Secrets

Pre implementacije potrebno je dodati dva nova secret-a u Supabase:

1. **KIOSK_TOKEN_EMPLOYEE** - Token za pristup employee kiosku
2. **KIOSK_TOKEN_KITCHEN** - Token za pristup kitchen kiosku

Preporučene vrednosti: Nasumični UUID-ovi ili 32+ karaktera alfanumerički stringovi.
