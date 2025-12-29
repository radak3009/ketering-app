import type { Tables } from '@/integrations/supabase/types';
import type { ProfileBasic } from './user';

// Base suggestion type from database
export type SuggestionBase = Tables<'suggestions'>;

// Suggestion with profile info
export interface Suggestion extends SuggestionBase {
  profiles?: ProfileBasic | null;
}

// Suggestion creation data
export interface SuggestionCreateData {
  meal_name: string;
  description?: string;
  notes?: string;
  user_id: string;
}
