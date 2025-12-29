import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { handleError } from '@/services/errorService';
import type { Meal, OrderWithItems, ProfileBasic, MealOrderSummary } from '@/types';

export function useOrders(initialStartDate?: string, initialEndDate?: string) {
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const currentDateRangeRef = useRef<{ start?: string; end?: string }>({
    start: initialStartDate,
    end: initialEndDate
  });

  const fetchOrders = useCallback(async (startDate?: string, endDate?: string) => {
    try {
      setLoading(true);
      currentDateRangeRef.current = { start: startDate, end: endDate };
      
      let query = supabase
        .from('orders')
        .select(`
          *,
          order_items (
            *,
            meals (*)
          )
        `)
        .order('delivery_date', { ascending: true });

      if (startDate) {
        query = query.gte('delivery_date', startDate);
      }
      if (endDate) {
        query = query.lte('delivery_date', endDate);
      }

      const { data: ordersData, error: ordersError } = await query;

      if (ordersError) throw ordersError;
      
      const userIds = [...new Set(ordersData?.map(o => o.user_id) || [])];
      
      let profilesMap: Record<string, ProfileBasic> = {};
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, user_id, full_name, company_card_id')
          .in('user_id', userIds);
        
        profilesData?.forEach(p => {
          profilesMap[p.user_id] = {
            id: p.id,
            full_name: p.full_name,
            company_card_id: p.company_card_id
          };
        });
      }
      
      const formattedOrders: OrderWithItems[] = ordersData?.map(order => ({
        ...order,
        profile: profilesMap[order.user_id],
        order_items: order.order_items?.map(oi => ({
          ...oi,
          meal: oi.meals as unknown as Meal
        }))
      })) || [];
      
      setOrders(formattedOrders);
    } catch (error) {
      handleError({ category: 'fetch', entity: 'porudžbina', error });
    } finally {
      setLoading(false);
    }
  }, []);

  const getMealOrdersByDate = async (date: string): Promise<MealOrderSummary[]> => {
    try {
      const { data, error } = await supabase
        .from('order_items')
        .select(`
          quantity,
          meals (
            id,
            name,
            image_url
          ),
          orders!inner (
            delivery_date
          )
        `)
        .eq('orders.delivery_date', date);

      if (error) throw error;

      const mealGroups: Record<string, MealOrderSummary> = {};
      
      data?.forEach(item => {
        const meal = item.meals;
        if (meal) {
          if (!mealGroups[meal.id]) {
            mealGroups[meal.id] = {
              meal_id: meal.id,
              meal_name: meal.name,
              meal_image_url: meal.image_url,
              total_orders: 0
            };
          }
          mealGroups[meal.id].total_orders += item.quantity;
        }
      });

      return Object.values(mealGroups).sort((a, b) => b.total_orders - a.total_orders);
    } catch (error) {
      console.error('Error fetching meal orders by date:', error);
      return [];
    }
  };

  const searchMealOrders = async (mealName: string, startDate?: string, endDate?: string) => {
    try {
      setLoading(true);
      
      let ordersQuery = supabase
        .from('orders')
        .select(`
          *,
          order_items (
            *,
            meals (*)
          )
        `)
        .order('delivery_date', { ascending: true });

      if (startDate) {
        ordersQuery = ordersQuery.gte('delivery_date', startDate);
      }
      if (endDate) {
        ordersQuery = ordersQuery.lte('delivery_date', endDate);
      }

      const { data, error } = await ordersQuery;

      if (error) throw error;
      
      const searchLower = mealName.toLowerCase();
      
      const filteredOrders = data?.filter(order => {
        const hasMatch = order.order_items?.some(item => {
          const mealName = item.meals?.name?.toLowerCase() || '';
          return mealName.includes(searchLower);
        });
        return hasMatch;
      }).map(order => ({
        ...order,
        order_items: order.order_items?.map(oi => ({
          ...oi,
          meal: oi.meals
        }))
      })) || [];
      
      setOrders(filteredOrders);
      return filteredOrders;
    } catch (error) {
      handleError({ 
        category: 'fetch', 
        entity: 'porudžbina', 
        error,
        customMessage: 'Nije moguće pretražiti porudžbine'
      });
      return [];
    } finally {
      setLoading(false);
    }
  };

  // Fetch orders when initial date range changes
  useEffect(() => {
    fetchOrders(initialStartDate, initialEndDate);
  }, [initialStartDate, initialEndDate, fetchOrders]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('order-items-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'order_items' },
        () => {
          fetchOrders(currentDateRangeRef.current.start, currentDateRangeRef.current.end);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchOrders]);

  return {
    orders,
    loading,
    fetchOrders,
    getMealOrdersByDate,
    searchMealOrders,
    refetch: fetchOrders
  };
}
