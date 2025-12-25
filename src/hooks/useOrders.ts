import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Tables } from '@/integrations/supabase/types';

type Order = Tables<'orders'>;
type OrderItem = Tables<'order_items'>;
type Meal = Tables<'meals'>;

interface Profile {
  id: string;
  full_name: string | null;
  company_card_id: string | null;
}

interface OrderWithItems extends Order {
  order_items?: (OrderItem & { meal: Meal })[];
  profile?: Profile;
}

interface MealOrderSummary {
  meal_id: string;
  meal_name: string;
  meal_image_url: string | null;
  total_orders: number;
}

export function useOrders() {
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDateRange, setCurrentDateRange] = useState<{ start?: string; end?: string }>({});
  const { toast } = useToast();

  const fetchOrders = async (startDate?: string, endDate?: string) => {
    try {
      setLoading(true);
      // Store current date range for realtime refetch
      setCurrentDateRange({ start: startDate, end: endDate });
      
      // First fetch orders with order items
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

      // Apply date filters independently
      if (startDate) {
        query = query.gte('delivery_date', startDate);
      }
      if (endDate) {
        query = query.lte('delivery_date', endDate);
      }

      const { data: ordersData, error: ordersError } = await query;

      if (ordersError) throw ordersError;
      
      // Get unique user IDs from orders
      const userIds = [...new Set(ordersData?.map(o => o.user_id) || [])];
      
      // Fetch profiles for those users
      let profilesMap: Record<string, Profile> = {};
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
      console.error('Error fetching orders:', error);
      toast({
        title: 'Greška',
        description: 'Nije moguće učitati porudžbine',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

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

      // Group by meal and sum quantities
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

      // Convert to array and sort by total orders descending
      return Object.values(mealGroups).sort((a, b) => b.total_orders - a.total_orders);
    } catch (error) {
      console.error('Error fetching meal orders by date:', error);
      return [];
    }
  };

  const searchMealOrders = async (mealName: string, startDate?: string, endDate?: string) => {
    try {
      setLoading(true);
      
      // First, get all orders with their items and meals
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

      // Apply date filters independently
      if (startDate) {
        ordersQuery = ordersQuery.gte('delivery_date', startDate);
      }
      if (endDate) {
        ordersQuery = ordersQuery.lte('delivery_date', endDate);
      }

      const { data, error } = await ordersQuery;

      if (error) throw error;
      
      // Filter orders that have at least one meal matching the search term (case-insensitive)
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
      console.error('Error searching meal orders:', error);
      toast({
        title: 'Greška',
        description: 'Nije moguće pretražiti porudžbine',
        variant: 'destructive'
      });
      return [];
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    
    // Realtime subscription for order_items changes
    const channel = supabase
      .channel('order-items-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'order_items' },
        () => {
          // Re-fetch orders when any order_item changes
          fetchOrders(currentDateRange.start, currentDateRange.end);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentDateRange.start, currentDateRange.end]);

  return {
    orders,
    loading,
    fetchOrders,
    getMealOrdersByDate,
    searchMealOrders,
    refetch: fetchOrders
  };
}