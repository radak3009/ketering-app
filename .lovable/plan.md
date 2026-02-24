

## Plan: Fiskalizacija obroka preko Octopos API

### Pregled

Implementirati automatsku fiskalizaciju pri potvrdi preuzimanja obroka. Fiskalizacija se odvija server-side kroz Edge Function, sa cuvanjem fiskalnih podataka i TXT racuna u Supabase Storage. Zaposleni mogu preuzeti fiskalni racun kroz "Tekuca" sekciju.

---

### A. Baza podataka - migracija

Dodati kolone u `pickup_requests`:

```sql
ALTER TABLE pickup_requests
  ADD COLUMN fiscal_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN fiscal_external_id TEXT,
  ADD COLUMN octopos_weborder_id INTEGER,
  ADD COLUMN invoice_number TEXT,
  ADD COLUMN verification_url TEXT,
  ADD COLUMN receipt_text_top TEXT,
  ADD COLUMN receipt_text_bottom TEXT,
  ADD COLUMN receipt_file_path TEXT,
  ADD COLUMN fiscalized_at TIMESTAMPTZ,
  ADD COLUMN fiscal_error TEXT;

ALTER TABLE pickup_requests
  ADD CONSTRAINT unique_fiscal_external_id UNIQUE (fiscal_external_id);
```

Kreirati storage bucket:

```sql
INSERT INTO storage.buckets (id, name, public) VALUES ('receipts', 'receipts', false);

-- RLS: samo service role moze uploadovati, korisnik moze citati svoje
CREATE POLICY "Service role upload"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'receipts');

CREATE POLICY "Users can read own receipts"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'receipts'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
```

Dodati RLS politiku da zaposleni moze da vidi svoj `pickup_requests` red (preko `profile_id`):

```sql
CREATE POLICY "Users can view own pickup requests"
  ON pickup_requests FOR SELECT
  USING (profile_id = auth.uid());
```

Napomena: `pickup_requests.profile_id` se vec koristi i popunjava - treba proveriti da li mapira na `auth.uid()` ili na `profiles.id`. Ako mapira na `profiles.id`, koristicemo subquery.

---

### B. Edge Function 1: `fiscalize-meal`

**Fajl:** `supabase/functions/fiscalize-meal/index.ts`

**Config (config.toml):**
```toml
[functions.fiscalize-meal]
verify_jwt = false
```

Poziva se iz `kiosk-confirm-pickup` i `kiosk-serve` (server-to-server, kiosk token auth). Takodje se moze pozvati iz frontend-a sa JWT auth za "Pokusaj ponovo".

**Koraci:**
1. Primi `pickupId`, opciono `price` (default iz order_items.unit_price)
2. `externalId = "kiosk-" + pickupId`
3. Proveri u `pickup_requests`: ako `invoice_number` vec postoji -> vrati postojece podatke (idempotentno)
4. Postavi `fiscal_status='pending'`, `fiscal_external_id=externalId`
5. Pozovi Octopos `POST {OCTOPOS_BASE_URL}/WebOrder` sa `Authorization: Basic {OCTOPOS_TOKEN}`
6. Na uspeh: sacuvaj fiskalne podatke, generiši TXT, uploaduj u `receipts/{profile_id}/{pickupId}.txt`, postavi `fiscal_status='fiscalized'`
7. Na neuspeh: postavi `fiscal_status='failed'`, `fiscal_error=errors`
8. Nikad ne blokira kiosk flow - uvek vraca HTTP 200

**Payload za Octopos (iz primerka korisnika):**
```json
{
  "ExternalId": "kiosk-{pickupId}",
  "CompanyTaxNumber": "101612478",
  "Items": [{ "Quantity": 1, "ProductCode": "S001", "Price": 260.0 }],
  "Payments": [{ "Amount": 260.0, "FiscalPaymentTypeId": 4 }],
  "FiscalReceiptData": { "ReturnTextualRepresentation": true, "LineWidth": 40 }
}
```

**Mapiranje response-a:**
- `Data.Id` -> `octopos_weborder_id`
- `Data.InvoiceNumber` -> `invoice_number`
- `Data.VerificationUrl` -> `verification_url`
- `Data.TextTop` -> `receipt_text_top`
- `Data.TextBottom` -> `receipt_text_bottom`
- `Data.SdcDateTime` -> `fiscalized_at`

**TXT sadrzaj:**
```
{Data.TextTop}
{Data.TextBottom}

VERIFICATION:
{Data.VerificationUrl}
INVOICE:
{Data.InvoiceNumber}
```

---

### C. Edge Function 2: `receipt-link`

**Fajl:** `supabase/functions/receipt-link/index.ts`

**Config:**
```toml
[functions.receipt-link]
verify_jwt = false
```

**Koraci:**
1. Autentikuj korisnika preko JWT iz Authorization header-a
2. Primi `pickupId` iz query params
3. Proveri da je korisnik vlasnik pickup_request-a (profile_id match)
4. Ako `fiscal_status != 'fiscalized'` ili `receipt_file_path` ne postoji -> vrati `{ url: null }`
5. Generiši signed URL (TTL 300s) za fajl iz `receipts` bucket-a
6. Vrati `{ url }`

---

### D. Integracija u kiosk flow

**Izmene u `kiosk-confirm-pickup/index.ts` i `kiosk-serve/index.ts`:**

Nakon uspesnog `status='served'` update-a, asinhrono pozvati `fiscalize-meal`:
- Dohvati `unit_price` iz `order_items` (ako `order_item_id` postoji)
- Pozovi `fiscalize-meal` sa `fetch()` (fire-and-forget, bez cekanja)
- Ako nema `order_item_id` (rucno dodat obrok), koristi default cenu ili preskoci fiskalizaciju

```typescript
// Fire-and-forget fiscalization
const fiscalizeUrl = `${supabaseUrl}/functions/v1/fiscalize-meal`;
fetch(fiscalizeUrl, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    pickupId: pickupRequestId,
    price: orderItem?.unit_price || 0,
    kioskToken: kioskToken
  })
}).catch(err => console.error("Fiscalize fire-and-forget error:", err));
```

---

### E. Frontend - "Tekuca" sekcija

**Izmene u fajlovima:**

| Fajl | Izmena |
|------|--------|
| `src/hooks/useWeekOrders.ts` | Dodati join na `pickup_requests` preko `order_item_id` da dohvati `fiscal_status` i `pickup_requests.id` |
| `src/types/order.ts` | Prosiriti `OrderItemForWeekView` sa `fiscal_status`, `pickup_request_id` |
| `src/components/employee/MealCard.tsx` | Dodati prikaz fiskalnog statusa i dugme "Preuzmi racun" / "Pokusaj ponovo" |
| `src/services/kioskApi.ts` ili novi servis | Dodati `getReceiptLink(pickupId)` i `retryFiscalize(pickupId)` |

**UI logika u MealCard (ispod statusa preuzimanja):**

```text
Ako pickup_status == 'preuzeto':
  - fiscal_status == 'fiscalized' -> Dugme "Preuzmi racun" (Download ikonica)
  - fiscal_status == 'pending'    -> Text "Fiskalizacija u toku..."
  - fiscal_status == 'failed'     -> Text "Racun nije dostupan" + Dugme "Pokusaj ponovo"
```

"Preuzmi racun" poziva `GET receipt-link?pickupId=...` sa JWT auth, pa otvara signed URL u novom tabu.

"Pokusaj ponovo" poziva `POST fiscalize-meal` sa JWT auth, pa refreshuje status.

**Dohvatanje fiscal_status:**

`useWeekOrders` trenutno dohvata `order_items` sa join na `orders` i `meals`. Treba dodati dohvat `pickup_requests` gde `order_item_id` odgovara. Posto `pickup_requests` nema direktan FK na `order_items` u Supabase types, koristicemo odvojen upit:

```typescript
// Nakon dohvatanja order_items, dohvati fiscal statuse
const orderItemIds = data.map(item => item.id);
const { data: pickups } = await supabase
  .from('pickup_requests')
  .select('id, order_item_id, fiscal_status')
  .in('order_item_id', orderItemIds);
```

Zatim mergujemo u rezultat.

---

### F. Supabase Secrets

Dodati sledece secrets:

| Secret | Vrednost |
|--------|----------|
| `OCTOPOS_BASE_URL` | `https://sandbox.octopos.rs/api` |
| `OCTOPOS_TOKEN` | Token iz prompta (Basic auth) |
| `OCTOPOS_COMPANY_TAX_NUMBER` | `101612478` |
| `OCTOPOS_PRODUCT_CODE_PERSONAL_MEAL` | `S001` |
| `OCTOPOS_FISCAL_PAYMENT_TYPE_ID` | `4` |

---

### G. Idempotency zastita

- `UNIQUE(fiscal_external_id)` na DB nivou spreccava duplikate
- Edge function pre poziva Octopos proverava da li vec postoji `invoice_number`
- Octopos takodje koristi `ExternalId` za svoju internu idempotency

---

### H. Fajlovi za kreiranje/izmenu

| Fajl | Akcija |
|------|--------|
| Nova SQL migracija | Kolone u `pickup_requests` + `receipts` bucket + RLS |
| `supabase/functions/fiscalize-meal/index.ts` | NOVO - glavna fiskalizacija |
| `supabase/functions/receipt-link/index.ts` | NOVO - signed URL za racun |
| `supabase/config.toml` | Dodati obe nove funkcije |
| `supabase/functions/kiosk-confirm-pickup/index.ts` | Dodati fire-and-forget poziv `fiscalize-meal` |
| `supabase/functions/kiosk-serve/index.ts` | Dodati fire-and-forget poziv `fiscalize-meal` |
| `src/hooks/useWeekOrders.ts` | Dohvat fiscal_status iz pickup_requests |
| `src/types/order.ts` | Prosiriti `OrderItemForWeekView` |
| `src/components/employee/MealCard.tsx` | UI za fiskalni status + dugmad |
| `src/integrations/supabase/types.ts` | Auto-regenerise se |

---

### I. Sta se NE menja

- Postojeca logika rezervacija/planiranja obroka
- UI van "Tekuca" sekcije (osim MealCard koji je shared ali prikazuje fiskalizaciju samo kad je `pickup_status == 'preuzeto'`)
- Kiosk flow ostaje neblokiran - fiskalizacija je fire-and-forget

