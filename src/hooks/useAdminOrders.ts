import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { handleError, handleSuccess } from '@/services/errorService';

interface CreateAdminOrderParams {
  userId: string;
  deliveryDate: string;
  shift: string;
  mealId: string;
  mealPrice: number;
}

interface UpdateOrderItemParams {
  orderItemId: string;
  shift?: string;
  mealId?: string;
  mealPrice?: number;
}

export function useAdminOrders(onSuccess?: () => void) {
  const createAdminOrder = useCallback(async (params: CreateAdminOrderParams) => {
    try {
      // Check if an order already exists for this user + delivery_date
      const { data: existingOrder } = await supabase
        .from('orders')
        .select('id')
        .eq('user_id', params.userId)
        .eq('delivery_date', params.deliveryDate)
        .maybeSingle();

      let orderId: string;

      if (existingOrder) {
        orderId = existingOrder.id;
      } else {
        const { data: newOrder, error: orderError } = await supabase
          .from('orders')
          .insert({
            user_id: params.userId,
            delivery_date: params.deliveryDate,
            order_date: new Date().toISOString().split('T')[0],
            status: 'pending',
            total_amount: params.mealPrice,
          })
          .select('id')
          .single();

        if (orderError) throw orderError;
        orderId = newOrder.id;
      }

      const { error: itemError } = await supabase
        .from('order_items')
        .insert({
          order_id: orderId,
          meal_id: params.mealId,
          shift: params.shift,
          quantity: 1,
          unit_price: params.mealPrice,
          total_price: params.mealPrice,
        });

      if (itemError) throw itemError;

      // Update order total_amount
      const { data: items } = await supabase
        .from('order_items')
        .select('total_price')
        .eq('order_id', orderId);

      const newTotal = items?.reduce((sum, i) => sum + Number(i.total_price), 0) || 0;
      await supabase.from('orders').update({ total_amount: newTotal }).eq('id', orderId);

      handleSuccess({ category: 'create', entity: 'porudžbina' });
      onSuccess?.();
    } catch (error) {
      handleError({ category: 'create', entity: 'porudžbina', error });
      throw error;
    }
  }, [onSuccess]);

  const updateOrderItem = useCallback(async (params: UpdateOrderItemParams) => {
    try {
      const updates: Record<string, unknown> = {};
      if (params.shift) updates.shift = params.shift;
      if (params.mealId) {
        updates.meal_id = params.mealId;
        if (params.mealPrice !== undefined) {
          updates.unit_price = params.mealPrice;
          updates.total_price = params.mealPrice;
        }
      }

      const { error } = await supabase
        .from('order_items')
        .update(updates)
        .eq('id', params.orderItemId);

      if (error) throw error;

      handleSuccess({ category: 'update', entity: 'porudžbina' });
      onSuccess?.();
    } catch (error) {
      handleError({ category: 'update', entity: 'porudžbina', error });
      throw error;
    }
  }, [onSuccess]);

  const deleteOrderItem = useCallback(async (orderItemId: string) => {
    try {
      const { error } = await supabase
        .from('order_items')
        .delete()
        .eq('id', orderItemId);

      if (error) throw error;

      // cleanup_empty_orders trigger handles removing empty orders
      handleSuccess({ category: 'delete', entity: 'porudžbina' });
      onSuccess?.();
    } catch (error) {
      handleError({ category: 'delete', entity: 'porudžbina', error });
      throw error;
    }
  }, [onSuccess]);

  return { createAdminOrder, updateOrderItem, deleteOrderItem };
}
