import { Badge } from '@/components/ui/badge';

/**
 * Maps shift identifier to a human-readable label in Serbian
 */
export const getShiftLabel = (shift: string): string => {
  const shiftMap: Record<string, string> = {
    'prva': 'Prva smena',
    'druga': 'Druga smena',
    'treća': 'Treća smena'
  };
  return shiftMap[shift] || shift;
};

/**
 * Renders allergen badges for a meal
 */
export const renderAllergens = (allergens: string[] | null): JSX.Element | null => {
  if (!allergens?.length) return null;
  
  return (
    <div className="flex flex-wrap gap-1.5 mb-3">
      {allergens.map((allergen, idx) => (
        <Badge key={idx} variant="secondary" className="text-xs">
          {allergen}
        </Badge>
      ))}
    </div>
  );
};
