

## Plan: Zamena "Password Setup" sa "Company Card ID Setup" pri prvoj prijavi

### Pregled

Trenutno, kada se korisnik prvi put prijavi, sistem zahteva postavljanje lozinke (`password_set = false`). Ovo nema smisla jer korisnik vec unosi lozinku prilikom registracije. Umesto toga, sistem ce zahtevati unos jedinstvenog ID-a zaposlenog (`company_card_id`) pre nego sto korisnik moze koristiti aplikaciju.

Nakon sto korisnik uspesno unese ID, polje postaje trajno zakljucano (read-only) i korisnik ga vise ne moze menjati. Samo admin moze menjati ID zaposlenog.

### Promena logike

```text
TRENUTNO:                           NOVO:
password_set = false                company_card_id = null
  -> zahtevaj lozinku                 -> zahtevaj unos ID-a
  -> password_set = true              -> sacuvaj ID
                                      -> polje postaje read-only zauvek
```

### Fajlovi za izmenu

| Fajl | Akcija | Opis |
|------|--------|------|
| `src/contexts/AuthContext.tsx` | UPDATE | Promeniti `requiresPasswordSetup` u `requiresIdSetup`, logika bazirana na `company_card_id` |
| `src/components/EmployeeDashboard.tsx` | UPDATE | Preimenovati reference, azurirati alert poruku |
| `src/components/employee/ProfileView.tsx` | UPDATE | Zameniti password setup sa ID setup sekcijom; nakon unosa ID postaje read-only |
| `src/i18n/locales/sr.json` | UPDATE | Novi prevodi za ID setup |
| `src/i18n/locales/en.json` | UPDATE | Novi prevodi za ID setup |

---

### Detalji implementacije

#### 1. AuthContext.tsx

- Preimenovati `requiresPasswordSetup` u `requiresIdSetup`
- Nova logika:
  ```typescript
  // STARO:
  const requiresPasswordSetup = profile !== null && profile.password_set === false;

  // NOVO:
  const requiresIdSetup = profile !== null && profile.role === 'employee' && !profile.company_card_id;
  ```
- Azurirati interfejs `AuthContextType` i `value` objekat

#### 2. EmployeeDashboard.tsx

- Zameniti sve reference `requiresPasswordSetup` sa `requiresIdSetup`
- Azurirati alert poruku na "Morate uneti svoj ID zaposlenog"
- Proslediti `isIdSetupMode` umesto `isPasswordSetupMode` u `ProfileView`

#### 3. ProfileView.tsx - Glavna izmena

**ID Setup rezim** (`isIdSetupMode = true`, kada korisnik nema ID):
- Prikazati istaknutu sekciju za unos `company_card_id`
- Polje za unos: numericko, max 10 cifara
- Validacija u realnom vremenu:
  - Samo cifre (regex `^[0-9]+$`)
  - Maksimalno 10 karaktera
  - Provera jedinstvenosti u bazi pre cuvanja
- Greska ako ID vec postoji: "ID XXXXX je vec dodeljen drugom korisniku"
- Dugme "Sacuvaj ID" koje cuva, poziva `refreshProfile()`, i korisnik dobija pristup

**Normalan rezim** (korisnik VEC ima ID):
- Polje `company_card_id` je **uvek read-only** - prikazuje se kao disabled input ili staticni tekst
- Korisnik ne moze menjati svoj ID nakon sto ga jednom postavi
- Samo admin moze menjati ID kroz admin panel (UsersManagement)
- Prikazati helper tekst: "ID je trajno dodeljen. Kontaktirajte administratora za promenu."

**Rezime ponasanja polja:**

```text
Stanje                    | Polje ID
--------------------------|------------------
Nema ID (setup mode)      | Editabilno + validacija
Ima ID (normalan rezim)   | Read-only, zauvek
Admin menja u admin panelu| Editabilno (vec implementirano)
```

#### 4. Validacija jedinstvenosti

Direktan upit ka bazi pre cuvanja:

```typescript
const { data } = await supabase
  .from('profiles')
  .select('id, full_name')
  .eq('company_card_id', inputValue)
  .maybeSingle();

if (data) {
  // ID vec postoji - prikazati gresku
}
```

Baza vec ima UNIQUE constraint kao dodatnu zastitu.

#### 5. Prevodi (sr.json / en.json)

Novi kljucevi:
- `profile.idSetupRequired` - Alert poruka u headeru
- `profile.setupId` - Naslov sekcije
- `profile.setupIdDescription` - Opis sta korisnik treba da uradi
- `profile.enterCompanyCardId` - Placeholder
- `profile.saveId` - Tekst dugmeta
- `profile.idAlreadyExists` - Greska jedinstvenosti
- `profile.idSetSuccess` - Poruka o uspehu
- `profile.idReadOnlyHelp` - "ID je trajno dodeljen. Kontaktirajte administratora za promenu."
- `employee.idSetupWarning` - Upozorenje u dashboard headeru

