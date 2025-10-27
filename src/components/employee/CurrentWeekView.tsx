import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from 'lucide-react';
import { WeekOrder } from '@/hooks/useWeekOrders';
import { format, startOfWeek, addDays } from 'date-fns';
import { sr } from 'date-fns/locale';
import { MealCard } from './MealCard';

interface CurrentWeekViewProps {
  orders: WeekOrder[];
  loading: boolean;
}

export function CurrentWeekView({ orders, loading }: CurrentWeekViewProps) {
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const getOrderForDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return orders.find(o => o.date === dateStr);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-20 md:pb-4">
      <div className="flex items-center gap-2 mb-4">
        <Calendar className="h-5 w-5 text-primary" />
        <h2 className="text-xl font-semibold">Tekuća nedelja</h2>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Vaše porudžbine</CardTitle>
          <CardDescription>
            Pregled obroka za tekuću nedelju (samo čitanje)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {weekDays.map((date) => {
              const order = getOrderForDate(date);
              const dayName = format(date, 'EEEE', { locale: sr });
              const dateStr = format(date, 'd. MMM', { locale: sr });

              return (
                <div
                  key={date.toISOString()}
                  className="border rounded-lg p-4"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <div className="font-medium capitalize">{dayName}</div>
                      <div className="text-sm text-muted-foreground">{dateStr}</div>
                    </div>
                  </div>

                  {!order || order.items.length === 0 ? (
                    <div className="text-sm text-muted-foreground italic">
                      Nema poručenih obroka
                    </div>
                  ) : (
                    <div className="space-y-3 mt-3">
                      {order.items.map((item) => (
                        <MealCard key={item.id} item={item} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
