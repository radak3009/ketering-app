Može da se vrati stari UX: automatska toast poruka posle osvežavanja/prijave kada postoji nova verzija, sa dugmetom za ažuriranje. Problem nije u tome da je to nemoguće, već u tome što su poslednje izmene razdvojile detekciju ažuriranja od toast prikaza i dodatno unele konflikt u Workbox navigacionu strategiju.

## Šta sam našao

1. Toast za automatsko ažuriranje trenutno ne postoji u automatskom toku
   - `UpdateContext` kada detektuje update samo radi `setManualNeedRefresh(true)`.
   - `UpdatePrompt` prikazuje fiksni donji banner, ali ne šalje Sonner toast.
   - `AppVersionBadge` prikazuje toast samo kada korisnik ručno klikne „Proveri ažuriranja“.
   - Zato ponašanje „posle refresh-a ili prijave izađe toast sa dugmetom“ više nije pokriveno kodom.

2. PWA navigacioni cache je u konfliktu
   - `vite.config.ts` je izbacio `index.html` iz precache-a, što je ispravan smer za svež shell.
   - Ali je ostao `navigateFallback: "/index.html"`.
   - U generisanom `sw.js` se zato i dalje prvo registruje Workbox `NavigationRoute(createHandlerBoundToURL("/index.html"))`, pa tek posle toga custom `NetworkFirst` navigaciona ruta.
   - To znači da `NetworkFirst` ruta za navigacije može da ne bude ona koja stvarno obrađuje refresh u PWA režimu. To objašnjava zašto mobilna PWA može ostati zaglavljena na staroj shell verziji.

3. Razlika `v0.0.0 · 27` i `v0.0.0 · 29` nije pravi release/version sistem
   - `v0.0.0` dolazi iz `package.json`, gde je verzija i dalje `0.0.0`.
   - Broj `27` / `29` dolazi iz build date-a.
   - To je indikator build datuma, ali nije dovoljno precizan za dijagnostiku PWA update-a, jer nema vreme build-a ni jedinstveni build ID.

## Plan implementacije

### 1. Vratiti automatski toast update prompt

Uvesti ponovo Sonner toast koji se prikuje kada `needRefresh === true`:

- Toast tekst: „Dostupno je ažuriranje“.
- Opis: „Nova verzija aplikacije je spremna.“
- Dugme: „Ažuriraj“.
- Klik na dugme poziva postojeći `updateServiceWorker(true)` tok.
- Toast treba da bude dugotrajan ili persistent, da ne nestane pre nego što korisnik reaguje.
- Koristiće se stabilan toast ID, npr. `pwa-update-available`, da se ne gomilaju duplikati.

Zadržaću i postojeći donji `UpdatePrompt` banner kao fallback/persistent UI, ali će toast ponovo biti primarni signal kao ranije.

### 2. Dodati okidače za proveru posle mount-a, refresh-a, focus-a i vraćanja online

U `UpdateContext` ću stabilizovati provere tako da se update proverava:

- odmah nakon registracije service worker-a,
- kratko nakon mount-a aplikacije,
- kada se tab/app vrati u fokus,
- kada se aplikacija vrati online,
- kada se dokument vrati iz hidden u visible stanje,
- periodično kao i sada.

Cilj: posle refresh-a, otvaranja PWA ili prijave korisnik opet dobija automatsku poruku ako je objavljena nova verzija.

### 3. Popraviti Workbox konfiguraciju navigacija

U `vite.config.ts` ću ukloniti `navigateFallback: "/index.html"`, jer sada pravi konflikt sa nameravanom `NetworkFirst` strategijom.

Zadržati i pojačati runtime rute:

```text
Navigacija korisnika:
  online  -> prvo mreža, dobija novi index.html
  offline -> fallback na runtime cache ako postoji

/index.html?pwa-check=...:
  uvek NetworkFirst / no-store kompatibilno
```

Tako PWA neće više prvo pokušavati da koristi Workbox precache fallback za `index.html`, već će navigacije stvarno ići kroz `NetworkFirst`.

### 4. Stabilizovati ručni i automatski update tok

U `UpdateContext` ću razdvojiti, ali povezati tri slučaja:

```text
A) postoji waiting service worker
   -> prikaži toast/banner
   -> dugme šalje SKIP_WAITING
   -> reload watchdog proverava da li su asset hash-evi promenjeni

B) nema waiting SW, ali je published index.html promenjen
   -> prikaži toast/banner
   -> dugme radi običan reload
   -> ako su asseti isti posle 2s, hard reload watchdog čisti cache/SW i učitava cache-busted URL

C) nema razlike
   -> očisti stale update state
   -> ručna provera prikazuje „Aplikacija je ažurna“
```

### 5. Poboljšati ručni toast iz dugmeta „Proveri ažuriranja“

Kada ručna provera nađe update, umesto običnog `toast.success("Novo ažuriranje je dostupno")`, prikazaću toast sa akcijom:

- „Novo ažuriranje je dostupno“
- dugme „Ažuriraj“
- klik koristi isti centralni update tok kao automatski toast.

Tako ručna i automatska provera imaju isto ponašanje.

### 6. Poboljšati prikaz build verzije

Neću menjati poslovnu verziju aplikacije bez potrebe, ali ću predložiti jasniji build label:

- `v0.0.0` ostaje ako `package.json` ostane `0.0.0`.
- Build datum treba proširiti na datum + vreme ili build ID, npr. `29. apr 2026, 08:55`.

Ovo će olakšati proveru da li je PWA stvarno prešla na novu verziju.

## Tehnički detalji izmena

Planirane datoteke:

- `src/contexts/UpdateContext.tsx`
  - dodati centralni `notifyUpdateAvailable`/toast ili izložiti stabilan signal koji komponenta može da koristi,
  - dodati event listenere za `focus`, `online`, `visibilitychange`,
  - sprečiti duple intervale/toastove,
  - zadržati watchdog hard reload logiku.

- `src/components/UpdatePrompt.tsx`
  - eventualno zadržati kao donji banner,
  - povezati sa istim centralnim update akcijama.

- `src/components/AppVersionBadge.tsx`
  - ručni update toast dobija akciju „Ažuriraj“.

- `vite.config.ts`
  - ukloniti `navigateFallback`,
  - ostaviti `NetworkFirst` za navigacije i `/index.html`,
  - ugraditi denylist za `~oauth` direktno u runtime `urlPattern`.

## Očekivani rezultat

- Na web aplikaciji i mobilnoj PWA, posle refresh-a/otvaranja/prijave, ako postoji nova verzija, ponovo će se pojaviti toast poruka sa dugmetom za ažuriranje.
- Klik na „Ažuriraj“ će prvo pokušati normalan PWA update/reload.
- Ako posle 2 sekunde i dalje ostanu isti asseti, watchdog će pokrenuti hard reload i očistiti cache/SW.
- Mobilna PWA više ne bi trebalo da ostaje zaglavljena na starom shell-u zbog Workbox navigation fallback konflikta.
- Verzija u footer-u/bedžu će biti informativnija za proveru realnog build-a.