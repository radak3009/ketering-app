

## Plan: Zamena kartice Prihod sa karticama za danas

### Pregled
Ukloniti karticu "Prihod" iz metrike. Dodati novu karticu koja prikazuje dve vrednosti za danas: broj porudžbina i broj preuzetih porudžbina — sve na jednoj kartici radi uštede prostora.

### Izmene

#### 1. `src/hooks/useAdminStats.ts`
- Dodati u `AdminStats` interfejs: `todayOrders: number`, `todayPickedUp: number`
- U `fetchStats`, dodati drugi upit za danas:
  - Upit na `orders` tabelu za `delivery_date = today` → broji porudžbine
  - Upit na `order_items` tabelu sa `pickup_status = 'preuzeto'` JOIN preko `orders` gde je `delivery_date = today` → broji preuzete

#### 2. `src/components/AdminDashboard.tsx`
- Ukloniti četvrtu karticu (Prihod, linije 160-173)
- Na njenom mestu dodati karticu "Danas" sa dve vrednosti:
  - Porudžbine danas: `stats.todayOrders`
  - Preuzeto danas: `stats.todayPickedUp`
- Grid ostaje `grid-cols-2 md:grid-cols-4` (4 kartice ukupno)

### Fajlovi za izmenu
| Fajl | Izmena |
|------|--------|
| `src/hooks/useAdminStats.ts` | Dodati `todayOrders` i `todayPickedUp` u stats |
| `src/components/AdminDashboard.tsx` | Zameniti karticu Prihod sa karticom Danas |

