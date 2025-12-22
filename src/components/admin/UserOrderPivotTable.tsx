import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface OrderWithProfile {
  id: string;
  user_id: string;
  delivery_date: string;
  profile?: {
    id: string;
    full_name: string | null;
    company_card_id: string | null;
  };
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

interface UserOrderPivotTableProps {
  orders: OrderWithProfile[];
  userCardFilter?: string;
}

interface UserPivotData {
  company_card_id: string;
  full_name: string;
  meals: {
    [dayName: string]: string;
  };
  total: number;
}

const DAYS_OF_WEEK = ['Ponedeljak', 'Utorak', 'Sreda', 'Četvrtak', 'Petak', 'Subota', 'Nedelja'];

export function UserOrderPivotTable({ orders, userCardFilter = '' }: UserOrderPivotTableProps) {
  // Transform orders into user pivot table format
  const userDataMap: { [userId: string]: UserPivotData } = {};
  const dayTotals: { [dayName: string]: number } = {};
  
  // Initialize day totals
  DAYS_OF_WEEK.forEach(day => {
    dayTotals[day] = 0;
  });
  
  // Process each order
  orders.forEach(order => {
    const profile = order.profile;
    if (!profile) return;
    
    const userId = order.user_id;
    const date = new Date(order.delivery_date);
    const dayIndex = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
    // Adjust to match our array (0 = Monday)
    const adjustedIndex = dayIndex === 0 ? 6 : dayIndex - 1;
    const dayName = DAYS_OF_WEEK[adjustedIndex];
    
    // Initialize user row if it doesn't exist
    if (!userDataMap[userId]) {
      userDataMap[userId] = {
        company_card_id: profile.company_card_id || '-',
        full_name: profile.full_name || 'Nepoznat korisnik',
        meals: {},
        total: 0
      };
      DAYS_OF_WEEK.forEach(day => {
        userDataMap[userId].meals[day] = '-';
      });
    }
    
    // Get meal name from first order item (user can only have one meal per day)
    const firstItem = order.order_items?.[0];
    if (firstItem) {
      const mealName = firstItem.meal?.name || firstItem.meals?.name || '-';
      userDataMap[userId].meals[dayName] = mealName;
      userDataMap[userId].total += 1;
      dayTotals[dayName] += 1;
    }
  });
  
  // Calculate grand total
  const grandTotal = Object.values(dayTotals).reduce((sum, val) => sum + val, 0);
  
  // Convert to array and filter by company_card_id if filter is provided
  let usersArray = Object.values(userDataMap);
  
  if (userCardFilter.trim()) {
    const filterLower = userCardFilter.toLowerCase().trim();
    usersArray = usersArray.filter(user => 
      user.company_card_id.toLowerCase().includes(filterLower)
    );
  }
  
  // Sort by full name
  usersArray.sort((a, b) => a.full_name.localeCompare(b.full_name, 'sr'));
  
  if (usersArray.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pivot tabela - Po korisnicima</CardTitle>
          <CardDescription>Pregled porudžbina po korisnicima i danima</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            {userCardFilter.trim() 
              ? `Nema korisnika sa ID karticom "${userCardFilter}"`
              : 'Nema porudžbina za izabrani period'
            }
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg md:text-xl">Pivot tabela - Po korisnicima</CardTitle>
        <CardDescription className="text-xs md:text-sm">Pregled porudžbina po korisnicima i danima</CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto -mx-3 md:mx-0 px-3 md:px-0">
        <div className="min-w-[800px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-bold bg-muted/50 sticky left-0 z-10 text-xs md:text-sm p-2 md:p-4">ID Kartice</TableHead>
                <TableHead className="font-bold bg-muted/50 text-xs md:text-sm p-2 md:p-4">Ime i Prezime</TableHead>
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
              {usersArray.map((user, index) => (
                <TableRow key={`${user.company_card_id}-${index}`}>
                  <TableCell className="font-mono sticky left-0 z-10 bg-background text-xs md:text-sm p-2 md:p-4">
                    {user.company_card_id}
                  </TableCell>
                  <TableCell className="font-medium text-xs md:text-sm p-2 md:p-4">
                    {user.full_name}
                  </TableCell>
                  {DAYS_OF_WEEK.map(day => {
                    const mealName = user.meals[day];
                    const hasMeal = mealName !== '-';
                    return (
                      <TableCell 
                        key={day} 
                        className={`text-center text-xs md:text-sm p-2 md:p-4 max-w-[120px] truncate ${hasMeal ? 'font-medium' : 'text-muted-foreground'}`}
                        title={mealName}
                      >
                        {mealName}
                      </TableCell>
                    );
                  })}
                  <TableCell className="text-center font-bold bg-muted/20 text-xs md:text-sm p-2 md:p-4">
                    {user.total}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-muted/50 font-bold">
                <TableCell className="sticky left-0 z-10 bg-muted/50 text-xs md:text-sm p-2 md:p-4" colSpan={2}>Total</TableCell>
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