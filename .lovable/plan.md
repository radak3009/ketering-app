

## Plan: Dostupnost obroka prema TAG-u (organizaciji)

### Pregled

Dodati mogucnost da se svaki obrok ogranici na odredjene organizacije (tagove). Ako obrok nema nijedan tag, vidljiv je svima. Ako ima odabrane tagove, vidljiv je samo zaposlenima sa tim tagom.

### Izmene

#### 1. Baza podataka - migracija

Dodati novu kolonu `allowed_tags` (TEXT ARRAY, nullable, default NULL) u tabelu `meals`.

Azurirati `meals_secure` view da filtrira obroke prema tagu korisnika:
- Ako `allowed_tags` je NULL ili prazan niz - obrok je vidljiv svima
- Ako `allowed_tags` sadrzi vrednosti - obrok je vidljiv samo korisnicima ciji tag se nalazi u nizu

```sql
ALTER TABLE meals ADD COLUMN allowed_tags TEXT[] DEFAULT NULL;

-- Azurirati view
CREATE OR REPLACE VIEW meals_secure AS
SELECT id, name, description, price,
  CASE WHEN is_admin_user(auth.uid()) THEN purchase_price ELSE NULL END AS purchase_price,
  category, code, status, shifts, allergens, image_url, is_available,
  nutritional_info, created_at, updated_at, allowed_tags
FROM meals
WHERE (
  allowed_tags IS NULL
  OR array_length(allowed_tags, 1) IS NULL
  OR allowed_tags && ARRAY(
    SELECT tag FROM profiles WHERE user_id = auth.uid() AND tag IS NOT NULL
  )
);
```

#### 2. Frontend - Admin UI (`MealsManagement.tsx`)

Ispod sekcije "Dostupnost u smenama", dodati novu sekciju "Dostupnost prema organizaciji" sa istim dizajnom (checkbox-ovi).

Tagovi se ucitavaju iz baze (distinct tagovi iz `profiles` tabele). Svaki tag se prikazuje kao checkbox. Ako nijedan nije odabran - obrok je dostupan svima (prikazati napomenu).

Izmene u oba panela - kreiranje i izmena obroka:

```text
Dostupnost u smenama
✅ Prva Smena  ✅ Druga Smena  ✅ Treća Smena

Dostupnost prema organizaciji
☐ Hogo  ☐ Proizvodnja
ℹ️ Ako nijedna organizacija nije odabrana, obrok je dostupan svima.
```

#### 3. Frontend - Form state i logika

| Fajl | Izmena |
|------|--------|
| `src/components/admin/MealsManagement.tsx` | Dodati `allowed_tags: string[]` u `MealFormState`; dodati checkbox sekciju u oba panela (add/edit); proslediti `allowed_tags` u `createMeal` i `updateMeal`; dodati fetch distinct tagova iz `profiles` |

#### 4. Employee filtriranje (automatski)

`meals_secure` view ce automatski filtrirati obroke na osnovu korisnikovog taga. Employee `OrderMealDialog` vec koristi `meals` tabelu preko `menu_meals` join-a - ovo treba proveriti da li ce RLS politika na `meals` tabeli automatski filtrirati. Posto employees koriste `meals` direktno (preko join-a u menijima), treba azurirati RLS politiku "Users can view active available meals" da ukljuci proveru `allowed_tags`.

```sql
-- Azurirati RLS politiku za employees
DROP POLICY "Users can view active available meals" ON meals;
CREATE POLICY "Users can view active available meals" ON meals
  FOR SELECT USING (
    is_available = true
    AND status = 'aktivan'
    AND (
      allowed_tags IS NULL
      OR array_length(allowed_tags, 1) IS NULL
      OR allowed_tags && ARRAY(
        SELECT tag FROM profiles WHERE user_id = auth.uid() AND tag IS NOT NULL
      )
    )
  );
```

#### 5. Kiosk edge funkcija

`kiosk-show-meal` koristi service role pa nece biti pogodjena RLS-om - bez izmena.

### Fajlovi za izmenu

| Fajl | Izmena |
|------|--------|
| Nova migracija | `allowed_tags` kolona + azuriran view + azurirana RLS politika |
| `src/components/admin/MealsManagement.tsx` | Checkbox sekcija za tagove u oba panela; fetch distinct tagova; prosledjivanje u create/update |
| `src/integrations/supabase/types.ts` | Regenerisace se automatski sa novom kolonom |

### Tehnicki detalji

- Tagovi se ucitavaju jednom pri mount-u komponente: `SELECT DISTINCT tag FROM profiles WHERE tag IS NOT NULL`
- `allowed_tags` je TEXT[] - isti tip kao `allergens` i `shifts`, dosledan sa ostatkom scheme
- Null/prazan niz znaci "dostupno svima" - backward compatible, svi postojeci obroci ostaju vidljivi svim korisnicima
- RLS politika koristi `&&` (overlap) operator za proveru da li se tag korisnika nalazi u nizu dozvoljenih tagova

