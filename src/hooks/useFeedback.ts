import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { handleError, handleSuccess } from '@/services/errorService';
// Extended feedback type with profile info for display
export interface FeedbackWithProfile {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  obradeno: boolean;
  profiles?: {
    full_name: string;
    email: string;
  } | null;
}

export function useFeedback() {
  const [feedback, setFeedback] = useState<FeedbackWithProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFeedback = async () => {
    setLoading(true);
    try {
      const { data: feedbackData, error } = await supabase
        .from('feedback')
        .select('*')
        .eq('obradeno', false)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch profile data for each feedback
      const feedbackWithProfiles = await Promise.all(
        (feedbackData || []).map(async (item) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, email')
            .eq('user_id', item.user_id)
            .single();

          return {
            ...item,
            profiles: profile || undefined,
          };
        })
      );

      setFeedback(feedbackWithProfiles);
    } catch (error) {
      handleError({ category: 'fetch', entity: 'povratna informacija', error });
    } finally {
      setLoading(false);
    }
  };

  const createFeedback = async (content: string, userId: string) => {
    try {
      const { error } = await supabase
        .from('feedback')
        .insert({ content, user_id: userId });

      if (error) throw error;

      handleSuccess({ 
        category: 'create', 
        entity: 'povratna informacija',
        customMessage: 'Utisak je poslat'
      });

      await fetchFeedback();
    } catch (error) {
      handleError({ category: 'create', entity: 'povratna informacija', error });
    }
  };

  const updateFeedback = async (id: string, obradeno: boolean) => {
    try {
      const { error } = await supabase
        .from('feedback')
        .update({ obradeno })
        .eq('id', id);

      if (error) throw error;

      await fetchFeedback();
    } catch (error) {
      handleError({ category: 'update', entity: 'povratna informacija', error });
    }
  };

  useEffect(() => {
    fetchFeedback();
  }, []);

  return {
    feedback,
    loading,
    createFeedback,
    updateFeedback,
    refetch: fetchFeedback,
  };
}

// Re-export for backward compatibility
export type { Feedback } from '@/types';
