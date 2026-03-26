

## Plan: Višestruki odabir datuma pri kopiranju jelovnika

### Pregled
Omogućiti adminu da odabere jedan ili više datuma prilikom kopiranja pojedinačnog jelovnika. Kalendar prelazi u `multiple` mode, odabrani datumi se prikazuju kao lista badge-eva, a kloniranje se izvršava za svaki odabrani datum.

### Izmene

#### 1. `src/components/admin/MenusManagement.tsx`

**State promena (linija 62):**
- `cloneSingleTargetDate: Date | undefined` → `cloneSingleTargetDates: Date[]` (niz datuma)

**Kalendar (linije 785-792):**
- Promeniti `mode="single"` u `mode="multiple"`
- `selected={cloneSingleTargetDates}`, `onSelect={setCloneSingleTargetDates}`

**Prikaz odabranih datuma:**
- Umesto jednog datuma u button trigeru, prikazati broj odabranih datuma (npr. "Odabrano: 3 datuma")
- Ispod kalendara dodati listu odabranih datuma kao badge-eve sa mogućnošću uklanjanja (X)

**Potvrda (linija 232-241):**
- Iterirati kroz sve odabrane datume i pozvati `cloneSingleMenu` za svaki
- Koristiti silent pattern za bulk operacije — prikazati jednu zbirnu toast poruku

**Dugme i dijalog potvrde:**
- Disabled kada je `cloneSingleTargetDates.length === 0`
- Tekst potvrde: "Kopiraj na X datuma"

#### 2. `src/hooks/useMenus.ts`

Bez promena — postojeća `cloneSingleMenu` funkcija se poziva za svaki datum iz petlje.

### Fajlovi za izmenu
| Fajl | Izmena |
|------|--------|
| `src/components/admin/MenusManagement.tsx` | Multi-select kalendar, badge lista, bulk clone logika |

