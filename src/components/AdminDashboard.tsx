import { useState, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { 
  BarChart3, 
  Users, 
  ChefHat, 
  Calendar, 
  Download, 
  Plus,
  Search,
  Filter,
  LogOut,
  Edit,
  Trash2,
  Mail,
  ImageIcon,
  Clock,
  Upload,
  Save,
  FileText,
  ChevronDown
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useMeals } from "@/hooks/useMeals";
import { useMenus } from "@/hooks/useMenus";
import { useUsers } from "@/hooks/useUsers";
import { useOrders } from "@/hooks/useOrders";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfWeek, endOfWeek, addWeeks, isThisWeek } from "date-fns";

interface OrderStats {
  totalOrders: number;
  totalRevenue: number;
  employeesOrdered: number;
  avgOrderValue: number;
}

interface DailyOrders {
  day: string;
  orders: number;
  revenue: number;
}

const SAMPLE_STATS: OrderStats = {
  totalOrders: 847,
  totalRevenue: 382150,
  employeesOrdered: 245,
  avgOrderValue: 451
};

const SAMPLE_DAILY_ORDERS: DailyOrders[] = [
  { day: "Ponedeljak", orders: 180, revenue: 81000 },
  { day: "Utorak", orders: 165, revenue: 74250 },
  { day: "Sreda", orders: 172, revenue: 77400 },
  { day: "Četvrtak", orders: 158, revenue: 71100 },
  { day: "Petak", orders: 172, revenue: 78400 }
];

export function AdminDashboard() {
  const { signOut } = useAuth();
  const { toast } = useToast();
  const { meals, loading: mealsLoading, createMeal, updateMeal, deleteMeal } = useMeals();
  const { menus, loading: menusLoading, createMenu, updateMenu, deleteMenu } = useMenus();
  const { users, loading: usersLoading, createUser, updateUser, deleteUser, sendMagicLink } = useUsers();
  const { orders, loading: ordersLoading, fetchOrders, getMealOrdersByDate, searchMealOrders } = useOrders();

  // State management
  const [selectedMeal, setSelectedMeal] = useState<any>(null);
  const [selectedMenu, setSelectedMenu] = useState<any>(null);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [dailyMealOrders, setDailyMealOrders] = useState<any[]>([]);
  const [isAddMealOpen, setIsAddMealOpen] = useState(false);
  const [isCreateMenuOpen, setIsCreateMenuOpen] = useState(false);
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  // Form states
  const [mealForm, setMealForm] = useState({
    name: "",
    description: "",
    price: "",
    status: "aktivan" as "aktivan" | "neaktivan",
    shifts: [] as string[],
    image_url: ""
  });

  const [menuForm, setMenuForm] = useState({
    description: "",
    menu_date: "",
    selectedMeals: [] as string[]
  });

  const [userForm, setUserForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    role: "employee" as "admin" | "employee"
  });

  // Search states
  const [menuMealSearch, setMenuMealSearch] = useState("");
  const [orderSearch, setOrderSearch] = useState("");
  const [orderDateRange, setOrderDateRange] = useState({
    startDate: "",
    endDate: ""
  });

  const resetUserForm = () => {
    setUserForm({
      full_name: "",
      email: "",
      phone: "",
      role: "employee"
    });
  };

  const handleCreateUser = async () => {
    if (!userForm.full_name || !userForm.email) {
      toast({
        title: "Greška",
        description: "Molimo unesite ime i email",
        variant: "destructive"
      });
      return;
    }

    try {
      await createUser(userForm);
      resetUserForm();
      setIsAddUserOpen(false);
    } catch (error) {
      console.error('Error creating user:', error);
    }
  };

  const handleBulkUserImport = async () => {
    if (!csvFile) {
      toast({
        title: "Greška",
        description: "Molimo odaberite fajl",
        variant: "destructive"
      });
      return;
    }

    try {
      const text = await csvFile.text();
      const lines = text.split('\n').filter(line => line.trim());
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      
      const requiredFields = ['ime', 'email'];
      const hasRequiredFields = requiredFields.every(field => 
        headers.some(h => h.includes(field) || h.includes(field.replace('ime', 'name')))
      );

      if (!hasRequiredFields) {
        toast({
          title: "Greška",
          description: "CSV mora sadržavati kolone: Ime, Email",
          variant: "destructive"
        });
        return;
      }

      const users = lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim());
        const userData: any = {};
        
        headers.forEach((header, index) => {
          if (header.includes('ime') || header.includes('name')) userData.full_name = values[index];
          if (header.includes('email')) userData.email = values[index];
          if (header.includes('phone') || header.includes('telefon')) userData.phone = values[index];
          if (header.includes('role') || header.includes('uloga')) {
            userData.role = values[index].toLowerCase().includes('admin') ? 'admin' : 'employee';
          } else {
            userData.role = 'employee';
          }
        });
        
        return userData;
      }).filter(user => user.full_name && user.email);

      for (const userData of users) {
        await createUser(userData);
      }

      setCsvFile(null);
      toast({
        title: "Uspeh",
        description: `Uvezeno je ${users.length} korisnika`
      });
    } catch (error) {
      console.error('Error importing users:', error);
      toast({
        title: "Greška",
        description: "Greška pri uvozu korisnika",
        variant: "destructive"
      });
    }
  };

  const handleDateRangeFilter = () => {
    if (orderDateRange.startDate && orderDateRange.endDate) {
      fetchOrders(orderDateRange.startDate, orderDateRange.endDate);
    }
  };

  const handleDayClick = async (day: any) => {
    // Extract date from the day string or use direct date
    const dateString = day.date || day.day;
    let date;
    
    if (dateString.includes('-')) {
      // Already a date string
      date = dateString;
    } else {
      // Parse from display format like "Ponedeljak 06.01"
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

  const handleSearchOrders = async () => {
    if (orderSearch.trim()) {
      const results = await searchMealOrders(
        orderSearch, 
        orderDateRange.startDate || undefined, 
        orderDateRange.endDate || undefined
      );
      // Handle search results - you could display them in a separate state
      toast({
        title: "Pretraga završena",
        description: `Pronađeno je ${results.length} porudžbina`
      });
    }
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('Slike obroka')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('Slike obroka')
        .getPublicUrl(filePath);

      return data.publicUrl;
    } catch (error) {
      console.error('Error uploading image:', error);
      toast({
        title: "Greška",
        description: "Greška pri upload-u slike",
        variant: "destructive"
      });
      return null;
    }
  };

  const handleCreateMeal = async () => {
    if (!mealForm.name || !mealForm.price) {
      toast({
        title: "Greška",
        description: "Molimo unesite naziv i cenu obroka",
        variant: "destructive"
      });
      return;
    }

    try {
      let imageUrl = mealForm.image_url;
      
      if (imageFile) {
        imageUrl = await uploadImage(imageFile);
        if (!imageUrl) return;
      }

      await createMeal({
        name: mealForm.name,
        description: mealForm.description || null,
        price: parseFloat(mealForm.price),
        category: "Glavno jelo", // Default category
        status: mealForm.status,
        shifts: mealForm.shifts,
        image_url: imageUrl || null,
        is_available: true,
        allergens: null,
        nutritional_info: null
      });
      
      resetMealForm();
      setIsAddMealOpen(false);
    } catch (error) {
      console.error('Error creating meal:', error);
    }
  };

  const handleUpdateMeal = async () => {
    if (!selectedMeal || !selectedMeal.name || !selectedMeal.price) {
      toast({
        title: "Greška",
        description: "Molimo unesite naziv i cenu obroka",
        variant: "destructive"
      });
      return;
    }

    try {
      let imageUrl = selectedMeal.image_url;
      
      if (imageFile) {
        imageUrl = await uploadImage(imageFile);
        if (!imageUrl) return;
      }

      await updateMeal(selectedMeal.id, {
        name: selectedMeal.name,
        description: selectedMeal.description || null,
        price: parseFloat(selectedMeal.price),
        status: selectedMeal.status,
        shifts: selectedMeal.shifts,
        image_url: imageUrl || null,
      });
      
      setSelectedMeal(null);
      setImageFile(null);
    } catch (error) {
      console.error('Error updating meal:', error);
    }
  };

  const generateMenuName = (date: string) => {
    const menuDate = new Date(date);
    const dayNames = ['Nedelja', 'Ponedeljak', 'Utorak', 'Sreda', 'Četvrtak', 'Petak', 'Subota'];
    const dayName = dayNames[menuDate.getDay()];
    const formattedDate = format(menuDate, 'dd.MM.yyyy');
    return `${dayName} ${formattedDate}`;
  };

  const handleCreateMenu = async () => {
    if (!menuForm.menu_date || menuForm.selectedMeals.length === 0) {
      toast({
        title: "Greška",
        description: "Molimo odaberite datum i obroke",
        variant: "destructive"
      });
      return;
    }

    const selectedDate = new Date(menuForm.menu_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (selectedDate <= today) {
      toast({
        title: "Greška",
        description: "Ne možete kreirati jelovnik za prošle datume",
        variant: "destructive"
      });
      return;
    }

    try {
      const menuName = generateMenuName(menuForm.menu_date);
      
      await createMenu({
        name: menuName,
        description: menuForm.description || undefined,
        menu_date: menuForm.menu_date,
        meal_ids: menuForm.selectedMeals
      });
      
      setMenuForm({
        description: "",
        menu_date: "",
        selectedMeals: []
      });
      setIsCreateMenuOpen(false);
    } catch (error) {
      console.error('Error creating menu:', error);
    }
  };

  const handleUpdateUser = async () => {
    if (!selectedUser) return;

    try {
      await updateUser(selectedUser.id, {
        full_name: selectedUser.full_name,
        email: selectedUser.email,
        phone: selectedUser.phone,
        role: selectedUser.role
      });
      
      setSelectedUser(null);
    } catch (error) {
      console.error('Error updating user:', error);
    }
  };

  const handleUpdateMenu = async () => {
    if (!selectedMenu) return;

    try {
      const selectedMealIds = selectedMenu.meals?.map((m: any) => m.meal_id) || [];
      
      await updateMenu(selectedMenu.id, {
        description: selectedMenu.description,
        menu_date: selectedMenu.menu_date,
        meal_ids: selectedMealIds
      });
      
      setSelectedMenu(null);
    } catch (error) {
      console.error('Error updating menu:', error);
    }
  };

  const handleSendMagicLink = async (email: string) => {
    try {
      await sendMagicLink(email);
    } catch (error) {
      console.error('Error sending magic link:', error);
    }
  };

  const resetMealForm = () => {
    setMealForm({
      name: "",
      description: "",
      price: "",
      status: "aktivan",
      shifts: [],
      image_url: ""
    });
    setImageFile(null);
  };

  const filteredMenuMeals = meals.filter(meal => 
    meal.status === "aktivan" && 
    meal.name.toLowerCase().includes(menuMealSearch.toLowerCase())
  );

  const isNextWeek = (date: Date) => {
    const nextWeek = addWeeks(new Date(), 1);
    const startOfNextWeek = startOfWeek(nextWeek, { weekStartsOn: 1 });
    const endOfNextWeek = endOfWeek(nextWeek, { weekStartsOn: 1 });
    return date >= startOfNextWeek && date <= endOfNextWeek;
  };

  const thisWeekMenus = menus.filter(menu => isThisWeek(new Date(menu.menu_date)));
  const nextWeekMenus = menus.filter(menu => isNextWeek(new Date(menu.menu_date)));

  const handleExportReport = () => {
    toast({
      title: "Izveštaj se generiše",
      description: "CSV fajl će biti preuzet za nekoliko sekundi",
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-corporate/5 to-background">
      <div className="container mx-auto p-6">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-corporate rounded-lg">
                <BarChart3 className="h-6 w-6 text-corporate-foreground" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-foreground">Admin Panel</h1>
                <p className="text-muted-foreground">Upravljanje keteringom i izveštajima</p>
              </div>
            </div>
            <Button onClick={signOut} variant="outline" size="sm">
              <LogOut className="h-4 w-4 mr-2" />
              Odjavi se
            </Button>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-corporate" />
                <div>
                  <p className="text-sm text-muted-foreground">Ukupno porudžbina</p>
                  <p className="text-2xl font-bold">{SAMPLE_STATS.totalOrders}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-success" />
                <div>
                  <p className="text-sm text-muted-foreground">Ukupan prihod</p>
                  <p className="text-2xl font-bold">{SAMPLE_STATS.totalRevenue.toLocaleString()} RSD</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Zaposleni poručili</p>
                  <p className="text-2xl font-bold">{SAMPLE_STATS.employeesOrdered}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-warning" />
                <div>
                  <p className="text-sm text-muted-foreground">Prosečna porudžbina</p>
                  <p className="text-2xl font-bold">{SAMPLE_STATS.avgOrderValue} RSD</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="meals" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="orders">Porudžbine</TabsTrigger>
            <TabsTrigger value="meals">Obroci</TabsTrigger>
            <TabsTrigger value="menus">Jelovnici</TabsTrigger>
            <TabsTrigger value="users">Korisnici</TabsTrigger>
            <TabsTrigger value="reports">Izveštaji</TabsTrigger>
          </TabsList>

          <TabsContent value="orders">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Pregled porudžbina</CardTitle>
                    <CardDescription>Filtriraj i pretraži porudžbine</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Input 
                      placeholder="Pretraži po nazivu obroka..."
                      value={orderSearch}
                      onChange={(e) => setOrderSearch(e.target.value)}
                      className="w-48"
                    />
                    <Button variant="outline" size="sm" onClick={handleSearchOrders}>
                      <Search className="h-4 w-4 mr-1" />
                      Pretraži
                    </Button>
                  </div>
                </div>
                <div className="flex gap-4 mt-4">
                  <div className="flex gap-2">
                    <Input 
                      type="date"
                      placeholder="Od datuma"
                      value={orderDateRange.startDate}
                      onChange={(e) => setOrderDateRange({...orderDateRange, startDate: e.target.value})}
                    />
                    <Input 
                      type="date"
                      placeholder="Do datuma"
                      value={orderDateRange.endDate}
                      onChange={(e) => setOrderDateRange({...orderDateRange, endDate: e.target.value})}
                    />
                    <Button variant="outline" size="sm" onClick={handleDateRangeFilter}>
                      <Filter className="h-4 w-4 mr-1" />
                      Filtriraj
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {ordersLoading ? (
                  <div className="text-center py-8">Učitavanje...</div>
                ) : (
                  <div className="grid gap-4">
                    {orders.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        Nema porudžbina za izabrani period
                      </div>
                    ) : (
                      // Group orders by date
                      Object.entries(
                        orders.reduce((acc, order) => {
                          const date = order.order_date;
                          if (!acc[date]) {
                            acc[date] = [];
                          }
                          acc[date].push(order);
                          return acc;
                        }, {} as Record<string, typeof orders>)
                      ).map(([date, dayOrders]) => {
                        const totalOrders = dayOrders.length;
                        const totalRevenue = dayOrders.reduce((sum, order) => sum + (parseFloat(order.total_amount.toString()) || 0), 0);
                        const dayName = ['Nedelja', 'Ponedeljak', 'Utorak', 'Sreda', 'Četvrtak', 'Petak', 'Subota'][new Date(date).getDay()];
                        
                        return (
                          <div key={date} className="relative">
                            <div 
                              className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 cursor-pointer"
                              onClick={() => handleDayClick({ day: `${dayName} ${format(new Date(date), 'dd.MM')}` })}
                            >
                              <div>
                                <h3 className="font-medium">{dayName} {format(new Date(date), 'dd.MM.yyyy')}</h3>
                                <p className="text-sm text-muted-foreground">{totalOrders} porudžbina</p>
                              </div>
                              <div className="text-right flex items-center gap-2">
                                <div>
                                  <p className="font-bold">{totalRevenue.toLocaleString()} RSD</p>
                                  <Badge variant="secondary">{totalOrders} kom</Badge>
                                </div>
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              </div>
                            </div>
                            
                            {selectedDay === date && (
                              <div className="mt-2 p-4 bg-muted/20 rounded-lg">
                                <h4 className="font-medium mb-3">Obroci za {dayName}</h4>
                                {dailyMealOrders.length === 0 ? (
                                  <p className="text-sm text-muted-foreground">Nema podataka</p>
                                ) : (
                                  <div className="space-y-2">
                                    {dailyMealOrders.map((mealOrder) => (
                                      <div key={mealOrder.meal_id} className="flex items-center gap-3 p-2 border rounded">
                                        <div className="w-10 h-10 rounded overflow-hidden bg-muted">
                                          {mealOrder.meal_image_url ? (
                                            <img 
                                              src={mealOrder.meal_image_url} 
                                              alt={mealOrder.meal_name} 
                                              className="w-full h-full object-cover" 
                                            />
                                          ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                              <ImageIcon className="h-4 w-4 text-muted-foreground" />
                                            </div>
                                          )}
                                        </div>
                                        <div className="flex-1">
                                          <p className="font-medium text-sm">{mealOrder.meal_name}</p>
                                          <Badge variant="outline" className="text-xs">
                                            {mealOrder.total_orders} kom
                                          </Badge>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="meals">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <ChefHat className="h-5 w-5" />
                      Upravljanje obrocima
                    </CardTitle>
                    <CardDescription>Svi obroci u sistemu</CardDescription>
                  </div>
                  <Sheet open={isAddMealOpen} onOpenChange={setIsAddMealOpen}>
                    <SheetTrigger asChild>
                      <Button onClick={() => { resetMealForm(); setIsAddMealOpen(true); }}>
                        <Plus className="h-4 w-4 mr-2" />
                        Dodaj obrok
                      </Button>
                    </SheetTrigger>
                    <SheetContent>
                      <SheetHeader>
                        <SheetTitle>Dodaj novi obrok</SheetTitle>
                      </SheetHeader>
                      <div className="space-y-4 mt-6">
                        <div>
                          <Label htmlFor="meal-name">Naziv obroka *</Label>
                          <Input 
                            id="meal-name"
                            value={mealForm.name}
                            onChange={(e) => setMealForm({...mealForm, name: e.target.value})}
                            placeholder="npr. Piletina sa rižom"
                          />
                        </div>
                        
                        <div>
                          <Label htmlFor="meal-price">Cena (RSD) *</Label>
                          <Input 
                            id="meal-price"
                            type="number"
                            value={mealForm.price}
                            onChange={(e) => setMealForm({...mealForm, price: e.target.value})}
                            placeholder="450"
                          />
                        </div>
                        
                        <div>
                          <Label htmlFor="meal-description">Opis</Label>
                          <Textarea 
                            id="meal-description"
                            value={mealForm.description}
                            onChange={(e) => setMealForm({...mealForm, description: e.target.value})}
                            placeholder="Kratak opis obroka..."
                          />
                        </div>
                        
                        <div>
                          <Label>Status</Label>
                          <Select 
                            value={mealForm.status} 
                            onValueChange={(value: "aktivan" | "neaktivan") => setMealForm({...mealForm, status: value})}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Odaberite status" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="aktivan">Aktivan</SelectItem>
                              <SelectItem value="neaktivan">Neaktivan</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label>Dostupnost u smenama</Label>
                          <div className="flex gap-4 mt-2">
                            {["prva", "druga", "treća"].map((shift) => (
                              <div key={shift} className="flex items-center space-x-2">
                                <Checkbox
                                  id={shift}
                                  checked={mealForm.shifts.includes(shift)}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      setMealForm({...mealForm, shifts: [...mealForm.shifts, shift]});
                                    } else {
                                      setMealForm({...mealForm, shifts: mealForm.shifts.filter(s => s !== shift)});
                                    }
                                  }}
                                />
                                <label htmlFor={shift} className="text-sm font-medium capitalize">
                                  {shift} smena
                                </label>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div>
                          <Label>Slika obroka</Label>
                          <div className="flex gap-2 mt-2">
                            <Button 
                              type="button" 
                              variant="outline" 
                              onClick={() => fileInputRef.current?.click()}
                              className="flex-1"
                            >
                              <Upload className="h-4 w-4 mr-2" />
                              {imageFile ? imageFile.name : "Učitaj sliku"}
                            </Button>
                            <input
                              ref={fileInputRef}
                              type="file"
                              accept="image/*"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) setImageFile(file);
                              }}
                              className="hidden"
                            />
                          </div>
                          {(imageFile || mealForm.image_url) && (
                            <div className="mt-2">
                              <img 
                                src={imageFile ? URL.createObjectURL(imageFile) : mealForm.image_url} 
                                alt="Preview" 
                                className="w-full h-32 object-cover rounded-md"
                              />
                            </div>
                          )}
                        </div>
                        
                        <Button onClick={handleCreateMeal} className="w-full" disabled={mealsLoading}>
                          <Plus className="h-4 w-4 mr-2" />
                          Dodaj obrok
                        </Button>
                      </div>
                    </SheetContent>
                  </Sheet>
                </div>
              </CardHeader>
              <CardContent>
                {mealsLoading ? (
                  <div className="text-center py-8">Učitavanje...</div>
                ) : (
                  <div className="grid gap-4">
                    {meals.map((meal) => (
                      <div key={meal.id} className="flex items-center gap-4 p-4 border rounded-lg hover:bg-muted/50 cursor-pointer"
                        onClick={() => setSelectedMeal({...meal, shifts: meal.shifts || []})}
                      >
                        <div className="w-16 h-16 rounded-md overflow-hidden bg-muted">
                          {meal.image_url ? (
                            <img src={meal.image_url} alt={meal.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <ImageIcon className="h-6 w-6 text-muted-foreground" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{meal.name}</p>
                            <Badge variant={meal.status === "aktivan" ? "default" : "secondary"}>
                              {meal.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{meal.price} RSD</p>
                          <div className="flex items-center gap-1 mt-1">
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">
                              {meal.shifts?.join(', ')} smena
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Edit Meal Sheet */}
            <Sheet open={!!selectedMeal} onOpenChange={() => { setSelectedMeal(null); setImageFile(null); }}>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Izmeni obrok</SheetTitle>
                </SheetHeader>
                {selectedMeal && (
                  <div className="space-y-4 mt-6">
                    <div>
                      <Label htmlFor="edit-meal-name">Naziv obroka *</Label>
                      <Input 
                        id="edit-meal-name"
                        value={selectedMeal.name}
                        onChange={(e) => setSelectedMeal({...selectedMeal, name: e.target.value})}
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="edit-meal-price">Cena (RSD) *</Label>
                      <Input 
                        id="edit-meal-price"
                        type="number"
                        value={selectedMeal.price}
                        onChange={(e) => setSelectedMeal({...selectedMeal, price: e.target.value})}
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="edit-meal-description">Opis</Label>
                      <Textarea 
                        id="edit-meal-description"
                        value={selectedMeal.description || ''}
                        onChange={(e) => setSelectedMeal({...selectedMeal, description: e.target.value})}
                      />
                    </div>
                    
                    <div>
                      <Label>Status</Label>
                      <Select 
                        value={selectedMeal.status} 
                        onValueChange={(value: "aktivan" | "neaktivan") => setSelectedMeal({...selectedMeal, status: value})}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="aktivan">Aktivan</SelectItem>
                          <SelectItem value="neaktivan">Neaktivan</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Dostupnost u smenama</Label>
                      <div className="flex gap-4 mt-2">
                        {["prva", "druga", "treća"].map((shift) => (
                          <div key={shift} className="flex items-center space-x-2">
                            <Checkbox
                              id={`edit-${shift}`}
                              checked={selectedMeal.shifts?.includes(shift)}
                              onCheckedChange={(checked) => {
                                const currentShifts = selectedMeal.shifts || [];
                                if (checked) {
                                  setSelectedMeal({...selectedMeal, shifts: [...currentShifts, shift]});
                                } else {
                                  setSelectedMeal({...selectedMeal, shifts: currentShifts.filter(s => s !== shift)});
                                }
                              }}
                            />
                            <label htmlFor={`edit-${shift}`} className="text-sm font-medium capitalize">
                              {shift} smena
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <Label>Slika obroka</Label>
                      <div className="flex gap-2 mt-2">
                        <Button 
                          type="button" 
                          variant="outline" 
                          onClick={() => fileInputRef.current?.click()}
                          className="flex-1"
                        >
                          <Upload className="h-4 w-4 mr-2" />
                          {imageFile ? imageFile.name : "Promeni sliku"}
                        </Button>
                      </div>
                      {(imageFile || selectedMeal.image_url) && (
                        <div className="mt-2">
                          <img 
                            src={imageFile ? URL.createObjectURL(imageFile) : selectedMeal.image_url} 
                            alt="Preview" 
                            className="w-full h-32 object-cover rounded-md"
                          />
                        </div>
                      )}
                    </div>
                    
                    <div className="space-y-2 pt-4">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button className="w-full">
                            <Save className="h-4 w-4 mr-2" />
                            Sačuvaj izmene
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Potvrdi izmene</AlertDialogTitle>
                            <AlertDialogDescription>
                              Da li ste sigurni da želite da sačuvate izmene za ovaj obrok?
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Otkaži</AlertDialogCancel>
                            <AlertDialogAction onClick={handleUpdateMeal}>Sačuvaj</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" className="w-full">
                            <Trash2 className="h-4 w-4 mr-2" />
                            Obriši obrok
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Potvrdi brisanje</AlertDialogTitle>
                            <AlertDialogDescription>
                              Da li ste sigurni da želite da obrišete ovaj obrok? Ova akcija se ne može poništiti.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Otkaži</AlertDialogCancel>
                            <AlertDialogAction 
                              onClick={async () => {
                                await deleteMeal(selectedMeal.id);
                                setSelectedMeal(null);
                              }}
                            >
                              Obriši
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                )}
              </SheetContent>
            </Sheet>
          </TabsContent>

          <TabsContent value="menus">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Calendar className="h-5 w-5" />
                      Upravljanje jelovnicima
                    </CardTitle>
                    <CardDescription>Pregled i kreiranje jelovnika</CardDescription>
                  </div>
                  <Sheet open={isCreateMenuOpen} onOpenChange={setIsCreateMenuOpen}>
                    <SheetTrigger asChild>
                      <Button onClick={() => setIsCreateMenuOpen(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Kreiraj jelovnik
                      </Button>
                    </SheetTrigger>
                    <SheetContent>
                      <SheetHeader>
                        <SheetTitle>Kreiraj novi jelovnik</SheetTitle>
                      </SheetHeader>
                      <div className="space-y-4 mt-6">
                        <div>
                          <Label htmlFor="menu-date">Datum *</Label>
                          <Input 
                            id="menu-date"
                            type="date"
                            value={menuForm.menu_date}
                            onChange={(e) => setMenuForm({...menuForm, menu_date: e.target.value})}
                            min={new Date().toISOString().split('T')[0]}
                          />
                        </div>
                        
                        <div>
                          <Label htmlFor="menu-description">Opis</Label>
                          <Textarea 
                            id="menu-description"
                            value={menuForm.description}
                            onChange={(e) => setMenuForm({...menuForm, description: e.target.value})}
                            placeholder="Kratak opis jelovnika..."
                          />
                        </div>
                        
                        <div>
                          <Label>Pretraži obroke</Label>
                          <div className="flex gap-2 mt-1">
                            <Input 
                              placeholder="Pretraži po nazivu..."
                              value={menuMealSearch}
                              onChange={(e) => setMenuMealSearch(e.target.value)}
                            />
                          </div>
                        </div>
                        
                        <div>
                          <Label>Odaberite obroke</Label>
                          <div className="max-h-48 overflow-y-auto border rounded-md p-2 space-y-2 mt-2">
                            {filteredMenuMeals.map((meal) => (
                              <div key={meal.id} className="flex items-center space-x-2 p-2 hover:bg-muted rounded">
                                <Checkbox
                                  id={`menu-meal-${meal.id}`}
                                  checked={menuForm.selectedMeals.includes(meal.id)}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      setMenuForm({...menuForm, selectedMeals: [...menuForm.selectedMeals, meal.id]});
                                    } else {
                                      setMenuForm({...menuForm, selectedMeals: menuForm.selectedMeals.filter(id => id !== meal.id)});
                                    }
                                  }}
                                />
                                <div className="w-8 h-8 rounded overflow-hidden bg-muted mr-2">
                                  {meal.image_url ? (
                                    <img src={meal.image_url} alt={meal.name} className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                      <ImageIcon className="h-4 w-4 text-muted-foreground" />
                                    </div>
                                  )}
                                </div>
                                <div className="flex-1">
                                  <label htmlFor={`menu-meal-${meal.id}`} className="text-sm font-medium cursor-pointer">
                                    {meal.name}
                                  </label>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                        
                        <Button onClick={handleCreateMenu} className="w-full" disabled={menusLoading}>
                          <Plus className="h-4 w-4 mr-2" />
                          Kreiraj jelovnik
                        </Button>
                      </div>
                    </SheetContent>
                  </Sheet>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* This Week */}
                <div>
                  <h3 className="text-lg font-medium mb-3">Tekuća nedelja</h3>
                  {thisWeekMenus.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">Nema jelovnika za tekuću nedelju</p>
                  ) : (
                    <div className="grid gap-3">
                      {thisWeekMenus.map((menu) => (
                        <div key={menu.id} className="flex items-center gap-4 p-4 border rounded-lg hover:bg-muted/50 cursor-pointer"
                          onClick={() => setSelectedMenu({...menu})}
                        >
                          <div className="flex-1">
                            <p className="font-medium">{menu.name}</p>
                            {menu.description && (
                              <p className="text-sm text-muted-foreground mt-1">{menu.description}</p>
                            )}
                            <p className="text-sm text-muted-foreground">
                              {menu.meals?.length || 0} obroka
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Next Week */}
                <div>
                  <h3 className="text-lg font-medium mb-3">Sledeća nedelja</h3>
                  {nextWeekMenus.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">Nema jelovnika za sledeću nedelju</p>
                  ) : (
                    <div className="grid gap-3">
                      {nextWeekMenus.map((menu) => (
                        <div key={menu.id} className="flex items-center gap-4 p-4 border rounded-lg hover:bg-muted/50 cursor-pointer"
                          onClick={() => setSelectedMenu({...menu})}
                        >
                          <div className="flex-1">
                            <p className="font-medium">{menu.name}</p>
                            {menu.description && (
                              <p className="text-sm text-muted-foreground mt-1">{menu.description}</p>
                            )}
                            <p className="text-sm text-muted-foreground">
                              {menu.meals?.length || 0} obroka
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Edit Menu Sheet */}
            <Sheet open={!!selectedMenu} onOpenChange={() => setSelectedMenu(null)}>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Detalji jelovnika</SheetTitle>
                </SheetHeader>
                {selectedMenu && (
                  <div className="space-y-4 mt-6">
                    <div>
                      <Label>Naziv jelovnika</Label>
                      <Input value={selectedMenu.name} disabled />
                    </div>
                    
                    <div>
                      <Label>Datum</Label>
                      <Input 
                        type="date"
                        value={selectedMenu.menu_date}
                        onChange={(e) => setSelectedMenu({...selectedMenu, menu_date: e.target.value})}
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="edit-menu-description">Opis</Label>
                      <Textarea 
                        id="edit-menu-description"
                        value={selectedMenu.description || ''}
                        onChange={(e) => setSelectedMenu({...selectedMenu, description: e.target.value})}
                      />
                    </div>
                    
                    <div>
                      <Label>Pretraži obroke</Label>
                      <Input 
                        placeholder="Pretraži po nazivu..."
                        value={menuMealSearch}
                        onChange={(e) => setMenuMealSearch(e.target.value)}
                      />
                    </div>
                    
                    <div>
                      <Label>Obroke u jelovniku</Label>
                      <div className="max-h-48 overflow-y-auto border rounded-md p-2 space-y-2 mt-2">
                        {filteredMenuMeals.map((meal) => (
                          <div key={meal.id} className="flex items-center space-x-2 p-2 hover:bg-muted rounded">
                            <Checkbox
                              id={`edit-menu-meal-${meal.id}`}
                              checked={selectedMenu.meals?.some((m: any) => m.meal_id === meal.id) || false}
                              onCheckedChange={(checked) => {
                                const currentMeals = selectedMenu.meals || [];
                                if (checked) {
                                  setSelectedMenu({
                                    ...selectedMenu,
                                    meals: [...currentMeals, { meal_id: meal.id, meal: meal }]
                                  });
                                } else {
                                  setSelectedMenu({
                                    ...selectedMenu,
                                    meals: currentMeals.filter((m: any) => m.meal_id !== meal.id)
                                  });
                                }
                              }}
                            />
                            <div className="w-8 h-8 rounded overflow-hidden bg-muted mr-2">
                              {meal.image_url ? (
                                <img src={meal.image_url} alt={meal.name} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <ImageIcon className="h-4 w-4 text-muted-foreground" />
                                </div>
                              )}
                            </div>
                            <div className="flex-1">
                              <label htmlFor={`edit-menu-meal-${meal.id}`} className="text-sm font-medium cursor-pointer">
                                {meal.name}
                              </label>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button className="w-full">
                          <Save className="h-4 w-4 mr-2" />
                          Sačuvaj izmene
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Potvrdi izmene</AlertDialogTitle>
                          <AlertDialogDescription>
                            Da li ste sigurni da želite da sačuvate izmene za ovaj jelovnik?
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Otkaži</AlertDialogCancel>
                          <AlertDialogAction onClick={handleUpdateMenu}>
                            Sačuvaj
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                )}
              </SheetContent>
            </Sheet>
          </TabsContent>

          <TabsContent value="users">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      Upravljanje korisnicima
                    </CardTitle>
                    <CardDescription>Pregled svih registrovanih korisnika</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <input
                      ref={csvInputRef}
                      type="file"
                      accept=".csv,.xlsx"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) setCsvFile(file);
                      }}
                      className="hidden"
                    />
                    <Button variant="outline" onClick={() => csvInputRef.current?.click()}>
                      <FileText className="h-4 w-4 mr-2" />
                      Uvezi CSV/XLSX
                    </Button>
                    {csvFile && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline">
                            <Upload className="h-4 w-4 mr-2" />
                            Uvezi ({csvFile.name})
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Potvrdi uvoz</AlertDialogTitle>
                            <AlertDialogDescription>
                              Da li ste sigurni da želite da uvezete korisnike iz fajla {csvFile.name}? CSV mora imati kolone: Ime, Email (opciono: Telefon, Uloga).
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Otkaži</AlertDialogCancel>
                            <AlertDialogAction onClick={handleBulkUserImport}>Uvezi</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                    <Sheet open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
                      <SheetTrigger asChild>
                        <Button onClick={() => { resetUserForm(); setIsAddUserOpen(true); }}>
                          <Plus className="h-4 w-4 mr-2" />
                          Dodaj korisnika
                        </Button>
                      </SheetTrigger>
                      <SheetContent>
                        <SheetHeader>
                          <SheetTitle>Dodaj novog korisnika</SheetTitle>
                        </SheetHeader>
                        <div className="space-y-4 mt-6">
                          <div>
                            <Label htmlFor="user-name">Ime i prezime *</Label>
                            <Input 
                              id="user-name"
                              value={userForm.full_name}
                              onChange={(e) => setUserForm({...userForm, full_name: e.target.value})}
                              placeholder="Marko Marković"
                            />
                          </div>
                          
                          <div>
                            <Label htmlFor="user-email">Email *</Label>
                            <Input 
                              id="user-email"
                              type="email"
                              value={userForm.email}
                              onChange={(e) => setUserForm({...userForm, email: e.target.value})}
                              placeholder="marko@example.com"
                            />
                          </div>
                          
                          <div>
                            <Label htmlFor="user-phone">Telefon</Label>
                            <Input 
                              id="user-phone"
                              value={userForm.phone}
                              onChange={(e) => setUserForm({...userForm, phone: e.target.value})}
                              placeholder="069123456"
                            />
                          </div>
                          
                          <div>
                            <Label>Uloga</Label>
                            <Select 
                              value={userForm.role} 
                              onValueChange={(value: "admin" | "employee") => setUserForm({...userForm, role: value})}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Odaberite ulogu" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="employee">Zaposleni</SelectItem>
                                <SelectItem value="admin">Administrator</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          
                          <Button onClick={handleCreateUser} className="w-full" disabled={usersLoading}>
                            <Plus className="h-4 w-4 mr-2" />
                            Sačuvaj
                          </Button>
                        </div>
                      </SheetContent>
                    </Sheet>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {usersLoading ? (
                  <div className="text-center py-8">Učitavanje...</div>
                ) : (
                  <div className="space-y-3">
                    {users.map((user) => (
                      <div key={user.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 cursor-pointer"
                        onClick={() => setSelectedUser(user)}
                      >
                        <div className="flex-1">
                          <p className="font-medium">{user.full_name || 'Bez imena'}</p>
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline">{user.role}</Badge>
                            {user.phone && <span className="text-xs text-muted-foreground">{user.phone}</span>}
                          </div>
                        </div>
                        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="outline" size="sm">
                                <Mail className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Pošalji magic link</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Da li ste sigurni da želite da pošaljete magic link za prijavu korisniku {user.full_name} na email {user.email}?
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Otkaži</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleSendMagicLink(user.email || '')}>
                                  Pošalji
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Edit User Sheet */}
            <Sheet open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Izmeni korisnika</SheetTitle>
                </SheetHeader>
                {selectedUser && (
                  <div className="space-y-4 mt-6">
                    <div>
                      <Label htmlFor="edit-user-name">Ime i prezime</Label>
                      <Input 
                        id="edit-user-name"
                        value={selectedUser.full_name || ''}
                        onChange={(e) => setSelectedUser({...selectedUser, full_name: e.target.value})}
                        placeholder="Marko Marković"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="edit-user-email">Email</Label>
                      <Input 
                        id="edit-user-email"
                        type="email"
                        value={selectedUser.email || ''}
                        onChange={(e) => setSelectedUser({...selectedUser, email: e.target.value})}
                        placeholder="marko@example.com"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="edit-user-phone">Telefon</Label>
                      <Input 
                        id="edit-user-phone"
                        value={selectedUser.phone || ''}
                        onChange={(e) => setSelectedUser({...selectedUser, phone: e.target.value})}
                        placeholder="069123456"
                      />
                    </div>
                    
                    <div>
                      <Label>Uloga</Label>
                      <Select 
                        value={selectedUser.role} 
                        onValueChange={(value) => setSelectedUser({...selectedUser, role: value})}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Odaberite ulogu" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="employee">Zaposleni</SelectItem>
                          <SelectItem value="admin">Administrator</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2 pt-4">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button className="w-full">
                            <Save className="h-4 w-4 mr-2" />
                            Sačuvaj izmene
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Potvrdi izmene</AlertDialogTitle>
                            <AlertDialogDescription>
                              Da li ste sigurni da želite da sačuvate izmene za ovog korisnika?
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Otkaži</AlertDialogCancel>
                            <AlertDialogAction onClick={() => {
                              handleUpdateUser();
                            }}>Sačuvaj</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" className="w-full">
                            <Trash2 className="h-4 w-4 mr-2" />
                            Obriši korisnika
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Potvrdi brisanje</AlertDialogTitle>
                            <AlertDialogDescription>
                              Da li ste sigurni da želite da obrišete ovog korisnika? Ova akcija se ne može poništiti.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Otkaži</AlertDialogCancel>
                            <AlertDialogAction 
                              onClick={async () => {
                                await deleteUser(selectedUser.id);
                                setSelectedUser(null);
                              }}
                            >
                              Obriši
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                )}
              </SheetContent>
            </Sheet>
          </TabsContent>

          <TabsContent value="reports">
            <div className="grid lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Generišite izveštaj</CardTitle>
                  <CardDescription>Izvoz podataka u CSV format</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Tip izveštaja</Label>
                    <Select defaultValue="orders">
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
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Od datuma</Label>
                      <Input type="date" />
                    </div>
                    <div>
                      <Label>Do datuma</Label>
                      <Input type="date" />
                    </div>
                  </div>
                  
                  <Button onClick={handleExportReport} className="w-full">
                    <Download className="h-4 w-4 mr-2" />
                    Generiši izveštaj
                  </Button>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>Brzi statistike</CardTitle>
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
                    <span className="font-bold">{thisWeekMenus.length}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Jelovnici sledeće nedelje</span>
                    <span className="font-bold">{nextWeekMenus.length}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}