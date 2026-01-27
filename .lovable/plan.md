
## Plan: Ispravka trke između optimističkog ažuriranja i pollinga na Kitchen Kiosku

### Problem
Kada korisnik klikne "Izdato" na zapisu koji je prethodno bio poništen, dolazi do "bljeskanja" - zapis nestaje, vraća se, pa opet nestaje pre nego što završi na "Izdato danas" listi.

### Uzrok
1. **Optimistički update** odmah premešta zapis iz jedne liste u drugu
2. **Polling (svakih 2.5s)** nastavlja da dohvata podatke iz baze
3. Ako API poziv nije završen pre sledećeg pollinga, polling vraća **staro stanje** iz baze
4. Ovo prepisuje optimistički update i stvara vizuelni "skok" zapisa nazad
5. Kada se baza konačno ažurira, sledeći polling vraća ispravan state

### Rešenje
Dodati mehanizam koji **pauzira polling dok je akcija u toku**. Ovo sprečava da polling prepiše optimističke update-ove.

---

### Tehnički detalji implementacije

#### 1. Dodati `isProcessing` state koji prati da li je bilo koja akcija u toku

```typescript
const [isProcessing, setIsProcessing] = useState(false);
```

#### 2. Modifikovati polling da preskače fetch dok je akcija u toku

```typescript
// Polling every 2.5 seconds - skip if processing
useEffect(() => {
  if (!authorized) return;

  const interval = setInterval(() => {
    if (!isProcessing) {
      fetchQueue();
    }
  }, 2500);
  return () => clearInterval(interval);
}, [authorized, fetchQueue, isProcessing]);
```

#### 3. Ažurirati handleServe, handleUndo, i handleDeleteConfirm

Svaka funkcija treba da:
- Postavi `setIsProcessing(true)` na početku
- Postavi `setIsProcessing(false)` na kraju (u finally bloku)
- Nakon uspešnog API poziva, eksplicitno pozvati `fetchQueue()` da osveži podatke

```typescript
const handleServe = async (item: QueueItem) => {
  setProcessingId(item.id);
  setIsProcessing(true);  // NOVO: Pauziraj polling
  
  // Optimistic update
  setPending(prev => prev.filter(p => p.id !== item.id));
  setServed(prev => [{ ...item, status: 'served', served_at: new Date().toISOString() }, ...prev]);

  try {
    await kioskApi.serve(token, item.id);
    // Uspešno - osveži sa pravim podacima iz baze
    await fetchQueue();
  } catch (error) {
    console.error("Serve error:", error);
    // Revert on error
    await fetchQueue();
  } finally {
    setProcessingId(null);
    setIsProcessing(false);  // NOVO: Nastavi polling
  }
};
```

Ista logika za `handleUndo` i `handleDeleteConfirm`.

---

### Fajlovi za izmenu

| Fajl | Izmena |
|------|--------|
| `src/pages/KioskKitchen.tsx` | Dodati `isProcessing` state, modifikovati polling i handler funkcije |

---

### Alternativno rešenje (naprednije)
Umesto pollinga, koristiti **Supabase Realtime** za slušanje promena na `pickup_requests` tabeli. Međutim, pošto kiosk ne koristi autentifikaciju i sve operacije idu preko Edge Functions sa service role, ovo bi zahtevalo dodatnu konfiguraciju.

Za sada, pauziranje pollinga tokom akcija je jednostavno i efikasno rešenje.
