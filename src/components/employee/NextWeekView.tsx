import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, Plus, AlertCircle, UtensilsCrossed } from 'lucide-react';
import { WeekOrder } from '@/hooks/useWeekOrders';
import { format, startOfWeek, addDays, addWeeks } from 'date-fns';
import { sr, enUS } from 'date-fns/locale';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { MealCard } from './MealCard';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { EmptyState } from '@/components/ui/empty-state';


interface NextWeekViewProps {
  orders: WeekOrder[];
  loading: boolean;
  canEdit: boolean;
  onOpenOrderDialog: () => void;
  onOrderDeleted: () => void;
  totalMenuDays: number;
  profileIncomplete?: boolean;
}

export function NextWeekView({ orders, loading, canEdit, onOpenOrderDialog, onOrderDeleted, totalMenuDays, profileIncomplete = false }: NextWeekViewProps) {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const locale = i18n.language === 'sr' ? sr : enUS;
  
  const nextWeekStart = addWeeks(startOfWeek(new Date(), { weekStartsOn: 1 }), 1);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(nextWeekStart, i));
  
  // Calculate how many days have orders
  const orderedDaysCount = orders.length;
  const isAllOrdered = orderedDaysCount >= totalMenuDays && totalMenuDays > 0;

  const getOrderForDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return orders.find(o => o.date === dateStr);
  };

  const handleDeleteOrder = async (orderItemId: string) => {
    if (!canEdit) {
      toast({
        title: t('orders.notPossible'),
        description: t('orders.deadlinePassed'),
        variant: 'destructive',
      });
      return;
    }

    const { error } = await supabase
      .from('order_items')
      .delete()
      .eq('id', orderItemId);

    if (error) {
      toast({
        title: t('toast.error'),
        description: t('orders.cannotDelete'),
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: t('toast.success'),
      description: t('orders.orderDeleted'),
    });

    onOrderDeleted();
  };

  if (loading) {
    return <LoadingSpinner size="lg" className="p-8" />;
  }

  return (
    <div className="space-y-4 pb-20 md:pb-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">{t('navigation.nextWeek')}</h2>
        </div>
        {canEdit && totalMenuDays === 0 && (
          <>
            {/* Desktop: tooltip on hover */}
            <TooltipProvider>
              <Tooltip delayDuration={300}>
                <TooltipTrigger asChild>
                  <span tabIndex={0} className="hidden md:inline-flex">
                    <Button size="sm" className="gap-2" variant="secondary" disabled>
                      <Plus className="h-4 w-4" />
                      <span>{t('orders.orderMeal')}</span>
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{t('orders.noMenusForNextWeek')}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            {/* Mobile: toast on tap */}
            <span
              className="inline-flex md:hidden"
              onClick={() => toast({ title: t('orders.notPossible'), description: t('orders.noMenusForNextWeek') })}
            >
              <Button size="sm" className="gap-2" variant="secondary" disabled>
                <Plus className="h-4 w-4" />
              </Button>
            </span>
          </>
        )}
        {canEdit && totalMenuDays > 0 && profileIncomplete && (
          <>
            <TooltipProvider>
              <Tooltip delayDuration={300}>
                <TooltipTrigger asChild>
                  <span tabIndex={0} className="hidden md:inline-flex">
                    <Button size="sm" className="gap-2" disabled>
                      <Plus className="h-4 w-4" />
                      <span>{t('orders.orderMeal')}</span>
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{t('orders.profileIncomplete')}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <span
              className="inline-flex md:hidden"
              onClick={() => toast({ title: t('orders.notPossible'), description: t('orders.profileIncomplete') })}
            >
              <Button size="sm" className="gap-2" disabled>
                <Plus className="h-4 w-4" />
              </Button>
            </span>
          </>
        )}
        {canEdit && totalMenuDays > 0 && !profileIncomplete && !isAllOrdered && (
          <Button 
            onClick={onOpenOrderDialog} 
            size="sm" 
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">
              {t('orders.orderMeal')}
            </span>
          </Button>
        )}
        {canEdit && totalMenuDays > 0 && !profileIncomplete && isAllOrdered && (
          <>
            <TooltipProvider>
              <Tooltip delayDuration={300}>
                <TooltipTrigger asChild>
                  <span tabIndex={0} className="hidden md:inline-flex">
                    <Button size="sm" className="gap-2" variant="secondary" disabled>
                      <Plus className="h-4 w-4" />
                      <span>{t('orders.allOrderedButton')}</span>
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{t('orders.allOrderedButton')}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <span
              className="inline-flex md:hidden"
              onClick={() => toast({ title: t('orders.notPossible'), description: t('orders.allOrderedButton') })}
            >
              <Button size="sm" className="gap-2" variant="secondary" disabled>
                <Plus className="h-4 w-4" />
              </Button>
            </span>
          </>
        )}
      </div>

      {canEdit && totalMenuDays > 0 && (
        <Alert className={isAllOrdered ? 'border-green-500 bg-green-50 dark:bg-green-950' : ''}>
          <AlertCircle className={isAllOrdered ? 'h-4 w-4 text-green-600' : 'h-4 w-4'} />
          <AlertDescription>
            {isAllOrdered ? (
              <span className="text-green-700 dark:text-green-400 font-medium">
                ✓ {t('orders.allOrdered', { ordered: orderedDaysCount, total: totalMenuDays })}
              </span>
            ) : (
              <span>
                {t('orders.orderedDays', { ordered: orderedDaysCount, total: totalMenuDays })}
              </span>
            )}
          </AlertDescription>
        </Alert>
      )}

      {!canEdit && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {t('orders.orderDeadlinePassed')}
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t('orders.yourOrdersForNextWeek')}</CardTitle>
          <CardDescription>
            {canEdit ? t('orders.canEditUntil') : t('orders.editDeadlinePassed')}
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
                        <MealCard 
                          key={item.id} 
                          item={item}
                          canDelete={canEdit}
                          onDelete={handleDeleteOrder}
                        />
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
