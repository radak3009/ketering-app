

## Plan: Paginacija i tabovi za Povratne informacije

### Pregled
Podeliti sekciju "Povratne" na dva taba (Knjiga utisaka / Predlozi) i dodati `TablePagination` komponentu na obe tabele.

### Izmene

#### 1. `src/components/AdminDashboard.tsx` (linije 256-266)
Zameniti grid sa dva Suspense bloka jednim novim wrapper komponentom ili inline tabovima:
```tsx
<TabsContent value="feedback">
  <Tabs defaultValue="utisci">
    <TabsList>
      <TabsTrigger value="utisci">Knjiga utisaka</TabsTrigger>
      <TabsTrigger value="predlozi">Predlozi za nova jela</TabsTrigger>
    </TabsList>
    <TabsContent value="utisci">
      <Suspense fallback={<TabLoader />}><FeedbackManagement /></Suspense>
    </TabsContent>
    <TabsContent value="predlozi">
      <Suspense fallback={<TabLoader />}><SuggestionsManagement /></Suspense>
    </TabsContent>
  </Tabs>
</TabsContent>
```

#### 2. `src/components/admin/FeedbackManagement.tsx`
- Dodati state: `currentPage`, `pageSize` (default 20)
- Paginirati `filteredFeedback` klijentski: `paginatedFeedback = filteredFeedback.slice((currentPage-1)*pageSize, currentPage*pageSize)`
- Resetovati `currentPage` na 1 pri promeni pretrage
- Dodati `<TablePagination>` ispod tabele

#### 3. `src/components/admin/SuggestionsManagement.tsx`
- Identična paginacija kao za FeedbackManagement
- State: `currentPage`, `pageSize` (default 20)
- Paginirati `filteredSuggestions` klijentski
- Resetovati stranicu pri promeni pretrage
- Dodati `<TablePagination>` ispod tabele

### Fajlovi za izmenu
| Fajl | Izmena |
|------|--------|
| `src/components/AdminDashboard.tsx` | Nested tabovi za Povratne |
| `src/components/admin/FeedbackManagement.tsx` | Paginacija |
| `src/components/admin/SuggestionsManagement.tsx` | Paginacija |

