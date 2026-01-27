

## Plan: Supabase Realtime na Kitchen Kiosku sa Fallback Pollingom

### Pregled

Ovaj plan zamenjuje agresivan polling (svake 2.5s) sa Supabase Realtime WebSocket konekcijom, uz fallback polling (30-60s) kao sigurnosnu mrežu.

---

### Arhitektura rešenja

```text
┌─────────────────────────────────────────────────────────────────────┐
│                        KioskKitchen Component                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐  │
│  │   Realtime      │    │   Fallback      │    │   Connection    │  │
│  │   Subscription  │    │   Polling       │    │   Monitor       │  │
│  │   (primary)     │    │   (safety net)  │    │   (health)      │  │
│  └────────┬────────┘    └────────┬────────┘    └────────┬────────┘  │
│           │                      │                      │           │
│           └──────────────────────┼──────────────────────┘           │
│                                  │                                  │
│                         ┌────────▼────────┐                         │
│                         │    fetchQueue   │                         │
│                         │    (unified)    │                         │
│                         └─────────────────┘                         │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        Supabase Backend                             │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐    ┌─────────────────┐                         │
│  │ pickup_requests │◄───│   Realtime      │                         │
│  │     (table)     │    │   Publication   │                         │
│  └─────────────────┘    └─────────────────┘                         │
└─────────────────────────────────────────────────────────────────────┘
```

---

### Faze implementacije

#### Faza 1: Omogućavanje Realtime-a za `pickup_requests` tabelu

Potrebna je SQL migracija koja dodaje tabelu u Supabase Realtime publikaciju.

**Migracija:**
```sql
-- Enable realtime for pickup_requests table
ALTER PUBLICATION supabase_realtime ADD TABLE pickup_requests;

-- Set REPLICA IDENTITY FULL for complete row data in realtime updates
ALTER TABLE pickup_requests REPLICA IDENTITY FULL;
```

**Zašto `REPLICA IDENTITY FULL`:**
- Omogućava slanje kompletnih podataka reda u realtime event payload-u
- Neophodno za DELETE evente (inače bi dobili samo ID)

---

#### Faza 2: Kreiranje custom hook-a `useKioskRealtime`

Novi hook koji enkapsulira logiku Realtime + Fallback polling.

**Fajl:** `src/hooks/useKioskRealtime.ts`

**Ključne funkcionalnosti:**

1. **Realtime subscription**
   - Pretplata na `pickup_requests` tabelu
   - Filtriranje po `pickup_date = today`
   - Praćenje INSERT, UPDATE, DELETE eventa

2. **Connection health monitoring**
   - Praćenje statusa konekcije (`SUBSCRIBED`, `CHANNEL_ERROR`, `TIMED_OUT`)
   - Automatski reconnect pri prekidu

3. **Fallback polling**
   - Interval: 45 sekundi (kompromis između 30s i 60s)
   - Aktivira se uvek kao "safety net"
   - Ne interferira sa realtime update-ima

4. **Visibility API integration**
   - Detekcija kada je tab/app "asleep"
   - Force fetch kada se vraća u fokus

**Struktura hook-a:**

```typescript
interface UseKioskRealtimeOptions {
  token: string;
  onAuthError?: () => void;
}

interface UseKioskRealtimeReturn {
  pending: QueueItem[];
  served: QueueItem[];
  loading: boolean;
  connectionStatus: 'connected' | 'connecting' | 'disconnected';
  lastUpdate: Date | null;
  refetch: () => Promise<void>;
}
```

**Logika:**

```text
1. Initial fetch
   └─► fetchQueue() → setPending/setServed

2. Setup Realtime channel
   └─► supabase.channel('kiosk-kitchen-realtime')
       └─► .on('postgres_changes', {
             event: '*',
             schema: 'public',
             table: 'pickup_requests',
             filter: `pickup_date=eq.${today}`
           })
       └─► Handle events:
           ├─► INSERT: Append to pending (if status='pending')
           ├─► UPDATE: Move between lists based on status
           └─► DELETE: Remove from both lists

3. Monitor connection status
   └─► .subscribe((status) => {
         'SUBSCRIBED' → setConnected(true)
         'CHANNEL_ERROR' → setConnected(false), retry
         'TIMED_OUT' → setConnected(false), retry
       })

4. Fallback polling (45s interval)
   └─► Runs independently
   └─► Skipped during active processing (isProcessing flag)

5. Visibility change listener
   └─► document.addEventListener('visibilitychange')
   └─► If visible && wasHidden > 5s → fetchQueue()
```

---

#### Faza 3: Integracija u KioskKitchen komponentu

**Fajl:** `src/pages/KioskKitchen.tsx`

**Izmene:**

1. **Zamena direktnog polling-a sa hook-om**
   - Uklanjanje postojećeg 2.5s polling interval-a
   - Korišćenje `useKioskRealtime` hook-a

2. **Optimistic updates ostaju**
   - Trenutni optimistic update pattern se zadržava
   - Realtime event će potvrditi/korigovati UI state

3. **Prikaz connection status-a**
   - Vizuelni indikator kada je WebSocket prekinut
   - Korisnik zna da fallback polling radi

4. **Pauziranje polling-a tokom procesiranja**
   - Ista logika kao sada: `isProcessing` flag
   - Sprečava race conditions

**Novi UI element:**

```text
┌───────────────────────────────────────────┐
│ 🟢 Povezano u realnom vremenu             │  ← Realtime aktivan
│ 🟡 Sinhronizacija... (polling)            │  ← Fallback mode
│ 🔴 Nije povezano - pokušaj ponovnog...    │  ← Potpuni prekid
└───────────────────────────────────────────┘
```

---

### Tehnički detalji

#### Supabase Realtime filter

```typescript
.on('postgres_changes', {
  event: '*',
  schema: 'public',
  table: 'pickup_requests',
  filter: `pickup_date=eq.${today}`  // Filter za današnji datum
}, handleChange)
```

#### Event handling logika

| Event Type | Payload | Akcija |
|------------|---------|--------|
| INSERT | new record | Dodaj u `pending` ako status='pending' |
| UPDATE | old → new | Premesti između `pending`/`served` |
| DELETE | old record | Ukloni iz obe liste |

#### Debouncing

```typescript
// Sprečava višestruke fetch-ove za rapid-fire evente
const debouncedFetch = useMemo(() => 
  debounce(() => fetchQueue(), 300), 
[fetchQueue]);
```

#### Visibility API

```typescript
useEffect(() => {
  let hiddenAt: number | null = null;
  
  const handleVisibility = () => {
    if (document.hidden) {
      hiddenAt = Date.now();
    } else if (hiddenAt && Date.now() - hiddenAt > 5000) {
      // App was hidden for 5+ seconds, force refresh
      fetchQueue();
    }
  };
  
  document.addEventListener('visibilitychange', handleVisibility);
  return () => document.removeEventListener('visibilitychange', handleVisibility);
}, [fetchQueue]);
```

---

### Fajlovi za izmenu

| Fajl | Akcija | Opis |
|------|--------|------|
| `supabase/migrations/[timestamp].sql` | CREATE | Omogući realtime za pickup_requests |
| `src/hooks/useKioskRealtime.ts` | CREATE | Novi hook za realtime + fallback |
| `src/pages/KioskKitchen.tsx` | UPDATE | Integracija hook-a, uklanjanje starog pollinga |

---

### Prednosti

| Aspekt | Pre (polling 2.5s) | Posle (realtime + fallback) |
|--------|-------------------|----------------------------|
| Latencija | 0-2.5s | ~100-300ms |
| Network requests | ~24/min | ~1-2/min + WebSocket |
| Battery drain | Visok | Nizak |
| Vizuelno bljeskanje | Moguće | Eliminisano |
| Offline resilience | Nema | Fallback aktivan |

---

### Rizici i mitigacije

| Rizik | Mitigacija |
|-------|------------|
| WebSocket prekid | Fallback polling preuzima |
| Propušten event | 45s polling kao backup |
| Tab "asleep" | Visibility API force refresh |
| Race condition | isProcessing flag pauzira sve |
| Memory leak | Proper cleanup u useEffect return |

---

### Testiranje

1. **Realtime funkcionisanje**
   - Otvoriti dva browser taba
   - Na Employee kiosku uneti ID → videti instant update na Kitchen kiosku

2. **Fallback aktivacija**
   - Onemogućiti WebSocket (DevTools → Network throttle)
   - Verifikovati da polling preuzima nakon 45s

3. **Visibility recovery**
   - Prebaciti na drugi tab 10+ sekundi
   - Vratiti se → verifikovati instant refresh

4. **Optimistic updates**
   - Kliknuti "Izdato" → UI odmah reaguje
   - Realtime potvrđuje bez bljeskanja

