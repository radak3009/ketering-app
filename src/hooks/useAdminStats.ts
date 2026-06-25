import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { handleError } from '@/services/errorService';

export interface AdminStats {
  totalOrders: number;
  totalRevenue: number;
  employeesOrdered: number;
  avgOrderValue: number;
  todayOrders: number;
  todayPickedUp: number;
  shiftBreakdown: { shift: string; count: number }[];
  topMeals: { name: string; count: number }[];
}

export function useAdminStats(startDate?: string, endDate?: string) {
  const [stats, setStats] = useState<AdminStats>({
    totalOrders: 0,
    totalRevenue: 0,
    employeesOrdered: 0,
    avgOrderValue: 0,
    todayOrders: 0,
    todayPickedUp: 0,
    shiftBreakdown: [],
    topMeals: [],
  });
  const [loading, setLoading] = useState(true);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Helper to fetch all rows bypassing the 1000-row default limit
  const fetchAllFromTable = async (
    table: 'orders' | 'order_items',
    selectColumns: string,
    filters: (q: any) => any
  ): Promise<any[]> => {
    const pageSize = 1000;
    let allData: any[] = [];
    let from = 0;
    let hasMore = true;
    while (hasMore) {
      let query = supabase.from(table).select(selectColumns).range(from, from + pageSize - 1);
      query = filters(query);
      const { data, error } = await query;
      if (error) throw error;
      if (data) {
        allData = allData.concat(data);
      }
      hasMore = (data?.length || 0) === pageSize;
      from += pageSize;
    }
    return allData;
  };

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch ALL orders for the period (bypass 1000-row limit)
      const orders = await fetchAllFromTable(
        'orders',
        'id, total_amount, user_id, delivery_date',
        (q: any) => {
          if (startDate) q = q.gte('delivery_date', startDate);
          if (endDate) q = q.lte('delivery_date', endDate);
          return q;
        }
      );

      // Today's stats - count order_items (consistent with pivot tables)
      const today = new Date().toISOString().split('T')[0];
      
      // Fetch today's order IDs first
      const { data: todayOrders } = await supabase
        .from('orders')
        .select('id')
        .eq('delivery_date', today);
      
      let todayOrdersCount = 0;
      let todayPickedUpCount = 0;
      
      if (todayOrders && todayOrders.length > 0) {
        const todayOrderIds = todayOrders.map(o => o.id);
        
        // Count all order_items for today (matches pivot table total)
        const batchSize = 100;
        for (let i = 0; i < todayOrderIds.length; i += batchSize) {
          const batch = todayOrderIds.slice(i, i + batchSize);
          const { count: itemsCount } = await supabase
            .from('order_items')
            .select('*', { count: 'exact', head: true })
            .in('order_id', batch);
          todayOrdersCount += itemsCount || 0;
        }
        
        // Count picked up order_items for today
        for (let i = 0; i < todayOrderIds.length; i += batchSize) {
          const batch = todayOrderIds.slice(i, i + batchSize);
          const { count: pickedCount } = await supabase
            .from('order_items')
            .select('*', { count: 'exact', head: true })
            .in('order_id', batch)
            .eq('pickup_status', 'preuzeto');
          todayPickedUpCount += pickedCount || 0;
        }
      }

      if (!orders || orders.length === 0) {
        setStats({
          totalOrders: 0,
          totalRevenue: 0,
          employeesOrdered: 0,
          avgOrderValue: 0,
          todayOrders: todayOrdersCount || 0,
          todayPickedUp: todayPickedUpCount,
          shiftBreakdown: [],
          topMeals: [],
        });
        return;
      }

      const totalRevenue = orders.reduce(
        (sum, order) => sum + parseFloat(order.total_amount.toString()),
        0
      );
      
      const uniqueUsers = new Set(orders.map(order => order.user_id));
      const employeesOrdered = uniqueUsers.size;

      // Fetch ALL order_items for the period (bypass 1000-row limit)
      const orderIds = orders.map(o => o.id);
      
      let shiftBreakdown: { shift: string; count: number }[] = [];
      let topMeals: { name: string; count: number }[] = [];
      let totalOrders = 0;

      if (orderIds.length > 0) {
        // Fetch order_items in batches of 100 IDs, each with pagination to get ALL rows
        const batchSize = 100;
        const allItems: { shift: string; meal_id: string }[] = [];
        
        for (let i = 0; i < orderIds.length; i += batchSize) {
          const batch = orderIds.slice(i, i + batchSize);
          const batchItems = await fetchAllFromTable(
            'order_items',
            'shift, meal_id',
            (q: any) => q.in('order_id', batch)
          );
          allItems.push(...batchItems);
        }
        
        const shiftCounts: Record<string, number> = {};
        const mealCounts: Record<string, number> = {};
        
        allItems.forEach(item => {
          shiftCounts[item.shift] = (shiftCounts[item.shift] || 0) + 1;
          mealCounts[item.meal_id] = (mealCounts[item.meal_id] || 0) + 1;
        });
        
        shiftBreakdown = Object.entries(shiftCounts).map(([shift, count]) => ({ shift, count }));
        totalOrders = allItems.length;

        // Top 3 meals
        const sortedMeals = Object.entries(mealCounts)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 3);
        
        if (sortedMeals.length > 0) {
          const topMealIds = sortedMeals.map(([id]) => id);
          const { data: mealNames } = await supabase
            .from('meals')
            .select('id, name')
            .in('id', topMealIds);
          
          const nameMap: Record<string, string> = {};
          mealNames?.forEach(m => { nameMap[m.id] = m.name; });
          topMeals = sortedMeals.map(([id, count]) => ({
            name: nameMap[id] || 'Nepoznat',
            count,
          }));
        }
      }

      const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

      setStats({
        totalOrders,
        totalRevenue: Math.round(totalRevenue),
        employeesOrdered,
        avgOrderValue: Math.round(avgOrderValue),
        todayOrders: todayOrdersCount || 0,
        todayPickedUp: todayPickedUpCount,
        shiftBreakdown,
        topMeals,
      });
    } catch (error) {
      handleError({ 
        category: 'fetch', 
        entity: 'podaci', 
        error,
        customMessage: 'Nije moguće učitati statistiku'
      });
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  const debouncedFetchStats = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      fetchStats();
    }, 500);
  }, [fetchStats]);

  useEffect(() => {
    fetchStats();

    const channel = supabase
      .channel('admin-stats-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => debouncedFetchStats()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'order_items' },
        () => debouncedFetchStats()
      )
      .subscribe();

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      supabase.removeChannel(channel);
    };
  }, [fetchStats, debouncedFetchStats]);

  return {
    stats,
    loading,
    refetch: fetchStats,
  };
}
