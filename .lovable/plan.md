# Faza 1 — Granularni RBAC (Uloge i dozvole)

Cilj: uvesti 5 uloga sa grupisanim dozvolama, data-driven u Supabase, UI ekran „Uloge i dozvole" tipa Shop Floor, UI gejtovanje i bezbedan most prema postojećem RLS-u. Server-side enforcement po pojedinačnim dozvolama dolazi u Fazi 2.

## 1. Model podataka (Supabase migracija)

Nove tabele u `public`:

- `roles`
  - `id uuid pk`, `key text unique` (npr. `administrator`, `hr`, `kuhinja`, `zaposleni`, `demo`)
  - `name text`, `description text`
  - `panel text check in ('admin','employee')` — odlučuje koji dashboard ruter prikazuje
  - `is_system bool default false` — sistemske uloge se ne mogu brisati/preimenovati ključ
  - `is_demo bool default false` — okida dodatne serverske blokade
  - `created_at/updated_at`
- `permissions` (katalog, čitljiv svima auth) — `key text pk`, `group_key text`, `label text`, `description text`, `sort_order int`. Razlog za tabelu (ne samo kod): „Uloge i dozvole" ekran može da renderuje grupe direktno iz baze i da admin doda nove dozvole bez deploya. Seed lista (vidi §2).
- `role_permissions` — `role_id uuid fk roles`, `permission_key text fk permissions`, `allowed bool default false`, pk(role_id, permission_key).

Promena `user_roles`:
- Dodati `role_id uuid references roles(id)` (nullable u Fazi 1).
- Backfill: za svaki red sa `role='admin'` → `role_id = roles.administrator`, `role='employee'` → `roles.zaposleni`.
- Stara enum kolona `role app_role` ostaje (ne briše se u Fazi 1) da postojeći RLS i funkcije (`has_role`, `is_admin_user`) rade bez izmena. Trigger sinhronizuje: kada se upiše novi `role_id`, izvodi se i enum vrednost po `roles.panel` (`admin` panel → enum `admin`; `employee` panel → enum `employee`). Time stari RLS automatski tretira HR/Kuhinja/Demo kao admin (bezbednosni most — vidi §6).

GRANT-ovi (uz svaku novu tabelu):
- `roles`, `permissions`: `GRANT SELECT TO authenticated`, `ALL TO service_role`.
- `role_permissions`: `GRANT SELECT TO authenticated`, `ALL TO service_role` (pisanje samo preko edge funkcije).
- RLS na svima ON; SELECT politika `to authenticated using (true)` (čitanje kataloga uloga/dozvola je bezbedno i potrebno za `usePermissions`).
- INSERT/UPDATE/DELETE bez politike → blokira sve direktno iz klijenta; izmene isključivo preko service role edge funkcija.

Funkcije:
- `public.get_user_permissions(_user uuid) returns setof text` (security definer) — vraća sve `permission_key` gde je `allowed=true` za sve uloge tog korisnika.
- `public.has_permission(_user uuid, _perm text) returns boolean` (security definer) — koristi se u Fazi 2 za RLS.
- `public.is_demo_user(_user uuid) returns boolean` — true ako bilo koja uloga korisnika ima `is_demo=true`. Koristi se odmah za serverske blokade.

## 2. Seed uloga i dozvola

Katalog dozvola (insert u `permissions`, grupisan):

```
dashboard.view
orders.view  orders.create  orders.update  orders.delete  orders.export_csv  orders.mark_pickup
meals.view   meals.write    meals.delete   meals.upload_image
menus.view   menus.write    menus.delete   menus.templates
users.view   users.create   users.update   users.delete   users.assign_role  users.invite  users.import
feedback.view  feedback.process  suggestions.view  suggestions.process
notifications.menu  notifications.reminder  notifications.custom_email
reports.view  reports.export
settings.kiosk  settings.kitchen  settings.organization  settings.roles
self.order  self.my_orders  self.feedback  self.suggestions  self.profile  self.nfc
```

Podrazumevane dodele:
- **Administrator**: sve = true.
- **HR**: `dashboard.view`, sve `users.*`, `settings.organization`, `reports.view`, `reports.export`, `notifications.custom_email`, `feedback.view`, `suggestions.view`. panel='admin'.
- **Kuhinja**: `dashboard.view`, `orders.view`, `orders.mark_pickup`, `orders.export_csv`, `meals.view`, `menus.view`. panel='admin'.
- **Zaposleni**: sve `self.*`. panel='employee'. is_system.
- **Demo korisnik**: sve `*.view` + `dashboard.view` + `self.*` view-only. Sve write/delete/invite/export/notifications = false. is_demo=true, panel='admin'.

## 3. Edge funkcije (admin-only put za izmene)

Nove:
- `manage-roles` — CRUD na `roles` i `role_permissions`. Zahteva `is_admin_user`. Operacije: `list`, `create_role`, `update_role` (name/desc/panel), `delete_role` (samo kad `is_system=false` i nema dodeljenih korisnika), `set_permissions` (bulk upsert za jednu ulogu).
- Modifikacija `manage-user-role` — pored postojećeg enum `role`, prihvata i `role_id`; piše oboje u `user_roles` (preko trigger-a se i enum sinhronizuje). Ostaje admin-only.

Demo blokade (Faza 1, ciljano, ne kompletno):
- Dodati helper `assertNotDemo(supabaseAdmin, callerUserId)` u `supabase/functions/_shared/auth.ts`.
- Pozvati ga u: `delete-user`, `manage-user-role`, `manage-roles` (write op), `create-user`, `send-invitation`, `send-magic-link`, `send-custom-broadcast`, `notify-menu-ready`, `reset-user-password`. Vraća 403 „Demo nalogu nije dozvoljena ova akcija".

## 4. Frontend — novi i izmenjeni fajlovi

Novi:
- `src/hooks/usePermissions.ts` — učitava `get_user_permissions` preko RPC za trenutnog korisnika, kešira u React Query, vraća `{ has(perm), permissions, panel, isDemo, loading }`.
- `src/components/auth/Can.tsx` — `<Can permission="orders.delete" fallback={null}>...</Can>`.
- `src/components/admin/RolesPermissions.tsx` — ekran „Uloge i dozvole":
  - Levo: lista uloga + dugme „Dodaj ulogu" (modal: naziv, opis, panel, kopija dozvola od postojeće).
  - Desno: grupisani toggle-ovi (Shop Floor stil), header sa „Sačuvaj"/„Vrati", oznaka „Sistemska" za is_system.
  - Sve izmene preko `manage-roles` edge funkcije.
- `src/hooks/useRoles.ts`, `src/hooks/useRolePermissions.ts` — React Query hooks.

Izmenjeni:
- `src/components/admin/SettingsTab.tsx` — dodati tab „Uloge i dozvole" (vidljiv samo uz `settings.roles`).
- `src/components/admin/UsersManagement.tsx` — dropdown „Uloga" sada čita iz `roles` tabele, šalje `role_id` u `manage-user-role`. Badge prikazuje `roles.name` umesto enum mapiranja.
- `src/pages/Index.tsx` — bira dashboard po `panel` iz `usePermissions` (umesto `profile.role==='employee'`). Fallback na enum dok `usePermissions` ne učita.
- `src/components/AdminDashboard.tsx` — tabovi i akcije obmotani u `<Can>`:
  - tab Porudžbine: `orders.view`; dugme „Novi“/„Izvoz“/„Obriši“ po dozvoli.
  - tab Obroci: `meals.view`; akcije po `meals.write/delete/upload_image`.
  - tab Jelovnici: `menus.view`; itd.
  - tab Korisnici: `users.view`; itd.
  - tab Postavke: po `settings.*`.
  - tab KPI/Dashboard: `dashboard.view`.
- `src/components/EmployeeDashboard.tsx` — tabovi po `self.*`.
- `src/types/user.ts` — `ProfileWithRole` dobija opciono `role_id` i `role_name` (UI label).

## 5. RLS strategija u Fazi 1 (bezbednosni most)

Trenutni RLS na svim admin tabelama koristi `is_admin_user`. Pošto trigger nad `user_roles` sinhronizuje enum `app_role` prema `roles.panel`, HR/Kuhinja/Demo (panel='admin') automatski dobijaju enum `admin` i prolaze postojeće politike. To je **namerni kompromis Faze 1**:

- ✅ HR i Kuhinja mogu da otvore liste korisnika/porudžbina bez prepisivanja desetina RLS politika.
- ⚠️ Na DB nivou HR/Kuhinja/Demo i dalje mogu SVE što i Administrator. Granulacija je čisto UI (Can + sakrivene rute).
- ⚠️ Demo korisnik je serverski zaštićen samo na osetljivim edge funkcijama (vidi §3). Direktni mutacije nad tabelama preko PostgREST-a ostaju moguće dok se ne pređe u Fazu 2.

Faza 2 (van obima): zameniti `is_admin_user(...)` sa `has_permission(auth.uid(), '<perm>')` po tabeli/operaciji, isfazirati enum `app_role`, ukloniti most.

## 6. Redosled koraka

1. Migracija: `roles`, `permissions`, `role_permissions`, ALTER `user_roles` (+ trigger sync ka enum), funkcije `get_user_permissions`, `has_permission`, `is_demo_user`. Seed kataloga + 5 uloga + default `role_permissions`. Backfill `user_roles.role_id` iz enum-a.
2. Edge funkcije: `manage-roles` (nova), update `manage-user-role`, shared `assertNotDemo`, ubaciti pozive u sve write funkcije iz §3.
3. Frontend osnova: `usePermissions`, `<Can>`, izmena `Index.tsx` rutiranja.
4. Ekran „Uloge i dozvole" + tab u Postavkama.
5. Gejtovanje tabova/dugmadi u Admin i Employee dashboard-u.
6. UsersManagement dropdown čita iz `roles`.
7. Ručni smoke test: prijava kao Administrator/HR/Kuhinja/Demo/Zaposleni; provera ruta, vidljivosti tabova, demo blokada na `delete-user` i `send-custom-broadcast`.

## 7. Bezbednosni kompromisi Faze 1 (eksplicitno)

- DB-nivo dozvola ostaje binarno admin/employee preko enum mosta. Granularne dozvole važe samo u UI i u edge funkcijama iz §3.
- Korisnik sa `panel='admin'` (HR, Kuhinja, Demo) na nivou tabele ima admin RLS pristup. Smanjenje rizika: sve destruktivne i „slanje" akcije ionako idu kroz edge funkcije; demo je tamo blokiran.
- Brisanje uloge dozvoljeno samo ako nema korisnika i `is_system=false`.
- Sva pisanja u `roles`/`role_permissions` isključivo preko `manage-roles` edge funkcije (klijent nema INSERT/UPDATE/DELETE politiku).

Sve gornje stavke se rešavaju u Fazi 2 prelaskom RLS-a na `has_permission()` i ukidanjem enum `app_role`.
