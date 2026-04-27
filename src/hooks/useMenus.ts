import { useState, useEffect } from 'react';
import { format, addDays, differenceInDays, parseISO } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { handleError, handleSuccess } from '@/services/errorService';
import { WEEK_DAYS } from '@/constants';
import type { MenuWithMeals, MenuCreateData, MenuUpdateData } from '@/types';

// Helper function to generate menu name from date
const generateMenuName = (date: Date | string): string => {
  const menuDate = typeof date === 'string' ? parseISO(date) : date;
  const dayName = WEEK_DAYS[menuDate.getDay()];
  const formattedDate = format(menuDate, 'dd.MM.yyyy');
  return `${dayName} ${formattedDate}`;
};

export function useMenus() {
  const [menus, setMenus] = useState<MenuWithMeals[]>([]);
  const [loading, setLoading] = useState(true);

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
      handleError({ category: 'fetch', entity: 'jelovnik', error });
    } finally {
      setLoading(false);
    }
  };

  const createMenu = async (menuData: MenuCreateData) => {
    try {
      const { data: menu, error: menuError } = await supabase
        .from('menus')
        .insert([{
          name: menuData.name,
          description: menuData.description,
          menu_date: menuData.menu_date,
          organization_tag: menuData.organization_tag ?? null
        }])
        .select()
        .single();

      if (menuError) throw menuError;

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

      await fetchMenus();
      handleSuccess({ category: 'create', entity: 'jelovnik' });
      return menu;
    } catch (error) {
      handleError({ category: 'create', entity: 'jelovnik', error });
      throw error;
    }
  };

  const updateMenu = async (id: string, menuData: MenuUpdateData) => {
    try {
      const { error: menuError } = await supabase
        .from('menus')
        .update({
          name: menuData.name,
          description: menuData.description,
          menu_date: menuData.menu_date
        })
        .eq('id', id);

      if (menuError) throw menuError;

      if (menuData.meal_ids) {
        const { error: deleteError } = await supabase
          .from('menu_meals')
          .delete()
          .eq('menu_id', id);

        if (deleteError) throw deleteError;

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

      await fetchMenus();
      handleSuccess({ category: 'update', entity: 'jelovnik' });
    } catch (error) {
      handleError({ category: 'update', entity: 'jelovnik', error });
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
      handleSuccess({ category: 'delete', entity: 'jelovnik' });
    } catch (error) {
      handleError({ category: 'delete', entity: 'jelovnik', error });
      throw error;
    }
  };

  const cloneWeekMenus = async (sourceMenus: MenuWithMeals[], targetWeekStart: Date) => {
    try {
      // Sort source menus by date to ensure correct week start calculation
      const sortedSourceMenus = [...sourceMenus].sort((a, b) => 
        parseISO(a.menu_date).getTime() - parseISO(b.menu_date).getTime()
      );
      
      // Use parseISO for consistent date parsing (avoids UTC timezone issues)
      const sourceWeekStart = parseISO(sortedSourceMenus[0].menu_date);
      const daysDiff = differenceInDays(targetWeekStart, sourceWeekStart);

      for (const sourceMenu of sortedSourceMenus) {
        const sourceDate = parseISO(sourceMenu.menu_date);
        const targetDate = addDays(sourceDate, daysDiff);
        
        const { data: newMenu, error: menuError } = await supabase
          .from('menus')
          .insert([{
            name: generateMenuName(targetDate),
            description: sourceMenu.description,
            menu_date: format(targetDate, 'yyyy-MM-dd'),
            is_active: true,
            organization_tag: sourceMenu.organization_tag ?? null
          }])
          .select()
          .single();

        if (menuError) throw menuError;

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
      handleSuccess({ 
        category: 'create', 
        entity: 'jelovnik', 
        customMessage: `Klonirano ${sourceMenus.length} jelovnika` 
      });
    } catch (error) {
      handleError({ 
        category: 'create', 
        entity: 'jelovnik', 
        error,
        customMessage: 'Nije moguće klonirati jelovnike'
      });
      throw error;
    }
  };

  const cloneSingleMenu = async (sourceMenu: MenuWithMeals, targetDate: Date) => {
    try {
      const { data: newMenu, error: menuError } = await supabase
        .from('menus')
        .insert([{
          name: generateMenuName(targetDate),
          description: sourceMenu.description,
          menu_date: format(targetDate, 'yyyy-MM-dd'),
          is_active: true,
          organization_tag: sourceMenu.organization_tag ?? null
        }])
        .select()
        .single();

      if (menuError) throw menuError;

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

      await fetchMenus();
      handleSuccess({ 
        category: 'create', 
        entity: 'jelovnik', 
        customMessage: `Jelovnik kloniran na ${format(targetDate, 'dd.MM.yyyy')}` 
      });
    } catch (error) {
      handleError({ 
        category: 'create', 
        entity: 'jelovnik', 
        error,
        customMessage: 'Nije moguće klonirati jelovnik'
      });
      throw error;
    }
  };

  const assignTemplate = async (
    template: { id: string; name: string; description: string | null; organization_tag: string | null; meals?: Array<{ meal_id: string; quantity: number }> },
    dates: Date[]
  ) => {
    try {
      const sortedDates = [...dates].sort((a, b) => a.getTime() - b.getTime());
      for (const targetDate of sortedDates) {
        const menuName = generateMenuName(targetDate);
        const { data: newMenu, error: menuError } = await supabase
          .from('menus')
          .insert([{
            name: menuName,
            description: template.description,
            menu_date: format(targetDate, 'yyyy-MM-dd'),
            is_active: true,
            organization_tag: template.organization_tag,
            template_id: template.id,
          }])
          .select()
          .single();

        if (menuError) throw menuError;

        if (template.meals && template.meals.length > 0) {
          const rows = template.meals.map(m => ({
            menu_id: newMenu.id,
            meal_id: m.meal_id,
            quantity: m.quantity ?? 1,
          }));
          const { error: mmErr } = await supabase.from('menu_meals').insert(rows);
          if (mmErr) throw mmErr;
        }
      }

      await fetchMenus();
      handleSuccess({
        category: 'create',
        entity: 'jelovnik',
        customMessage: `Jelovnik dodeljen za ${sortedDates.length} ${sortedDates.length === 1 ? 'datum' : 'datuma'}`,
      });
    } catch (error) {
      handleError({
        category: 'create',
        entity: 'jelovnik',
        error,
        customMessage: 'Nije moguće dodeliti jelovnik',
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
    cloneSingleMenu,
    assignTemplate,
    refetch: fetchMenus
  };
}

// Re-export type for backward compatibility
export type { MenuWithMeals } from '@/types';
