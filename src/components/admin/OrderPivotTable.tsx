import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronRight, ChevronDown } from "lucide-react";

interface Order {
  id: string;
  delivery_date: string;
  order_items?: Array<{
    meal_id: string;
    meal?: { name: string };
    meals?: { name: string };
    shift?: string;
    quantity: number;
  }>;
}

interface OrderPivotTableProps {
  orders: Order[];
  shiftFilter: string;
}

interface ShiftData {
  byDay: { [dayName: string]: number };
  total: number;
}

interface MealPivotRow {
  byDay: { [dayName: string]: number };
  total: number;
  shifts: { [shift: string]: ShiftData };
}

const DAYS_OF_WEEK = ['Ponedeljak', 'Utorak', 'Sreda', 'Četvrtak', 'Petak', 'Subota', 'Nedelja'];
const SHIFTS = ['prva', 'druga', 'treća'] as const;
const SHIFT_LABELS: Record<string, string> = {
  'prva': 'I smena',
  'druga': 'II smena',
  'treća': 'III smena',
};

export function OrderPivotTable({ orders, shiftFilter }: OrderPivotTableProps) {
  const [expandedMeals, setExpandedMeals] = useState<Set<string>>(new Set());

  const toggleMeal = (mealName: string) => {
    setExpandedMeals(prev => {
      const next = new Set(prev);
      if (next.has(mealName)) next.delete(mealName);
      else next.add(mealName);
      return next;
    });
  };

  // Build pivot data
  const pivotData: { [mealName: string]: MealPivotRow } = {};
  const dayTotals: { [dayName: string]: number } = {};
  
  DAYS_OF_WEEK.forEach(day => { dayTotals[day] = 0; });
  
  orders.forEach(order => {
    const date = new Date(order.delivery_date);
    const dayIndex = date.getDay();
    const adjustedIndex = dayIndex === 0 ? 6 : dayIndex - 1;
    const dayName = DAYS_OF_WEEK[adjustedIndex];
    
    order.order_items?.forEach(item => {
      const mealName = item.meal?.name || item.meals?.name || 'Nepoznat obrok';
      const quantity = item.quantity;
      const shift = item.shift || 'prva';
      
      if (!pivotData[mealName]) {
        pivotData[mealName] = { byDay: {}, total: 0, shifts: {} };
        DAYS_OF_WEEK.forEach(day => { pivotData[mealName].byDay[day] = 0; });
        SHIFTS.forEach(s => {
          pivotData[mealName].shifts[s] = { byDay: {}, total: 0 };
          DAYS_OF_WEEK.forEach(day => { pivotData[mealName].shifts[s].byDay[day] = 0; });
        });
      }
      
      pivotData[mealName].byDay[dayName] += quantity;
      pivotData[mealName].total += quantity;
      pivotData[mealName].shifts[shift].byDay[dayName] += quantity;
      pivotData[mealName].shifts[shift].total += quantity;
      dayTotals[dayName] += quantity;
    });
  });
  
  const grandTotal = Object.values(dayTotals).reduce((sum, val) => sum + val, 0);
  const sortedMeals = Object.keys(pivotData).sort((a, b) => a.localeCompare(b, 'sr'));
  
  const showDrillDown = shiftFilter === "all";
  
  if (sortedMeals.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pivot tabela</CardTitle>
          <CardDescription>Pregled porudžbina po obrocima i danima</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            Nema porudžbina za izabrani period
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg md:text-xl">Pivot tabela</CardTitle>
        <CardDescription className="text-xs md:text-sm">Pregled porudžbina po obrocima i danima</CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto -mx-3 md:mx-0 px-3 md:px-0">
        <div className="min-w-[600px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-bold bg-muted/50 sticky left-0 z-10 text-xs md:text-sm p-2 md:p-4">Obrok / Dan</TableHead>
                {DAYS_OF_WEEK.map(day => (
                  <TableHead key={day} className="text-center bg-muted/30 p-2 md:p-4">
                    <Badge variant="secondary" className="whitespace-nowrap text-xs">
                      {day}
                    </Badge>
                  </TableHead>
                ))}
                <TableHead className="text-center font-bold bg-muted/50 text-xs md:text-sm p-2 md:p-4">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedMeals.map((mealName) => {
                const row = pivotData[mealName];
                const isExpanded = expandedMeals.has(mealName);
                
                return (
                  <>
                    {/* Parent row */}
                    <TableRow key={mealName} className={showDrillDown ? "cursor-pointer hover:bg-muted/30" : ""} onClick={() => showDrillDown && toggleMeal(mealName)}>
                      <TableCell className="font-medium sticky left-0 z-10 bg-background text-xs md:text-sm p-2 md:p-4">
                        <div className="flex items-center gap-1.5">
                          {showDrillDown && (
                            isExpanded 
                              ? <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" /> 
                              : <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          )}
                          {mealName}
                        </div>
                      </TableCell>
                      {DAYS_OF_WEEK.map(day => {
                        const value = row.byDay[day];
                        return (
                          <TableCell 
                            key={day} 
                            className={`text-center text-xs md:text-sm p-2 md:p-4 ${value > 0 ? 'font-medium' : 'text-muted-foreground'}`}
                          >
                            {value || 0}
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-center font-bold bg-muted/20 text-xs md:text-sm p-2 md:p-4">
                        {row.total}
                      </TableCell>
                    </TableRow>
                    
                    {/* Child rows (shifts) */}
                    {showDrillDown && isExpanded && SHIFTS.map(shift => {
                      const shiftRow = row.shifts[shift];
                      if (!shiftRow || shiftRow.total === 0) return null;
                      return (
                        <TableRow key={`${mealName}-${shift}`} className="bg-muted/10">
                          <TableCell className="sticky left-0 z-10 bg-muted/10 text-xs p-2 md:p-4 pl-8 md:pl-10 text-muted-foreground">
                            {SHIFT_LABELS[shift]}
                          </TableCell>
                          {DAYS_OF_WEEK.map(day => {
                            const value = shiftRow.byDay[day];
                            return (
                              <TableCell 
                                key={day} 
                                className={`text-center text-xs p-2 md:p-4 ${value > 0 ? '' : 'text-muted-foreground'}`}
                              >
                                {value || 0}
                              </TableCell>
                            );
                          })}
                          <TableCell className="text-center text-xs bg-muted/20 p-2 md:p-4">
                            {shiftRow.total}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </>
                );
              })}
              <TableRow className="bg-muted/50 font-bold">
                <TableCell className="sticky left-0 z-10 bg-muted/50 text-xs md:text-sm p-2 md:p-4">
                  {showDrillDown && <span className="inline-block w-[22px]" />}
                  Total
                </TableCell>
                {DAYS_OF_WEEK.map(day => (
                  <TableCell key={day} className="text-center text-xs md:text-sm p-2 md:p-4">
                    {dayTotals[day]}
                  </TableCell>
                ))}
                <TableCell className="text-center text-xs md:text-sm p-2 md:p-4">
                  {grandTotal}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
