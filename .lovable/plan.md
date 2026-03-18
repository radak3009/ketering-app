

## Plan: Filtriranje obroka po smeni u formi za poručivanje

### Problem
Trenutno se svi obroci za odabrani dan prikazuju bez obzira na odabranu smenu. Korisnik može videti obroke koji nisu dostupni za njegovu smenu (npr. doručak koji se služi samo u I smeni).

### Izmene u `src/components/employee/OrderMealDialog.tsx`

**1. Dodati `shifts` u Meal interfejs (linija 14-21)**
- Dodati `shifts: string[] | null` u lokalni `Meal` interfejs

**2. Uključiti `shifts` u query (linija ~135-146)**
- Dodati `shifts` u select meals polja unutar menu_meals query-ja

**3. Sakriti obroke dok smena nije odabrana**
- Izmeniti sekciju za prikaz obroka (oko linije 350+) tako da se obroci prikazuju samo kada su i `selectedDate` i `selectedShift` popunjeni
- Bez odabrane smene, prikazati poruku "Odaberite smenu" umesto liste obroka

**4. Filtrirati obroke po smeni**
- Izmeniti `loadMealsForDate` ili dodati novi efekat koji filtrira obroke na osnovu `selectedShift`
- Obrok se prikazuje ako: `meal.shifts` je null/prazan (dostupan svima) ILI `meal.shifts` sadrži odabranu smenu
- Dodati `selectedShift` kao dependency u useEffect za učitavanje obroka

**5. Resetovati odabrani obrok pri promeni smene**
- Kada korisnik promeni smenu, resetovati `selectedMeal` na prazan string

### Logika filtriranja
```
filteredMeals = meals.filter(meal => 
  !meal.shifts || meal.shifts.length === 0 || meal.shifts.includes(selectedShift)
)
```

### Fajl za izmenu
- `src/components/employee/OrderMealDialog.tsx`

