

## Plan: Tag-based Octopos Product Code Selection

### Pregled

Dodati novi Supabase secret `OCTOPOS_PRODUCT_CODE_PERSONAL_MEAL_HOGO` i izmeniti `fiscalize-meal` edge funkciju da na osnovu Tag-a zaposlenog bira odgovarajuci product code pri slanju Octopos zahteva.

---

### Tehnicko resenje

U `fiscalize-meal/index.ts`, linija 266 trenutno hardkoduje jedan product code:
```typescript
const productCode = Deno.env.get("OCTOPOS_PRODUCT_CODE_PERSONAL_MEAL") || "S001";
```

Potrebno je:
1. Procitati tag zaposlenog iz `profiles` tabele (vec imamo `existing.profile_id`)
2. Na osnovu taga odabrati product code

### Izmene u `supabase/functions/fiscalize-meal/index.ts`

#### 1. Prosiriti profile select (linija 336-340)

Profil se vec cita za `user_id` radi storage path-a. Pomericemo ovaj upit IZNAD Octopos poziva (pre linije 262) i dodacemo `tag` u select:

```typescript
const { data: profile } = await supabase
  .from("profiles")
  .select("user_id, tag")
  .eq("id", existing.profile_id)
  .maybeSingle();
```

#### 2. Odabir product code-a na osnovu taga (zamena linije 266)

```typescript
const defaultProductCode = Deno.env.get("OCTOPOS_PRODUCT_CODE_PERSONAL_MEAL") || "S001";
const hogoProductCode = Deno.env.get("OCTOPOS_PRODUCT_CODE_PERSONAL_MEAL_HOGO") || defaultProductCode;
const productCode = profile?.tag === "Hogo" ? hogoProductCode : defaultProductCode;
```

#### 3. Ukloniti dupliran profile upit (linije 335-344)

Posto smo profil vec procitali ranije, koristicemo istu `profile` promenljivu za storage path umesto ponovnog upita.

### Novi secret

| Secret | Vrednost |
|--------|----------|
| `OCTOPOS_PRODUCT_CODE_PERSONAL_MEAL_HOGO` | Korisnik mora da postavi u Supabase dashboard-u |

### Fajlovi za izmenu

| Fajl | Akcija |
|------|--------|
| `supabase/functions/fiscalize-meal/index.ts` | Pomeri profile upit pre Octopos poziva, dodaj tag-based product code selekciju |

### Bez promena

- Baza podataka — nema schema promena
- UI — nema promena
- Ostale edge funkcije — bez promena

