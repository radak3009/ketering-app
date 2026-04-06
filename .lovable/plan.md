

## Plan: Prikaz "Kuhinja ne radi" na Kitchen Kiosku van radnog vremena

### Problem
Kitchen Kiosk trenutno prikazuje listu porudzbina i tokom i van radnog vremena kuhinje. Potrebno je da van radnog vremena prikaže poruku "Kuhinja ne radi" sa informacijom o radnom vremenu.

### Pristup
Dodati periodičnu proveru statusa kuhinje (`kiosk-get-kitchen-status`) na Kitchen Kiosk stranici. Kada kuhinja nije otvorena, umesto liste porudzbina prikazati full-screen poruku.

### Izmene

**1. `src/pages/KioskKitchen.tsx`**
- Dodati state za `kitchenOpen`, `openTime`, `closeTime`
- Na mount i svakih ~60s pozivati `kioskApi.getKitchenStatus(token)` da proveri status
- Kada `isOpen === false`, prikazati ekran sa:
  - Ikona `ChefHat` ili `Clock`
  - Naslov: **"Kuhinja ne radi"**
  - Tekst: **"Radno vreme kuhinje od {openTime} do {closeTime}"**
  - Ako su `openTime`/`closeTime` null (npr. zatvoreno ceo dan): prikazati "Kuhinja danas ne radi"
- Kada `isOpen === true`, prikazati postojeći interfejs sa listom porudzbina
- Header sa datumom i connection statusom ostaje vidljiv u oba slučaja

**2. `src/types/kiosk.ts`**
- Dodati `tag_excluded` u `KitchenStatus.reason` union type (za kompatibilnost sa edge function odgovorom)

### Ponašanje
- Polling interval: 60 sekundi (dovoljno brzo da uhvati prelaz u/iz radnog vremena)
- Dok se status učitava prvi put, prikazuje se loading spinner (postojeći)
- Kuhinjsko osoblje vidi jasnu poruku i ne može izdavati obroke van radnog vremena (backend ionako blokira, ali sada i UI to jasno komunicira)

