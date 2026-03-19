

## Plan: Kloniranje pojedinačnog jelovnika

### Pregled

Dodati dugme za kopiranje na svaki pojedinačni jelovnik u listi. Klikom se otvara dijalog za izbor datuma (isti UX kao kloniranje nedelje), sa ograničenjima: ne može se birati prošlost, niti datumi koji već imaju jelovnik za istu organizaciju.

---

### Izmene

#### 1. Dugme za kopiranje na svakom jelovniku

U `MenusManagement.tsx`, linije 451-469 — dodati Copy dugme pored svakog jelovnika u listi (desna strana, kao na screenshot-u).

#### 2. Novo stanje za kloniranje pojedinačnog jelovnika

Dodati state:
- `cloneSingleMenu: MenuWithMeals | null` — izvor za kloniranje
- `cloneSingleTargetDate: Date | undefined` — ciljni datum

#### 3. Nova funkcija `cloneSingleMenu` u `useMenus.ts`

Kreira kopiju jednog jelovnika na odabrani datum:
- Kreira novi menu sa `generateMenuName(targetDate)`, kopira opis i `organization_tag`
- Kopira sve `menu_meals` iz izvora

#### 4. Dijalog za izbor datuma (Sheet)

Novi Sheet sličan postojećem "Clone Week" dijalogu, ali za jedan jelovnik:
- Prikazuje naziv izvornog jelovnika
- Kalendar za izbor datuma sa ograničenjima:
  - `disabled` za datume pre tekuće nedelje (ponedeljak tekuće nedelje)
  - `disabled` za datume koji već imaju jelovnik u istoj organizaciji (`filteredMenus`)
- Potvrda kloniranja kroz AlertDialog

---

### Fajlovi za izmenu

| Fajl | Akcija |
|------|--------|
| `src/hooks/useMenus.ts` | Dodati `cloneSingleMenu(sourceMenu, targetDate)` funkciju |
| `src/components/admin/MenusManagement.tsx` | Dodati Copy dugme na svaki jelovnik, novi Sheet dijalog za izbor datuma |

