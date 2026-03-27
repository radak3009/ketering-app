import { useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ChevronRight, ChevronDown, Download } from "lucide-react";
import { downloadCSV } from "@/lib/csv-export";
import { useIsMobile } from "@/hooks/use-mobile";

interface Order {
  id: string;
  delivery_date: string;
  order_items?: Array<{
    meal_id: string;
    meal?: { name: string; shifts?: string[] | null };
    meals?: { name: string; shifts?: string[] | null };
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
const DAYS_SHORT = ['Pon', 'Uto', 'Sre', 'Čet', 'Pet', 'Sub', 'Ned'];
const SHIFTS = ['prva', 'druga', 'treća'] as const;
const SHIFT_LABELS: Record<string, string> = {
  'prva': 'I smena',
  'druga': 'II smena',
  'treća': 'III smena',
};
const SHIFT_ROMAN: Record<string, string> = {
  'prva': 'I',
  'druga': 'II',
  'treća': 'III',
};

export function OrderPivotTable({ orders, shiftFilter }: OrderPivotTableProps) {
  const [expandedMeals, setExpandedMeals] = useState<Set<string>>(new Set());
  const isMobile = useIsMobile();

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
  const mealShiftsMap: { [mealName: string]: string[] | null } = {};
  
  DAYS_OF_WEEK.forEach(day => { dayTotals[day] = 0; });
  
  orders.forEach(order => {
    const date = new Date(order.delivery_date);
    const dayIndex = date.getDay();
    const adjustedIndex = dayIndex === 0 ? 6 : dayIndex - 1;
    const dayName = DAYS_OF_WEEK[adjustedIndex];
    
    order.order_items?.forEach(item => {
      const mealName = item.meal?.name || item.meals?.name || 'Nepoznat obrok';
      const mealShifts = item.meal?.shifts || item.meals?.shifts || null;
      const quantity = item.quantity;
      const shift = item.shift || 'prva';
      
      if (!pivotData[mealName]) {
        pivotData[mealName] = { byDay: {}, total: 0, shifts: {} };
        DAYS_OF_WEEK.forEach(day => { pivotData[mealName].byDay[day] = 0; });
        SHIFTS.forEach(s => {
          pivotData[mealName].shifts[s] = { byDay: {}, total: 0 };
          DAYS_OF_WEEK.forEach(day => { pivotData[mealName].shifts[s].byDay[day] = 0; });
        });
        mealShiftsMap[mealName] = mealShifts;
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
  
  const getMealDisplayName = (mealName: string) => {
    const shifts = mealShiftsMap[mealName];
    if (!shifts || shifts.length === 0) return mealName;
    const romanShifts = shifts.map(s => SHIFT_ROMAN[s] || s).join(', ');
    return `${mealName} (${romanShifts})`;
  };
  
  const showDrillDown = shiftFilter === "all";

  const handleExportCSV = useCallback(() => {
    const rows: (string | number)[][] = [];
    rows.push(['Obrok', 'Smena', ...DAYS_OF_WEEK, 'Total']);
    
    sortedMeals.forEach(mealName => {
      const row = pivotData[mealName];
      rows.push([getMealDisplayName(mealName), 'Ukupno', ...DAYS_OF_WEEK.map(d => row.byDay[d]), row.total]);
      SHIFTS.forEach(shift => {
        const sr = row.shifts[shift];
        if (sr && sr.total > 0) {
          rows.push([mealName, SHIFT_LABELS[shift], ...DAYS_OF_WEEK.map(d => sr.byDay[d]), sr.total]);
        }
      });
    });
    rows.push(['Total', '', ...DAYS_OF_WEEK.map(d => dayTotals[d]), grandTotal]);
    
    downloadCSV(rows, `pivot-obroci-${new Date().toISOString().slice(0, 10)}`);
  }, [pivotData, sortedMeals, dayTotals, grandTotal]);
  
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

  // Mobile: Accordion view
  if (isMobile) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <CardTitle className="text-lg">Po obrocima</CardTitle>
              <CardDescription className="text-xs">Porudžbine po danima</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={handleExportCSV} className="shrink-0">
              <Download className="h-4 w-4 mr-1.5" />
              CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent className="px-3">
          <Accordion type="single" collapsible className="w-full">
            {sortedMeals.map((mealName) => {
              const row = pivotData[mealName];
              return (
                <AccordionItem key={mealName} value={mealName}>
                  <AccordionTrigger className="py-3 text-sm hover:no-underline">
                    <div className="flex items-center justify-between w-full pr-2">
                      <span className="text-left font-medium">{getMealDisplayName(mealName)}</span>
                      <Badge variant="secondary" className="ml-2 shrink-0">{row.total}</Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-1.5 pb-1">
                      {DAYS_OF_WEEK.map((day, i) => {
                        const val = row.byDay[day];
                        if (val === 0) return null;
                        return (
                          <div key={day} className="flex justify-between text-sm px-1">
                            <span className="text-muted-foreground">{DAYS_SHORT[i]}</span>
                            <span className="font-medium">{val}</span>
                          </div>
                        );
                      })}
                      {showDrillDown && SHIFTS.map(shift => {
                        const sr = row.shifts[shift];
                        if (!sr || sr.total === 0) return null;
                        return (
                          <div key={shift} className="mt-2 pt-2 border-t">
                            <div className="text-xs text-muted-foreground font-medium mb-1 px-1">{SHIFT_LABELS[shift]}</div>
                            {DAYS_OF_WEEK.map((day, i) => {
                              const val = sr.byDay[day];
                              if (val === 0) return null;
                              return (
                                <div key={day} className="flex justify-between text-xs px-3">
                                  <span className="text-muted-foreground">{DAYS_SHORT[i]}</span>
                                  <span>{val}</span>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
          <div className="flex justify-between items-center mt-4 pt-3 border-t font-bold text-sm">
            <span>Ukupno</span>
            <span>{grandTotal}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Desktop: Table view
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-lg md:text-xl">Pivot tabela</CardTitle>
            <CardDescription className="text-xs md:text-sm">Pregled porudžbina po obrocima i danima</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={handleExportCSV} className="self-start sm:self-auto shrink-0">
            <Download className="h-4 w-4 mr-1.5" />
            CSV
          </Button>
        </div>
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
                    <TableRow key={mealName} className={showDrillDown ? "cursor-pointer hover:bg-muted/30" : ""} onClick={() => showDrillDown && toggleMeal(mealName)}>
                      <TableCell className="font-medium sticky left-0 z-10 bg-background text-xs md:text-sm p-2 md:p-4">
                        <div className="flex items-center gap-1.5">
                          {showDrillDown && (
                            isExpanded 
                              ? <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" /> 
                              : <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          )}
                          {getMealDisplayName(mealName)}
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