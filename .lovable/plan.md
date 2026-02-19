

## Plan: Prikaz ID-a i imena korisnika u header-u Employee panela

### Pregled

Prikazati `company_card_id` (ID zaposlenog) i `full_name` (Ime i Prezime) ulogovanog korisnika u gornjoj traci Employee Dashboard-a, vidljivo na desktop i tablet ekranima (sakriveno na mobilnim).

### Optimalna pozicija

Informacije o korisniku ce biti postavljene **levo od dugmeta "Odjavi se"**, a desno od AI ikonice. Ovako korisnik odmah vidi ko je ulogovan pre nego sto klikne na odjavu.

```text
Header layout (desktop/tablet):
┌──────────────────────────────────────────────────────────────────┐
│ [Logo] Ketering Portal          [AI] [RS] [Theme] [User] [Odjavi se] │
│        Porucite obroke...                          ▲                  │
│                                          ID: 12345                   │
│                                          Ime Prezime                 │
└──────────────────────────────────────────────────────────────────┘
```

Korisnicke informacije ce biti prikazane kao kompaktan blok sa malim tekstom (ID i ime), vidljiv samo na `sm:` i vecim ekranima. Na mobilnim uredajima, ove informacije su dostupne kroz "Profil" tab.

### Fajlovi za izmenu

| Fajl | Akcija | Opis |
|------|--------|------|
| `src/contexts/AuthContext.tsx` | UPDATE | Dodati `company_card_id` u profile SELECT upit |
| `src/components/EmployeeDashboard.tsx` | UPDATE | Dodati prikaz korisnickih podataka u header |

---

### Detalji implementacije

#### 1. AuthContext.tsx - Dodati `company_card_id` u profile fetch

Obe lokacije gde se profil ucitava (`fetchUserProfile` i `refreshProfile`) treba azurirati da ukljuce `company_card_id` polje u SELECT upit.

Takodje, `Profile` interfejs u AuthContext-u treba prosiriti sa:
```typescript
interface Profile {
  // ... postojeca polja ...
  company_card_id: string | null;
}
```

#### 2. EmployeeDashboard.tsx - Prikaz u header-u

Dodati blok sa korisnickim podacima izmedju AI ikonice i Language toggle-a (ili pre "Odjavi se" dugmeta). Koristice se `profile` iz `useAuth()`:

```typescript
const { signOut, user, profile, requiresPasswordSetup } = useAuth();
```

Prikaz ce biti:
- **ID:** `profile?.company_card_id` (ili prazno ako nije postavljeno)
- **Ime:** `profile?.full_name`
- Vidljivost: `hidden sm:flex` - sakriveno na malim mobilnim ekranima
- Stilizacija: kompaktan tekst, `text-xs` ili `text-sm`, desno poravnanje

Pozicija u kodu - izmedju Language/Theme toggle-ova i "Odjavi se" dugmeta:

```typescript
{/* User Info - visible on tablet/desktop */}
{!requiresPasswordSetup && profile && (
  <div className="hidden sm:flex flex-col items-end text-xs text-muted-foreground">
    {profile.company_card_id && (
      <span className="font-mono font-medium text-foreground">
        ID: {profile.company_card_id}
      </span>
    )}
    {profile.full_name && (
      <span className="truncate max-w-[150px]">{profile.full_name}</span>
    )}
  </div>
)}
```

### Rezime vizuelnog prikaza

- **Desktop/Tablet (>=640px):** ID i ime vidljivi u header-u, kompaktno poravnati
- **Mobilni (<640px):** Sakriveno - korisnik pristupa podacima kroz "Profil" tab
- Koristi se `text-muted-foreground` za ime i `font-mono` za ID radi vizuelne razlike
