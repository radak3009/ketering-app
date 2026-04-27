## Plan: Razdvajanje Jelovnika (template) od Dodele (datumi)

### Koncept
Trenutno jedan zapis u `menus` = jedan dan + lista obroka. Nova logika:
- **Jelovnik (template)** = imenovani skup obroka bez datuma (može se ponovo dodeljivati).
- **Dodela** = vezivanje template-a za jedan ili više datuma (ostaje u tabeli `menus`, kao i do sada).

### 1. Promene u bazi (migracija)

**Nova tabela `menu_templates`:**
- `id` uuid PK
- `name` text NOT NULL (obavezno polje)
- `description` text nullable
- `organization_tag` text nullable (Proizvodnja / NULL=Hogo)
- `created_at`, `updated_at`

**Nova tabela `menu_template_meals`** (junction template ↔ obroci):
- `id` uuid PK
- `template_id` uuid → `menu_templates.id` ON DELETE CASCADE
- `meal_id` uuid → `meals.id`
- `quantity` int default 1
- UNIQUE (template_id, meal_id)

**Izmena tabele `menus` (dodela):**
- Dodati `template_id` uuid nullable (FK na `menu_templates.id`, ON DELETE SET NULL).
- Postojeći redovi ostaju kao "istorijske dodele" sa `template_id = NULL`.

**RLS:** identično kao za `menus` / `menu_meals` (admini full, svi authenticated mogu SELECT za potrebe prikaza).

**Bez auto-migracije** postojećih podataka.

### 2. Frontend struktura

**`MenusManagement.tsx`** dobija unutrašnje tabove:

```
┌─ Jelovnici ─┬─ Dodela Jelovnika ─┐
```

#### Tab "Jelovnici" (NOVO — lista template-a)
- Lista svih `menu_templates` u tabeli (slično `MealsManagement`):
  - Kolone: Naziv, Grupa (organization_tag), Broj obroka, Smene (izvedeno iz `shifts` polja povezanih obroka — unija), Akcije.
- Pretraga po: **nazivu** (input), **grupi** (select: Sve / Proizvodnja / Hogo), **smeni** (select: Sve / I / II / III — filtrira template-e koji sadrže bar jedan obrok te smene).
- Paginacija (`TablePagination`, 20/50/100) — prati `mem://ux/admin-table-patterns`.
- Dugme **"Kreiraj jelovnik"** otvara Sheet sa formom:
  - **Naziv** (obavezno, validacija `nonempty`, max 100)
  - **Grupa** (select: Proizvodnja / Hogo)
  - **Opis** (opciono)
  - Pretraga obroka (po nazivu, grupi, smeni — kao sada), checkbox lista
  - Submit → INSERT u `menu_templates` + `menu_template_meals`
- Akcije po redu: **Izmeni** (Sheet sa istom formom, prepopulated), **Obriši** (AlertDialog confirm — kaskadno briše i `menu_template_meals`; postojeće dodele u `menus` ostaju jer je FK SET NULL).

#### Tab "Dodela Jelovnika" (postojeći prikaz)
- Identičan trenutnom prikazu (nedeljni grouping, kloniranje, edit/delete dodele).
- Dugme se menja iz "Kreiraj jelovnik" u **"Dodeli jelovnik"**, otvara novi dijalog (vidi #3).
- Postojeći inline edit dodele ostaje (datum, obroci, opis).

### 3. Novi dijalog "Dodela Jelovnika"

Sheet/Dialog sa:
- **Select template-a** (dropdown sa svim `menu_templates`, filtriran po aktivnom org tabu Proizvodnja/Hogo) — obavezno.
- Preview izabranih obroka iz template-a (read-only lista).
- **Multi-select kalendar** (`Calendar mode="multiple"`) — korisnik klikom dodaje/uklanja datume.
  - Disabled: prošli datumi i datumi koji već imaju dodelu u istom org tabu.
  - Lista izabranih datuma ispod kalendara sa "X" za uklanjanje.
- Submit → za svaki izabrani datum INSERT u `menus` (sa `template_id`, `organization_tag` iz template-a, `name` = `template.name + ' — ' + format(date)`, `menu_date`) + bulk INSERT u `menu_meals` (kopiranje obroka iz template-a, da postojeća logika prikaza i porudžbina nastavi da radi bez promena).

### 4. Hook izmene

- **Nov `useMenuTemplates.ts`**: `templates`, `loading`, `createTemplate`, `updateTemplate`, `deleteTemplate`, `refetch`.
- **`useMenus.ts`**: dodati `assignTemplate(templateId, dates[])` koji u petlji kreira `menus` + `menu_meals` zapise (slično postojećem `cloneSingleMenu`).
- Postojeće `createMenu`, `cloneWeekMenus`, `cloneSingleMenu` ostaju netaknute (koriste se za istorijske dodele i kloniranje).

### 5. Tipovi

- `src/types/menu.ts`: dodati `MenuTemplate`, `MenuTemplateMeal`, `MenuTemplateWithMeals`, `MenuTemplateCreateData`, `MenuTemplateUpdateData`.
- `Menu` interfejs dobija opciono `template_id`.

### Šta ostaje nepromenjeno
- `menu_meals`, `orders`, `order_items`, RLS politike za `menus`, employee dashboard, kioski, fiskalizacija — sve nastavlja da radi jer dodele i dalje žive u `menus` sa popunjenim `menu_meals`.
- Postojeći "Kloniraj nedelju / Kloniraj jelovnik" funkcionalnost ostaje u tabu "Dodela Jelovnika".

### Tehnički detalji
- Migracija koristi standardni RLS pattern sa `is_admin_user(auth.uid())`.
- FK `menus.template_id → menu_templates.id ON DELETE SET NULL` čuva istoriju dodela ako se template obriše.
- Dijalog za dodelu koristi `Calendar mode="multiple"` sa `pointer-events-auto` klasom (Radix DayPicker pravilo iz Shadcn).
- Pretraga po smeni u listi template-a se računa klijentski iz `template.meals[].meal.shifts`.
- Validacija template forme preko `zod` schema (`name: z.string().trim().nonempty().max(100)`).
