

## Plan: Dodavanje atributa 'Grupa' na obroke

### 1. Migracija baze
- Dodati kolonu `meal_group TEXT` u tabelu `meals`
- Azurirati `meals_secure` view da ukljuci `meal_group`

### 2. Izmene u `MealsManagement.tsx`

#### Tabela
- **Sakriti** kolonu "Opis" (header, filter, body cell)
- **Dodati** kolonu "Grupa" odmah posle "Naziv obroka" — prikazuje Badge ili "-"
- Dodati filter za grupu (Select sa dinamickim opcijama iz postojecih obroka)

#### MealFormState + initialMealForm
- Dodati `meal_group: string` (default `""`)

#### Forma za dodavanje obroka (Sheet "Dodaj novi obrok")
- Dodati polje "Grupa" **ispod polja "Opis" (linija 306) a iznad polja "Alergeni" (linija 308)**
- Implementacija: Select sa opcijama:
  - Postojece grupe (unique iz `meals` niza)
  - "Nova grupa..." opcija koja prikazuje Input za unos
  - "Bez grupe" opcija

#### Forma za uredjivanje obroka (Edit Sheet)
- Dodati isto polje "Grupa" na istoj poziciji

#### handleCreateMeal / handleUpdateMeal
- Ukljuciti `meal_group` u payload

#### filteredMeals logika
- Dodati `matchesGroup` proveru

### Fajlovi za izmenu

| Fajl | Akcija |
|------|--------|
| DB migracija | `ALTER TABLE meals ADD COLUMN meal_group text` + azurirati `meals_secure` view |
| `src/components/admin/MealsManagement.tsx` | Svi UI/logika opisani gore |

