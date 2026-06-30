## Dijagnoza (utvrđeno na bazi)

**1. RLS politike — `auth.uid()` i `has_perm()` se zovu direktno (per-row).**
Na ključnim employee tabelama OR politike nisu obmotane u skalarni podupit, pa Postgres re-evaluira funkcije za svaki red:

- `feedback` SELECT: `(auth.uid() = user_id) OR has_perm('feedback.view')`
- `notification_preferences` SELECT: `(auth.uid() = user_id) OR has_perm('users.view')`
- `orders` SELECT/UPDATE/INSERT: self politike koriste goli `auth.uid()`, staff politike goli `has_perm(...)`
- `order_items` SELECT/INSERT/DELETE: self politike imaju `EXISTS (SELECT 1 FROM orders WHERE id=order_id AND user_id=auth.uid())`, staff `has_perm(...)`
- `meals` SELECT: dve odvojene permissive politike — `(status='aktivan' AND is_available)` za sve + `has_perm('meals.view')`. Druga se evaluira i za zaposlene → trošak.
- `menus` SELECT: `is_active=true` + `has_perm('menus.view')` — isto.
- `menu_meals` SELECT: `true` + `has_perm('menus.write')` — isto.
- `profiles`, `pickup_requests`, `push_subscriptions` — isti obrazac.

Sve permissive policies se OR-uju, ali `has_perm()` se i tako evaluira za svaki red iako bi self/public uslov već vratio true.

**2. Helper funkcije već su `STABLE`** (`has_perm`, `has_permission`, `get_user_panel`, `is_demo_user`, `get_user_permissions`, `can_view_company`). OK — nema potrebe menjati volatilnost.

**3. Indeksi — KRITIČNO NEDOSTAJU:**
- `orders(user_id)` — **ne postoji**. Sve employee upite na `orders` ide Seq Scan.
- `orders(delivery_date)` — ne postoji.
- `order_items(order_id)` — **ne postoji**. RLS EXISTS subquery iz `order_items → orders` radi Seq Scan po `order_items` (15.792 reda u test bazi).
- `menus(menu_date)` i `menus(is_active, menu_date)` — ne postoje.

Dokaz iz `EXPLAIN ANALYZE` (čak i BEZ RLS-a, kao admin):
```
Seq Scan on orders ... rows=15600 removed by filter
Seq Scan on order_items ... rows=15792
```
Sa RLS uključenim (employee role), iznad ovoga ide još i `has_perm` evaluacija po redu.

**4. `role_permissions_pkey` je `(role_id, permission_key)`** — dobar. `user_roles_user_id_unique` postoji — dobro.

**5. Frontend (`usePermissions`)**
- Već koristi `useQuery` sa `staleTime: 5 min` i ključem `["user-permissions", user.id]` — to je OK.
- Pravi 3 paralelna RPC-ja po sesiji (`get_user_permissions`, `get_user_panel`, `is_demo_user`). Nije uzrok sporog rada, ali može se spojiti u jedan RPC kasnije.

---

## Plan (čisto performanse — bezbednosna pravila ostaju identična)

### Korak 1: Indeksi (najveći efekat, najmanji rizik)

```sql
CREATE INDEX IF NOT EXISTS idx_orders_user_id           ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_user_delivery     ON public.orders(user_id, delivery_date);
CREATE INDEX IF NOT EXISTS idx_orders_delivery_date     ON public.orders(delivery_date);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id     ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_menus_menu_date          ON public.menus(menu_date);
CREATE INDEX IF NOT EXISTS idx_menus_active_date        ON public.menus(is_active, menu_date);
CREATE INDEX IF NOT EXISTS idx_role_permissions_allowed ON public.role_permissions(role_id, permission_key) WHERE allowed = true;
```
**Efekat:** Seq Scan → Index Scan na employee upitima nedelje (10×–100× brže za nedeljno čitanje, INSERT/DELETE na `order_items` neće više pretraživati ceo `orders`).

### Korak 2: Obmotati `auth.uid()` i `has_perm()` u `(SELECT …)` u svim RLS politikama

Postgres tretira `(SELECT auth.uid())` i `(SELECT has_perm('x'))` kao **InitPlan** — izvrši ih jednom po upitu, ne po redu. Logika je identična.

Tabele za prepravku (sve policies koje koriste `auth.uid()` ili `has_perm(...)` direktno u `qual`/`with_check`):
`profiles`, `user_roles`, `orders`, `order_items`, `meals`, `menus`, `menu_meals`, `feedback`, `suggestions`, `notification_preferences`, `push_subscriptions`, `pickup_requests`, `allergens`, `meal_groups`, `companies`, `app_settings`, `kitchen_schedule_*`, `menu_templates`, `menu_template_meals`, `admin_broadcasts`, `email_verification_tokens`, `role_permissions`, `roles`, `permissions`.

Migracija će za svaku politiku uraditi `DROP POLICY` + `CREATE POLICY` sa identičnim uslovom, samo obmotanim. Primer:

**Pre (orders SELECT, self):**
```sql
USING (auth.uid() = user_id)
```
**Posle:**
```sql
USING ((SELECT auth.uid()) = user_id)
```

**Pre (order_items SELECT, self):**
```sql
USING (EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id
              AND orders.user_id = auth.uid()))
```
**Posle:**
```sql
USING (EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id
              AND orders.user_id = (SELECT auth.uid())))
```

**Pre (feedback SELECT):**
```sql
USING ((auth.uid() = user_id) OR has_perm('feedback.view'))
```
**Posle:**
```sql
USING (((SELECT auth.uid()) = user_id) OR (SELECT public.has_perm('feedback.view')))
```

**Pre (meals UPDATE):**
```sql
USING (has_perm('meals.write')) WITH CHECK (has_perm('meals.write'))
```
**Posle:**
```sql
USING ((SELECT public.has_perm('meals.write'))) WITH CHECK ((SELECT public.has_perm('meals.write')))
```

Logika potpuno ekvivalentna; menja se samo plan izvršavanja.

### Korak 3: (sitna optimizacija) `orders` UPDATE self politika

Trenutno `WITH CHECK` radi 4 podupita na `orders o WHERE o.id = orders.id` da spreči promenu zaštićenih kolona. Ostaje funkcionalno isto, ali se `auth.uid()` obmotava. Bez izmene logike.

### Korak 4: Frontend — bez izmena u ovoj fazi
`usePermissions` je već dovoljno keširan. Eventualno spajanje 3 RPC-ja u jedan `get_user_context` ostavljamo za kasnije ako measure-ovanjem ostane vidljivo.

---

## Procena efekta

| Akcija | Pre | Posle (procena) |
|---|---|---|
| Učitavanje nedeljnih `order_items` | Seq Scan 15k+ redova + has_perm per row | Index Scan, has_perm jednom |
| INSERT/DELETE `order_items` | EXISTS sa Seq Scan na orders | Index lookup |
| Učitavanje `menus`/`menu_meals` | Seq Scan + has_perm per row | Index Scan, has_perm jednom |
| Promena dana u formi | višestruki spori upiti | instant |

Očekivano: employee panel ponovo "instant" kao pre RBAC-a.

## Rizici i mitigacija

- **Bezbednosna ekvivalencija:** `(SELECT f())` je semantički identično `f()` u RLS kontekstu — Supabase Performance Advisor eksplicitno preporučuje ovaj pattern. Politike se DROP+CREATE u istoj transakciji, bez prozora bez RLS-a.
- **Indeksi:** Plain `CREATE INDEX` (ne CONCURRENTLY — migracije idu u transakciji). Tabele su male (≤16k redova), kratko zaključavanje.
- **Validacija:** Posle migracije ponovo `EXPLAIN ANALYZE` istih upita uz session JWT zaposlenog → očekujemo Index Scan i InitPlan za `has_perm`.

## Šta NE menjamo
- Set dozvola, ko šta sme, koje politike postoje, koje funkcije su SECURITY DEFINER.
- `meals_secure` view, `enforce_order_item_pickup_only` trigger, edge funkcije.
- Frontend logika dozvola i `Can` komponenta.

Čeka odobrenje pre izvršavanja migracije.