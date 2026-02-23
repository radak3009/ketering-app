

## Plan: Ispravka race condition-a za prikaz organizacione jedinice

### Problem

Postoji vremenski nesklad (race condition) između ucitavanja profila i ucitavanja `tag_selection_visible` podesavanja u `AuthContext.tsx`. Redosled dogadjaja:

1. Sesija se uspostavi, profil se ucita
2. `requiresIdSetup` se izracuna sa `tagSelectionVisible = false` (podrazumevana vrednost)
3. Tek NAKON toga `fetchTagSetting` zavrsi i postavi `tagSelectionVisible = true`
4. U tom trenutku, korisnik vec vidi samo ID unos bez opcije za organizaciju

Takodje, u `ProfileView.tsx`, `useAppSettings` hook moze vratiti prazne podatke dok se ucitava, pa se radio button-i ne prikazuju.

### Resenje

#### 1. `src/contexts/AuthContext.tsx`

- Dodati `tagSettingLoaded` state koji prati da li je setting ucitan
- Ukljuciti `tagSettingLoaded` u `loading` stanje - korisnik nece videti dashboard dok se setting ne ucita
- Ovo sprecava da se `requiresIdSetup` izracuna pre nego sto znamo da li je tag obavezan

```text
TRENUTNO:
  session uspostavljena -> profil ucitan -> requiresIdSetup = false (tag setting jos nije ucitan)
  -> korisnik vidi samo ID unos
  -> tag setting ucitan (prekasno)

NOVO:
  session uspostavljena -> profil ucitan + tag setting ucitan (paralelno)
  -> tek onda se loading zavrsava
  -> requiresIdSetup = true (ako tag treba)
  -> korisnik vidi ID unos + organizacija
```

#### 2. `src/components/employee/ProfileView.tsx`

- Dodati proveru `settingsLoading` - dok se podesavanja ucitavaju, prikazati loading indikator u tag sekciji
- Ovo sprecava da se radio button-i sakriju dok se podaci ucitavaju

### Fajlovi za izmenu

| Fajl | Izmena |
|------|--------|
| `src/contexts/AuthContext.tsx` | Dodati `tagSettingLoaded` state; ukljuciti ga u loading uslov |
| `src/components/employee/ProfileView.tsx` | Dodati loading stanje za tag sekciju dok se settings ucitavaju |

### Tehnicki detalji

U `AuthContext.tsx`:
- Novi state: `tagSettingLoaded` (default `false`)
- U `fetchTagSetting` uvefu, postaviti `tagSettingLoaded = true` na kraju (i u slucaju greske)
- Promeniti loading uslov: `loading: loading || processingAuth || (!!session && !tagSettingLoaded)`
- Ovo garantuje da se `requiresIdSetup` ne evaluira dok ne znamo vrednost `tagSelectionVisible`

U `ProfileView.tsx`:
- Proveriti `settingsLoading` pre renderovanja tag sekcije
- Ako `settingsLoading = true`, prikazati mali spinner umesto prazne sekcije

