

## Plan: Centriranje tekstualnog bloka u PDF računu

### Izmena: `supabase/functions/fiscalize-meal/index.ts` (linije 91-104)

Zameniti fiksni `x: margin` sa dinamički izračunatim `startX` koji centrira ceo blok:

1. Pre petlje, izračunati širinu najduže linije koristeći `font.widthOfTextAtSize(line, fontSize)`
2. Izračunati `startX = Math.max(0, (pageWidth - maxLineWidth) / 2)`
3. Sve linije renderovati sa istim `x: startX`
4. Ukloniti `maxWidth` constraint jer više nije potreban (blok je već centriran)
5. QR kod ostaje nepromenjen

```typescript
// Render text lines
const maxLineWidth = Math.max(
  ...allLines.filter(l => l.trim()).map(l => font.widthOfTextAtSize(l, fontSize))
);
const startX = Math.max(0, (pageWidth - maxLineWidth) / 2);

for (const line of allLines) {
  y -= lineHeight;
  if (line.trim()) {
    page.drawText(line, {
      x: startX,
      y,
      size: fontSize,
      font,
      color: rgb(0, 0, 0),
    });
  }
}
```

### Redeploy
Edge funkcija se automatski deployuje nakon izmene.

