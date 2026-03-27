

## Plan: Pie chart po smenama umesto kartice Korisnici

### Pregled
Ukloniti karticu "Korisnici" i na njeno mesto (četvrta pozicija, iza "Danas") dodati pie chart koji prikazuje raspodelu porudžbina po smenama za izabrani period.

### Izmene

#### 1. `src/hooks/useAdminStats.ts`
- Dodati `shiftBreakdown: { shift: string; count: number }[]` u `AdminStats` interfejs
- U `fetchStats`, dohvatiti `order_items` sa `shift` za filtrirani period (JOIN preko `orders.delivery_date`):
  ```
  select shift, count(*) from order_items
  join orders on orders.id = order_items.order_id
  where orders.delivery_date between startDate and endDate
  group by shift
  ```
- Pošto Supabase JS klijent ne podržava GROUP BY, dohvatiti sve `order_items.shift` za period i agregirati klijentski

#### 2. `src/components/AdminDashboard.tsx`
- Ukloniti prvu karticu "Korisnici" (linije 117-129)
- Ukloniti `useUsers` import (više nije potreban za metrike)
- Pomeriti preostale kartice (Obroci, Porudžbine, Danas) na pozicije 1-3
- Na četvrtu poziciju dodati novu karticu sa Recharts `PieChart`:
  - Naslov: "Po smenama"
  - Podaci: `stats.shiftBreakdown` mapirani na pie chart segmente
  - Boje: tri distinktne boje za I, II, III smenu
  - Label sa procentima
  - Koristiti `ChartContainer` iz `src/components/ui/chart.tsx`
- Grid ostaje `grid-cols-2 md:grid-cols-4`
- Visina kartice usklađena sa ostalim karticama

### Fajlovi za izmenu
| Fajl | Izmena |
|------|--------|
| `src/hooks/useAdminStats.ts` | Dodati `shiftBreakdown` u stats |
| `src/components/AdminDashboard.tsx` | Zameniti karticu Korisnici sa pie chart karticom |

