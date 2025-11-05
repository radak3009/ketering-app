import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Tables } from '@/integrations/supabase/types';

type Menu = Tables<'menus'>;
type MenuMeal = Tables<'menu_meals'>;
type Meal = Tables<'meals'>;

export interface MenuWithMeals extends Menu {
  meals?: (MenuMeal & { meal: Meal })[];
}

export function useMenus() {
  const [menus, setMenus] = useState<MenuWithMeals[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchMenus = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('menus')
        .select(`
          *,
          menu_meals (
            *,
            meals (*)
          )
        `)
        .order('menu_date', { ascending: false });

      if (error) throw error;
      
      const formattedMenus = data?.map(menu => ({
        ...menu,
        meals: menu.menu_meals?.map(mm => ({
          ...mm,
          meal: mm.meals
        }))
      })) || [];
      
      setMenus(formattedMenus);
    } catch (error) {
      console.error('Error fetching menus:', error);
      toast({
        title: 'Greška',
        description: 'Nije moguće učitati jelovnike',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const createMenu = async (menuData: {
    name: string;
    description?: string;
    menu_date: string;
    meal_ids: string[];
  }) => {
    try {
      // First create the menu
      const { data: menu, error: menuError } = await supabase
        .from('menus')
        .insert([{
          name: menuData.name,
          description: menuData.description,
          menu_date: menuData.menu_date
        }])
        .select()
        .single();

      if (menuError) throw menuError;

      // Then add meals to the menu
      if (menuData.meal_ids.length > 0) {
        const menuMeals = menuData.meal_ids.map(meal_id => ({
          menu_id: menu.id,
          meal_id,
          quantity: 1
        }));

        const { error: menuMealsError } = await supabase
          .from('menu_meals')
          .insert(menuMeals);

        if (menuMealsError) throw menuMealsError;
      }

      await fetchMenus(); // Refresh the list
      
      toast({
        title: 'Uspeh',
        description: 'Jelovnik je uspešno kreiran'
      });
      
      return menu;
    } catch (error) {
      console.error('Error creating menu:', error);
      toast({
        title: 'Greška',
        description: 'Nije moguće kreirati jelovnik',
        variant: 'destructive'
      });
      throw error;
    }
  };

  const updateMenu = async (id: string, menuData: {
    description?: string;
    menu_date?: string;
    meal_ids?: string[];
  }) => {
    try {
      // Update menu basic info
      const { error: menuError } = await supabase
        .from('menus')
        .update({
          description: menuData.description,
          menu_date: menuData.menu_date
        })
        .eq('id', id);

      if (menuError) throw menuError;

      // Update meal associations if provided
      if (menuData.meal_ids) {
        // First delete existing associations
        const { error: deleteError } = await supabase
          .from('menu_meals')
          .delete()
          .eq('menu_id', id);

        if (deleteError) throw deleteError;

        // Then add new associations
        if (menuData.meal_ids.length > 0) {
          const menuMeals = menuData.meal_ids.map(meal_id => ({
            menu_id: id,
            meal_id,
            quantity: 1
          }));

          const { error: insertError } = await supabase
            .from('menu_meals')
            .insert(menuMeals);

          if (insertError) throw insertError;
        }
      }

      await fetchMenus(); // Refresh the list
      
      toast({
        title: 'Uspeh',
        description: 'Jelovnik je uspešno ažuriran'
      });
    } catch (error) {
      console.error('Error updating menu:', error);
      toast({
        title: 'Greška',
        description: 'Nije moguće ažurirati jelovnik',
        variant: 'destructive'
      });
      throw error;
    }
  };

  const deleteMenu = async (id: string) => {
    try {
      const { error } = await supabase
        .from('menus')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setMenus(prev => prev.filter(menu => menu.id !== id));
      toast({
        title: 'Uspeh',
        description: 'Jelovnik je uspešno obrisan'
      });
    } catch (error) {
      console.error('Error deleting menu:', error);
      toast({
        title: 'Greška',
        description: 'Nije moguće obrisati jelovnik',
        variant: 'destructive'
      });
      throw error;
    }
  };

  const cloneWeekMenus = async (sourceMenus: MenuWithMeals[], targetWeekStart: Date) => {
    try {
      // Izračunaj razliku u danima između source i target nedelje
      const sourceDates = sourceMenus.map(m => new Date(m.menu_date));
      const sourceWeekStart = new Date(Math.min(...sourceDates.map(d => d.getTime())));
      const daysDiff = Math.floor((targetWeekStart.getTime() - sourceWeekStart.getTime()) / (1000 * 60 * 60 * 24));

      for (const sourceMenu of sourceMenus) {
        const sourceDate = new Date(sourceMenu.menu_date);
        const targetDate = new Date(sourceDate.getTime() + (daysDiff * 24 * 60 * 60 * 1000));
        
        // Kreiraj novi jelovnik
        const { data: newMenu, error: menuError } = await supabase
          .from('menus')
          .insert([{
            name: sourceMenu.name,
            description: sourceMenu.description,
            menu_date: targetDate.toISOString().split('T')[0],
            is_active: true
          }])
          .select()
          .single();

        if (menuError) throw menuError;

        // Kopiraj meal asocijacije
        if (sourceMenu.meals && sourceMenu.meals.length > 0) {
          const menuMeals = sourceMenu.meals.map(mm => ({
            menu_id: newMenu.id,
            meal_id: mm.meal_id,
            quantity: mm.quantity
          }));

          const { error: menuMealsError } = await supabase
            .from('menu_meals')
            .insert(menuMeals);

          if (menuMealsError) throw menuMealsError;
        }
      }

      await fetchMenus();
      
      toast({
        title: 'Uspeh',
        description: `Klonirano ${sourceMenus.length} jelovnika`
      });
    } catch (error) {
      console.error('Error cloning menus:', error);
      toast({
        title: 'Greška',
        description: 'Nije moguće klonirati jelovnike',
        variant: 'destructive'
      });
      throw error;
    }
  };

  useEffect(() => {
    fetchMenus();
  }, []);

  return {
    menus,
    loading,
    createMenu,
    updateMenu,
    deleteMenu,
    cloneWeekMenus,
    refetch: fetchMenus
  };
}