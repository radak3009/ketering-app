

## Plan: Pomeriti QR kod iznad TextBottom sekcije

### Izmena: `supabase/functions/fiscalize-meal/index.ts`

**Trenutno stanje:** Tekst se renderuje kao jedan blok (cleanTop + cleanBottom + separator + invoice), pa QR na kraju.

**Novo stanje:** cleanTop → QR kod → cleanBottom + separator + invoice

#### 1. Razdvojiti linije na dva bloka (linije 57-63)

```typescript
const topLines: string[] = [];
if (cleanTop) topLines.push(...cleanTop.split("\n"));

const bottomLines: string[] = [];
if (cleanBottom) bottomLines.push(...cleanBottom.split("\n"));
bottomLines.push("", "----------------------------------------");
if (invoiceNumber) bottomLines.push(`INVOICE: ${invoiceNumber}`);
bottomLines.push("");

const allLines = [...topLines, ...bottomLines];
```

#### 2. Ažurirati renderovanje (linije 90-121)

Umesto jednog prolaza, renderovati u tri faze:
1. Renderuj `topLines` sa centiranim startX (računaj maxLineWidth iz svih linija)
2. Embed QR kod (centriran)
3. Renderuj `bottomLines` sa istim startX

#### 3. Redeploy edge funkcije

