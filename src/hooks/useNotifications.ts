import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { startOfWeek, endOfWeek, addWeeks, getDay, getHours } from 'date-fns';

export const useNotifications = (userId: string | undefined, isAdmin: boolean) => {
  const [employeeNotification, setEmployeeNotification] = useState<string | null>(null);
  const [adminNotification, setAdminNotification] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;

    const checkNotifications = async () => {
      const now = new Date();
      const dayOfWeek = getDay(now);
      const hours = getHours(now);

      // Employee notification: Check if close to deadline
      if (!isAdmin) {
        // Show notification from Monday to Friday before 17:00
        if (dayOfWeek >= 1 && dayOfWeek <= 5) {
          const daysUntilFriday = 5 - dayOfWeek;
          const hoursUntilDeadline = daysUntilFriday * 24 + (17 - hours);

          // Show notification if less than 48 hours until deadline
          if (hoursUntilDeadline <= 48 && hoursUntilDeadline > 0) {
            // Check if user has orders for next week
            const nextMonday = addWeeks(startOfWeek(now, { weekStartsOn: 1 }), 1);
            const nextSunday = addWeeks(endOfWeek(now, { weekStartsOn: 1 }), 1);

            const { data: orders } = await supabase
              .from('orders')
              .select('id')
              .eq('user_id', userId)
              .gte('delivery_date', nextMonday.toISOString().split('T')[0])
              .lte('delivery_date', nextSunday.toISOString().split('T')[0])
              .limit(1);

            if (!orders || orders.length === 0) {
              if (dayOfWeek === 5) {
                setEmployeeNotification('Danas je poslednji dan za poručivanje obroka! (Rok: 17:00h)');
              } else {
                setEmployeeNotification(`Poručite obroke za sledeću nedelju! Rok: Petak 17:00h`);
              }
            } else {
              setEmployeeNotification(null);
            }
          } else {
            setEmployeeNotification(null);
          }
        }
      }

      // Admin notification: Check if menu for next week is defined
      if (isAdmin) {
        const nextMonday = addWeeks(startOfWeek(now, { weekStartsOn: 1 }), 1);
        const nextSunday = addWeeks(endOfWeek(now, { weekStartsOn: 1 }), 1);

        const { data: menus } = await supabase
          .from('menus')
          .select('id, menu_date')
          .eq('is_active', true)
          .gte('menu_date', nextMonday.toISOString().split('T')[0])
          .lte('menu_date', nextSunday.toISOString().split('T')[0]);

        const menuCount = menus?.length || 0;

        if (menuCount < 5) {
          if (menuCount === 0) {
            setAdminNotification('Jelovnik za sledeću nedelju nije definisan!');
          } else {
            setAdminNotification(`Jelovnik za sledeću nedelju je nepotpun (${menuCount}/5 dana)`);
          }
        } else {
          setAdminNotification(null);
        }
      }
    };

    checkNotifications();
    
    // Check every hour
    const interval = setInterval(checkNotifications, 60 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [userId, isAdmin]);

  return { employeeNotification, adminNotification };
};
