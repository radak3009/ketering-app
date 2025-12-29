import type { Tables } from '@/integrations/supabase/types';
import type { ProfileBasic } from './user';

// Base feedback type from database
export type FeedbackBase = Tables<'feedback'>;

// Feedback with profile info
export interface Feedback extends FeedbackBase {
  profiles?: ProfileBasic | null;
}

// Feedback creation data
export interface FeedbackCreateData {
  content: string;
  user_id: string;
}
