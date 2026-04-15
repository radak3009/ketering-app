

## Plan: Offline podrška za Kiosk (Queue & Sync)

### Problem
Kada WiFi konekcija padne, kiosk ne može da potvrdi preuzimanje obroka jer sve operacije (serve, confirm-pickup) zahtevaju mrežni poziv ka Edge funkcijama.

### Rešenje
Implementirati **offline queue** sistem koji lokalno skladišti neuspele operacije i automatski ih sinhronizuje kada se konekcija ponovo uspostavi.

### Izmene

**1. Novi servis: `src/services/offlineQueue.ts`**
- IndexedDB skladište za čuvanje neuspelih operacija (preživljava refresh/reboot)
- Svaka operacija se čuva kao `{ id, type, token, pickupRequestId, kioskType, timestamp }`
- Tipovi operacija: `serve`, `confirm-pickup`
- Funkcija `enqueue()` za dodavanje u red
- Funkcija `processQueue()` koja redom šalje zahteve i briše uspešne
- Slušač na `navigator.onLine` event za automatski retry pri ponovnom povezivanju
- Periodic retry svakih 10 sekundi dok postoje stavke u redu
- Dedup logika: ne dodaje istu operaciju dva puta

**2. Izmena: `src/pages/KioskPickup.tsx`**
- U `handleConfirmPickup`: ako `fetch` padne sa network greškom, sačuvaj u offline queue
- Prikaži korisniku "confirmed" ekran sa napomenom "Biće sinhronizovano" umesto greške
- Dodaj indikator broja stavki u offline redu (badge na ekranu)
- Dodaj online/offline status indikator

**3. Izmena: `src/pages/KioskKitchen.tsx`**
- U `handleServe`: ako `fetch` padne sa network greškom, sačuvaj u offline queue
- Zadrži optimistički UI update (već postoji) — korisnik vidi da je obrok izdat
- Dodaj badge sa brojem stavki čekaju sinhronizaciju
- Dodaj online/offline status indikator

**4. Izmena: `src/services/kioskApi.ts`**
- Pomoćna funkcija `isNetworkError(error)` za razlikovanje mrežnih grešaka od serverskih

### Ključni detalji

- **IndexedDB** umesto localStorage jer je pouzdaniji za strukturirane podatke i preživljava sve scenarije
- **Optimistički UI** već postoji na Kitchen kiosku — offline queue samo osigurava da se podaci zaista pošalju
- **Deduplikacija na serveru** već postoji (provera `pickup_status === 'preuzeto'`) — dupli zahtevi su bezbedni
- **Vizuelni feedback**: offline badge prikazuje koliko operacija čeka sync, nestaje kad se sve pošalje

```text
Tok rada:
1. Korisnik potvrdi obrok
2. Pokušaj slanja na server
3a. Uspeh → normalan tok
3b. Network error → sačuvaj u IndexedDB, prikaži "sačuvano offline"
4. Kad se WiFi vrati → automatski pošalji sve iz reda
5. Badge prikazuje preostale stavke
```

