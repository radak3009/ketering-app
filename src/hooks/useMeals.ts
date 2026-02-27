import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { handleError, handleSuccess } from '@/services/errorService';
import type { Meal, MealInsert, MealUpdate } from '@/types';

export function useMeals() {
  const [meals, setMeals] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(true);
  const { profile } = useAuth();

  const isAdmin = profile?.role === 'admin';

  const fetchMeals = async () => {
    try {
      setLoading(true);
      
      if (isAdmin) {
        const { data, error } = await supabase
          .from('meals')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;
        setMeals(data || []);
      } else {
        const { data, error } = await (supabase as any)
          .from('meals_secure')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;
        setMeals((data || []) as Meal[]);
      }
    } catch (error) {
      handleError({ category: 'fetch', entity: 'obrok', error });
    } finally {
      setLoading(false);
    }
  };

  const createMeal = async (meal: MealInsert) => {
    try {
      const { data, error } = await supabase
        .from('meals')
        .insert([meal])
        .select()
        .single();

      if (error) throw error;

      setMeals(prev => [data, ...prev]);
      await fetchMeals();
      handleSuccess({ category: 'create', entity: 'obrok' });
      return data;
    } catch (error) {
      handleError({ category: 'create', entity: 'obrok', error });
      throw error;
    }
  };

  const updateMeal = async (id: string, updates: MealUpdate) => {
    try {
      const { data, error } = await supabase
        .from('meals')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      setMeals(prev => prev.map(meal => meal.id === id ? data : meal));
      await fetchMeals();
      handleSuccess({ category: 'update', entity: 'obrok' });
      return data;
    } catch (error) {
      handleError({ category: 'update', entity: 'obrok', error });
      throw error;
    }
  };

  const deleteMeal = async (id: string) => {
    try {
      const { error } = await supabase
        .from('meals')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setMeals(prev => prev.filter(meal => meal.id !== id));
      await fetchMeals();
      handleSuccess({ category: 'delete', entity: 'obrok' });
    } catch (error) {
      handleError({ category: 'delete', entity: 'obrok', error });
      throw error;
    }
  };

  useEffect(() => {
    fetchMeals();
  }, [isAdmin]);

  return {
    meals,
    loading,
    createMeal,
    updateMeal,
    deleteMeal,
    refetch: fetchMeals
  };
}
