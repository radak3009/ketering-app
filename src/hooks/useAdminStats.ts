import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { handleError } from '@/services/errorService';

export interface AdminStats {
  totalOrders: number;
  totalRevenue: number;
  employeesOrdered: number;
  avgOrderValue: number;
  todayOrders: number;
  todayPickedUp: number;
}

export function useAdminStats(startDate?: string, endDate?: string) {
  const [stats, setStats] = useState<AdminStats>({
    totalOrders: 0,
    totalRevenue: 0,
    employeesOrdered: 0,
    avgOrderValue: 0,
    todayOrders: 0,
    todayPickedUp: 0,
  });
  const [loading, setLoading] = useState(true);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('orders')
        .select('total_amount, user_id, delivery_date');

      if (startDate) {
        query = query.gte('delivery_date', startDate);
      }
      if (endDate) {
        query = query.lte('delivery_date', endDate);
      }

      const { data: orders, error } = await query;

      if (error) throw error;

      // Today's stats
      const today = new Date().toISOString().split('T')[0];
      const { count: todayOrdersCount } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('delivery_date', today);

      const { data: todayOrderIds } = await supabase
        .from('orders')
        .select('id')
        .eq('delivery_date', today);

      let todayPickedUpCount = 0;
      if (todayOrderIds && todayOrderIds.length > 0) {
        const ids = todayOrderIds.map(o => o.id);
        const { count } = await supabase
          .from('order_items')
          .select('*', { count: 'exact', head: true })
          .in('order_id', ids)
          .eq('pickup_status', 'preuzeto');
        todayPickedUpCount = count || 0;
      }

      if (!orders || orders.length === 0) {
        setStats({
          totalOrders: 0,
          totalRevenue: 0,
          employeesOrdered: 0,
          avgOrderValue: 0,
          todayOrders: todayOrdersCount || 0,
          todayPickedUp: todayPickedUpCount,
        });
        return;
      }

      const totalOrders = orders.length;
      const totalRevenue = orders.reduce(
        (sum, order) => sum + parseFloat(order.total_amount.toString()),
        0
      );
      
      const uniqueUsers = new Set(orders.map(order => order.user_id));
      const employeesOrdered = uniqueUsers.size;

      const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

      setStats({
        totalOrders,
        totalRevenue: Math.round(totalRevenue),
        employeesOrdered,
        avgOrderValue: Math.round(avgOrderValue),
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
