import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Trash2, XCircle, Download, RefreshCw, Loader2 } from 'lucide-react';
import { OrderItemWithMeal } from '@/hooks/useWeekOrders';
import { renderAllergens } from '@/lib/meal-utils.tsx';
import { supabase } from '@/integrations/supabase/client';
import { useState } from 'react';
import { toast } from 'sonner';

interface MealCardProps {
  item: OrderItemWithMeal;
  canDelete?: boolean;
  onDelete?: (id: string) => void;
  onRefresh?: () => void;
}

export function MealCard({ item, canDelete = false, onDelete, onRefresh }: MealCardProps) {
  const { t } = useTranslation();
  const [fiscalLoading, setFiscalLoading] = useState(false);

  const getShiftLabel = (shift: string): string => {
    return t(`orders.shifts.${shift}`, shift);
  };

  const handleDownloadReceipt = async () => {
    if (!item.pickup_request_id) return;
    setFiscalLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Niste prijavljeni');
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/receipt-download?pickupId=${item.pickup_request_id}`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (!response.ok) {
        toast.error('Račun nije dostupan');
        return;
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      window.open(objectUrl, '_blank');
      setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
    } catch (err) {
      console.error('Receipt download error:', err);
      toast.error('Greška pri preuzimanju računa');
    } finally {
      setFiscalLoading(false);
    }
  };

  const handleRetryFiscalize = async () => {
    if (!item.pickup_request_id) return;
    setFiscalLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Niste prijavljeni');
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fiscalize-meal`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ pickupId: item.pickup_request_id }),
        }
      );

      const result = await response.json();
      if (result.status === 'fiscalized') {
        toast.success('Fiskalizacija uspešna');
        onRefresh?.();
      } else if (result.status === 'failed') {
        toast.error('Fiskalizacija neuspešna');
      }
    } catch (err) {
      console.error('Retry fiscalize error:', err);
      toast.error('Greška pri ponovnom pokušaju');
    } finally {
      setFiscalLoading(false);
    }
  };

  return (
    <div className="relative border rounded-lg overflow-hidden bg-card hover:shadow-md transition-shadow">
      {item.meal.image_url && (
        <div className="relative w-full aspect-[4/3] md:aspect-[16/9] overflow-hidden bg-muted">
          <img
            src={item.meal.image_url}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 w-full h-full object-cover scale-110 blur-xl opacity-60"
          />
          <img
            src={item.meal.image_url}
            alt={item.meal.name}
            loading="lazy"
            className="relative w-full h-full object-contain"
          />
          {item.pickup_status === 'preuzeto' && (
            <div className="absolute top-2 right-2 bg-green-500 rounded-full p-1.5 z-10">
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

          {/* Fiscal status - show for picked up OR auto-fiscalized */}
          {item.fiscal_status && (item.pickup_status === 'preuzeto' || item.fiscal_status === 'fiscalized' || item.fiscal_status === 'pending' || item.fiscal_status === 'failed') && (
            <div className="pt-2 border-t mt-2">
              {item.fiscal_status === 'fiscalized' && item.pickup_request_id && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadReceipt}
                  disabled={fiscalLoading}
                  className="w-full text-xs"
                >
                  {fiscalLoading ? (
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  ) : (
                    <Download className="h-3 w-3 mr-1" />
                  )}
                  Preuzmi račun
                </Button>
              )}
              {item.fiscal_status === 'pending' && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Fiskalizacija u toku...
                </p>
              )}
              {item.fiscal_status === 'failed' && (
                <div className="space-y-1">
                  <p className="text-xs text-destructive">Račun nije dostupan</p>
                  {item.pickup_request_id && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRetryFiscalize}
                      disabled={fiscalLoading}
                      className="w-full text-xs"
                    >
                      {fiscalLoading ? (
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3 w-3 mr-1" />
                      )}
                      Pokušaj ponovo
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
