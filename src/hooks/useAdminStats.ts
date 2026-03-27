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
  shiftBreakdown: { shift: string; count: number }[];
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
          shiftBreakdown: [],
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

      // Fetch shift breakdown for the period
      const orderIds = orders.map(o => o.id);
      let shiftBreakdown: { shift: string; count: number }[] = [];
      
      if (orderIds.length > 0) {
        // Fetch in batches if needed (Supabase .in() limit)
        const batchSize = 100;
        const allShifts: string[] = [];
        for (let i = 0; i < orderIds.length; i += batchSize) {
          const batch = orderIds.slice(i, i + batchSize);
          const { data: items } = await supabase
            .from('order_items')
            .select('shift')
            .in('order_id', batch);
          if (items) {
            allShifts.push(...items.map(it => it.shift));
          }
        }
        
        const shiftCounts: Record<string, number> = {};
        allShifts.forEach(s => {
          shiftCounts[s] = (shiftCounts[s] || 0) + 1;
        });
        shiftBreakdown = Object.entries(shiftCounts).map(([shift, count]) => ({ shift, count }));
      }

      setStats({
        totalOrders,
        totalRevenue: Math.round(totalRevenue),
        employeesOrdered,
        avgOrderValue: Math.round(avgOrderValue),
        todayOrders: todayOrdersCount || 0,
        todayPickedUp: todayPickedUpCount,
        shiftBreakdown,
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
