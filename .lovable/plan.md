## Plan: Intervalno i manuelno osvežavanje porudžbina

### Pregled

Zameniti realtime Supabase pretplatu u `useOrders` hooeku sa automatskim osvežavanjem na svakih 5 minuta + dugme za manuelno osvežavanje u zaglavlju odeljka Porudžbine.

### Izmene

#### 1. `src/hooks/useOrders.ts`

- Ukloniti realtime subscription (linije 182-197) — kanal `order-items-realtime`
- Dodati `setInterval` od 5 minuta (300000ms) koji poziva `fetchOrders` sa trenutnim datumskim opsegom
- Cleanup interval u `useEffect` return

#### 2. `src/components/admin/OrdersOverview.tsx`

- Dodati dugme `RefreshCw` ikonica pored naslova ili pored dugmeta "Nova porudžbina"
- Na klik poziva `refetch()` iz `useOrders` hooka sa trenutnim datumskim opsegom
- Tokom učitavanja dugme se rotira (animacija `animate-spin`)
- Na mobilnom: dugme u redu sa "Nova porudžbina", oba full-width

### Fajlovi za izmenu


| Fajl                                      | Izmena                   |
| ----------------------------------------- | ------------------------ |
| `src/hooks/useOrders.ts`                  | Interval umesto realtime |
| `src/components/admin/OrdersOverview.tsx` | Dugme za osvežavanje     |
