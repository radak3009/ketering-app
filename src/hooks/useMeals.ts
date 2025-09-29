import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Tables } from '@/integrations/supabase/types';

type Meal = Tables<'meals'>;
type MealInsert = Omit<Meal, 'id' | 'created_at' | 'updated_at'>;
type MealUpdate = Partial<MealInsert>;

export function useMeals() {
  const [meals, setMeals] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchMeals = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('meals')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMeals(data || []);
    } catch (error) {
      console.error('Error fetching meals:', error);
      toast({
        title: 'Greška',
        description: 'Nije moguće učitati obroke',
        variant: 'destructive'
      });
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
      toast({
        title: 'Uspeh',
        description: 'Obrok je uspešno dodat'
      });
      return data;
    } catch (error) {
      console.error('Error creating meal:', error);
      toast({
        title: 'Greška',
        description: 'Nije moguće dodati obrok',
        variant: 'destructive'
      });
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
      toast({
        title: 'Uspeh',
        description: 'Obrok je uspešno ažuriran'
      });
      return data;
    } catch (error) {
      console.error('Error updating meal:', error);
      toast({
        title: 'Greška',
        description: 'Nije moguće ažurirati obrok',
        variant: 'destructive'
      });
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
      toast({
        title: 'Uspeh',
        description: 'Obrok je uspešno obrisan'
      });
    } catch (error) {
      console.error('Error deleting meal:', error);
      toast({
        title: 'Greška',
        description: 'Nije moguće obrisati obrok',
        variant: 'destructive'
      });
      throw error;
    }
  };

  useEffect(() => {
    fetchMeals();
  }, []);

  return {
    meals,
    loading,
    createMeal,
    updateMeal,
    deleteMeal,
    refetch: fetchMeals
  };
}