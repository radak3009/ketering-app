import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, Filter, ChevronDown, Tag as TagIcon, Plus, Pencil, Trash2, Download } from "lucide-react";
import { downloadCSV } from "@/lib/csv-export";
import { TablePagination } from "@/components/ui/table-pagination";
import { useToast } from "@/hooks/use-toast";
import { useOrders } from "@/hooks/useOrders";
import { useUsers } from "@/hooks/useUsers";
import { useMeals } from "@/hooks/useMeals";
import { useAdminOrders } from "@/hooks/useAdminOrders";
import { OrderPivotTable } from "./OrderPivotTable";
import { UserOrderPivotTable } from "./UserOrderPivotTable";
import { AdminOrderDialog } from "./AdminOrderDialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { format } from "date-fns";

interface OrdersOverviewProps {
  orderDateRange: { startDate: string; endDate: string };
  setOrderDateRange: (range: { startDate: string; endDate: string }) => void;
}

const SHIFT_OPTIONS = [
  { value: "all", label: "Sve" },
  { value: "prva", label: "I" },
  { value: "druga", label: "II" },
  { value: "treća", label: "III" },
] as const;

const SHIFT_ROMAN: Record<string, string> = {
  prva: "I",
  druga: "II",
  treća: "III",
};

export function OrdersOverview({ orderDateRange, setOrderDateRange }: OrdersOverviewProps) {
  const { toast } = useToast();
  const { users } = useUsers();
  const { meals } = useMeals();
  
  const startDate = orderDateRange?.startDate || '';
  const endDate = orderDateRange?.endDate || '';
  
  const { orders, loading, fetchOrders, getMealOrdersByDate, searchMealOrders } = useOrders(
    startDate || undefined,
    endDate || undefined
  );

  const { createAdminOrder, updateOrderItem, deleteOrderItem } = useAdminOrders(() => {
    fetchOrders(orderDateRange.startDate || undefined, orderDateRange.endDate || undefined);
  });
  
  const [orderSearch, setOrderSearch] = useState("");
  const [userCardFilter, setUserCardFilter] = useState("");
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [pivotView, setPivotView] = useState<"meals" | "users" | "list">("meals");
  const [shiftFilter, setShiftFilter] = useState<string>("all");
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [dailyMealOrders, setDailyMealOrders] = useState<any[]>([]);

  // Admin order dialog state
  const [orderDialogOpen, setOrderDialogOpen] = useState(false);
  const [editData, setEditData] = useState<{
    orderItemId: string;
    userId: string;
    deliveryDate: string;
    shift: string;
    mealId: string;
  } | null>(null);

  // Delete confirm state
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Pagination state for list view
  const [listPage, setListPage] = useState(1);
  const [listPageSize, setListPageSize] = useState(20);

  // Get unique tags from users
  const availableTags = useMemo(() => {
    const tags = new Set<string>();
    users.forEach(user => {
      if (user.tag) tags.add(user.tag);
    });
    return Array.from(tags).sort();
  }, [users]);

  // Filter orders by tag
  const tagFilteredOrders = useMemo(() => {
    if (tagFilter.length === 0) return orders;
    return orders.filter(order => {
      const user = users.find(u => u.user_id === order.user_id);
      return user?.tag && tagFilter.includes(user.tag);
    });
  }, [orders, users, tagFilter]);

  // Filter orders by shift
  const filteredOrders = useMemo(() => {
    if (shiftFilter === "all") return tagFilteredOrders;
    return tagFilteredOrders.map(order => ({
      ...order,
      order_items: order.order_items?.filter(item => item.shift === shiftFilter)
    })).filter(order => (order.order_items?.length ?? 0) > 0);
  }, [tagFilteredOrders, shiftFilter]);

  // Flat list of order items for list view
  const flatOrderItems = useMemo(() => {
    const items: Array<{
      orderItemId: string;
      userId: string;
      userName: string;
      cardId: string;
      deliveryDate: string;
      mealName: string;
      mealId: string;
      shift: string;
      quantity: number;
    }> = [];

    filteredOrders.forEach(order => {
      const user = users.find(u => u.user_id === order.user_id);
      order.order_items?.forEach(oi => {
        items.push({
          orderItemId: oi.id,
          userId: order.user_id,
          userName: user?.full_name || order.profile?.full_name || "Nepoznat",
          cardId: user?.company_card_id || order.profile?.company_card_id || "-",
          deliveryDate: order.delivery_date || "",
          mealName: (oi as any).meal?.name || "Nepoznat",
          mealId: oi.meal_id,
          shift: oi.shift || "prva",
          quantity: oi.quantity,
        });
      });
    });

    // Filter by card if set
    if (userCardFilter.trim()) {
      const f = userCardFilter.toLowerCase().trim();
      return items.filter(i => i.cardId.toLowerCase().includes(f) || i.userName.toLowerCase().includes(f));
    }
    return items.sort((a, b) => a.deliveryDate.localeCompare(b.deliveryDate) || a.userName.localeCompare(b.userName, "sr"));
  }, [filteredOrders, users, userCardFilter]);

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

  const handleEditItem = (item: typeof flatOrderItems[0]) => {
    setEditData({
      orderItemId: item.orderItemId,
      userId: item.userId,
      deliveryDate: item.deliveryDate,
      shift: item.shift,
      mealId: item.mealId,
    });
    setOrderDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteItemId) return;
    setDeleteLoading(true);
    try {
      await deleteOrderItem(deleteItemId);
    } finally {
      setDeleteLoading(false);
      setDeleteItemId(null);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg md:text-xl">Pregled porudžbina</CardTitle>
                <CardDescription className="text-xs md:text-sm">Zbirni prikaz porudžbina po danu</CardDescription>
              </div>
              <Button size="sm" onClick={() => { setEditData(null); setOrderDialogOpen(true); }}>
                <Plus className="h-4 w-4 mr-1.5" />
                Nova porudžbina
              </Button>
            </div>
            
            {/* View Toggle + Shift Filter */}
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
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
                <Button 
                  variant={pivotView === "list" ? "default" : "outline"} 
                  size="sm"
                  onClick={() => setPivotView("list")}
                >
                  Lista
                </Button>
              </div>
              
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground whitespace-nowrap">Smena:</Label>
                <ToggleGroup
                  type="single"
                  value={shiftFilter}
                  onValueChange={(val) => val && setShiftFilter(val)}
                  size="sm"
                >
                  {SHIFT_OPTIONS.map(opt => (
                    <ToggleGroupItem key={opt.value} value={opt.value} className="text-xs px-3">
                      {opt.label}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </div>
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
              
              {(pivotView === "users" || pivotView === "list") && (
                <div className="flex gap-2">
                  <Input 
                    placeholder="Filter po ID kartice..." 
                    value={userCardFilter} 
                    onChange={e => setUserCardFilter(e.target.value)} 
                    className="text-sm w-40"
                  />
                </div>
              )}
              
              {/* Tag Filter Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-full md:w-auto">
                    <TagIcon className="h-4 w-4 mr-2" />
                    Tag {tagFilter.length > 0 && `(${tagFilter.length})`}
                    <ChevronDown className="h-4 w-4 ml-2" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 max-h-60 overflow-y-auto p-2">
                  {availableTags.length === 0 ? (
                    <p className="text-xs text-muted-foreground p-2">Nema dostupnih tagova</p>
                  ) : (
                    availableTags.map(tag => (
                      <div key={tag} className="flex items-center space-x-2 p-2">
                        <Checkbox 
                          checked={tagFilter.includes(tag)}
                          onCheckedChange={(checked) => {
                            setTagFilter(prev => 
                              checked ? [...prev, tag] : prev.filter(t => t !== tag)
                            );
                          }}
                        />
                        <span className="text-sm">{tag}</span>
                      </div>
                    ))
                  )}
                  {tagFilter.length > 0 && (
                    <Button variant="ghost" size="sm" className="w-full mt-2" onClick={() => setTagFilter([])}>
                      Resetuj
                    </Button>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Date Filter Dropdown */}
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
          ) : filteredOrders.length === 0 ? (
            <p className="text-muted-foreground text-center py-4 text-sm">
              Nema porudžbina za izabrani period
            </p>
          ) : pivotView === "meals" ? (
            <OrderPivotTable orders={filteredOrders} shiftFilter={shiftFilter} />
          ) : pivotView === "users" ? (
            <UserOrderPivotTable 
              orders={filteredOrders} 
              userCardFilter={userCardFilter}
              shiftFilter={shiftFilter}
            />
          ) : (
            /* List view with edit/delete */
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg md:text-xl">Lista porudžbina</CardTitle>
                    <CardDescription className="text-xs md:text-sm">Lista porudžbina po korisnicima</CardDescription>
                  </div>
                  {flatOrderItems.length > 0 && (
                    <Button variant="outline" size="sm" onClick={() => {
                      const header = ["Korisnik", "ID Kartice", "Datum dostave", "Obrok", "Smena"];
                      const rows: (string | number)[][] = [header, ...flatOrderItems.map(item => [
                        item.userName,
                        item.cardId,
                        item.deliveryDate,
                        item.mealName,
                        SHIFT_ROMAN[item.shift] || item.shift,
                      ])];
                      downloadCSV(rows, `porudzbine-lista_${format(new Date(), 'yyyy-MM-dd')}`);
                      toast({ title: "CSV izvezen", description: `Izvezeno ${flatOrderItems.length} stavki` });
                    }}>
                      <Download className="h-4 w-4 mr-1.5" />
                      CSV
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="overflow-x-auto -mx-3 md:mx-0 px-3 md:px-0">
                <div className="min-w-[600px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs md:text-sm">Korisnik</TableHead>
                        <TableHead className="text-xs md:text-sm">ID Kartice</TableHead>
                        <TableHead className="text-xs md:text-sm">Datum dostave</TableHead>
                        <TableHead className="text-xs md:text-sm">Obrok</TableHead>
                        <TableHead className="text-xs md:text-sm">Smena</TableHead>
                        <TableHead className="text-xs md:text-sm text-right">Akcije</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {flatOrderItems.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                            Nema stavki za prikaz
                          </TableCell>
                        </TableRow>
                      ) : (
                        flatOrderItems
                          .slice((listPage - 1) * listPageSize, listPage * listPageSize)
                          .map((item) => (
                          <TableRow key={item.orderItemId}>
                            <TableCell className="text-xs md:text-sm font-medium">{item.userName}</TableCell>
                            <TableCell className="text-xs md:text-sm font-mono">{item.cardId}</TableCell>
                            <TableCell className="text-xs md:text-sm">{item.deliveryDate}</TableCell>
                            <TableCell className="text-xs md:text-sm">{item.mealName}</TableCell>
                            <TableCell className="text-xs md:text-sm">
                              <Badge variant="secondary">{SHIFT_ROMAN[item.shift] || item.shift}</Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex gap-1 justify-end">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => handleEditItem(item)}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-destructive hover:text-destructive"
                                  onClick={() => setDeleteItemId(item.orderItemId)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
                {flatOrderItems.length > 0 && (
                  <TablePagination
                    currentPage={listPage}
                    totalItems={flatOrderItems.length}
                    pageSize={listPageSize}
                    onPageChange={setListPage}
                    onPageSizeChange={(size) => { setListPageSize(size); setListPage(1); }}
                  />
                )}
              </CardContent>
            </Card>
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

      {/* Admin Order Dialog */}
      <AdminOrderDialog
        open={orderDialogOpen}
        onOpenChange={setOrderDialogOpen}
        users={users}
        meals={meals}
        editData={editData}
        onSubmit={async (data) => {
          await createAdminOrder({
            userId: data.userId,
            deliveryDate: data.deliveryDate,
            shift: data.shift,
            mealId: data.mealId,
            mealPrice: data.mealPrice,
            fiscalize: data.fiscalize,
          });
        }}
        onUpdate={async (data) => {
          await updateOrderItem({
            orderItemId: data.orderItemId,
            shift: data.shift,
            mealId: data.mealId,
            mealPrice: data.mealPrice,
          });
        }}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteItemId}
        onOpenChange={(open) => { if (!open) setDeleteItemId(null); }}
        title="Obriši stavku porudžbine"
        description="Da li ste sigurni da želite da obrišete ovu stavku? Ova akcija se ne može poništiti."
        confirmLabel="Obriši"
        variant="destructive"
        loading={deleteLoading}
        onConfirm={handleDeleteConfirm}
      />
    </>
  );
}
