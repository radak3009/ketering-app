export const SHIFTS = ['prva', 'druga', 'treća'] as const;
export type Shift = typeof SHIFTS[number];

export const ROLES = ['admin', 'employee'] as const;
export type Role = typeof ROLES[number];

export const MEAL_STATUSES = ['aktivan', 'neaktivan'] as const;
export type MealStatus = typeof MEAL_STATUSES[number];

export const WEEK_DAYS = ['Nedelja', 'Ponedeljak', 'Utorak', 'Sreda', 'Četvrtak', 'Petak', 'Subota'] as const;

export const PICKUP_STATUSES = ['nije_preuzeto', 'preuzeto'] as const;
export type PickupStatus = typeof PICKUP_STATUSES[number];
