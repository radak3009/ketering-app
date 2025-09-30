import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { format, addWeeks, startOfWeek, addDays } from 'date-fns';
import { sr } from 'date-fns/locale';

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
}

const SHIFTS = [
  { value: 'prva', label: 'Prva smena' },
  { value: 'druga', label: 'Druga smena' },
  { value: 'treća', label: 'Treća smena' },
];

export function OrderMealDialog({ open, onOpenChange, userId, onOrderCreated }: OrderMealDialogProps) {
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedShift, setSelectedShift] = useState<string>('');
  const [selectedMeal, setSelectedMeal] = useState<string>('');
  const [availableDates, setAvailableDates] = useState<{ value: string; label: string }[]>([]);
  const [menus, setMenus] = useState<Menu[]>([]);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(false);
  const [existingOrderDates, setExistingOrderDates] = useState<string[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    if (open && userId) {
      fetchMenus();
      fetchExistingOrders();
    }
  }, [open, userId]);

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
  }, [existingOrderDates, menus]);

  const fetchExistingOrders = async () => {
    if (!userId) return;

    const nextWeekStart = addWeeks(startOfWeek(new Date(), { weekStartsOn: 1 }), 1);
    const nextWeekEnd = addDays(nextWeekStart, 6);

    const { data, error } = await supabase
      .from('orders')
      .select('delivery_date')
      .eq('user_id', userId)
      .gte('delivery_date', format(nextWeekStart, 'yyyy-MM-dd'))
      .lte('delivery_date', format(nextWeekEnd, 'yyyy-MM-dd'));

    if (!error && data) {
      const dates = data.map(order => order.delivery_date).filter(Boolean);
      setExistingOrderDates(dates);
    }
  };

  const generateAvailableDatesFromMenus = (fetchedMenus: Menu[]) => {
    // Extract dates from menus and format them, filtering out dates with existing orders
    const dates = fetchedMenus
      .filter(menu => !existingOrderDates.includes(menu.menu_date))
      .map(menu => ({
        value: menu.menu_date,
        label: format(new Date(menu.menu_date), 'EEEE, d. MMMM', { locale: sr })
      }));
    
    setAvailableDates(dates);
    
    // Auto-select first date if available
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
        title: 'Greška',
        description: 'Molimo popunite sva polja',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    // Check if order already exists for this date
    const { data: existingOrder } = await supabase
      .from('orders')
      .select('id')
      .eq('user_id', userId)
      .eq('delivery_date', selectedDate)
      .single();

    let orderId = existingOrder?.id;

    // Create order if it doesn't exist
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
          title: 'Greška',
          description: 'Nije moguće kreirati porudžbinu',
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      orderId = newOrder.id;
    }

    // Get meal price
    const { data: mealData } = await supabase
      .from('meals')
      .select('price')
      .eq('id', selectedMeal)
      .single();

    const price = mealData?.price || 0;

    // Create order item
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
        title: 'Greška',
        description: 'Nije moguće poručiti obrok',
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Uspešno!',
      description: 'Obrok je uspešno poručen',
    });

    // Refetch orders and available dates
    await fetchExistingOrders();
    await fetchMenus();
    
    // Reset form fields but keep dialog open
    setSelectedDate('');
    setSelectedShift('');
    setSelectedMeal('');
    setMeals([]);
    
    onOrderCreated();
    
    // Check if all dates are now ordered - if so, close dialog
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
        title: 'Kompletno!',
        description: 'Poručili ste obroke za sve dostupne dane',
      });
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Poruči obrok</DialogTitle>
          {availableDates.length > 0 && (
            <p className="text-sm text-muted-foreground mt-2">
              Preostalo dana za poručivanje: {availableDates.length}
            </p>
          )}
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Dan</Label>
            <Select value={selectedDate} onValueChange={setSelectedDate}>
              <SelectTrigger>
                <SelectValue placeholder="Odaberite dan" />
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
            <Label>Smena</Label>
            <Select value={selectedShift} onValueChange={setSelectedShift}>
              <SelectTrigger>
                <SelectValue placeholder="Odaberite smenu" />
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
            <Label>Obrok</Label>
            {!selectedDate && (
              <p className="text-sm text-muted-foreground">Prvo odaberite dan</p>
            )}
            {selectedDate && meals.length === 0 && (
              <p className="text-sm text-muted-foreground">Nema dostupnih obroka za odabrani dan</p>
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
            Otkaži
          </Button>
          <Button 
            onClick={handleOrder} 
            disabled={loading || !selectedDate || !selectedShift || !selectedMeal}
          >
            {loading ? 'Poručivanje...' : 'Poruči'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
