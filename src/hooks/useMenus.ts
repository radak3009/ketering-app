import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Tables } from '@/integrations/supabase/types';

type Menu = Tables<'menus'>;
type MenuMeal = Tables<'menu_meals'>;
type Meal = Tables<'meals'>;

interface MenuWithMeals extends Menu {
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

  useEffect(() => {
    fetchMenus();
  }, []);

  return {
    menus,
    loading,
    createMenu,
    deleteMenu,
    refetch: fetchMenus
  };
}