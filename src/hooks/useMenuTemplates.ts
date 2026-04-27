import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { handleError, handleSuccess } from '@/services/errorService';
import type {
  MenuTemplateWithMeals,
  MenuTemplateCreateData,
  MenuTemplateUpdateData,
} from '@/types/menu';

export function useMenuTemplates() {
  const [templates, setTemplates] = useState<MenuTemplateWithMeals[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTemplates = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('menu_templates')
        .select(`
          *,
          menu_template_meals (
            *,
            meals (*)
          )
        `)
        .order('created_at', { ascending: false });

      console.log('[useMenuTemplates] fetch result:', { count: data?.length, error });

      if (error) throw error;

      const formatted = (data || []).map((t: any) => ({
        ...t,
        meals: t.menu_template_meals?.map((tm: any) => ({
          ...tm,
          meal: tm.meals,
        })) || [],
      }));

      setTemplates(formatted);
    } catch (error) {
      console.error('[useMenuTemplates] fetch error:', error);
      handleError({ category: 'fetch', entity: 'jelovnik', error });
    } finally {
      setLoading(false);
    }
  }, []);

  const createTemplate = async (data: MenuTemplateCreateData) => {
    try {
      const { data: tpl, error } = await supabase
        .from('menu_templates')
        .insert([{
          name: data.name,
          description: data.description ?? null,
          organization_tag: data.organization_tag ?? null,
          status: data.status ?? 'aktivan',
        }])
        .select()
        .single();

      if (error) throw error;

      if (data.meal_ids.length > 0) {
        const rows = data.meal_ids.map(meal_id => ({
          template_id: tpl.id,
          meal_id,
          quantity: 1,
        }));
        const { error: insErr } = await supabase
          .from('menu_template_meals')
          .insert(rows);
        if (insErr) throw insErr;
      }

      await fetchTemplates();
      handleSuccess({ category: 'create', entity: 'jelovnik' });
      return tpl;
    } catch (error) {
      handleError({ category: 'create', entity: 'jelovnik', error });
      throw error;
    }
  };

  const updateTemplate = async (id: string, data: MenuTemplateUpdateData) => {
    try {
      const updates: Record<string, any> = {};
      if (data.name !== undefined) updates.name = data.name;
      if (data.description !== undefined) updates.description = data.description;
      if (data.organization_tag !== undefined) updates.organization_tag = data.organization_tag;
      if (data.status !== undefined) updates.status = data.status;

      if (Object.keys(updates).length > 0) {
        const { error } = await supabase
          .from('menu_templates')
          .update(updates)
          .eq('id', id);
        if (error) throw error;
      }

      if (data.meal_ids) {
        const { error: delErr } = await supabase
          .from('menu_template_meals')
          .delete()
          .eq('template_id', id);
        if (delErr) throw delErr;

        if (data.meal_ids.length > 0) {
          const rows = data.meal_ids.map(meal_id => ({
            template_id: id,
            meal_id,
            quantity: 1,
          }));
          const { error: insErr } = await supabase
            .from('menu_template_meals')
            .insert(rows);
          if (insErr) throw insErr;
        }
      }

      await fetchTemplates();
      handleSuccess({ category: 'update', entity: 'jelovnik' });
    } catch (error) {
      handleError({ category: 'update', entity: 'jelovnik', error });
      throw error;
    }
  };

  const deleteTemplate = async (id: string) => {
    try {
      const { error } = await supabase
        .from('menu_templates')
        .delete()
        .eq('id', id);
      if (error) throw error;
      setTemplates(prev => prev.filter(t => t.id !== id));
      handleSuccess({ category: 'delete', entity: 'jelovnik' });
    } catch (error) {
      handleError({ category: 'delete', entity: 'jelovnik', error });
      throw error;
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  return {
    templates,
    loading,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    refetch: fetchTemplates,
  };
}
