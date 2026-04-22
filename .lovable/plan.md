

## Plan: Tag-aware "confirmationRequired" za Kiosk Pickup

### Problem
Korisnici čiji TAG NIJE u `kitchen_schedule_tags` listi (npr. "Hogo hotel") na Kiosk Pickup-u, dok je kuhinja otvorena, dobijaju ekran "Preuzmite obrok na šalteru kuhinje" (success screen) umesto dugmeta za potvrdu preuzimanja. Ovi korisnici ne preuzimaju obrok preko kuhinje i moraju uvek imati self-service flow — bez obzira na status kuhinje.

### Uzrok
`supabase/functions/kiosk-show-meal/index.ts` postavlja `confirmationRequired: !kitchenStatus.isOpen` isključivo na osnovu globalnog statusa kuhinje, ignorišući korisnikov tag. Logika koja proverava `kitchen_schedule_tags` (već postoji u `kiosk-confirm-pickup` i `kiosk-get-kitchen-status`) nije primenjena ovde.

### Izmena

**Jedan fajl: `supabase/functions/kiosk-show-meal/index.ts`**

Pre formiranja odgovora dodati istu `scheduleApplies` proveru koja postoji u `kiosk-confirm-pickup`:

1. Učitati `profiles.tag` (već imamo `profile.id`) i `app_settings` ključ `kitchen_schedule_tags` (paralelno sa već postojećim Promise.all blokom radi performansi).
2. Izračunati `scheduleApplies`:
   - Ako je `kitchen_schedule_tags` prazan → `scheduleApplies = true` (raspored važi za sve, ponašanje kao danas).
   - Ako lista ima vrednosti → `scheduleApplies = userTag !== null && scheduleTags.includes(userTag)`.
3. Izračunati `confirmationRequired`:
   - Ako `scheduleApplies === false` → uvek `true` (korisnik uvek vidi self-service confirm dugme).
   - Ako `scheduleApplies === true` → zadržati postojeću logiku `!kitchenStatus.isOpen`.
4. Primeniti istu logiku na sva tri response branch-a u `kiosk-show-meal` koja vraćaju `confirmationRequired` (postojeći pending request, novi pickup request, kao i `alreadyServed` koji ostaje `false`).

### Rezultat
- "Proizvodnja"/Hogo (tagovi u `kitchen_schedule_tags`): nepromenjeno ponašanje — kada kuhinja radi vide success ekran sa porukom da preuzmu na šalteru.
- "Hogo hotel" i ostali korisnici van liste: uvek dobijaju confirm ekran sa dugmetom "DA, PREUZIMAM", bilo da je kuhinja otvorena ili zatvorena.
- `kiosk-confirm-pickup` već ispravno dozvoljava potvrdu za ove korisnike (`scheduleApplies` skip), tako da tu nije potrebna promena.
- Frontend (`KioskPickup.tsx`) ne menjamo — već ispravno reaguje na `confirmationRequired` flag iz response-a.

