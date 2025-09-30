import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, CheckCircle2, XCircle } from 'lucide-react';
import { WeekOrder } from '@/hooks/useWeekOrders';
import { format, startOfWeek, addDays } from 'date-fns';
import { sr } from 'date-fns/locale';

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
                    <div className="space-y-2 mt-3">
                      {order.items.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-start gap-3 p-3 bg-accent/50 rounded-lg"
                        >
                          {item.meal.image_url && (
                            <img
                              src={item.meal.image_url}
                              alt={item.meal.name}
                              className="w-16 h-16 rounded object-cover flex-shrink-0"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm">{item.meal.name}</div>
                            <div className="text-xs text-muted-foreground mb-1">
                              {item.meal.description}
                            </div>
                            <div className="flex flex-wrap gap-1 items-center">
                              <Badge variant="outline" className="text-xs">
                                {item.shift === 'prva' ? 'Prva smena' : item.shift === 'druga' ? 'Druga smena' : 'Treća smena'}
                              </Badge>
                              {item.pickup_status === 'preuzeto' ? (
                                <Badge variant="default" className="text-xs gap-1">
                                  <CheckCircle2 className="h-3 w-3" />
                                  Preuzeto
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="text-xs gap-1">
                                  <XCircle className="h-3 w-3" />
                                  Nije preuzeto
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
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
