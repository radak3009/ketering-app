import { useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download } from "lucide-react";
import { downloadCSV } from "@/lib/csv-export";
import { TablePagination } from "@/components/ui/table-pagination";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePermissions } from "@/hooks/usePermissions";

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
const DAYS_SHORT = ['Pon', 'Uto', 'Sre', 'Čet', 'Pet', 'Sub', 'Ned'];

const SHIFT_ROMAN: Record<string, string> = {
  'prva': 'I',
  'druga': 'II',
  'treća': 'III',
};

export function UserOrderPivotTable({ orders, userCardFilter = '', shiftFilter }: UserOrderPivotTableProps) {
  const isMobile = useIsMobile();
  const { has: hasPerm } = usePermissions();
  const canExport = hasPerm("orders.export_csv");
  const [mobilePage, setMobilePage] = useState(1);
  const [mobilePageSize, setMobilePageSize] = useState(20);
  const [desktopPage, setDesktopPage] = useState(1);
  const [desktopPageSize, setDesktopPageSize] = useState(20);
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

  const handleExportCSV = useCallback(() => {
    const rows: (string | number)[][] = [];
    rows.push(['ID Kartice', 'Ime i Prezime', ...DAYS_OF_WEEK, 'Total']);
    usersArray.forEach(user => {
      rows.push([user.company_card_id, user.full_name, ...DAYS_OF_WEEK.map(d => user.meals[d]), user.total]);
    });
    rows.push(['Total', '', ...DAYS_OF_WEEK.map(d => dayTotals[d]), grandTotal]);
    downloadCSV(rows, `pivot-korisnici-${new Date().toISOString().slice(0, 10)}`);
  }, [usersArray, dayTotals, grandTotal]);
  
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

  // Mobile: Card view
  if (isMobile) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <CardTitle className="text-lg">Po korisnicima</CardTitle>
              <CardDescription className="text-xs">Porudžbine po danima</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={handleExportCSV} className="shrink-0">
              <Download className="h-4 w-4 mr-1.5" />
              CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent className="px-3 space-y-3">
          {usersArray
            .slice((mobilePage - 1) * mobilePageSize, mobilePage * mobilePageSize)
            .map((user, index) => (
            <div key={`${user.company_card_id}-${index}`} className="border rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{user.full_name}</p>
                  <p className="text-xs text-muted-foreground font-mono">ID: {user.company_card_id}</p>
                </div>
                <Badge variant="secondary" className="shrink-0 ml-2">{user.total}</Badge>
              </div>
              <div className="space-y-1">
                {DAYS_OF_WEEK.map((day, i) => {
                  const meal = user.meals[day];
                  if (meal === '-') return null;
                  return (
                    <div key={day} className="flex gap-2 text-xs">
                      <span className="text-muted-foreground w-8 shrink-0">{DAYS_SHORT[i]}</span>
                      <span className="font-medium">{meal}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          <div className="flex justify-between items-center pt-3 border-t font-bold text-sm">
            <span>Ukupno</span>
            <span>{grandTotal}</span>
          </div>
          {usersArray.length > 0 && (
            <TablePagination
              currentPage={mobilePage}
              totalItems={usersArray.length}
              pageSize={mobilePageSize}
              onPageChange={setMobilePage}
              onPageSizeChange={(size) => { setMobilePageSize(size); setMobilePage(1); }}
            />
          )}
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
            <CardTitle className="text-lg md:text-xl">Pivot tabela - Po korisnicima</CardTitle>
            <CardDescription className="text-xs md:text-sm">Pregled porudžbina po korisnicima i danima</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={handleExportCSV} className="self-start sm:self-auto shrink-0">
            <Download className="h-4 w-4 mr-1.5" />
            CSV
          </Button>
        </div>
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
              {usersArray
                .slice((desktopPage - 1) * desktopPageSize, desktopPage * desktopPageSize)
                .map((user, index) => (
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
        {usersArray.length > 0 && (
          <TablePagination
            currentPage={desktopPage}
            totalItems={usersArray.length}
            pageSize={desktopPageSize}
            onPageChange={setDesktopPage}
            onPageSizeChange={(size) => { setDesktopPageSize(size); setDesktopPage(1); }}
          />
        )}
      </CardContent>
    </Card>
  );
}