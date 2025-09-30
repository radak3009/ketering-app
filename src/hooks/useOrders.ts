import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Tables } from '@/integrations/supabase/types';

type Order = Tables<'orders'>;
type OrderItem = Tables<'order_items'>;
type Meal = Tables<'meals'>;

interface OrderWithItems extends Order {
  order_items?: (OrderItem & { meal: Meal })[];
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
  const { toast } = useToast();

  const fetchOrders = async (startDate?: string, endDate?: string) => {
    try {
      setLoading(true);
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

      if (startDate && endDate) {
        query = query.gte('delivery_date', startDate).lte('delivery_date', endDate);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      const formattedOrders = data?.map(order => ({
        ...order,
        order_items: order.order_items?.map(oi => ({
          ...oi,
          meal: oi.meals
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
      let query = supabase
        .from('orders')
        .select(`
          *,
          order_items!inner (
            *,
            meals!inner (*)
          )
        `)
        .ilike('order_items.meals.name', `%${mealName}%`)
        .order('delivery_date', { ascending: true });

      if (startDate && endDate) {
        query = query.gte('delivery_date', startDate).lte('delivery_date', endDate);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      const formattedOrders = data?.map(order => ({
        ...order,
        order_items: order.order_items?.map(oi => ({
          ...oi,
          meal: oi.meals
        }))
      })) || [];
      
      setOrders(formattedOrders);
      return formattedOrders;
    } catch (error) {
      console.error('Error searching meal orders:', error);
      return [];
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  return {
    orders,
    loading,
    fetchOrders,
    getMealOrdersByDate,
    searchMealOrders,
    refetch: fetchOrders
  };
}