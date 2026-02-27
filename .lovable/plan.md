

## Plan: Dodavanje dimenzije "Smena" u Pregled porudžbina

### Pregled
Tri izmene: globalni filter smene u `OrdersOverview`, drill-down po smenama u `OrderPivotTable`, i prikaz smene u ćelijama `UserOrderPivotTable`.

---

### 1. `OrdersOverview.tsx` — Globalni filter smene

- Dodati state: `const [shiftFilter, setShiftFilter] = useState<string>("all")`
- Mapiranje vrednosti: `"all"` | `"prva"` | `"druga"` | `"treća"` → UI labele: `Sve` | `I` | `II` | `III`
- Dodati `ToggleGroup` ili dugmad ispod "Po obrocima / Po korisnicima" toggle-a sa labelom "Smena:"
- Pre prosleđivanja `filteredOrders` u pivot komponente, dodatno filtrirati:
  - Ako `shiftFilter !== "all"`, filtrirati `order.order_items` da zadrže samo stavke sa odgovarajućom smenom
  - Proslediti `shiftFilter` kao prop u obe pivot komponente

### 2. `OrderPivotTable.tsx` — Hijerarhijski drill-down po smenama

- Dodati prop `shiftFilter: string` (vrednost `"all"` | `"prva"` | `"druga"` | `"treća"`)
- Proširiti `Order` interfejs da `order_items` uključi `shift: string`
- Promeniti `PivotData` strukturu:
  ```typescript
  interface MealPivotRow {
    byDay: { [dayName: string]: number };
    total: number;
    shifts: {
      [shift: string]: { byDay: { [dayName: string]: number }; total: number };
    };
  }
  ```
- Prilikom obrade `order_items`, pored ukupnog zbira, akumulirati i po `item.shift`
- Dodati state `expandedMeals: Set<string>` za collapse/expand
- UI: Parent red ima `ChevronRight`/`ChevronDown` ikonu; klik toggleuje expanded stanje
- Kada je expanded, ispod parent reda renderovati 3 child reda (`I smena`, `II smena`, `III smena`) sa indent-om i manjim fontom
- Kada je `shiftFilter !== "all"`, parent red prikazuje samo vrednosti te smene; child redovi se ne prikazuju (ili prikazuju samo tu jednu smenu)
- Shift labele: `prva` → `I smena`, `druga` → `II smena`, `treća` → `III smena`

### 3. `UserOrderPivotTable.tsx` — Obrok + smena u ćeliji

- Dodati prop `shiftFilter: string`
- Proširiti `OrderWithProfile` interfejs: `order_items` treba da ima `shift: string`
- U obradi, uz `mealName`, uzeti i `shift` iz `firstItem`
- Format ćelije: `"NazivObroka (I)"` umesto samo `"NazivObroka"`
- Mapiranje smene: `prva` → `I`, `druga` → `II`, `treća` → `III`
- Kada je aktivan `shiftFilter`, filtrirati stavke pre obrade (prikazati samo tu smenu)
- Ako korisnik ima više stavki za isti dan (različite smene), spojiti ih sa `", "` separator

### 4. `OrdersOverview.tsx` — Prosleđivanje filtriranih podataka

- Pre prosleđivanja `filteredOrders`, mapirati orders tako da `order_items` budu filtrirani po smeni:
  ```typescript
  const shiftFilteredOrders = useMemo(() => {
    if (shiftFilter === "all") return filteredOrders;
    return filteredOrders.map(order => ({
      ...order,
      order_items: order.order_items?.filter(item => item.shift === shiftFilter)
    })).filter(order => order.order_items?.length > 0);
  }, [filteredOrders, shiftFilter]);
  ```
- Proslediti `shiftFilter` u `OrderPivotTable` i `UserOrderPivotTable`

### Fajlovi koji se menjaju
1. `src/components/admin/OrdersOverview.tsx` — filter state + UI + filtriranje + props
2. `src/components/admin/OrderPivotTable.tsx` — drill-down struktura
3. `src/components/admin/UserOrderPivotTable.tsx` — format ćelija sa smenom

Nema potrebe za bazom podataka — `shift` već postoji u `order_items` i već se fetch-uje.

