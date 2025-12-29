import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { handleError, handleSuccess } from '@/services/errorService';
// Extended suggestion type with profile info for display
export interface SuggestionWithProfile {
  id: string;
  user_id: string;
  meal_name: string;
  description: string;
  additional_notes: string | null;
  created_at: string;
  obradeno: boolean;
  profiles?: {
    full_name: string;
    email: string;
  } | null;
}

export function useSuggestions() {
  const [suggestions, setSuggestions] = useState<SuggestionWithProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSuggestions = async () => {
    setLoading(true);
    try {
      const { data: suggestionsData, error } = await supabase
        .from('suggestions')
        .select('*')
        .eq('obradeno', false)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch profile data for each suggestion
      const suggestionsWithProfiles = await Promise.all(
        (suggestionsData || []).map(async (item) => {
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

      setSuggestions(suggestionsWithProfiles);
    } catch (error) {
      handleError({ category: 'fetch', entity: 'predlog', error });
    } finally {
      setLoading(false);
    }
  };

  const createSuggestion = async (
    mealName: string,
    description: string,
    additionalNotes: string | null,
    userId: string
  ) => {
    try {
      const { error } = await supabase.from('suggestions').insert({
        meal_name: mealName,
        description,
        additional_notes: additionalNotes,
        user_id: userId,
      });

      if (error) throw error;

      handleSuccess({ 
        category: 'create', 
        entity: 'predlog',
        customMessage: 'Predlog je poslat'
      });

      await fetchSuggestions();
    } catch (error) {
      handleError({ category: 'create', entity: 'predlog', error });
    }
  };

  const updateSuggestion = async (id: string, obradeno: boolean) => {
    try {
      const { error } = await supabase
        .from('suggestions')
        .update({ obradeno })
        .eq('id', id);

      if (error) throw error;

      await fetchSuggestions();
    } catch (error) {
      handleError({ category: 'update', entity: 'predlog', error });
    }
  };

  useEffect(() => {
    fetchSuggestions();
  }, []);

  return {
    suggestions,
    loading,
    createSuggestion,
    updateSuggestion,
    refetch: fetchSuggestions,
  };
}

// Re-export for backward compatibility
export type { Suggestion } from '@/types';
