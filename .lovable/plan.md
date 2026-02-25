

## Plan: PDF fiskalni racun sa QR kodom i cleanup-om footer-a

### Pregled

Zameniti TXT generisanje u `fiscalize-meal` edge funkciji sa PDF generisanjem koriscenjem `pdf-lib`. Dodati cleanup logiku za uklanjanje Octopos footer-a ("SALES COMPANY DATA", ASCII art). Generisati QR kod za VerificationUrl i embedovati ga u PDF. Koristiti font sa podrskom za cirilicu (DejaVu Sans Mono, fetch sa CDN-a).

---

### Tehnicka resenja

**PDF biblioteka**: `pdf-lib` (dostupna via `esm.sh`, radi u Deno)

**QR kod**: `qrcode` npm biblioteka via `esm.sh` - generise QR kao PNG data URL, pa se embedduje u PDF kao slika

**Font sa cirilicom**: DejaVu Sans Mono TTF, fetch sa javnog CDN-a (`cdn.jsdelivr.net`) pri svakom pozivu. pdf-lib ga embeduje u PDF. Font je ~300KB i kesira se u memoriji tokom zivota edge function instance.

---

### A. Izmene u `supabase/functions/fiscalize-meal/index.ts`

#### 1. Novi importi

```typescript
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";
import QRCode from "https://esm.sh/qrcode@1.5.4";
```

#### 2. Helper funkcije

Dodati `stripUnwantedFooter` pored postojeceg `normalizeText`:

```typescript
function stripUnwantedFooter(textBottom: string): string {
  const lines = normalizeText(textBottom).split("\n");
  const idx = lines.findIndex(l => l.trim() === "SALES COMPANY DATA");
  const trimmed = idx >= 0 ? lines.slice(0, idx) : lines;
  const filtered = trimmed.filter(l => !l.includes("@"));
  while (filtered.length && filtered[filtered.length - 1].trim() === "") filtered.pop();
  return filtered.join("\n");
}
```

#### 3. PDF generisanje (zamena za TXT)

Umesto generisanja `receiptContent` stringa i upload-a kao TXT:

```text
1. Kreiraj PDFDocument
2. Fetch DejaVu Sans Mono TTF sa CDN-a
3. Embeduj font u PDF
4. Dodaj stranicu (sirina ~226pt = ~80mm termalni slip)
5. Renderuj cleanTop liniju po liniju monospaced fontom (8pt)
6. Renderuj cleanBottom (ociscen od footer-a)
7. Dodaj razdelnu liniju
8. Dodaj "INVOICE: {invoiceNumber}"
9. Generisi QR kod kao PNG putem qrcode.toDataURL()
10. Embeduj QR PNG u PDF (100x100pt)
11. Opciono dodaj plain text verification URL ispod QR-a
12. Sacuvaj PDF kao Uint8Array
```

#### 4. Storage upload

```typescript
storagePath = `${profile.user_id}/${pickupId}.pdf`  // .pdf umesto .txt
contentType: "application/pdf"
```

#### 5. Fallback logika

Ako PDF generisanje ne uspe (font fetch error, pdf-lib greska), loguj gresku ali i dalje sacuvaj fiskalne podatke u DB. Fiskalizacija ne sme biti blokirana zbog PDF-a.

---

### B. Fajlovi za izmenu

| Fajl | Akcija |
|------|--------|
| `supabase/functions/fiscalize-meal/index.ts` | Glavne izmene: importi, stripUnwantedFooter, PDF generisanje, .pdf path |

### C. Fajlovi koji se NE menjaju

| Fajl | Razlog |
|------|--------|
| `supabase/functions/receipt-link/index.ts` | Vec vraca signed URL za bilo koji fajl iz `receipt_file_path` - radi i za PDF |
| `src/components/employee/MealCard.tsx` | `window.open(url, '_blank')` radi i za PDF - browser ga prikazuje nativno |
| Baza podataka | Nema promena schema-e |

### D. Rizici i mitigacija

| Rizik | Mitigacija |
|-------|-----------|
| Font fetch moze biti spor/nedostupan | Fallback: sacuvaj fiskalne podatke bez PDF-a, loguj gresku |
| pdf-lib ili qrcode verzija ne radi u Deno | Testirani su u Deno okruzenju; koristimo esm.sh koji transpiluje za Deno |
| Veliki PDF | Slip je mali (1 stranica, ~50KB sa QR-om), nema rizika |
| Stari .txt fajlovi u bucket-u | `receipt-link` koristi `receipt_file_path` iz DB-a - stari fajlovi i dalje rade |

