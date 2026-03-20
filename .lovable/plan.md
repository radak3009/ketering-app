

## Plan: Pretraga po imenu i ID kartice + podešavanje širina

### Izmene u `src/components/admin/OrdersOverview.tsx`

1. **Promeniti placeholder** Input polja za filter (linija 310) sa "Filter po ID kartice..." na "Filter po ID kartice ili imenu..."

2. **Proširiti logiku filtriranja** u `flatOrderItems` memo (linije 146-149) — pored `cardId`, pretraživati i po `userName`:
   ```typescript
   return items.filter(i => 
     i.cardId.toLowerCase().includes(f) || 
     i.userName.toLowerCase().includes(f)
   );
   ```

3. **Smanjiti širinu** Input-a za pretragu po obroku (linija 295-301) — dodati `max-w-[280px]` klasu

4. **Povećati širinu** Input-a za filter po ID/imenu (linija 309-314) — promeniti `w-40` na `w-56`

### Fajlovi
| Fajl | Izmena |
|------|--------|
| `src/components/admin/OrdersOverview.tsx` | Placeholder, filter logika, širine inputa |

