import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, UtensilsCrossed } from 'lucide-react';
import { WeekOrder } from '@/hooks/useWeekOrders';
import { format, startOfWeek, addDays } from 'date-fns';
import { sr, enUS } from 'date-fns/locale';
import { MealCard } from './MealCard';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { EmptyState } from '@/components/ui/empty-state';

interface CurrentWeekViewProps {
  orders: WeekOrder[];
  loading: boolean;
  onRefresh?: () => void;
}

export function CurrentWeekView({ orders, loading }: CurrentWeekViewProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'sr' ? sr : enUS;
  
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const getOrderForDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return orders.find(o => o.date === dateStr);
  };

  if (loading) {
    return <LoadingSpinner size="lg" className="p-8" />;
  }

  return (
    <div className="space-y-4 pb-20 md:pb-4">
      <div className="flex items-center gap-2 mb-4">
        <Calendar className="h-5 w-5 text-primary" />
        <h2 className="text-xl font-semibold">{t('navigation.currentWeek')}</h2>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('orders.yourOrders')}</CardTitle>
          <CardDescription>
            {t('orders.reviewCurrentWeek')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {weekDays.map((date) => {
              const order = getOrderForDate(date);
              const dayName = format(date, 'EEEE', { locale });
              const dateStr = format(date, 'd. MMM', { locale });

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
                    <EmptyState 
                      icon={UtensilsCrossed}
                      title={t('orders.noOrders')}
                      className="py-4"
                    />
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
