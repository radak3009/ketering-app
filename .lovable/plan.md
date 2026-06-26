## Problem
Dropdown „Uloga" u kreiranju i izmeni korisnika nudi samo `Zaposleni` i `Administrator`. Faza 1 RBAC je uvela 5 uloga (Administrator, HR, Kuhinja, Zaposleni, Demo) + mogućnost custom uloga u tabeli `public.roles`, ali UI i edge funkcije i dalje rade samo sa starim enumom `app_role`. Rezultat: ne može se dodeliti HR/Kuhinja/Demo/custom uloga, pa se RBAC ne može testirati.

## Cilj
Sve tri tačke u tabu Korisnici da nude pun spisak uloga iz `public.roles`:
- forma „Dodaj korisnika"
- dijalog „Izmena korisnika" (promena uloge u letu)
- CSV/XLSX uvoz (mapiranje po nazivu/ključu)

Plus prikaz uloge u tabeli/listi po nazivu iz `roles`, ne više fiksno „Admin/Zaposleni".

Zadržavamo bezbednosni princip: izmene uloga isključivo preko service-role edge funkcija, štićeno dozvolom `users.assign_role` (trenutno samo Administrator).

## Promene

### 1. Novi hook `useRoles`
`src/hooks/useRoles.ts` — vraća sve redove iz `public.roles` (`id, key, naziv, opis, is_system, is_demo, panel`), sortirano (sistemske prvo). Koristi React Query, kratak staleTime. Single source of truth za sve dropdowne.

### 2. `useUsers` — proširenje
- `fetchUsers`: umesto trenutnog `user_roles.role` (enum), čitati `user_id, role_id, role` i join sa `roles` (jedan dodatni select po `role_id IN (...)`); izložiti na profilu `role_id`, `role_key`, `role_name`, plus zadržati legacy `role` (enum admin/employee) radi postojećih provera.
- `changeUserRole(userId, userIdAuth, roleKey)`: poziva `manage-user-role` sa `{ userId, roleKey }`. Tip više nije `'admin' | 'employee'`, već `string` (ključ iz `roles`).
- `createUser`: prosleđuje `roleKey` umesto enum vrednosti.

### 3. Edge `manage-user-role` (već štićen `users.assign_role`)
- Prihvata `{ userId, roleKey }` (zadržati backward-compat za stari `role` enum kao fallback).
- Lookup `roles` po `key` → uzima `id`. Validacija da uloga postoji.
- Upis u `public.user_roles` postavlja `role_id = roles.id`. Stara kolona `role` (enum) se popunjava automatski preko postojećeg trigera `sync_user_role_enum` (admin/employee na osnovu `panel`), tako da legacy RLS i dalje radi.
- Vraća kreirani red sa imenom uloge radi UI feedbacka.

### 4. Edge `create-user`
- Prihvata `roleKey`. Posle kreiranja `auth.users` i `profiles`, upisuje `user_roles(user_id, role_id)` direktno (service role) umesto da se oslanja samo na `handle_new_user` triger. Triger i dalje ostaje za samo-registraciju.
- Ako `roleKey` izostane → default `zaposleni`.

### 5. `UsersManagement.tsx`
- Učitati `useRoles()`.
- **Forma „Dodaj korisnika"** (red ~657): `Select` sa stavkama iz `roles` (label = `naziv`, value = `key`); default `zaposleni`.
- **Dijalog „Izmena korisnika"** (red ~1236): isto, `value = selectedUser.role_key`, on change → `changeUserRole(..., roleKey)`. Disable opcija sa `is_system && key === 'administrator'` se ne radi — admin sme da dodeli bilo koju ulogu (ima `users.assign_role`).
- **Badge u tabeli** (red ~857, ~1048): prikazuje `role_name`; varijanta `default` za panel=admin, `outline` za panel=employee.
- **Filter „Uloga"** (red ~982): opcije iz `roles` (key), umesto fiksno admin/employee. „all" ostaje.
- **CSV uvoz** (red ~295): pokušaj match po `key` ILI `naziv` (case-insensitive) → ako pogodi, šalje `roleKey`; inače fallback `zaposleni` + warning u importLog.
- **CSV izvoz** (red ~132): kolona „Uloga" upisuje `naziv` umesto raw enuma.

### 6. Tipovi
`src/types/user.ts`: proširi `ProfileWithRole` opcionim poljima `role_id?: string; role_key?: string; role_name?: string;` (legacy `role: AppRole` ostaje). `UserCreateData.role` postaje `string` (role key).

## Bezbednost (nepromenjena)
- Sve mutacije idu kroz edge funkcije sa `assertPermission('users.assign_role')` + `assertNotDemo`. HR, Kuhinja, Demo ne mogu da menjaju uloge ni iz UI ni direktno.
- Enum-most ostaje aktivan; nove uloge HR/Kuhinja/Demo se preko panela mapiraju na enum `admin`/`employee` i postojeći RLS i dalje funkcioniše.
- Migracije: **nisu potrebne**. Sve već postoji u bazi.

## Test plan
1. Iz Administrator naloga: kreiraj testne naloge sa svim 5 uloga; potvrdi da svaki ulazi u očekivani panel (Administrator/HR/Kuhinja/Demo → admin panel; Zaposleni → employee panel) i da Demo ne može da pozove destruktivne akcije.
2. Edit postojećeg korisnika: promeni iz Zaposleni → HR; proveri da se badge i panel ažuriraju nakon ponovne prijave.
3. HR nalog otvara tab Korisnici: dropdown uloga je vidljiv (HR ima `users.view/update`), ali snimanje role poziva edge i vraća 403 (HR nema `users.assign_role`). UI prikaz: toast „Nemate dozvolu: users.assign_role".

## Izmenjeni / novi fajlovi
- nov: `src/hooks/useRoles.ts`
- `src/hooks/useUsers.ts`
- `src/components/admin/UsersManagement.tsx`
- `src/types/user.ts`
- `supabase/functions/manage-user-role/index.ts`
- `supabase/functions/create-user/index.ts`
