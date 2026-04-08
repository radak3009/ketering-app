

## Plan: Prikaži sve jelovnike sa scroll i auto-fokus na tekuću nedelju

### Problem
Trenutno se filtriraju jelovnici stariji od tekuće nedelje (`weekStart >= currentWeekStart` na liniji 305). Nema prikaza istorije, nema scroll containera, i nema auto-scroll na tekuću nedelju.

### Izmene

**`src/components/admin/MenusManagement.tsx`**

1. **Ukloni filter koji sakriva prošle nedelje** (linije 298-306) — koristi `groupMenusByWeek(filteredMenus)` direktno umesto filtriranja samo budućih nedelja.

2. **Naslov po broju kalendarske nedelje** — već postoji na liniji 506 (`Nedelja ${weekData.weekNumber}`). Prošle nedelje će koristiti isti format. Tekuća i sledeća zadržavaju posebne nazive.

3. **Dodaj scroll container sa max visinom** — umotaj listu nedelja u `div` sa `max-h-[600px] overflow-y-auto` i padding.

4. **Auto-scroll na tekuću nedelju** — dodaj `useRef` + `useEffect` koji nakon renderovanja skroluje do elementa tekuće nedelje koristeći `scrollIntoView`. Dodaj `ref` na `Collapsible` element koji je `isCurrentWeek`.

5. **defaultOpen** — zadrži `defaultOpen` samo za tekuću i sledeću nedelju (već implementirano na liniji 496).

### Ključne promene

```text
Linija 298-306: Ukloni .filter() — prikaži sve nedelje
Linija 494:     Dodaj max-h-[600px] overflow-y-auto p-1 na wrapper div
Novi:           useRef za current-week element + useEffect scrollIntoView
```

