

## Plan: Mobilni prikaz porudžbina — zamena pivot tabela karticama

### Problem
Pivot tabele sa 7+ kolona su inherentno nepregledne na mobilnim ekranima (390px). Podaci izlaze van okvira čak i sa `overflow-x-auto`.

### Rešenje
Na mobilnim ekranima (`< 768px`) prikazati **accordion/kartični prikaz** umesto pivot tabela. Desktop zadržava postojeće tabele.

#### Mobilni prikaz "Po obrocima"
Accordion lista gde je svaki obrok jedna stavka. Klikom se otvara lista dana sa brojem porudžbina. Na dnu — ukupan zbir.

```text
┌─────────────────────────┐
│ ▶ Ćufte u sosu (I, II)  │  Total: 45
├─────────────────────────┤
│ ▶ Pasta arabiata (I)    │  Total: 32
├─────────────────────────┤
│ ▼ Carska proja (I)      │  Total: 28
│   Ponedeljak: 5         │
│   Utorak: 8             │
│   Sreda: 3              │
│   ...                   │
├─────────────────────────┤
│ Ukupno: 105             │
└─────────────────────────┘
```

#### Mobilni prikaz "Po korisnicima"
Kartice sa imenom korisnika, ID karticom, i listom dana sa obrocima.

```text
┌─────────────────────────┐
│ Petar Petrović  ID: 228 │
│ Pon: Ćufte (I)          │
│ Uto: Pasta (II)         │
│ Total: 2                │
├─────────────────────────┤
│ Marko Marković  ID: 176 │
│ Pon: Proja (I)          │
│ Total: 1                │
└─────────────────────────┘
```

#### Mobilni prikaz "Lista"
Kartice umesto tabele sa redovima — ime, ID, datum, obrok, smena, i akciona dugmad.

### Izmene

#### 1. `src/components/admin/OrderPivotTable.tsx`
- Dodati `useIsMobile()` hook
- Na mobilnom: renderovati Accordion komponentu (iz shadcn) sa obrocima kao stavkama
- Svaka stavka prikazuje dane sa količinama i total
- CSV dugme ostaje
- Desktop: bez promena

#### 2. `src/components/admin/UserOrderPivotTable.tsx`
- Dodati `useIsMobile()` hook
- Na mobilnom: renderovati kartice (Card) za svakog korisnika sa listom dana/obroka
- Paginacija ostaje
- Desktop: bez promena

#### 3. `src/components/admin/OrdersOverview.tsx`
- Lista prikaz: na mobilnom koristiti kartice umesto tabele
- Svaka kartica prikazuje korisnika, datum, obrok, smenu i akciona dugmad

### Fajlovi za izmenu
| Fajl | Izmena |
|------|--------|
| `src/components/admin/OrderPivotTable.tsx` | Mobilni accordion prikaz |
| `src/components/admin/UserOrderPivotTable.tsx` | Mobilni kartični prikaz |
| `src/components/admin/OrdersOverview.tsx` | Lista — mobilne kartice |

