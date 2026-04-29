Potvrdio sam uzrok: objavljeni `sw.js` i dalje sadrži Workbox navigacioni fallback:

```text
registerRoute(new NavigationRoute(createHandlerBoundToURL("index.html")))
```

To znači da prethodna izmena nije stvarno uklonila fallback. Razlog je u `vite-plugin-pwa`: njegov podrazumevani `navigateFallback` je `"index.html"`, pa samo izostavljanje opcije nije dovoljno. Mora eksplicitno da se postavi na `null` ili `undefined` u `workbox` konfiguraciji. Zbog toga PWA i dalje može da vraća stari app shell, čak i nakon deinstalacije/reinstalacije, dok web u browser tabu dobija svež HTML.

## Plan implementacije

### 1. Eksplicitno isključiti Workbox navigate fallback

U `vite.config.ts` ću promeniti PWA konfiguraciju tako da `workbox.navigateFallback` bude eksplicitno isključen:

```ts
workbox: {
  navigateFallback: null,
  globPatterns: ["**/*.{js,css,ico,png,svg,woff2}"],
  runtimeCaching: [ ...NetworkFirst navigacija... ]
}
```

Cilj je da generisani `sw.js` više nema:

```text
NavigationRoute(createHandlerBoundToURL("index.html"))
```

i da navigacije stvarno idu kroz postojeći `NetworkFirst` handler.

### 2. Dodati hitnu PWA recovery putanju pri startu aplikacije

Pošto su neki uređaji već zaglavljeni pod starim service worker-om, dodaću u `src/main.tsx` mali bootstrap recovery pre renderovanja React aplikacije.

Ako URL sadrži recovery parametar, npr:

```text
/?pwa-reset=1
```

aplikacija će pre rendera:

- obrisati sve `caches`,
- odjaviti sve service worker registracije za domen,
- očistiti recovery parametar iz URL-a,
- uraditi `window.location.replace(...)` na čist URL.

Ovo daje korisniku i nama sigurnu, ručnu putanju za izlazak iz starog PWA stanja bez zavisnosti od starog React koda.

### 3. Povezati hard reload sa istom recovery putanjom

U `src/contexts/UpdateContext.tsx` ću izmeniti postojeći `hardReload()` tako da, posle čišćenja cache/SW, preusmeri na URL sa recovery markerom ili cache-busting markerom koji jasno aktivira bootstrap recovery.

Time update dugme više neće zavisiti samo od toga da li stari service worker ispravno prepusti novi `index.html`.

### 4. Dodati manifest start URL cache-busting za nove instalacije

U `vite.config.ts` ću promeniti manifest `start_url` sa:

```json
"/"
```

na stabilnu PWA start putanju sa parametrom, npr:

```json
"/?source=pwa"
```

ili, ako je potrebna agresivnija recovery varijanta:

```json
"/?pwa-start=1"
```

Ovo pomaže novim instalacijama da ne koriste identičan start URL koji je ranije mogao biti uhvaćen starim shell cache-om. Ne menja rute aplikacije, jer React i dalje vidi `/`.

### 5. Dodati jasan dijagnostički indikator

U `AppVersionBadge`/build define ću ostaviti postojeći datum i vreme, ali ću dodati i kratki build identifier baziran na timestamp-u build-a, npr:

```text
v0.0.0 · 29. apr 2026, 09:22 · b1777447
```

Ovo olakšava proveru da li PWA stvarno učitava novi build, a ne samo isti dan/datum.

### 6. Šta će biti potrebno nakon implementacije

Nakon izmene moraće da se klikne `Publish / Update` za frontend. Zatim za zaglavljenu PWA postoje dve opcije:

1. otvoriti PWA i kliknuti `Ažuriraj` ako se toast pojavi;
2. ako se i dalje otvara stari shell, otvoriti u mobilnom browseru:

```text
https://ketering-app.lovable.app/?pwa-reset=1
```

Ovaj link će obrisati stari service worker i cache. Posle toga treba ponovo otvoriti/instalirati PWA.

## Očekivani rezultat

- Objavljeni `sw.js` više neće sadržati `NavigationRoute(createHandlerBoundToURL("index.html"))`.
- PWA navigacije će ići preko `NetworkFirst`, pa novi `index.html` stiže sa mreže kada postoji nova verzija.
- Već zaglavljeni mobilni uređaji imaće recovery URL za čišćenje starog SW/cache stanja.
- Dugme `Ažuriraj` i watchdog će imati jači fallback ako običan reload ne promeni build.
- Version badge će jasno pokazivati da li PWA zaista radi na novom buildu.