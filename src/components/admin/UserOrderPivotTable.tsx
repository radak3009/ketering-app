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
    meal?: { name: string };
    meals?: { name: string };
    shift?: string;
    quantity: number;
  }>;
}

interface UserOrderPivotTableProps {
  orders: OrderWithProfile[];
  userCardFilter?: string;
  shiftFilter: string;
}

interface UserPivotData {
  company_card_id: string;
  full_name: string;
  meals: { [dayName: string]: string };
  total: number;
}

const DAYS_OF_WEEK = ['Ponedeljak', 'Utorak', 'Sreda', 'Četvrtak', 'Petak', 'Subota', 'Nedelja'];

const SHIFT_ROMAN: Record<string, string> = {
  'prva': 'I',
  'druga': 'II',
  'treća': 'III',
};

export function UserOrderPivotTable({ orders, userCardFilter = '', shiftFilter }: UserOrderPivotTableProps) {
  const userDataMap: { [userId: string]: UserPivotData } = {};
  const dayTotals: { [dayName: string]: number } = {};
  
  DAYS_OF_WEEK.forEach(day => { dayTotals[day] = 0; });
  
  orders.forEach(order => {
    const profile = order.profile;
    if (!profile) return;
    
    const userId = order.user_id;
    const date = new Date(order.delivery_date);
    const dayIndex = date.getDay();
    const adjustedIndex = dayIndex === 0 ? 6 : dayIndex - 1;
    const dayName = DAYS_OF_WEEK[adjustedIndex];
    
    if (!userDataMap[userId]) {
      userDataMap[userId] = {
        company_card_id: profile.company_card_id || '-',
        full_name: profile.full_name || 'Nepoznat korisnik',
        meals: {},
        total: 0
      };
      DAYS_OF_WEEK.forEach(day => { userDataMap[userId].meals[day] = '-'; });
    }
    
    // Collect all items for this day
    const itemLabels: string[] = [];
    order.order_items?.forEach(item => {
      const mealName = item.meal?.name || item.meals?.name || '-';
      const shiftLabel = SHIFT_ROMAN[item.shift || 'prva'] || item.shift || '';
      itemLabels.push(`${mealName} (${shiftLabel})`);
    });
    
    if (itemLabels.length > 0) {
      const existing = userDataMap[userId].meals[dayName];
      if (existing && existing !== '-') {
        userDataMap[userId].meals[dayName] = existing + ', ' + itemLabels.join(', ');
      } else {
        userDataMap[userId].meals[dayName] = itemLabels.join(', ');
      }
      userDataMap[userId].total += itemLabels.length;
      dayTotals[dayName] += itemLabels.length;
    }
  });
  
  const grandTotal = Object.values(dayTotals).reduce((sum, val) => sum + val, 0);
  
  let usersArray = Object.values(userDataMap);
  
  if (userCardFilter.trim()) {
    const filterLower = userCardFilter.toLowerCase().trim();
    usersArray = usersArray.filter(user => 
      user.company_card_id.toLowerCase().includes(filterLower)
    );
  }
  
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
                        className={`text-center text-xs md:text-sm p-2 md:p-4 max-w-[150px] ${hasMeal ? 'font-medium' : 'text-muted-foreground'}`}
                        title={mealName}
                      >
                        <span className="block truncate">{mealName}</span>
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
