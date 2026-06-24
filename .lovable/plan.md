## 1) Alergeni — reusable + searchable multi-select (forme za dodavanje i izmenu)

**Migracija (Supabase):** nova tabela `public.allergens` po obrascu `meal_groups`:

```
id uuid PK, name text UNIQUE NOT NULL, created_at timestamptz default now()
```

- GRANT-ovi (`SELECT` za authenticated, `ALL` za service_role) i RLS policy: SELECT za sve authenticated, INSERT/DELETE samo za admine (`is_admin_user(auth.uid())`).

**Frontend (`src/components/admin/MealsManagement.tsx`):**

- Po uzoru na `fetchMealGroups` / `persistMealGroup`: dodaj `persistedAllergens` state, `fetchAllergens()` i `persistAllergen(name)` (upsert sa `onConflict: 'name'`). Sinhronizovati sa `meals.allergens` jsonb nizom: pri svakom save obroka popuniti tabelu `allergens` svim novim vrednostima koje još ne postoje (idempotent upsert) — tako i ručno unete vrednosti postaju reusable, isto kao za grupe.
- Napraviti novu komponentu `src/components/admin/AllergensCombobox.tsx`: shadcn `Popover` + `Command` (`CommandInput`, `CommandList`, `CommandEmpty`, `CommandItem`) sa multi-select (badge chip-ovi sa X za uklanjanje), pretragom kroz `availableAllergens`, opcijom „Dodaj '&nbsp;'" kada query ne postoji u listi (kreira preko `persistAllergen` i odmah selektuje).
- Zameniti `<TagInput …allergens…>` u OBE forme (oko linija 567 i 1223) ovom komponentom, prosledjujući `value`, `onChange`, `options`, `onCreate`.
- **Bug fix placeholder/caret:** `CommandInput` se renderuje uvek vidljiv unutar popovera (fokus se postavlja na `onOpenAutoFocus` Popover-a), čime se rešava trenutni problem (TagInput placeholder ostaje vidljiv i caret se ne vidi). Trigger dugme prikazuje samo izabrane badge-ove ili „Izaberite alergene…" placeholder; sam input field unutar popovera prirodno pokazuje caret i sklanja placeholder čim korisnik kuca.
- Filter polje „Alergeni" iznad tabele (linija 875) ostaje običan tekstualni input za pretragu (ne menja se logika filtera).

## 2) Custom obaveštenja → Email (filter po tagu)

**Nova edge funkcija `supabase/functions/send-custom-broadcast/index.ts**` (verify_jwt = true, dodati u `supabase/config.toml`):

- Body: `{ subject: string, message: string, tag: string | null }` (tag = null znači „Svi").
- Autorizacija: proveriti da pozivalac ima `admin` role (isti pattern kao `notify-menu-ready`).
- Učitati `profiles` (`user_id, email, full_name, tag`) filtrirano po `role='employee'` i opciono `tag = X`, sa email != null.
- Slati preko `sendEmail()` iz `_shared/smtp.ts` u petlji (isti pattern kao `notify-menu-ready`), HTML šablon konzistentan sa postojećim (naslov, pozdrav po imenu, telo poruke iz admin unosa kroz `escapeHtml` + `<br/>` za nove redove, footer).
- Vraća `{ sent, failed, total }`.

**Frontend (`src/components/AdminDashboard.tsx`):**

- U kartici „Custom obaveštenje" zameniti `sendBroadcast` da:
  1. dovuče listu jedinstvenih tagova iz `profiles` (jednom u `useEffect`),
  2. doda polja: `Naslov` (Input), `Tag` (Select sa opcijama: „Svi zaposleni" + svaki tag), zadrži postojeći Textarea za poruku,
  3. poziva `supabase.functions.invoke('send-custom-broadcast', { body: { subject, message, tag } })`,
  4. prikaže toast „Email poslat: X/Y" sa brojem iz odgovora.
- Ukloniti `INSERT` u `admin_broadcasts` iz ove funkcije (in-app/realtime put). Tabela `admin_broadcasts` i njena realtime potrošnja u drugim komponentama se ne diraju u ovom zadatku.

**Tajne:** sve SMTP tajne već postoje (`SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM_EMAIL`, `SMTP_FROM_NAME`) — nove tajne nisu potrebne.

## 3) KPI auto-refresh + manuelni refresh + timestamp

**Frontend (`src/components/AdminDashboard.tsx`):**

- `useAdminStats` već vraća `refetch`. Dodati:
  - lokalni state `lastRefreshed: Date | null` koji se postavlja u `useEffect` na `!statsLoading` kada se `stats` promene (ili wrapper oko `refetch` koji setuje timestamp posle await).
  - `useEffect` sa `setInterval(refetch, 3 * 60 * 1000)` (cleanup obavezan).
  - Manuelno dugme (ikonica `RefreshCw` iz `lucide-react`) iznad grid-a sa KPI karticama (linija ~136), klikom poziva `refetch`. Tokom `statsLoading` ikonica `animate-spin`, dugme `disabled`.
  - Pored dugmeta tekst „Poslednje osveženo: HH:mm:ss" formatiran kroz `toLocaleTimeString('sr-RS')`.
- Nema izmena u `useAdminStats.ts` — postojeći realtime kanal ostaje (debounce 500ms), interval je dodatni safety net.

## Nije potrebno

- Nove Supabase tajne.
- Promene tipova generated `types.ts` (allergens tabela će biti dostupna preko `(supabase as any)`, isti obrazac kao `meal_groups`).
- Promene `admin_broadcasts` schema / drugih komponenti koje je koriste.

## Otvorena pretpostavka

Pretpostavljam da „filtriranje po tagu" znači jedan tag po slanju (ili „Svi"). Ako želite multi-tag selekciju (checkbox lista tagova), recite — dodajem `tags: string[]` umesto jednog Select polja. - Odgovor: DA, multi-tag selekcija.