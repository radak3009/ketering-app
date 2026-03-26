## Plan: Automatska fiskalizacija nepreuzetih obroka

### Pregled

Kreirati Edge funkciju koja se pokreće svakog dana u 23:30 i automatski fiskalizuje sve obroke koji su poručeni za taj dan ali nisu preuzeti. Na Employee panelu, status ostaje "Nije preuzet" ali se prikazuje dugme za preuzimanje fiskalnog računa.

### Izmene

#### 1. Nova Edge funkcija: `supabase/functions/fiscalize-undelivered/index.ts`

- Pronalazi sve `order_items` za današnji `delivery_date` sa `pickup_status = 'nije_preuzeto'`
- Za svaki takav order_item proverava da li već postoji `pickup_request` — ako da, preskače
- Kreira novi `pickup_request` zapis sa:
  - `status: 'not_picked_up'`, `served_by: 'auto-fiscal'`, `served_at: now()`
  - `fiscal_status: 'pending'`
  - Podaci o korisniku iz `profiles` tabele
- Poziva `fiscalize-meal` za svaki kreirani pickup_request
- Autentifikacija: koristi `KIOSK_TOKEN_KITCHEN` (bez JWT-a, cron poziv)

#### 2. Cron job (pg_cron) — SQL insert

```sql
select cron.schedule(
  'fiscalize-undelivered-daily',
  '30 23 * * *',
  $$ select net.http_post(
    url:='https://qqrvezuesxaappslfvrh.supabase.co/functions/v1/fiscalize-undelivered',
    headers:='{"Content-Type":"application/json","Authorization":"Bearer <anon_key>"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id; $$
);
```

#### 3. `supabase/config.toml` — dodati novu funkciju

```toml
[functions.fiscalize-undelivered]
verify_jwt = false
```

#### 4. `src/components/employee/MealCard.tsx` — prikazivanje računa za nepreuzete obroke

Trenutno (linija 155): fiskalni status se prikazuje samo kada je `pickup_status === 'preuzeto'`.

Promena: prikazivati sekciju fiskalnog računa i kada je `pickup_status === 'nije_preuzeto'` ali postoji `fiscal_status === 'fiscalized'` i `pickup_request_id`. Dugme "Preuzmi račun" se prikazuje bez obzira na pickup status. 

Nova logika:

```tsx
{/* Fiscal receipt - show for picked up OR auto-fiscalized */}
{item.fiscal_status && (item.pickup_status === 'preuzeto' || item.fiscal_status === 'fiscalized' || item.fiscal_status === 'pending' || item.fiscal_status === 'failed') && (
  <div className="pt-2 border-t mt-2">
    {/* existing fiscal status UI */}
  </div>
)}
```

### Fajlovi za izmenu/kreiranje


| Fajl                                                | Akcija                                 |
| --------------------------------------------------- | -------------------------------------- |
| `supabase/functions/fiscalize-undelivered/index.ts` | Kreirati — nova Edge funkcija          |
| `supabase/config.toml`                              | Dodati konfiguraciju za novu funkciju  |
| `src/components/employee/MealCard.tsx`              | Prikazati račun i za nepreuzete obroke |
| SQL (pg_cron)                                       | Kreirati cron job za 23:30 svaki dan   |
