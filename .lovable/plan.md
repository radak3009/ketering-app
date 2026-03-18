

## Plan: Izmene na Admin > Obroci tabeli

### Izmena 1: Zamena kolona "Nabavna cena" i "Cena" kolonom "Dostupnost u smenama"

**U `MealsManagement.tsx`:**
- Ukloniti dva `TableHead` elementa za "Nabavna cena" i "Cena" (linije 724-728)
- Dodati jedan `TableHead` za "Smene" koji prikazuje badge-eve sa rimskim brojevima (I, II, III)
- U `TableBody` redovima: ukloniti dva `TableCell` za cene, dodati jedan koji prikazuje smene kao badge-eve
- Ažurirati `colSpan` za prazno stanje (sa 9 na 8)
- Shift label helper: `prva→I`, `druga→II`, `treća→III`

### Izmena 2: Bulk izmena smena (kao bulk Tag u Korisnicima)

- Dodati state: `selectedMealIds` (Set), `bulkShiftDialogOpen`, `bulkShiftValues` (string[]), `bulkUpdating`
- Dodati checkbox kolonu u header (select all) i u svaki red
- Bulk action bar iznad tabele kad su obroci selektovani — dugme "Izmeni smene"
- AlertDialog sa checkbox-ovima za tri smene (I, II, III)
- `handleBulkShiftUpdate`: iterira selektovane obroke i poziva `updateMeal(id, { shifts: bulkShiftValues })`
- Pattern identičan `handleBulkTagUpdate` iz `UsersManagement.tsx`

### Izmena 3: Filter po smenama

- Filter za smene već postoji u `mealFilters.shifts` (linija 47) i logika filtriranja je već implementirana (linija 334-335)
- Potrebno je dodati UI za filter u header tabele — Popover sa checkbox-ovima za svaku smenu (I/II/III), identičan patternu filtera za Organizaciju
- Postaviti ga kao novu kolonu "Smene" umesto uklonjenih kolona za cene

### Fajlovi za izmenu
- `src/components/admin/MealsManagement.tsx` — jedini fajl

### Rezime promena
1. Uklanjaju se kolone "Nabavna cena" i "Cena" iz tabele
2. Nova kolona "Smene" sa filter popoverom (checkbox I/II/III) i prikazom badge-eva
3. Checkbox kolona za selekciju obroka + bulk action bar sa "Izmeni smene" dugmetom
4. Cene ostaju vidljive u Sheet-u za editovanje pojedinačnog obroka

