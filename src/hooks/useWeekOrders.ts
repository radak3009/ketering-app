import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { startOfWeek, endOfWeek, addWeeks, format, getHours } from 'date-fns';
import { handleError } from '@/services/errorService';
import type { WeekOrder, OrderItemForWeekView } from '@/types';

export const useWeekOrders = (userId: string | undefined) => {
  const [currentWeekOrders, setCurrentWeekOrders] = useState<WeekOrder[]>([]);
  const [nextWeekOrders, setNextWeekOrders] = useState<WeekOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const canEditNextWeek = () => {
    const now = new Date();
    const day = now.getDay();
    const hours = getHours(now);
    
    if (day === 5 && hours >= 17) {
      return false;
    }
    if (day === 6 || day === 0) {
      return false;
    }
    return true;
  };

  const fetchWeekOrders = async (weekStart: Date, weekEnd: Date) => {
    if (!userId) return [];

    const startDate = format(weekStart, 'yyyy-MM-dd');
    const endDate = format(weekEnd, 'yyyy-MM-dd');

    const { data, error } = await supabase
      .from('order_items')
      .select(`
        id,
        order_id,
        meal_id,
        shift,
        pickup_status,
        pickup_time,
        meals (
          id,
          name,
          description,
          image_url,
          category,
          allergens
        ),
        orders!inner (
          user_id,
          delivery_date
        )
      `)
      .eq('orders.user_id', userId)
      .gte('orders.delivery_date', startDate)
      .lte('orders.delivery_date', endDate);

    if (error) {
      handleError({ category: 'fetch', entity: 'porudžbina', error });
      return [];
    }

    const groupedByDate: { [key: string]: OrderItemForWeekView[] } = {};
    
    data?.forEach((item: any) => {
      const deliveryDate = item.orders.delivery_date;
      if (!groupedByDate[deliveryDate]) {
        groupedByDate[deliveryDate] = [];
      }
      groupedByDate[deliveryDate].push({
        id: item.id,
        order_id: item.order_id,
        meal_id: item.meal_id,
        shift: item.shift,
        pickup_status: item.pickup_status,
        pickup_time: item.pickup_time,
        delivery_date: deliveryDate,
        meal: item.meals
      });
    });

    return Object.entries(groupedByDate).map(([date, items]) => ({
      date,
      items
    }));
  };

  const fetchOrders = async () => {
    if (!userId) return;
    
    setLoading(true);
    const now = new Date();
    
    const currentStart = startOfWeek(now, { weekStartsOn: 1 });
    const currentEnd = endOfWeek(now, { weekStartsOn: 1 });
    
    const nextStart = addWeeks(currentStart, 1);
    const nextEnd = addWeeks(currentEnd, 1);

    const [current, next] = await Promise.all([
      fetchWeekOrders(currentStart, currentEnd),
      fetchWeekOrders(nextStart, nextEnd)
    ]);

    setCurrentWeekOrders(current);
    setNextWeekOrders(next);
    setLoading(false);
  };

  useEffect(() => {
    fetchOrders();
  }, [userId]);

  return {
    currentWeekOrders,
    nextWeekOrders,
    loading,
    canEditNextWeek: canEditNextWeek(),
    refetch: fetchOrders
  };
};

// Re-export types for backward compatibility
export type { WeekOrder, OrderItemForWeekView as OrderItemWithMeal } from '@/types';
