

## Plan: Update meal card display in OrderMealDialog

### What changes

In `src/components/employee/OrderMealDialog.tsx`, update the meal card rendering:

1. **Remove** the `Badge` showing `meal.category` ("Glavno jelo") from the top-right corner
2. **Add allergens** below the meal name — only shown if `meal.allergens` is non-empty
3. **Add description** below allergens — only shown if `meal.description` is non-empty/non-blank

### File modified

| File | Change |
|---|---|
| `src/components/employee/OrderMealDialog.tsx` | Update meal card layout in the render section (~lines 260-290) |

### Layout change

```text
Before:                          After:
┌─────────────────────┐          ┌─────────────────────┐
│ [image]             │          │ [image]             │
│ Name      [Glavno…] │          │ Name                │
│ Description         │          │ 🏷 Allergen badges   │
│ 🏷 Allergen badges   │          │ Description text    │
└─────────────────────┘          └─────────────────────┘
```

