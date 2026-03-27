

## Plan: Zameniti karticu Obroci sa Top 3 Obroka (bar chart)

### Pregled
Karticu "Obroci" (prva kartica u metrici) zameniti horizontalnim bar chart-om koji prikazuje 3 najnaručivanija obroka za odabrani period — isti vizuelni stil kao kartica "Po smenama".

### Izmene

#### 1. `src/hooks/useAdminStats.ts`
- Dodati `topMeals: { name: string; count: number }[]` u `AdminStats` interfejs
- U `fetchStats`, iz već dohvaćenih `order_items` (batch petlja gde se čitaju shift-ovi), dodati i `meal_id` u select
- Prebrojati porudžbine po `meal_id`, uzeti top 3
- Za top 3 meal_id-jeva dohvatiti imena iz tabele `meals`
- Postaviti u stats kao `topMeals`

#### 2. `src/components/AdminDashboard.tsx`
- Zameniti Card 1 (Obroci, linije 119-131) sa horizontalnim bar chart-om
- Naslov: "Top 3 obroka"
- Isti layout kao "Po smenama": `ResponsiveContainer`, `BarChart layout="vertical"`, `Bar` sa label
- YAxis prikazuje skraćeno ime obroka (max ~12 karaktera), XAxis skriven
- Tri distinktne boje za barove
- Kada nema podataka: "Nema podataka" poruka
- Ukloniti `useMeals` import ako više nije potreban na ovoj stranici

### Fajlovi za izmenu
| Fajl | Izmena |
|------|--------|
| `src/hooks/useAdminStats.ts` | Dodati `topMeals` u stats, dohvatiti iz order_items |
| `src/components/AdminDashboard.tsx` | Zameniti karticu Obroci sa Top 3 bar chart |

