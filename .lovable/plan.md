

## Plan: Optimizacija performansi frontend aplikacije

### Pregled izmena

Ovaj plan implementira 5 optimizacija koje poboljšavaju performanse aplikacije bez narušavanja funkcionalnosti.

---

### A) AuthContext – Stabilnost referenci i smanjenje re-rendera

**Problem:** `value` objekat se kreira na svakom renderu, što uzrokuje nepotrebne re-rendere svih komponenti koje koriste `useAuth()`.

**Rešenje:**

1. Umotati sve funkcije u `useCallback`:
   - `signUp`, `signIn`, `signOut`, `signInWithGoogle`, `signInWithMagicLink`, `resetPassword`, `updatePassword`, `refreshProfile`, `clearPasswordRecovery`

2. Umotati `value` objekat u `useMemo` sa svim zavisnostima

**Fajl:** `src/contexts/AuthContext.tsx`

```typescript
// Primer za signIn
const signIn = useCallback(async (email: string, password: string) => {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return { error };
}, []);

// Primer za value
const value = useMemo(() => ({
  user,
  session,
  profile,
  loading: loading || processingAuth,
  isPasswordRecovery,
  requiresPasswordSetup,
  clearPasswordRecovery,
  refreshProfile,
  signUp,
  signIn,
  signOut,
  signInWithGoogle,
  signInWithMagicLink,
  resetPassword,
  updatePassword
}), [
  user, session, profile, loading, processingAuth,
  isPasswordRecovery, requiresPasswordSetup,
  clearPasswordRecovery, refreshProfile, signUp, signIn,
  signOut, signInWithGoogle, signInWithMagicLink,
  resetPassword, updatePassword
]);
```

---

### B) useUsers.fetchUsers() – Optimizacija O(n) umesto O(n×m)

**Problem:** Trenutna implementacija koristi `find()` unutar `map()` što ima kvadratnu složenost.

**Rešenje:** Koristiti `Map` za O(1) lookup rola.

**Fajl:** `src/hooks/useUsers.ts`

```typescript
// Trenutno (O(n×m)):
const usersWithRoles = (profilesData || []).map(profile => {
  const userRole = (rolesData as any)?.find((r: any) => r.user_id === profile.user_id);
  return { ...profile, role: userRole?.role || 'employee' };
});

// Novo (O(n)):
const roleByUserId = new Map(
  (rolesData as any[] ?? []).map((r: any) => [r.user_id, r.role])
);

const usersWithRoles = (profilesData || []).map(profile => ({
  ...profile,
  role: roleByUserId.get(profile.user_id) || 'employee'
} as ProfileWithRole));
```

---

### C) Eksplicitne kolone umesto select('*')

**Problem:** `select('*')` prenosi nepotrebne podatke i povećava latenciju.

**Rešenje:** Definisati eksplicitne kolone za svaki upit. Implementirati postepeno po hook-u.

| Hook | Trenutno | Novo |
|------|----------|------|
| `useUsers.ts` (fetchUsers) | `select('*')` | `select('id, user_id, full_name, email, phone, company_card_id, tag, date_of_birth, company_id, role, password_set, created_at, updated_at')` |
| `useUsers.ts` (updateUser) | `select('*')` | `select('id, user_id, full_name, email, phone, company_card_id, tag, date_of_birth, company_id, role, password_set, created_at, updated_at')` |
| `useFeedback.ts` | `select('*')` | `select('id, user_id, content, created_at, obradeno')` |

**Napomena:** Ova optimizacija se može implementirati inkrementalno. Prvo A, B, D, E, pa zatim C po potrebi.

---

### D) Uklanjanje production logova

**Problem:** `console.log` u AuthContext-u usporava kiosk uređaje i može otkriti osetljive informacije.

**Rešenje:** Umotati sve logove u `if (import.meta.env.DEV)` proveru.

**Fajl:** `src/contexts/AuthContext.tsx`

```typescript
// Trenutno:
console.log('[AuthContext] Auth state changed:', event, session?.user?.email);

// Novo:
if (import.meta.env.DEV) {
  console.log('[AuthContext] Auth state changed:', event, session?.user?.email);
}
```

**Lokacije za izmenu (9 logova):**
- Linija 57: Processing auth parameters
- Linija 72: Exchanging code for session
- Linija 76: Code exchange error
- Linija 78: Code exchange successful
- Linija 91: Fetching profile for user
- Linija 119: Profile loaded successfully
- Linija 131: Auth state changed
- Linija 160: Initial session check
- Linija 171: Attempting to sign out (i ostali logovi u signOut)

---

### E) Bundle hygiene – Jedan lockfile

**Problem:** Projekt ima i `bun.lockb` i `package-lock.json`, što može uzrokovati nekonzistentne dependency verzije.

**Rešenje:** Zadržati samo `bun.lockb` jer projekt koristi Bun.

**Akcija:** Obrisati `package-lock.json` fajl.

---

### Redosled implementacije

| Prioritet | Optimizacija | Rizik | Uticaj |
|-----------|--------------|-------|--------|
| 1 | D) Dev-only logovi | Nizak | Srednji |
| 2 | E) Brisanje package-lock.json | Nizak | Nizak |
| 3 | B) Map lookup u useUsers | Nizak | Srednji |
| 4 | A) useMemo/useCallback u AuthContext | Srednji | Visok |
| 5 | C) Eksplicitne kolone | Srednji | Srednji |

---

### Fajlovi za izmenu

| Fajl | Izmene |
|------|--------|
| `src/contexts/AuthContext.tsx` | useCallback za funkcije, useMemo za value, dev-only logovi |
| `src/hooks/useUsers.ts` | Map lookup za role |
| `src/hooks/useFeedback.ts` | Eksplicitne kolone (opciono) |
| `package-lock.json` | Obrisati fajl |

---

### Testiranje nakon implementacije

1. **Auth tok:** Provera prijave, registracije, magic link, password recovery
2. **Admin dashboard:** Provera učitavanja korisnika, CRUD operacija
3. **Employee dashboard:** Provera naručivanja, profila, feedback-a
4. **Kiosk:** Provera Kitchen i Pickup kioska
5. **Console:** Verifikacija da nema logova u production modu

