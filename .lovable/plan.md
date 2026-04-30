
## Problem (rezime)

Trenutno self-signup na `/auth` traži samo email + lozinku + ime, što kreira `auth.users` i prazan `profiles` red bez ID-a/taga. Korisnik često ne završi onboarding → ostaje "zombi" profil. Kasnije isti čovek napravi novi nalog sa drugim email-om → izgleda kao duplikat osobe.

DB ne sprečava duple ID-ove ili case-varijante email-a. Provereno: 9 profila bez `company_card_id` u bazi.

## Cilj

Zadržati self-signup, ali:
1. Podaci moraju biti kompletni **pre** nego što se `auth.users` zapis kreira (atomski signup).
2. Email i `company_card_id` jedinstveni na DB nivou (ne samo klijent validacija).
3. Postojeći zombi nalozi se očiste / prikažu adminu za odluku.

## Plan izmena

### 1. Database migracija (jedinstvenost na DB nivou)

```sql
-- Pre indeksa: očistiti zombi profile (vidi korak 5)

-- Case-insensitive unique email u profiles
CREATE UNIQUE INDEX profiles_email_lower_unique
  ON public.profiles (lower(email))
  WHERE email IS NOT NULL;

-- Unique company_card_id (parcijalni — dozvoljava NULL)
CREATE UNIQUE INDEX profiles_company_card_id_unique
  ON public.profiles (company_card_id)
  WHERE company_card_id IS NOT NULL AND company_card_id <> '';

-- Case-insensitive email_exists
CREATE OR REPLACE FUNCTION public.email_exists(check_email text)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE lower(email) = lower(check_email)
  );
$$;

-- Nova funkcija: provera da li ID već zauzet
CREATE OR REPLACE FUNCTION public.company_card_id_exists(check_id text)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE company_card_id = check_id
  );
$$;
```

### 2. Nova edge funkcija: `signup-employee`

Atomski self-signup koji **prvo validira sve**, pa tek onda kreira `auth.users`.

Ulaz: `{ email, password, full_name, company_card_id, tag?, date_of_birth? }`

Logika:
1. Validacija formata (email, password ≥ 6, ID = numerik max 10, ime min 2 char).
2. `email_exists(lower(email))` → ako da, vrati `409 "Email već registrovan"`.
3. `company_card_id_exists(id)` → ako da, vrati `409 "ID zaposlenog je već dodeljen"`.
4. Ako tag postoji u zahtevu, validira da je dozvoljen (`Proizvodnja` / `Hogo`).
5. `supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: false, user_metadata: { full_name, company_card_id, tag } })` — email **mora biti potvrđen pre login-a** (klasični email confirmation flow).
6. Trigger `handle_new_user` već čita `full_name` i `tag` iz `raw_user_meta_data`. Proširiti ga da čita i `company_card_id`, `date_of_birth`.
7. Pošalje confirmation email kroz standardni Supabase mehanizam (ili custom SMTP po `send-invitation` šablonu).
8. Vraća `{ success: true, requiresEmailConfirmation: true }`.

Funkcija je **public** (`verify_jwt = false` u `supabase/config.toml`) jer se zove pre login-a. Nema rate-limit problem jer Supabase Auth ima sopstveni rate-limit na createUser, ali dodaćemo IP-based rate limit kao u `login-with-id` (5 pokušaja / minut).

### 3. Izmena `handle_new_user` triggera

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (
    user_id, full_name, email, role, tag,
    company_card_id, date_of_birth
  ) VALUES (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.email,
    COALESCE((new.raw_user_meta_data ->> 'role')::app_role, 'employee'::app_role),
    new.raw_user_meta_data ->> 'tag',
    new.raw_user_meta_data ->> 'company_card_id',
    NULLIF(new.raw_user_meta_data ->> 'date_of_birth', '')::date
  );
  RETURN new;
END;
$$;
```

Tako profil odmah ima sve podatke i **ne može biti nepotpun** (DB unique constraint će odbiti ako je ID/email duplikat — transakcija fail-uje, `auth.users` red se ne kreira).

### 4. Frontend izmene

**`src/pages/Auth.tsx` — registracioni tab:**

Dodati polja u `signUpData`:
- `fullName` (postoji)
- `email` (postoji)
- `password` (postoji)
- **`companyCardId`** (novo, obavezno, numerik 1-10 cifara)
- **`tag`** (novo, dropdown `Proizvodnja` / `Hogo`, obavezno)
- **`dateOfBirth`** (opciono)

Zod schema:
```ts
const signUpSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(6).max(100),
  fullName: z.string().trim().min(2).max(100),
  companyCardId: z.string().regex(/^\d{1,10}$/, 'ID mora biti 1-10 cifara'),
  tag: z.enum(['Proizvodnja', 'Hogo'], { message: 'Izaberi organizaciju' }),
  dateOfBirth: z.string().optional()
});
```

`handleSignUp` više ne zove `signUp` iz `AuthContext`-a, već poziva `supabase.functions.invoke('signup-employee', { body: validatedData })`. Na uspeh prikaže poruku "Proveri email za potvrdu". Na 409 prikaže precizan razlog (email vs ID već registrovan).

`AuthContext.signUp` se može zadržati kao internal helper za admin flow, ali se više ne koristi iz UI.

**Tag auto-fill iz URL** (`/auth?tag=Proizvodnja`) — već postoji logika kroz memoriju `tag-assignment-via-link`, samo proširiti da popuni novo polje u registracionoj formi.

### 5. Čišćenje postojećih zombi profila (jednokratno)

Pre dodavanja unique indeksa, pokrenuti:

```sql
-- Korak A: identifikuj zombi (nikad se nisu prijavili I nemaju ID)
SELECT p.id, p.user_id, p.email, p.created_at
FROM profiles p
JOIN auth.users u ON u.id = p.user_id
WHERE (p.company_card_id IS NULL OR p.company_card_id = '')
  AND (u.last_sign_in_at IS NULL OR u.email_confirmed_at IS NULL);

-- Korak B: obriši kroz delete-user edge funkciju (kaskadno čisti i auth.users)
-- ili direktno SQL DELETE iz profiles + auth.admin.deleteUser
```

Za one koji **jesu** se prijavili ali nisu popunili ID — ne brisati automatski. Prikazati ih u admin panelu pod novom karticom **"Nepotpuni korisnici"** sa akcijama:
- Pošalji email podsetnik
- Ručno popuni
- Obriši

(Implementacija ove kartice je manja izmena u `UsersManagement.tsx` — dodati filter čekboks "Samo nepotpuni" i akciono dugme "Pošalji podsetnik" koje zove `send-invitation` ili novu `send-onboarding-reminder` edge funkciju.)

### 6. Strožiji onboarding gate (već postoji — samo provera)

`AuthContext.requiresIdSetup` već blokira app dok ID/ime/tag nisu popunjeni. Sa novim flow-om (sve se traži pri signup-u) ovo postaje **fallback** za stare naloge. Nema potrebe za izmenom.

## Tehnički sažetak (za izvođača)

```text
┌───────────────────────────────────────────────────────────┐
│ Pre: Auth.tsx → supabase.auth.signUp → prazan profil      │
├───────────────────────────────────────────────────────────┤
│ Posle: Auth.tsx (full form) → edge:signup-employee        │
│        → validacija (email, ID jedinstveni)               │
│        → admin.createUser sa metadata                     │
│        → trigger pravi KOMPLETAN profil                   │
│        → email confirmation                               │
│        → login                                            │
└───────────────────────────────────────────────────────────┘

DB constraints (sprečavaju duplikate čak i ako frontend pukne):
- UNIQUE(lower(email))
- UNIQUE(company_card_id)
```

**Fajlovi koji se menjaju:**
- `supabase/migrations/...` — nova (constraints + trigger update + funkcije)
- `supabase/functions/signup-employee/index.ts` — nova edge funkcija
- `supabase/config.toml` — `verify_jwt = false` za `signup-employee`
- `src/pages/Auth.tsx` — proširena registraciona forma + poziv nove funkcije
- `src/i18n/locales/sr.json` + `en.json` — nove poruke (ID već zauzet, ID obavezan, izaberi organizaciju, itd.)
- `src/components/admin/UsersManagement.tsx` — filter "Nepotpuni" + akcije (manja izmena, opciono u istom PR)
- `supabase/functions/create-user/index.ts` — case-insensitive email check (`lower()`) i provera ID jedinstvenosti pre kreiranja

**Riziko/edge case:**
- Korisnik započne signup, ali email confirmation link nikad ne klikne. `auth.users` postoji sa `email_confirmed_at = NULL`. Profile postoji sa svim podacima. Login pokušaj će vratiti "Email not confirmed". Rešenje: dodati **resend confirmation** dugme u Auth tab i scheduled cleanup naloga starijih od 30 dana koji nisu potvrdili email.
- Ako neko probije unique constraint istovremenim zahtevima, edge funkcija hvata `23505` (unique violation) i vraća jasnu poruku korisniku.

## Šta NE menjamo

- Admin "Dodaj korisnika" flow (već traži ID i email obavezno).
- `AuthContext` strukturu — samo se manje koristi iz UI.
- Login flow (i dalje email/password ili ID/password kroz `login-with-id`).
- RLS politike.
