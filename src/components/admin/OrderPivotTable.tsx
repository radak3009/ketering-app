import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface Order {
  id: string;
  delivery_date: string;
  order_items?: Array<{
    meal_id: string;
    meal?: {
      name: string;
    };
    meals?: {
      name: string;
    };
    quantity: number;
  }>;
}

interface OrderPivotTableProps {
  orders: Order[];
}

interface PivotData {
  [mealName: string]: {
    [dayName: string]: number;
    total: number;
  };
}

const DAYS_OF_WEEK = ['Ponedeljak', 'Utorak', 'Sreda', 'Četvrtak', 'Petak', 'Subota', 'Nedelja'];

export function OrderPivotTable({ orders }: OrderPivotTableProps) {
  // Transform orders into pivot table format
  const pivotData: PivotData = {};
  const dayTotals: { [dayName: string]: number } = {};
  
  // Initialize day totals
  DAYS_OF_WEEK.forEach(day => {
    dayTotals[day] = 0;
  });
  
  // Process each order
  orders.forEach(order => {
    const date = new Date(order.delivery_date);
    const dayIndex = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
    // Adjust to match our array (0 = Monday)
    const adjustedIndex = dayIndex === 0 ? 6 : dayIndex - 1;
    const dayName = DAYS_OF_WEEK[adjustedIndex];
    
    // Process each order item
    order.order_items?.forEach(item => {
      const mealName = item.meal?.name || item.meals?.name || 'Nepoznat obrok';
      const quantity = item.quantity;
      
      // Initialize meal row if it doesn't exist
      if (!pivotData[mealName]) {
        pivotData[mealName] = { total: 0 };
        DAYS_OF_WEEK.forEach(day => {
          pivotData[mealName][day] = 0;
        });
      }
      
      // Add quantity to the appropriate cell
      pivotData[mealName][dayName] += quantity;
      pivotData[mealName].total += quantity;
      dayTotals[dayName] += quantity;
    });
  });
  
  // Calculate grand total
  const grandTotal = Object.values(dayTotals).reduce((sum, val) => sum + val, 0);
  
  // Sort meals by name
  const sortedMeals = Object.keys(pivotData).sort((a, b) => a.localeCompare(b, 'sr'));
  
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
        <CardTitle>Pivot tabela</CardTitle>
        <CardDescription>Pregled porudžbina po obrocima i danima</CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="font-bold bg-muted/50 sticky left-0 z-10">Obrok / Dan</TableHead>
              {DAYS_OF_WEEK.map(day => (
                <TableHead key={day} className="text-center bg-muted/30">
                  <Badge variant="secondary" className="whitespace-nowrap">
                    {day}
                  </Badge>
                </TableHead>
              ))}
              <TableHead className="text-center font-bold bg-muted/50">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedMeals.map((mealName) => (
              <TableRow key={mealName}>
                <TableCell className="font-medium sticky left-0 z-10 bg-background">
                  {mealName}
                </TableCell>
                {DAYS_OF_WEEK.map(day => {
                  const value = pivotData[mealName][day];
                  return (
                    <TableCell 
                      key={day} 
                      className={`text-center ${value > 0 ? 'font-medium' : 'text-muted-foreground'}`}
                    >
                      {value || 0}
                    </TableCell>
                  );
                })}
                <TableCell className="text-center font-bold bg-muted/20">
                  {pivotData[mealName].total}
                </TableCell>
              </TableRow>
            ))}
            <TableRow className="bg-muted/50 font-bold">
              <TableCell className="sticky left-0 z-10 bg-muted/50">Total</TableCell>
              {DAYS_OF_WEEK.map(day => (
                <TableCell key={day} className="text-center">
                  {dayTotals[day]}
                </TableCell>
              ))}
              <TableCell className="text-center">
                {grandTotal}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
