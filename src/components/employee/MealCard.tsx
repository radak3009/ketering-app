import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Trash2, XCircle } from 'lucide-react';
import { OrderItemWithMeal } from '@/hooks/useWeekOrders';
import { renderAllergens } from '@/lib/meal-utils.tsx';

interface MealCardProps {
  item: OrderItemWithMeal;
  canDelete?: boolean;
  onDelete?: (id: string) => void;
}

export function MealCard({ item, canDelete = false, onDelete }: MealCardProps) {
  const { t } = useTranslation();

  const getShiftLabel = (shift: string): string => {
    return t(`orders.shifts.${shift}`, shift);
  };

  return (
    <div className="relative border rounded-lg overflow-hidden bg-card hover:shadow-md transition-shadow">
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
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="font-semibold text-base">{item.meal.name}</h3>
          {canDelete && onDelete && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(item.id)}
              className="h-8 w-8 p-0 flex-shrink-0"
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          )}
        </div>
        <p className="text-sm text-muted-foreground mb-3">
          {item.meal.description}
        </p>
        {renderAllergens(item.meal.allergens)}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium">{t('orders.shift')}:</span>
            <span className="text-muted-foreground">
              {getShiftLabel(item.shift)}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium">{t('orders.status')}:</span>
            {item.pickup_status === 'preuzeto' ? (
              <span className="text-green-600 flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4" />
                {t('orders.pickedUp')}
              </span>
            ) : (
              <span className="text-muted-foreground flex items-center gap-1">
                <XCircle className="h-4 w-4" />
                {t('orders.notPickedUp')}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
