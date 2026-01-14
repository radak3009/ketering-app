import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Search, Filter, ChevronDown, Tag } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useOrders } from "@/hooks/useOrders";
import { useUsers } from "@/hooks/useUsers";
import { OrderPivotTable } from "./OrderPivotTable";
import { UserOrderPivotTable } from "./UserOrderPivotTable";
import { format } from "date-fns";

interface OrdersOverviewProps {
  orderDateRange: { startDate: string; endDate: string };
  setOrderDateRange: (range: { startDate: string; endDate: string }) => void;
}

export function OrdersOverview({ orderDateRange, setOrderDateRange }: OrdersOverviewProps) {
  const { toast } = useToast();
  
  // Memoize date range values to prevent unnecessary re-renders
  const startDate = orderDateRange?.startDate || '';
  const endDate = orderDateRange?.endDate || '';
  
  const { orders, loading, fetchOrders, getMealOrdersByDate, searchMealOrders } = useOrders(
    startDate || undefined,
    endDate || undefined
  );
  
  const [orderSearch, setOrderSearch] = useState("");
  const [userCardFilter, setUserCardFilter] = useState("");
  const [pivotView, setPivotView] = useState<"meals" | "users">("meals");
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [dailyMealOrders, setDailyMealOrders] = useState<any[]>([]);

  const handleDateRangeFilter = () => {
    const hasStartDate = orderDateRange.startDate && orderDateRange.startDate.trim() !== '';
    const hasEndDate = orderDateRange.endDate && orderDateRange.endDate.trim() !== '';
    
    if (hasStartDate || hasEndDate) {
      fetchOrders(hasStartDate ? orderDateRange.startDate : undefined, hasEndDate ? orderDateRange.endDate : undefined);
      let description = '';
      if (hasStartDate && hasEndDate) {
        description = `Prikazane porudžbine od ${orderDateRange.startDate} do ${orderDateRange.endDate}`;
      } else if (hasStartDate) {
        description = `Prikazane porudžbine od ${orderDateRange.startDate} pa nadalje`;
      } else if (hasEndDate) {
        description = `Prikazane porudžbine do ${orderDateRange.endDate}`;
      }
      toast({ title: "Filter primenjen", description });
    } else {
      setOrderDateRange({ startDate: '', endDate: '' });
      fetchOrders();
      toast({ title: "Filter resetovan", description: "Prikazuju se sve porudžbine" });
    }
  };

  const handleSearchOrders = async () => {
    if (orderSearch.trim()) {
      const results = await searchMealOrders(orderSearch);
      toast({
        title: "Pretraga završena",
        description: results.length > 0 
          ? `Pronađeno je ${results.length} porudžbina sa obrokom "${orderSearch}"` 
          : `Nije pronađena nijedna porudžbina sa obrokom "${orderSearch}"`
      });
    } else {
      setOrderSearch('');
      await fetchOrders(orderDateRange.startDate, orderDateRange.endDate);
      toast({ title: "Filter resetovan", description: "Prikazuju se sve porudžbine" });
    }
  };

  const handleDayClick = async (day: any) => {
    const dateString = day.date || day.day;
    let date;
    if (dateString.includes('-')) {
      date = dateString;
    } else {
      const parts = dateString.split(' ');
      if (parts.length >= 2) {
        const datePart = parts[1];
        const [dayNum, month] = datePart.split('.');
        date = `2025-${month.padStart(2, '0')}-${dayNum.padStart(2, '0')}`;
      } else {
        date = format(new Date(), 'yyyy-MM-dd');
      }
    }
    setSelectedDay(date);
    const mealOrders = await getMealOrdersByDate(date);
    setDailyMealOrders(mealOrders);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3">
            <CardTitle className="text-lg md:text-xl">Pregled porudžbina</CardTitle>
            <CardDescription className="text-xs md:text-sm">Zbirni prikaz porudžbina po danu</CardDescription>
            
            {/* View Toggle */}
            <div className="flex gap-2">
              <Button 
                variant={pivotView === "meals" ? "default" : "outline"} 
                size="sm"
                onClick={() => setPivotView("meals")}
              >
                Po obrocima
              </Button>
              <Button 
                variant={pivotView === "users" ? "default" : "outline"} 
                size="sm"
                onClick={() => setPivotView("users")}
              >
                Po korisnicima
              </Button>
            </div>
            
            {/* Filters Row */}
            <div className="flex flex-col md:flex-row gap-2">
              <div className="flex flex-1 gap-2">
                <Input 
                  placeholder="Pretraži po obroku..." 
                  value={orderSearch} 
                  onChange={e => setOrderSearch(e.target.value)} 
                  className="text-sm"
                  onKeyDown={e => e.key === 'Enter' && handleSearchOrders()}
                />
                <Button variant="outline" size="icon" onClick={handleSearchOrders}>
                  <Search className="h-4 w-4" />
                </Button>
              </div>
              
              {pivotView === "users" && (
                <div className="flex gap-2">
                  <Input 
                    placeholder="Filter po ID kartice..." 
                    value={userCardFilter} 
                    onChange={e => setUserCardFilter(e.target.value)} 
                    className="text-sm w-40"
                  />
                </div>
              )}
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-full md:w-auto">
                    <Filter className="h-4 w-4 mr-2" />
                    Filtriraj
                    <ChevronDown className="h-4 w-4 ml-2" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64 p-3">
                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs">Od datuma</Label>
                      <Input 
                        type="date" 
                        value={orderDateRange.startDate} 
                        onChange={e => setOrderDateRange({ ...orderDateRange, startDate: e.target.value })} 
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Do datuma</Label>
                      <Input 
                        type="date" 
                        value={orderDateRange.endDate} 
                        onChange={e => setOrderDateRange({ ...orderDateRange, endDate: e.target.value })} 
                        className="text-sm"
                      />
                    </div>
                    <Button onClick={handleDateRangeFilter} className="w-full" size="sm">
                      Primeni filter
                    </Button>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Učitavanje...</div>
          ) : orders.length === 0 ? (
            <p className="text-muted-foreground text-center py-4 text-sm">
              Nema porudžbina za izabrani period
            </p>
          ) : pivotView === "meals" ? (
            <OrderPivotTable orders={orders} />
          ) : (
            <UserOrderPivotTable 
              orders={orders} 
              userCardFilter={userCardFilter}
            />
          )}
        </CardContent>
      </Card>

      {/* Day Details Sheet */}
      <Sheet open={!!selectedDay} onOpenChange={() => setSelectedDay(null)}>
        <SheetContent className="w-full md:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Porudžbine za {selectedDay}</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 mt-6">
            {dailyMealOrders.length === 0 ? (
              <p className="text-muted-foreground text-center">Nema porudžbina za ovaj dan</p>
            ) : (
              <div className="space-y-3">
                {dailyMealOrders.map((item, index) => (
                  <div key={index} className="flex items-center gap-3 p-3 border rounded-lg">
                    {item.meal_image_url && (
                      <img 
                        src={item.meal_image_url} 
                        alt={item.meal_name} 
                        className="w-12 h-12 rounded object-cover"
                      />
                    )}
                    <div className="flex-1">
                      <p className="font-medium">{item.meal_name}</p>
                      <p className="text-sm text-muted-foreground">
                        Ukupno: {item.total_orders} porcija
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
