import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { format, addWeeks, startOfWeek, addDays } from 'date-fns';
import { sr, enUS } from 'date-fns/locale';

interface Meal {
  id: string;
  name: string;
  description: string;
  image_url: string | null;
  category: string;
  allergens: string[] | null;
}

interface Menu {
  id: string;
  menu_date: string;
  name: string;
  meals: Meal[];
}

interface OrderMealDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string | undefined;
  onOrderCreated: () => void;
  totalMenuDays: number;
  refreshTrigger: number;
}

export function OrderMealDialog({ open, onOpenChange, userId, onOrderCreated, totalMenuDays, refreshTrigger }: OrderMealDialogProps) {
  const { t, i18n } = useTranslation();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedShift, setSelectedShift] = useState<string>('');
  const [selectedMeal, setSelectedMeal] = useState<string>('');
  const [availableDates, setAvailableDates] = useState<{ value: string; label: string }[]>([]);
  const [menus, setMenus] = useState<Menu[]>([]);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(false);
  const [existingOrderDates, setExistingOrderDates] = useState<string[]>([]);
  const { toast } = useToast();

  const dateLocale = i18n.language === 'sr' ? sr : enUS;

  const SHIFTS = [
    { value: 'prva', label: t('orders.shifts.prva') },
    { value: 'druga', label: t('orders.shifts.druga') },
    { value: 'treća', label: t('orders.shifts.treća') },
  ];

  useEffect(() => {
    if (open && userId) {
      fetchMenus();
      fetchExistingOrders();
    }
  }, [open, userId]);

  useEffect(() => {
    if (open && refreshTrigger > 0) {
      fetchMenus();
      fetchExistingOrders();
    }
  }, [refreshTrigger]);

  useEffect(() => {
    if (selectedDate) {
      loadMealsForDate(selectedDate);
    } else {
      setMeals([]);
    }
  }, [selectedDate, menus]);

  useEffect(() => {
    if (menus.length > 0) {
      generateAvailableDatesFromMenus(menus);
    }
  }, [existingOrderDates, menus, i18n.language]);

  const fetchExistingOrders = async () => {
    if (!userId) return;

    const nextWeekStart = addWeeks(startOfWeek(new Date(), { weekStartsOn: 1 }), 1);
    const nextWeekEnd = addDays(nextWeekStart, 6);

    const { data, error } = await supabase
      .from('order_items')
      .select('orders!inner(delivery_date, user_id)')
      .eq('orders.user_id', userId)
      .gte('orders.delivery_date', format(nextWeekStart, 'yyyy-MM-dd'))
      .lte('orders.delivery_date', format(nextWeekEnd, 'yyyy-MM-dd'));

    if (!error && data) {
      const dates = data.map((item: any) => item.orders?.delivery_date).filter(Boolean);
      const uniqueDates = [...new Set(dates)];
      setExistingOrderDates(uniqueDates);
    }
  };

  const generateAvailableDatesFromMenus = (fetchedMenus: Menu[]) => {
    const dates = fetchedMenus
      .filter(menu => !existingOrderDates.includes(menu.menu_date))
      .map(menu => ({
        value: menu.menu_date,
        label: format(new Date(menu.menu_date), 'EEEE, d. MMMM', { locale: dateLocale })
      }));
    
    setAvailableDates(dates);
    
    if (dates.length > 0) {
      setSelectedDate(dates[0].value);
    }
  };

  const fetchMenus = async () => {
    const nextWeekStart = addWeeks(startOfWeek(new Date(), { weekStartsOn: 1 }), 1);
    const nextWeekEnd = addDays(nextWeekStart, 6);

    const { data, error } = await supabase
      .from('menus')
      .select(`
        id,
        menu_date,
        name,
        menu_meals (
          meal_id,
          meals (
            id,
            name,
            description,
            image_url,
            category,
            allergens
          )
        )
      `)
      .gte('menu_date', format(nextWeekStart, 'yyyy-MM-dd'))
      .lte('menu_date', format(nextWeekEnd, 'yyyy-MM-dd'))
      .eq('is_active', true)
      .order('menu_date', { ascending: true });

    if (error) {
      console.error('Error fetching menus:', error);
      return;
    }

    const formattedMenus: Menu[] = data?.map((menu: any) => ({
      id: menu.id,
      menu_date: menu.menu_date,
      name: menu.name,
      meals: menu.menu_meals?.map((mm: any) => mm.meals).filter(Boolean) || []
    })) || [];

    setMenus(formattedMenus);
  };

  const loadMealsForDate = (date: string) => {
    const menu = menus.find(m => m.menu_date === date);
    setMeals(menu?.meals || []);
    setSelectedMeal('');
  };

  const handleOrder = async () => {
    if (!userId || !selectedDate || !selectedShift || !selectedMeal) {
      toast({
        title: t('common.error'),
        description: t('orders.fillAllFields'),
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    const { data: existingOrder } = await supabase
      .from('orders')
      .select('id')
      .eq('user_id', userId)
      .eq('delivery_date', selectedDate)
      .single();

    let orderId = existingOrder?.id;

    if (!orderId) {
      const { data: newOrder, error: orderError } = await supabase
        .from('orders')
        .insert({
          user_id: userId,
          delivery_date: selectedDate,
          order_date: format(new Date(), 'yyyy-MM-dd'),
          status: 'pending',
          total_amount: 0
        })
        .select()
        .single();

      if (orderError) {
        console.error('Error creating order:', orderError);
        toast({
          title: t('common.error'),
          description: t('orders.cannotCreateOrder'),
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      orderId = newOrder.id;
    }

    const { data: mealData } = await supabase
      .from('meals')
      .select('price')
      .eq('id', selectedMeal)
      .single();

    const price = mealData?.price || 0;

    const { error: itemError } = await supabase
      .from('order_items')
      .insert({
        order_id: orderId,
        meal_id: selectedMeal,
        shift: selectedShift,
        quantity: 1,
        unit_price: price,
        total_price: price,
        pickup_status: 'nije_preuzeto'
      });

    setLoading(false);

    if (itemError) {
      console.error('Error creating order item:', itemError);
      toast({
        title: t('common.error'),
        description: t('orders.cannotOrderMeal'),
        variant: 'destructive',
      });
      return;
    }

    await fetchExistingOrders();
    await fetchMenus();
    
    const nextWeekStart = addWeeks(startOfWeek(new Date(), { weekStartsOn: 1 }), 1);
    const nextWeekEnd = addDays(nextWeekStart, 6);

    const { data: updatedOrders } = await supabase
      .from('orders')
      .select('delivery_date')
      .eq('user_id', userId)
      .gte('delivery_date', format(nextWeekStart, 'yyyy-MM-dd'))
      .lte('delivery_date', format(nextWeekEnd, 'yyyy-MM-dd'));

    const { data: availableMenus } = await supabase
      .from('menus')
      .select('menu_date')
      .gte('menu_date', format(nextWeekStart, 'yyyy-MM-dd'))
      .lte('menu_date', format(nextWeekEnd, 'yyyy-MM-dd'))
      .eq('is_active', true);

    const orderedDates = updatedOrders?.map(o => o.delivery_date) || [];
    const menuDates = availableMenus?.map(m => m.menu_date) || [];
    const remainingDates = menuDates.filter(d => !orderedDates.includes(d));

    if (remainingDates.length === 0) {
      toast({
        title: t('orders.complete'),
        description: t('orders.orderedAllDays'),
      });
      onOrderCreated();
      onOpenChange(false);
    } else {
      const messageKey = remainingDates.length === 1 ? 'orders.movingToNextDay' : 'orders.movingToNextDays';
      toast({
        title: t('orders.success'),
        description: t(messageKey, { count: remainingDates.length }),
      });
      
      setTimeout(() => {
        if (remainingDates.length > 0) {
          const nextDate = remainingDates[0];
          setSelectedDate(nextDate);
          setSelectedMeal('');
          // Scroll to top of dialog after moving to next day
          scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
        }
      }, 300);
      
      onOrderCreated();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent ref={scrollContainerRef} className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('orders.orderMeal')}</DialogTitle>
          {availableDates.length > 0 && (
            <p className="text-sm text-muted-foreground mt-2">
              {t('orders.remainingDays', { count: availableDates.length })}
            </p>
          )}
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>{t('orders.day')}</Label>
            <Select value={selectedDate} onValueChange={setSelectedDate}>
              <SelectTrigger>
                <SelectValue placeholder={t('orders.selectDay')} />
              </SelectTrigger>
              <SelectContent>
                {availableDates.map(date => (
                  <SelectItem key={date.value} value={date.value}>
                    {date.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t('orders.shift')}</Label>
            <Select value={selectedShift} onValueChange={setSelectedShift}>
              <SelectTrigger>
                <SelectValue placeholder={t('orders.selectShift')} />
              </SelectTrigger>
              <SelectContent>
                {SHIFTS.map(shift => (
                  <SelectItem key={shift.value} value={shift.value}>
                    {shift.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t('orders.meal')}</Label>
            {!selectedDate && (
              <p className="text-sm text-muted-foreground">{t('orders.selectDayFirst')}</p>
            )}
            {selectedDate && meals.length === 0 && (
              <p className="text-sm text-muted-foreground">{t('orders.noMealsForDay')}</p>
            )}
            {selectedDate && meals.length > 0 && (
              <div className="grid gap-3">
                {meals.map(meal => (
                  <div
                    key={meal.id}
                    onClick={() => setSelectedMeal(meal.id)}
                    className={`border rounded-lg overflow-hidden cursor-pointer transition-all ${
                      selectedMeal === meal.id ? 'ring-2 ring-primary' : 'hover:shadow-md'
                    }`}
                  >
                    {meal.image_url && (
                      <img
                        src={meal.image_url}
                        alt={meal.name}
                        className="w-full h-32 object-cover"
                      />
                    )}
                    <div className="p-3">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-medium">{meal.name}</h3>
                        <Badge variant="outline">{meal.category}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        {meal.description}
                      </p>
                      {meal.allergens && meal.allergens.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {meal.allergens.map((allergen, idx) => (
                            <Badge key={idx} variant="secondary" className="text-xs">
                              {allergen}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button 
            onClick={handleOrder} 
            disabled={loading || !selectedDate || !selectedShift || !selectedMeal}
          >
            {loading ? t('orders.ordering') : t('orders.order')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
