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
                    <div className="space-y-3 mt-3">
                      {order.items.map((item) => (
                        <div
                          key={item.id}
                          className="relative border rounded-lg overflow-hidden bg-card hover:shadow-md transition-shadow"
                        >
                          {item.meal.image_url && (
                            <div className="relative w-full h-48 md:h-32">
                              <img
                                src={item.meal.image_url}
                                alt={item.meal.name}
                                className="w-full h-full object-cover"
                              />
                              {item.pickup_status === 'preuzeto' && (
                                <div className="absolute top-2 right-2 bg-green-500 rounded-full p-1.5">
                                  <CheckCircle2 className="h-5 w-5 text-white" />
                                </div>
                              )}
                            </div>
                          )}
                          <div className="p-4">
                            <h3 className="font-semibold text-base mb-2">{item.meal.name}</h3>
                            <p className="text-sm text-muted-foreground mb-3">
                              {item.meal.description}
                            </p>
                            {item.meal.allergens && item.meal.allergens.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mb-3">
                                {item.meal.allergens.map((allergen, idx) => (
                                  <Badge key={idx} variant="secondary" className="text-xs">
                                    {allergen}
                                  </Badge>
                                ))}
                              </div>
                            )}
                            <div className="space-y-2">
                              <div className="flex items-center gap-2 text-sm">
                                <span className="font-medium">Smena:</span>
                                <span className="text-muted-foreground">
                                  {item.shift === 'prva' ? 'Prva smena' : item.shift === 'druga' ? 'Druga smena' : 'Treća smena'}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-sm">
                                <span className="font-medium">Status:</span>
                                {item.pickup_status === 'preuzeto' ? (
                                  <span className="text-green-600 flex items-center gap-1">
                                    <CheckCircle2 className="h-4 w-4" />
                                    Preuzeto
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground flex items-center gap-1">
                                    <XCircle className="h-4 w-4" />
                                    Nije preuzeto
                                  </span>
                                )}
                              </div>
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
