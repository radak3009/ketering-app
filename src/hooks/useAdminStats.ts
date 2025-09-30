import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface AdminStats {
  totalOrders: number;
  totalRevenue: number;
  employeesOrdered: number;
  avgOrderValue: number;
}

export function useAdminStats(startDate?: string, endDate?: string) {
  const [stats, setStats] = useState<AdminStats>({
    totalOrders: 0,
    totalRevenue: 0,
    employeesOrdered: 0,
    avgOrderValue: 0,
  });
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchStats = async () => {
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

      if (!orders || orders.length === 0) {
        setStats({
          totalOrders: 0,
          totalRevenue: 0,
          employeesOrdered: 0,
          avgOrderValue: 0,
        });
        return;
      }

      // Računanje metrika
      const totalOrders = orders.length;
      const totalRevenue = orders.reduce(
        (sum, order) => sum + parseFloat(order.total_amount.toString()),
        0
      );
      
      // Jedinstveni korisnici koji su poručili
      const uniqueUsers = new Set(orders.map(order => order.user_id));
      const employeesOrdered = uniqueUsers.size;

      const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

      setStats({
        totalOrders,
        totalRevenue: Math.round(totalRevenue),
        employeesOrdered,
        avgOrderValue: Math.round(avgOrderValue),
      });
    } catch (error: any) {
      console.error('Error fetching stats:', error);
      toast({
        title: 'Greška',
        description: 'Nije moguće učitati statistiku',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [startDate, endDate]);

  return {
    stats,
    loading,
    refetch: fetchStats,
  };
}
