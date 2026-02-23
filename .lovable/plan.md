

## Plan: Obavezni odabir organizacije (TAG) pri prvoj prijavi + Admin toggle

### Pregled

Prosiricemo onboarding flow zaposlenih da, nakon unosa ID-a, moraju odabrati i Organizaciju (tag) koristeci radio button sa opcijama "Proizvodnja" i "Hogo". Admin u Podesavanjima moze da ukljuci/iskljuci vidljivost Tag opcije za zaposlene.

### Potrebne izmene

```text
Flow zaposlenog pri prvoj prijavi:
1. Unesi ID (vec implementirano)
2. Odaberi Organizaciju (NOVO) - radio button: Proizvodnja / Hogo
3. Sacuvaj oba -> pristup aplikaciji

Admin panel -> Podesavanja:
- Novi toggle: "Prikaži organizacionu jedinicu zaposlenima" (ON/OFF)
- Cuva se u tabeli app_settings u bazi
```

---

### 1. Nova tabela: `app_settings`

Kreirati tabelu za cuvanje konfiguracije aplikacije:

```sql
CREATE TABLE public.app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value jsonb NOT NULL DEFAULT 'true'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Svi autentifikovani korisnici mogu citati podesavanja
CREATE POLICY "Authenticated users can read settings"
  ON public.app_settings FOR SELECT
  TO authenticated
  USING (true);

-- Samo admini mogu menjati
CREATE POLICY "Admins can manage settings"
  ON public.app_settings FOR ALL
  USING (is_admin_user(auth.uid()));

-- Inicijalni podatak - tag selekcija vidljiva po default-u
INSERT INTO public.app_settings (key, value)
VALUES ('tag_selection_visible', 'true'::jsonb);
```

### 2. Novi hook: `src/hooks/useAppSettings.ts`

- Fetch `app_settings` tabele
- Funkcija `getSetting(key)` i `updateSetting(key, value)` 
- Kesirano putem TanStack Query

### 3. Izmena `AuthContext.tsx`

Prosiriti `requiresIdSetup` logiku:

```typescript
// STARO:
const requiresIdSetup = profile !== null && profile.role === 'employee' && !profile.company_card_id;

// NOVO - takodje zahteva tag ako je tag_selection_visible ukljucen:
const requiresIdSetup = profile !== null && profile.role === 'employee' && 
  (!profile.company_card_id || (tagSelectionVisible && !profile.tag));
```

AuthContext ce morati da fetch-uje `tag_selection_visible` setting iz baze da bi odredio da li je tag obavezan.

### 4. Izmena `ProfileView.tsx`

U ID setup sekciji dodati:

- **Radio button grupa** ispod ID polja (prikazuje se samo ako je `tag_selection_visible = true`):
  - Opcija 1: "Proizvodnja"
  - Opcija 2: "Hogo"
  - Helper tekst iznad: "Odaberite organizacionu jedinicu"
- Dugme "Sacuvaj" sada cuva i `company_card_id` i `tag` u jednom koraku
- Validacija: oba polja moraju biti popunjena pre cuvanja (ako je tag vidljiv)

```text
+------------------------------------------+
|  Unesite ID zaposlenog                   |
|  +---------------------------------+     |
|  | [___________] ID broj           |     |
|  +---------------------------------+     |
|                                          |
|  Odaberite organizacionu jedinicu        |
|  ( ) Proizvodnja                         |
|  ( ) Hogo                                |
|                                          |
|              [ Sacuvaj ID ]              |
+------------------------------------------+
```

### 5. Izmena `SettingsTab.tsx`

Dodati novu karticu ispod "Radno vreme kuhinje":

```text
+------------------------------------------+
|  Podesavanja zaposlenih                  |
|  Konfigurisite opcije vidljive za        |
|  zaposlene                               |
|                                          |
|  Organizaciona jedinica (Tag)            |
|  Prikazite opciju za odabir              |
|  organizacione jedinice                  |
|  zaposlenima prilikom registracije       |
|  [Toggle ON/OFF]                         |
+------------------------------------------+
```

- Koristi `useAppSettings` hook
- Toggle switch koji UPDATE-uje `app_settings` red za `tag_selection_visible`

### 6. Prevodi (sr.json / en.json)

Novi kljucevi:
- `profile.selectOrganization` - "Odaberite organizacionu jedinicu"
- `profile.organizationRequired` - "Morate odabrati organizacionu jedinicu"
- `settings.employeeSettings` - "Podešavanja zaposlenih"
- `settings.employeeSettingsDesc` - "Konfigurisanje opcija vidljivih zaposlenima"
- `settings.tagSelectionVisible` - "Organizaciona jedinica (Tag)"
- `settings.tagSelectionVisibleDesc` - "Prikažite opciju za odabir organizacione jedinice zaposlenima prilikom registracije"

### Fajlovi za izmenu

| Fajl | Akcija |
|------|--------|
| Migracija | CREATE `app_settings` tabela + RLS + seed |
| `src/hooks/useAppSettings.ts` | CREATE - hook za citanje/update app_settings |
| `src/contexts/AuthContext.tsx` | UPDATE - dodati tag uslov u `requiresIdSetup` |
| `src/components/employee/ProfileView.tsx` | UPDATE - dodati radio button za organizaciju |
| `src/components/admin/SettingsTab.tsx` | UPDATE - dodati toggle za tag vidljivost |
| `src/i18n/locales/sr.json` | UPDATE - novi prevodi |
| `src/i18n/locales/en.json` | UPDATE - novi prevodi |

