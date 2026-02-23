

## Plan: Automatsko dodeljivanje TAG-a pri registraciji putem linka

### Pregled

Kreiranje razlicitih registracijskih linkova koji automatski dodeljuju TAG korisniku. Na primer:
- `https://ketering-app.lovable.app/auth?tag=Proizvodnja` - za zaposlene u proizvodnji
- `https://ketering-app.lovable.app/auth?tag=Hogo` - za zaposlene u hotelu HOGO
- Moze se dodati neogranicen broj tagova u buducnosti

### Kako funkcionise

```text
QR kod "Proizvodnja"                    QR kod "Hogo"
/auth?tag=Proizvodnja                   /auth?tag=Hogo
        |                                      |
        v                                      v
   Auth stranica cita tag iz URL-a
        |
        v
   signUp() salje tag kao user_metadata
        |
        v
   handle_new_user() trigger cuva tag u profiles tabelu
        |
        v
   Korisnik automatski ima dodeljen TAG
```

### Fajlovi za izmenu

| Fajl | Akcija | Opis |
|------|--------|------|
| `src/pages/Auth.tsx` | UPDATE | Citanje `tag` query parametra, prosledjivanje u signUp |
| `src/contexts/AuthContext.tsx` | UPDATE | Dodati `tag` parametar u signUp funkciju i user_metadata |
| Database migration | UPDATE | Azurirati `handle_new_user()` trigger da cita `tag` iz metadata |
| `src/components/admin/SettingsTab.tsx` | UPDATE | Dodati sekciju za generisanje QR kodova po TAG-u |

---

### Detalji implementacije

#### 1. Auth.tsx - Citanje TAG parametra iz URL-a

```typescript
// Vec postoji: const [searchParams] = useSearchParams();
const tagFromUrl = searchParams.get('tag'); // "Proizvodnja", "Hogo", itd.

// Pri pozivanju signUp, proslediti tag:
await signUp(email, password, fullName, 'employee', tagFromUrl || undefined);
```

Tag se prikazuje korisniku na registracionoj formi kao info poruka (npr. "Registrujete se za: Proizvodnja") da korisnik zna koji tag dobija.

#### 2. AuthContext.tsx - Prosiriti signUp

Dodati `tag` parametar u `signUp` funkciju:

```typescript
const signUp = async (email, password, fullName, role = 'employee', tag?: string) => {
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        role: role,
        tag: tag || null,  // NOVO
      }
    }
  });
  return { error };
};
```

Azurirati interfejs `AuthContextType` da ukljuci novi parametar.

#### 3. Database Migration - Azurirati handle_new_user() trigger

Trenutni trigger ne cita `tag` iz metadata. Treba ga azurirati:

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email, role, tag)
  VALUES (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.email,
    COALESCE((new.raw_user_meta_data ->> 'role')::app_role, 'employee'::app_role),
    new.raw_user_meta_data ->> 'tag'  -- NOVO: cuva tag iz metadata
  );
  RETURN new;
END;
$function$
```

#### 4. SettingsTab.tsx - Sekcija za generisanje QR kodova po TAG-u

Dodati novu karticu u admin podesavanja koja omogucava:
- Unos naziva TAG-a (npr. "Proizvodnja", "Hogo")
- Automatsko generisanje linka: `https://ketering-app.lovable.app/auth?tag=Proizvodnja`
- QR kod za svaki TAG (koristi vec instaliran `qrcode.react`)
- Dugme za kopiranje linka

Ovo koristi vec postojece komponente (`QRCodeSVG`, `Dialog`) iz `SettingsTab.tsx` fajla.

#### 5. Auth.tsx - Vizuelna indikacija TAG-a

Na registracionoj formi, ako je tag prisutan u URL-u, prikazati info badge:

```text
+----------------------------------+
|  Registracija                    |
|                                  |
|  [i] Registrujete se za:        |
|      Proizvodnja                 |
|                                  |
|  Ime: [____________]            |
|  Email: [____________]          |
|  Lozinka: [____________]        |
|                                  |
|  [Registruj se]                 |
+----------------------------------+
```

### Buducnost

Ovaj pristup je skalabilan - za svaki novi tag, admin samo unese naziv u Settings i generise novi QR kod. Nije potrebna nikakva promena koda za dodavanje novih tagova.
