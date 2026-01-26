import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, ExternalLink, MonitorSmartphone, ChefHat, QrCode } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useOrders } from "@/hooks/useOrders";
import { useUsers } from "@/hooks/useUsers";
import { useMeals } from "@/hooks/useMeals";
import { useMenus } from "@/hooks/useMenus";
import { format, startOfWeek, endOfWeek, addWeeks, getWeek, getYear } from "date-fns";
import { QRCodeSVG } from "qrcode.react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export function ReportsTab() {
  const { toast } = useToast();
  const { orders, fetchOrders } = useOrders();
  const { users } = useUsers();
  const { meals } = useMeals();
  const { menus } = useMenus();
  
  const [reportType, setReportType] = useState("orders");
  const [reportDateRange, setReportDateRange] = useState({
    startDate: format(startOfWeek(addWeeks(new Date(), 1), { weekStartsOn: 1 }), 'yyyy-MM-dd'),
    endDate: format(endOfWeek(addWeeks(new Date(), 1), { weekStartsOn: 1 }), 'yyyy-MM-dd')
  });

  // Group menus by week for stats
  const groupMenusByWeek = () => {
    const grouped = new Map<string, { 
      weekNumber: number, 
      year: number, 
      menus: typeof menus,
      isCurrentWeek: boolean,
      isNextWeek: boolean 
    }>();
    
    const now = new Date();
    const currentWeekNumber = getWeek(now, { weekStartsOn: 1 });
    const currentYear = getYear(now);
    
    const nextWeek = addWeeks(now, 1);
    const nextWeekNumber = getWeek(nextWeek, { weekStartsOn: 1 });
    const nextWeekYear = getYear(nextWeek);
    
    menus.forEach(menu => {
      const date = new Date(menu.menu_date);
      const weekNumber = getWeek(date, { weekStartsOn: 1 });
      const year = getYear(date);
      const key = `${year}-W${weekNumber}`;
      
      if (!grouped.has(key)) {
        grouped.set(key, {
          weekNumber,
          year,
          menus: [],
          isCurrentWeek: weekNumber === currentWeekNumber && year === currentYear,
          isNextWeek: weekNumber === nextWeekNumber && year === nextWeekYear
        });
      }
      
      grouped.get(key)!.menus.push(menu);
    });
    
    return Array.from(grouped.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .filter(([key, weekData]) => {
        const firstMenuDate = weekData.menus[0]?.menu_date;
        if (!firstMenuDate) return false;
        
        const weekStart = startOfWeek(new Date(firstMenuDate), { weekStartsOn: 1 });
        const currentWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
        
        return weekStart >= currentWeekStart;
      });
  };

  const groupedMenus = groupMenusByWeek();

  const handleExportReport = async () => {
    try {
      let csvContent = '';
      let filename = '';
      
      if (reportType === 'orders') {
        await fetchOrders(reportDateRange.startDate, reportDateRange.endDate);
        
        csvContent = '\uFEFF'; // UTF-8 BOM
        csvContent += 'ID Porudžbine,Korisnik,Tag,Datum porudžbine,Datum dostave,Status,Ukupan iznos,Napomene\n';
        orders.forEach(order => {
          const user = users.find(u => u.user_id === order.user_id);
          csvContent += `"${order.id}","${user?.full_name || 'N/A'}","${user?.tag || ''}","${order.order_date}","${order.delivery_date || 'N/A'}","${order.status}","${order.total_amount}","${order.notes || ''}"\n`;
        });
        filename = `porudzbine_${reportDateRange.startDate}_${reportDateRange.endDate}.csv`;
      } else if (reportType === 'revenue') {
        await fetchOrders(reportDateRange.startDate, reportDateRange.endDate);
        
        const revenueByDate: Record<string, number> = {};
        orders.forEach(order => {
          const date = order.delivery_date || order.order_date;
          if (!revenueByDate[date]) {
            revenueByDate[date] = 0;
          }
          revenueByDate[date] += parseFloat(order.total_amount.toString());
        });
        
        csvContent = '\uFEFF';
        csvContent += 'Datum,Ukupan prihod (RSD),Broj porudžbina\n';
        Object.entries(revenueByDate).sort(([a], [b]) => a.localeCompare(b)).forEach(([date, revenue]) => {
          const ordersCount = orders.filter(o => (o.delivery_date || o.order_date) === date).length;
          csvContent += `"${date}","${revenue.toFixed(2)}","${ordersCount}"\n`;
        });
        filename = `prihodi_${reportDateRange.startDate}_${reportDateRange.endDate}.csv`;
      } else if (reportType === 'users') {
        csvContent = '\uFEFF';
        csvContent += 'ID,Ime i prezime,Email,Tag,Telefon,Rola,ID kartice,Datum kreiranja\n';
        users.forEach(user => {
          csvContent += `"${user.user_id}","${user.full_name || ''}","${user.email || ''}","${user.tag || ''}","${user.phone || ''}","${user.role}","${user.company_card_id || ''}","${user.created_at}"\n`;
        });
        filename = `korisnici_${format(new Date(), 'yyyy-MM-dd')}.csv`;
      } else if (reportType === 'meals') {
        csvContent = '\uFEFF';
        csvContent += 'ID,Naziv,Kategorija,Cena (RSD),Status,Dostupnost,Smene,Datum kreiranja\n';
        meals.forEach(meal => {
          const shiftsStr = meal.shifts?.join(', ') || '';
          csvContent += `"${meal.id}","${meal.name}","${meal.category}","${meal.price}","${meal.status}","${meal.is_available ? 'Da' : 'Ne'}","${shiftsStr}","${meal.created_at}"\n`;
        });
        filename = `obroci_${format(new Date(), 'yyyy-MM-dd')}.csv`;
      }

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast({ title: "Izveštaj preuzet", description: `CSV fajl ${filename} je uspešno preuzet` });
    } catch (error) {
      console.error('Error exporting report:', error);
      toast({ title: "Greška", description: "Nije moguće generisati izveštaj", variant: "destructive" });
    }
  };

  // Get kiosk tokens from environment or use placeholder
  const employeeKioskUrl = `/kiosk/pickup?t=YOUR_EMPLOYEE_TOKEN`;
  const kitchenKioskUrl = `/kiosk/kitchen?t=YOUR_KITCHEN_TOKEN`;

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Generišite izveštaj</CardTitle>
          <CardDescription>Izvoz podataka u CSV format</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Tip izveštaja</Label>
            <Select value={reportType} onValueChange={setReportType}>
              <SelectTrigger>
                <SelectValue placeholder="Odaberite tip" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="orders">Porudžbine</SelectItem>
                <SelectItem value="revenue">Prihodi</SelectItem>
                <SelectItem value="users">Korisnici</SelectItem>
                <SelectItem value="meals">Obroci</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {(reportType === 'orders' || reportType === 'revenue') && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Od datuma</Label>
                <Input 
                  type="date" 
                  value={reportDateRange.startDate} 
                  onChange={e => setReportDateRange({ ...reportDateRange, startDate: e.target.value })} 
                />
              </div>
              <div>
                <Label>Do datuma</Label>
                <Input 
                  type="date" 
                  value={reportDateRange.endDate} 
                  onChange={e => setReportDateRange({ ...reportDateRange, endDate: e.target.value })} 
                />
              </div>
            </div>
          )}
          
          <Button onClick={handleExportReport} className="w-full">
            <Download className="h-4 w-4 mr-2" />
            Generiši i preuzmi CSV
          </Button>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Brze statistike</CardTitle>
          <CardDescription>Pregled ključnih pokazatelja</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Ukupno korisnika</span>
            <span className="font-bold">{users.length}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Aktivni obroci</span>
            <span className="font-bold">{meals.filter(m => m.status === 'aktivan').length}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Jelovnici ove nedelje</span>
            <span className="font-bold">
              {groupedMenus.find(([_, data]) => data.isCurrentWeek)?.[1]?.menus.length || 0}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Jelovnici sledeće nedelje</span>
            <span className="font-bold">
              {groupedMenus.find(([_, data]) => data.isNextWeek)?.[1]?.menus.length || 0}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Kiosk Panels Card */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Kiosk paneli</CardTitle>
          <CardDescription>Pristup kiosk ekranima za preuzimanje obroka</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="flex items-center justify-between p-4 border rounded-lg bg-card">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <MonitorSmartphone className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Kiosk - Ulaz u kantinu</p>
                  <p className="text-sm text-muted-foreground">
                    Za zaposlene da prikažu današnji obrok
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <QrCode className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>QR Kod - Ulaz u kantinu</DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col items-center gap-4 py-4">
                      <div className="p-4 bg-white rounded-lg">
                        <QRCodeSVG 
                          value={`${window.location.origin}${employeeKioskUrl}`}
                          size={200}
                          level="H"
                        />
                      </div>
                      <p className="text-sm text-muted-foreground text-center">
                        Skenirajte ovaj QR kod na tabletu za pristup kiosku
                      </p>
                      <code className="text-xs bg-muted p-2 rounded break-all max-w-full">
                        {`${window.location.origin}${employeeKioskUrl}`}
                      </code>
                    </div>
                  </DialogContent>
                </Dialog>
                <Button variant="outline" size="sm" asChild>
                  <a href={employeeKioskUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Otvori
                  </a>
                </Button>
              </div>
            </div>
            
            <div className="flex items-center justify-between p-4 border rounded-lg bg-card">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-success/10">
                  <ChefHat className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="font-medium">Kiosk - Kuhinja</p>
                  <p className="text-sm text-muted-foreground">
                    Za kuhinjsko osoblje da izdaju obroke
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <QrCode className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>QR Kod - Kuhinja</DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col items-center gap-4 py-4">
                      <div className="p-4 bg-white rounded-lg">
                        <QRCodeSVG 
                          value={`${window.location.origin}${kitchenKioskUrl}`}
                          size={200}
                          level="H"
                        />
                      </div>
                      <p className="text-sm text-muted-foreground text-center">
                        Skenirajte ovaj QR kod na tabletu za pristup kiosku
                      </p>
                      <code className="text-xs bg-muted p-2 rounded break-all max-w-full">
                        {`${window.location.origin}${kitchenKioskUrl}`}
                      </code>
                    </div>
                  </DialogContent>
                </Dialog>
                <Button variant="outline" size="sm" asChild>
                  <a href={kitchenKioskUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Otvori
                  </a>
                </Button>
              </div>
            </div>
          </div>
          
          <div className="text-xs text-muted-foreground p-3 bg-muted rounded-lg">
            💡 <strong>Napomena:</strong> Linkovi sadrže sigurnosne tokene (KIOSK_TOKEN_EMPLOYEE i KIOSK_TOKEN_KITCHEN). 
            Zamenite "YOUR_EMPLOYEE_TOKEN" i "YOUR_KITCHEN_TOKEN" sa stvarnim vrednostima iz Supabase secrets-a. 
            Koristite Full Screen (F11) za kiosk mod na tabletima.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
