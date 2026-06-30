## Cilj
Slike obroka uvek prikazati u celosti, bez sečenja, na sve tri površine:
- `OrderMealDialog` (forma za poručivanje)
- `MealCard` (kartice za tekuću i iduću nedelju)
- (bonus konzistentnost) `NextWeekView` / `CurrentWeekView` ako negde renderuju sliku direktno

Tehnika: **letterbox + blurovana pozadina** (ista slika u pozadini, `object-cover` + `blur` + `scale`, a glavna slika preko nje sa `object-contain`). Tako kontejner ima fiksan odnos stranica, a slika je uvek cela vidljiva, bez vidljivih praznih traka.

## Promene po fajlu

### 1) `src/components/employee/MealCard.tsx` (linije ~100-113)
Zameniti blok:
```tsx
<div className="relative w-full h-48 md:h-32">
  <img src={...} className="w-full h-full object-cover" />
  ...badge...
</div>
```
sa:
```tsx
<div className="relative w-full aspect-[4/3] md:aspect-[16/9] overflow-hidden bg-muted">
  {/* Blurovana pozadina */}
  <img
    src={item.meal.image_url}
    alt=""
    aria-hidden="true"
    className="absolute inset-0 w-full h-full object-cover scale-110 blur-xl opacity-60"
  />
  {/* Glavna slika - cela vidljiva */}
  <img
    src={item.meal.image_url}
    alt={item.meal.name}
    loading="lazy"
    className="relative w-full h-full object-contain"
  />
  {item.pickup_status === 'preuzeto' && (
    <div className="absolute top-2 right-2 bg-green-500 rounded-full p-1.5 z-10">
      <CheckCircle2 className="h-5 w-5 text-white" />
    </div>
  )}
</div>
```

### 2) `src/components/employee/OrderMealDialog.tsx` (linije ~388-396)
Zameniti:
```tsx
{meal.image_url && (
  <img src={meal.image_url} alt={meal.name} className="w-full h-32 object-cover" />
)}
```
sa istim letterbox+blur obrascem u `aspect-[4/3]` kontejneru (bez `md:` override-a — dijalog je uži, 4:3 daje dobar odnos i na mobilnom i na desktopu).

### 3) (opciono, konzistentnost) brzi `rg` po `object-cover` na slikama obroka u `src/components/employee/*` i primena istog obrasca ako postoji još jedna instanca (npr. `MealCard` ima dva mesta na liniji 100/103).

## Tehničke napomene
- Nema novih zavisnosti — Tailwind ima `aspect-*`, `blur-xl`, `scale-110`.
- `bg-muted` daje neutralan fallback dok se slika ne učita.
- `aria-hidden` na blurovanoj kopiji da čitači ekrana ne duplikuju alt.
- Admin tabela (`MealsManagement.tsx`, thumbnaili 10×10/12×12) ostaje `object-cover` — tu je crop poželjan za sitne ikonice.
- Nema izmena podataka, RLS-a, ni edge funkcija. Čisto CSS/markup.

## Verifikacija
- Otvoriti formu za poručivanje na mobilnom viewportu i proveriti da se „Gulaš sa piletinom" vidi ceo (mash + sos), bez sečenja vrha.
- Proveriti kartice u „Tekuća" i „Iduća" — slike u celosti, bez „crnih" praznih ivica (popunjava ih blur).
- Proveriti i pejzažne i portretne originalne slike — obe izgledaju uravnoteženo.