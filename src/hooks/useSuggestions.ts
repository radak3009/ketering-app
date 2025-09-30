import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface Suggestion {
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
  };
}

export function useSuggestions() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

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
    } catch (error: any) {
      toast({
        title: 'Greška',
        description: error.message,
        variant: 'destructive',
      });
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

      toast({
        title: 'Uspešno',
        description: 'Predlog je poslat',
      });

      await fetchSuggestions();
    } catch (error: any) {
      toast({
        title: 'Greška',
        description: error.message,
        variant: 'destructive',
      });
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
    } catch (error: any) {
      toast({
        title: 'Greška',
        description: error.message,
        variant: 'destructive',
      });
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
