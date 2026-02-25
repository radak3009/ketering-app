

## Plan: Ispravka encoding-a i formatiranja TXT fiskalnog racuna

### Pregled

Izmeniti samo deo `fiscalize-meal` edge funkcije koji generise i uploaduje TXT fajl. Dodati helper za normalizaciju line break-ova, UTF-8 BOM marker, i ispravan charset u content type.

### Izmene u `supabase/functions/fiscalize-meal/index.ts`

#### 1. Dodati helper funkciju (pre `Deno.serve`)

```typescript
function normalizeText(input: string | null | undefined): string {
  if (!input) return "";
  return input.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trimEnd();
}
```

#### 2. Zameniti generisanje `receiptContent` (linije 162-173)

Stari kod:
```typescript
const receiptContent = [
  data.TextTop || "",
  data.TextBottom || "",
  "",
  "VERIFICATION:",
  data.VerificationUrl || "",
  "INVOICE:",
  data.InvoiceNumber || "",
  "",
].join("\n");
```

Novi kod:
```typescript
const textTop = normalizeText(data.TextTop);
const textBottom = normalizeText(data.TextBottom);
const receiptBody = [
  textTop,
  textBottom,
  "",
  "----------------------------------------",
  "VERIFICATION:",
  data.VerificationUrl || "",
  "",
  "INVOICE:",
  data.InvoiceNumber || "",
  "",
].join("\n");
const receiptContent = "\uFEFF" + receiptBody;
```

#### 3. Ispraviti content type u upload-u (linija 192)

Staro: `contentType: "text/plain"`
Novo: `contentType: "text/plain; charset=utf-8"`

### Fajlovi za izmenu

| Fajl | Izmena |
|------|--------|
| `supabase/functions/fiscalize-meal/index.ts` | Helper funkcija + BOM + charset + formatiranje |

### Sta se NE menja

- Auth logika
- Octopos API poziv i parsiranje response-a
- Idempotency provera
- DB update fiskalnih podataka
- Ostatak kiosk flow-a

