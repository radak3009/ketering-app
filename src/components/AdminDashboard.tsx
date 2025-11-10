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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { EnhancedDatePicker } from "@/components/ui/enhanced-date-picker";
import { BarChart3, Users, ChefHat, Calendar, Download, Plus, Search, Filter, LogOut, Edit, Trash2, Mail, ImageIcon, Clock, Upload, Save, FileText, ChevronDown, MessageSquare, CalendarIcon, Bell, Copy } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useMeals } from "@/hooks/useMeals";
import { useMenus, type MenuWithMeals } from "@/hooks/useMenus";
import { useUsers } from "@/hooks/useUsers";
import { useOrders } from "@/hooks/useOrders";
import { useAdminStats } from "@/hooks/useAdminStats";
import { useNotifications } from "@/hooks/useNotifications";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfWeek, endOfWeek, addWeeks, getWeek, getYear, addDays } from "date-fns";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { FeedbackManagement } from "./admin/FeedbackManagement";
import { SuggestionsManagement } from "./admin/SuggestionsManagement";
import { OrderPivotTable } from "./admin/OrderPivotTable";
import { AIHelpChat } from "./AIHelpChat";
import { TagInput } from "./ui/tag-input";
import { cn } from "@/lib/utils";
interface DailyOrders {
  day: string;
  orders: number;
  revenue: number;
}
export function AdminDashboard() {
  const {
    signOut
  } = useAuth();
  const {
    toast
  } = useToast();
  const {
    meals,
    loading: mealsLoading,
    createMeal,
    updateMeal,
    deleteMeal
  } = useMeals();
  const {
    menus,
    loading: menusLoading,
    createMenu,
    updateMenu,
    deleteMenu,
    cloneWeekMenus
  } = useMenus();
  const {
    users,
    loading: usersLoading,
    createUser,
    updateUser,
    deleteUser,
    sendMagicLink
  } = useUsers();
  const {
    orders,
    loading: ordersLoading,
    fetchOrders,
    getMealOrdersByDate,
    searchMealOrders
  } = useOrders();

  // Search states
  const [menuMealSearch, setMenuMealSearch] = useState("");
  const [orderSearch, setOrderSearch] = useState("");
  const [orderDateRange, setOrderDateRange] = useState({
    startDate: format(startOfWeek(addWeeks(new Date(), 1), {
      weekStartsOn: 1
    }), 'yyyy-MM-dd'),
    // Početak iduće nedelje
    endDate: format(endOfWeek(addWeeks(new Date(), 1), {
      weekStartsOn: 1
    }), 'yyyy-MM-dd') // Kraj iduće nedelje
  });
  const {
    stats,
    loading: statsLoading
  } = useAdminStats(orderDateRange.startDate, orderDateRange.endDate);

  const { adminNotification } = useNotifications(undefined, true);

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
  const [mealForm, setMealForm] = useState({
    name: "",
    description: "",
    price: "",
    status: "aktivan" as "aktivan" | "neaktivan",
    shifts: [] as string[],
    allergens: [] as string[],
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
    date_of_birth: undefined as Date | undefined,
    role: "employee" as "admin" | "employee"
  });

  // Clone dialog state
  const [showCloneDialog, setShowCloneDialog] = useState(false);
  const [cloneSourceMenus, setCloneSourceMenus] = useState<MenuWithMeals[]>([]);
  const [cloneTargetDate, setCloneTargetDate] = useState<Date>();

  // Report states
  const [reportType, setReportType] = useState("orders");
  const [reportDateRange, setReportDateRange] = useState({
    startDate: format(startOfWeek(addWeeks(new Date(), 1), {
      weekStartsOn: 1
    }), 'yyyy-MM-dd'),
    // Početak iduće nedelje
    endDate: format(endOfWeek(addWeeks(new Date(), 1), {
      weekStartsOn: 1
    }), 'yyyy-MM-dd') // Kraj iduće nedelje
  });
  const resetUserForm = () => {
    setUserForm({
      full_name: "",
      email: "",
      phone: "",
      date_of_birth: undefined,
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
      const hasRequiredFields = requiredFields.every(field => headers.some(h => h.includes(field) || h.includes(field.replace('ime', 'name'))));
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
      toast({
        title: "Filter primenjen",
        description
      });
    } else {
      // Reset to show all orders
      setOrderDateRange({
        startDate: '',
        endDate: ''
      });
      fetchOrders();
      toast({
        title: "Filter resetovan",
        description: "Prikazuju se sve porudžbine"
      });
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
      // Search without date range - show all matching results
      const results = await searchMealOrders(orderSearch);
      toast({
        title: "Pretraga završena",
        description: results.length > 0 ? `Pronađeno je ${results.length} porudžbina sa obrokom "${orderSearch}"` : `Nije pronađena nijedna porudžbina sa obrokom "${orderSearch}"`
      });
    } else {
      // If search is empty, reset and fetch all orders
      setOrderSearch('');
      await fetchOrders(orderDateRange.startDate, orderDateRange.endDate);
      toast({
        title: "Filter resetovan",
        description: "Prikazuju se sve porudžbine"
      });
    }
  };
  const uploadImage = async (file: File): Promise<string | null> => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;
      const {
        error: uploadError
      } = await supabase.storage.from('Slike obroka').upload(filePath, file);
      if (uploadError) throw uploadError;

      // Use signed URL instead of public URL since bucket might not be public
      const {
        data,
        error: urlError
      } = await supabase.storage.from('Slike obroka').createSignedUrl(filePath, 60 * 60 * 24 * 365); // 1 year expiry

      if (urlError) throw urlError;
      console.log('Generated signed URL:', data.signedUrl);
      return data.signedUrl;
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
        category: "Glavno jelo",
        // Default category
        status: mealForm.status,
        shifts: mealForm.shifts,
        image_url: imageUrl || null,
        is_available: true,
        allergens: mealForm.allergens.length > 0 ? mealForm.allergens : null,
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
        console.log('Uploading new image:', imageFile.name);
        toast({
          title: "Upload u toku...",
          description: "Slika se učitava, molimo sačekajte"
        });
        imageUrl = await uploadImage(imageFile);
        if (!imageUrl) return;
        console.log('New image uploaded:', imageUrl);
      }
      console.log('Updating meal with data:', {
        name: selectedMeal.name,
        description: selectedMeal.description || null,
        price: parseFloat(selectedMeal.price),
        status: selectedMeal.status,
        shifts: selectedMeal.shifts,
        image_url: imageUrl || null
      });
      const updatedMeal = await updateMeal(selectedMeal.id, {
        name: selectedMeal.name,
        description: selectedMeal.description || null,
        price: parseFloat(selectedMeal.price),
        status: selectedMeal.status,
        shifts: selectedMeal.shifts,
        allergens: selectedMeal.allergens?.length > 0 ? selectedMeal.allergens : null,
        image_url: imageUrl || null
      });

      // Update selectedMeal with the new data including the updated image_url
      const updatedMealData = {
        ...selectedMeal,
        image_url: imageUrl || null,
        updated_at: new Date().toISOString()
      };
      setSelectedMeal(updatedMealData);
      setImageFile(null);
      console.log('Updated selectedMeal:', updatedMealData);
      toast({
        title: "Uspeh",
        description: "Obrok je uspešno ažuriran!"
      });
    } catch (error) {
      console.error('Error updating meal:', error);
      toast({
        title: "Greška pri ažuriranju",
        description: "Pokušajte ponovo",
        variant: "destructive"
      });
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

    // Check if menu already exists for this date
    const existingMenu = menus.find(menu => menu.menu_date === menuForm.menu_date);
    if (existingMenu) {
      toast({
        title: "Greška",
        description: "Jelovnik za ovaj datum već postoji",
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
    
    // Reset form but keep it open
    setMenuForm({
      description: "",
      menu_date: "",
      selectedMeals: []
    });
    // Form stays open - user clicks "Završi" to close
    } catch (error) {
      console.error('Error creating menu:', error);
    }
  };
  const handleUpdateUser = async () => {
    if (!selectedUser) return;
    try {
      // Only update profile fields (not role - roles managed separately)
      await updateUser(selectedUser.id, {
        full_name: selectedUser.full_name,
        email: selectedUser.email,
        phone: selectedUser.phone,
        date_of_birth: selectedUser.date_of_birth || null
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

  const handleCloneWeek = (weekMenus: MenuWithMeals[]) => {
    setCloneSourceMenus(weekMenus);
    setCloneTargetDate(undefined);
    setShowCloneDialog(true);
  };

  const handleConfirmClone = async () => {
    if (!cloneTargetDate || cloneSourceMenus.length === 0) return;
    
    try {
      await cloneWeekMenus(cloneSourceMenus, cloneTargetDate);
      setShowCloneDialog(false);
      setCloneSourceMenus([]);
      setCloneTargetDate(undefined);
    } catch (error) {
      console.error('Error cloning week:', error);
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
      allergens: [],
      image_url: ""
    });
    setImageFile(null);
  };
  const filteredMenuMeals = meals.filter(meal => meal.status === "aktivan" && meal.name.toLowerCase().includes(menuMealSearch.toLowerCase()));
  
  // Helper function to check if a date is disabled (already has a menu)
  const isDateDisabled = (date: Date): boolean => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const hasMenu = menus.some(menu => menu.menu_date === dateStr);
    const isPast = date < new Date(new Date().setHours(0, 0, 0, 0));
    return hasMenu || isPast;
  };

  const isNextWeek = (date: Date) => {
    const nextWeek = addWeeks(new Date(), 1);
    const startOfNextWeek = startOfWeek(nextWeek, {
      weekStartsOn: 1
    });
    const endOfNextWeek = endOfWeek(nextWeek, {
      weekStartsOn: 1
    });
    return date >= startOfNextWeek && date <= endOfNextWeek;
  };
  // Group menus by week
  const groupMenusByWeek = (menus: MenuWithMeals[]) => {
    const grouped = new Map<string, { 
      weekNumber: number, 
      year: number, 
      menus: MenuWithMeals[],
      isCurrentWeek: boolean,
      isNextWeek: boolean 
    }>();
    
    // Izračunaj broj tekuće i sledeće nedelje
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
          // Uporedi brojeve nedelja umesto datuma
          isCurrentWeek: weekNumber === currentWeekNumber && year === currentYear,
          isNextWeek: weekNumber === nextWeekNumber && year === nextWeekYear
        });
      }
      
      grouped.get(key)!.menus.push(menu);
    });
    
    // Sort chronologically
    return Array.from(grouped.entries())
      .sort((a, b) => {
        const [keyA] = a;
        const [keyB] = b;
        return keyA.localeCompare(keyB);
      });
  };

  // Filter menus to show only from current week onwards
  const groupedMenus = groupMenusByWeek(menus).filter(([key, weekData]) => {
    // Get the first menu date in this week to check if week is current or future
    const firstMenuDate = weekData.menus[0]?.menu_date;
    if (!firstMenuDate) return false;
    
    const weekStart = startOfWeek(new Date(firstMenuDate), { weekStartsOn: 1 });
    const currentWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    
    // Include current week and all future weeks
    return weekStart >= currentWeekStart;
  });
  const handleExportReport = async () => {
    try {
      let csvContent = '';
      let filename = '';
      if (reportType === 'orders') {
        // Fetch orders for the date range
        await fetchOrders(reportDateRange.startDate, reportDateRange.endDate);

        // Generate CSV for orders
        csvContent = '\uFEFF'; // UTF-8 BOM
        csvContent += 'ID Porudžbine,Korisnik,Datum porudžbine,Datum dostave,Status,Ukupan iznos,Napomene\n';
        orders.forEach(order => {
          const user = users.find(u => u.user_id === order.user_id);
          csvContent += `"${order.id}","${user?.full_name || 'N/A'}","${order.order_date}","${order.delivery_date || 'N/A'}","${order.status}","${order.total_amount}","${order.notes || ''}"\n`;
        });
        filename = `porudzbine_${reportDateRange.startDate}_${reportDateRange.endDate}.csv`;
      } else if (reportType === 'revenue') {
        // Fetch orders for revenue calculation
        await fetchOrders(reportDateRange.startDate, reportDateRange.endDate);

        // Group by date and calculate revenue
        const revenueByDate: Record<string, number> = {};
        orders.forEach(order => {
          const date = order.delivery_date || order.order_date;
          if (!revenueByDate[date]) {
            revenueByDate[date] = 0;
          }
          revenueByDate[date] += parseFloat(order.total_amount.toString());
        });
        csvContent = '\uFEFF'; // UTF-8 BOM
        csvContent += 'Datum,Ukupan prihod (RSD),Broj porudžbina\n';
        Object.entries(revenueByDate).sort(([a], [b]) => a.localeCompare(b)).forEach(([date, revenue]) => {
          const ordersCount = orders.filter(o => (o.delivery_date || o.order_date) === date).length;
          csvContent += `"${date}","${revenue.toFixed(2)}","${ordersCount}"\n`;
        });
        filename = `prihodi_${reportDateRange.startDate}_${reportDateRange.endDate}.csv`;
      } else if (reportType === 'users') {
        csvContent = '\uFEFF'; // UTF-8 BOM
        csvContent += 'ID,Ime i prezime,Email,Telefon,Rola,ID kartice,Datum kreiranja\n';
        users.forEach(user => {
          csvContent += `"${user.user_id}","${user.full_name || ''}","${user.email || ''}","${user.phone || ''}","${user.role}","${user.company_card_id || ''}","${user.created_at}"\n`;
        });
        filename = `korisnici_${format(new Date(), 'yyyy-MM-dd')}.csv`;
      } else if (reportType === 'meals') {
        csvContent = '\uFEFF'; // UTF-8 BOM
        csvContent += 'ID,Naziv,Kategorija,Cena (RSD),Status,Dostupnost,Smene,Datum kreiranja\n';
        meals.forEach(meal => {
          const shiftsStr = meal.shifts?.join(', ') || '';
          csvContent += `"${meal.id}","${meal.name}","${meal.category}","${meal.price}","${meal.status}","${meal.is_available ? 'Da' : 'Ne'}","${shiftsStr}","${meal.created_at}"\n`;
        });
        filename = `obroci_${format(new Date(), 'yyyy-MM-dd')}.csv`;
      }

      // Create and download the CSV file
      const blob = new Blob([csvContent], {
        type: 'text/csv;charset=utf-8;'
      });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast({
        title: "Izveštaj preuzet",
        description: `CSV fajl ${filename} je uspešno preuzet`
      });
    } catch (error) {
      console.error('Error exporting report:', error);
      toast({
        title: "Greška",
        description: "Nije moguće generisati izveštaj",
        variant: "destructive"
      });
    }
  };
  return <div className="min-h-screen bg-gradient-to-br from-corporate/5 to-background">
      <div className="container mx-auto p-3 md:p-6">
        <div className="mb-6 md:mb-8">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-corporate rounded-lg">
                <BarChart3 className="h-5 w-5 md:h-6 md:w-6 text-corporate-foreground" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-foreground">Admin Panel</h1>
                <p className="text-sm md:text-base text-muted-foreground">Upravljanje keteringom i izveštajima</p>
              </div>
            </div>
            <Button onClick={signOut} variant="outline" size="sm" className="w-full md:w-auto">
              <LogOut className="h-4 w-4 mr-2" />
              Odjavi se
            </Button>
          </div>
        </div>

        {/* Admin Notification Alert */}
        {adminNotification && (
          <Alert className="mb-4 border-red-500 bg-red-50 dark:bg-red-950/20">
            <Bell className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800 dark:text-red-200">
              {adminNotification}
            </AlertDescription>
          </Alert>
        )}

        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4 mb-6 md:mb-8">
          <Card>
            <CardContent className="p-3 md:p-6">
              <div className="flex flex-col md:flex-row items-start md:items-center gap-2">
                <Users className="h-4 w-4 md:h-5 md:w-5 text-corporate" />
                <div>
                  <p className="text-xs md:text-sm text-muted-foreground">Ukupno porudžbina</p>
                  {statsLoading ? <div className="h-6 md:h-8 w-12 md:w-16 bg-muted animate-pulse rounded" /> : <p className="text-xl md:text-2xl font-bold">{stats.totalOrders}</p>}
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-3 md:p-6">
              <div className="flex flex-col md:flex-row items-start md:items-center gap-2">
                <BarChart3 className="h-4 w-4 md:h-5 md:w-5 text-success" />
                <div>
                  <p className="text-xs md:text-sm text-muted-foreground">Ukupan prihod</p>
                  {statsLoading ? <div className="h-6 md:h-8 w-16 md:w-24 bg-muted animate-pulse rounded" /> : <p className="text-xl md:text-2xl font-bold">{stats.totalRevenue.toLocaleString()} RSD</p>}
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-3 md:p-6">
              <div className="flex flex-col md:flex-row items-start md:items-center gap-2">
                <Users className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                <div>
                  <p className="text-xs md:text-sm text-muted-foreground">Zaposleni poručili</p>
                  {statsLoading ? <div className="h-6 md:h-8 w-12 md:w-16 bg-muted animate-pulse rounded" /> : <p className="text-xl md:text-2xl font-bold">{stats.employeesOrdered}</p>}
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-3 md:p-6">
              <div className="flex flex-col md:flex-row items-start md:items-center gap-2">
                <Calendar className="h-4 w-4 md:h-5 md:w-5 text-warning" />
                <div>
                  <p className="text-xs md:text-sm text-muted-foreground">Prosečna porudžbina</p>
                  {statsLoading ? <div className="h-6 md:h-8 w-16 md:w-20 bg-muted animate-pulse rounded" /> : <p className="text-xl md:text-2xl font-bold">{stats.avgOrderValue} RSD</p>}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="meals" className="space-y-4 md:space-y-6">
          <TabsList className="flex overflow-x-auto md:grid w-full md:grid-cols-6 h-auto p-1">
            <TabsTrigger value="orders" className="whitespace-nowrap text-xs md:text-sm px-2 md:px-3">Porudžbine</TabsTrigger>
            <TabsTrigger value="meals" className="whitespace-nowrap text-xs md:text-sm px-2 md:px-3">Obroci</TabsTrigger>
            <TabsTrigger value="menus" className="whitespace-nowrap text-xs md:text-sm px-2 md:px-3">Jelovnici</TabsTrigger>
            <TabsTrigger value="users" className="whitespace-nowrap text-xs md:text-sm px-2 md:px-3">Korisnici</TabsTrigger>
            <TabsTrigger value="feedback" className="whitespace-nowrap text-xs md:text-sm px-2 md:px-3">Utisci</TabsTrigger>
            <TabsTrigger value="reports" className="whitespace-nowrap text-xs md:text-sm px-2 md:px-3">Izveštaji</TabsTrigger>
          </TabsList>

          <TabsContent value="orders">
            <div className="space-y-4 md:space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3">
                      <div>
                        <CardTitle className="text-lg md:text-xl">Pregled porudžbina</CardTitle>
                        <CardDescription className="text-xs md:text-sm">Filtriraj i pretraži porudžbine</CardDescription>
                      </div>
                      <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
                        <Input placeholder="Pretraži po nazivu obroka..." value={orderSearch} onChange={e => setOrderSearch(e.target.value)} className="w-full md:w-48 h-10 md:h-9" />
                        <Button variant="outline" size="sm" onClick={handleSearchOrders} className="w-full md:w-auto h-10 md:h-9">
                          <Search className="h-4 w-4 mr-1" />
                          Pretraži
                        </Button>
                      </div>
                    </div>
                    <div className="flex flex-col md:flex-row gap-2">
                      <Input type="date" placeholder="Od datuma" value={orderDateRange.startDate} onChange={e => setOrderDateRange({
                      ...orderDateRange,
                      startDate: e.target.value
                    })} className="w-full h-10 md:h-9" />
                      <Input type="date" placeholder="Do datuma" value={orderDateRange.endDate} onChange={e => setOrderDateRange({
                      ...orderDateRange,
                      endDate: e.target.value
                    })} className="w-full h-10 md:h-9" />
                      <Button variant="outline" size="sm" onClick={handleDateRangeFilter} className="w-full md:w-auto h-10 md:h-9">
                        <Filter className="h-4 w-4 mr-1" />
                        Filtriraj
                      </Button>
                    </div>
                  </div>
                </CardHeader>
              </Card>

              {ordersLoading ? <Card>
                  <CardContent className="p-6">
                    <div className="text-center py-8">Učitavanje...</div>
                  </CardContent>
                </Card> : <OrderPivotTable orders={orders} />}
            </div>
          </TabsContent>

          <TabsContent value="meals">
            <Card>
              <CardHeader>
                <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
                      <ChefHat className="h-4 w-4 md:h-5 md:w-5" />
                      Upravljanje obrocima
                    </CardTitle>
                    <CardDescription className="text-xs md:text-sm">Svi obroci u sistemu</CardDescription>
                  </div>
                  <Sheet open={isAddMealOpen} onOpenChange={setIsAddMealOpen}>
                    <SheetTrigger asChild>
                      <Button onClick={() => {
                      resetMealForm();
                      setIsAddMealOpen(true);
                    }} className="w-full md:w-auto">
                        <Plus className="h-4 w-4 mr-2" />
                        Dodaj obrok
                      </Button>
                    </SheetTrigger>
                    <SheetContent className="w-full md:max-w-lg overflow-y-auto">
                      <SheetHeader>
                        <SheetTitle>Dodaj novi obrok</SheetTitle>
                      </SheetHeader>
                      <div className="space-y-4 mt-6">
                        <div>
                          <Label htmlFor="meal-name">Naziv obroka *</Label>
                          <Input id="meal-name" value={mealForm.name} onChange={e => setMealForm({
                          ...mealForm,
                          name: e.target.value
                        })} placeholder="npr. Piletina sa rižom" />
                        </div>
                        
                        <div>
                          <Label htmlFor="meal-price">Cena (RSD) *</Label>
                          <Input id="meal-price" type="number" value={mealForm.price} onChange={e => setMealForm({
                          ...mealForm,
                          price: e.target.value
                        })} placeholder="450" />
                        </div>
                        
                        <div>
                          <Label htmlFor="meal-description">Opis</Label>
                          <Textarea id="meal-description" value={mealForm.description} onChange={e => setMealForm({
                          ...mealForm,
                          description: e.target.value
                        })} placeholder="Kratak opis obroka..." />
                        </div>
                        
                        <div>
                          <Label htmlFor="meal-allergens">Alergeni</Label>
                          <TagInput
                            value={mealForm.allergens}
                            onChange={(allergens) => setMealForm({ ...mealForm, allergens })}
                            placeholder="Dodajte alergene (gluten, laktoza, jaja...)"
                          />
                        </div>
                        
                        <div>
                          <Label>Status</Label>
                          <Select value={mealForm.status} onValueChange={(value: "aktivan" | "neaktivan") => setMealForm({
                          ...mealForm,
                          status: value
                        })}>
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
                            {["prva", "druga", "treća"].map(shift => <div key={shift} className="flex items-center space-x-2">
                                <Checkbox id={shift} checked={mealForm.shifts.includes(shift)} onCheckedChange={checked => {
                              if (checked) {
                                setMealForm({
                                  ...mealForm,
                                  shifts: [...mealForm.shifts, shift]
                                });
                              } else {
                                setMealForm({
                                  ...mealForm,
                                  shifts: mealForm.shifts.filter(s => s !== shift)
                                });
                              }
                            }} />
                                <label htmlFor={shift} className="text-sm font-medium capitalize">
                                  {shift} smena
                                </label>
                              </div>)}
                          </div>
                        </div>

                        <div>
                          <Label>Slika obroka</Label>
                          <div className="flex gap-2 mt-2">
                            <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} className="flex-1">
                              <Upload className="h-4 w-4 mr-2" />
                              {imageFile ? imageFile.name : "Učitaj sliku"}
                            </Button>
                            <input ref={fileInputRef} type="file" accept="image/*" onChange={e => {
                            const file = e.target.files?.[0];
                            if (file) setImageFile(file);
                          }} className="hidden" />
                          </div>
                          {(imageFile || mealForm.image_url) && <div className="mt-2">
                              <img src={imageFile ? URL.createObjectURL(imageFile) : mealForm.image_url} alt="Preview" className="w-full h-32 object-cover rounded-md" />
                            </div>}
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
                {mealsLoading ? <div className="text-center py-8">Učitavanje...</div> : <div className="grid gap-3 md:gap-4">
                    {meals.map(meal => <div key={meal.id} className="flex items-center gap-3 md:gap-4 p-3 md:p-4 border rounded-lg hover:bg-muted/50 cursor-pointer" onClick={() => setSelectedMeal({
                  ...meal,
                  shifts: meal.shifts || []
                })}>
                        <div className="w-12 h-12 md:w-16 md:h-16 rounded-md overflow-hidden bg-muted flex-shrink-0">
                          {meal.image_url ? <img src={meal.image_url} alt={meal.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center">
                              <ImageIcon className="h-5 w-5 md:h-6 md:w-6 text-muted-foreground" />
                            </div>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-sm md:text-base truncate">{meal.name}</p>
                            <Badge variant={meal.status === "aktivan" ? "default" : "secondary"} className="text-xs">
                              {meal.status}
                            </Badge>
                          </div>
                          <p className="text-xs md:text-sm text-muted-foreground">{meal.price} RSD</p>
                          <div className="flex items-center gap-1 mt-1">
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">
                              {meal.shifts?.join(', ')} smena
                            </span>
                          </div>
                          {meal.allergens && meal.allergens.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {meal.allergens.slice(0, 3).map((allergen, idx) => (
                                <Badge key={idx} variant="outline" className="text-xs">
                                  {allergen}
                                </Badge>
                              ))}
                              {meal.allergens.length > 3 && (
                                <Badge variant="outline" className="text-xs">
                                  +{meal.allergens.length - 3}
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                      </div>)}
                  </div>}
              </CardContent>
            </Card>

            {/* Edit Meal Sheet */}
            <Sheet open={!!selectedMeal} onOpenChange={() => {
            setSelectedMeal(null);
            setImageFile(null);
          }}>
              <SheetContent className="w-full md:max-w-lg overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>Izmeni obrok</SheetTitle>
                </SheetHeader>
                {selectedMeal && <div className="space-y-4 mt-6 pb-6">
                    <div>
                      <Label htmlFor="edit-meal-name">Naziv obroka *</Label>
                      <Input id="edit-meal-name" value={selectedMeal.name} onChange={e => setSelectedMeal({
                    ...selectedMeal,
                    name: e.target.value
                  })} />
                    </div>
                    
                    <div>
                      <Label htmlFor="edit-meal-price">Cena (RSD) *</Label>
                      <Input id="edit-meal-price" type="number" value={selectedMeal.price} onChange={e => setSelectedMeal({
                    ...selectedMeal,
                    price: e.target.value
                  })} />
                    </div>
                    
                    <div>
                      <Label htmlFor="edit-meal-description">Opis</Label>
                      <Textarea id="edit-meal-description" value={selectedMeal.description || ''} onChange={e => setSelectedMeal({
                    ...selectedMeal,
                    description: e.target.value
                  })} />
                    </div>
                    
                    <div>
                      <Label htmlFor="edit-meal-allergens">Alergeni</Label>
                      <TagInput
                        value={selectedMeal.allergens || []}
                        onChange={(allergens) => setSelectedMeal({ ...selectedMeal, allergens })}
                        placeholder="Dodajte alergene (gluten, laktoza, jaja...)"
                      />
                    </div>
                    
                    <div>
                      <Label>Status</Label>
                      <Select value={selectedMeal.status} onValueChange={(value: "aktivan" | "neaktivan") => setSelectedMeal({
                    ...selectedMeal,
                    status: value
                  })}>
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
                        {["prva", "druga", "treća"].map(shift => <div key={shift} className="flex items-center space-x-2">
                            <Checkbox id={`edit-${shift}`} checked={selectedMeal.shifts?.includes(shift)} onCheckedChange={checked => {
                        const currentShifts = selectedMeal.shifts || [];
                        if (checked) {
                          setSelectedMeal({
                            ...selectedMeal,
                            shifts: [...currentShifts, shift]
                          });
                        } else {
                          setSelectedMeal({
                            ...selectedMeal,
                            shifts: currentShifts.filter(s => s !== shift)
                          });
                        }
                      }} />
                            <label htmlFor={`edit-${shift}`} className="text-sm font-medium capitalize">
                              {shift} smena
                            </label>
                          </div>)}
                      </div>
                    </div>

                    <div>
                      <Label>Slika obroka</Label>
                      <div className="flex gap-2 mt-2">
                        <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} className="flex-1">
                          <Upload className="h-4 w-4 mr-2" />
                          {imageFile ? imageFile.name : "Promeni sliku"}
                        </Button>
                        <input ref={fileInputRef} type="file" accept="image/*" onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) setImageFile(file);
                    }} className="hidden" />
                      </div>
                       {(imageFile || selectedMeal.image_url) && <div className="mt-2">
                           <img src={imageFile ? URL.createObjectURL(imageFile) : selectedMeal.image_url || ''} alt="Preview slike obroka" className="w-full h-32 object-cover rounded-md" onLoad={() => console.log('Image loaded successfully')} onError={e => {
                      console.error('Image failed to load:', selectedMeal.image_url);
                      console.log('Image error event:', e);
                    }} />
                         </div>}
                    </div>
                    
                    <div className="space-y-2 pt-4">
                      <Button className="w-full" onClick={() => {
                    handleUpdateMeal();
                  }}>
                        <Save className="h-4 w-4 mr-2" />
                        Sačuvaj izmene
                      </Button>

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
                            <AlertDialogAction onClick={async () => {
                          await deleteMeal(selectedMeal.id);
                          setSelectedMeal(null);
                        }}>
                              Obriši
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                      </div>
                    </div>}
                </SheetContent>
              </Sheet>
          </TabsContent>

          <TabsContent value="menus">
            <Card>
              <CardHeader>
                <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
                      <Calendar className="h-4 w-4 md:h-5 md:w-5" />
                      Upravljanje jelovnicima
                    </CardTitle>
                    <CardDescription className="text-xs md:text-sm">Pregled i kreiranje jelovnika</CardDescription>
                  </div>
                  <Sheet open={isCreateMenuOpen} onOpenChange={setIsCreateMenuOpen}>
                    <SheetTrigger asChild>
                      <Button onClick={() => setIsCreateMenuOpen(true)} className="w-full md:w-auto">
                        <Plus className="h-4 w-4 mr-2" />
                        Kreiraj jelovnik
                      </Button>
                    </SheetTrigger>
                    <SheetContent className="w-full md:max-w-lg overflow-y-auto">
                      <SheetHeader>
                        <SheetTitle>Kreiraj novi jelovnik</SheetTitle>
                      </SheetHeader>
                      <div className="space-y-4 mt-6">
                        <div>
                          <Label htmlFor="menu-date">Datum *</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className="w-full justify-start text-left font-normal"
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {menuForm.menu_date ? format(new Date(menuForm.menu_date), 'dd.MM.yyyy') : "Odaberite datum"}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <CalendarComponent
                                mode="single"
                                selected={menuForm.menu_date ? new Date(menuForm.menu_date) : undefined}
                                onSelect={(date) => {
                                  if (date) {
                                    setMenuForm({
                                      ...menuForm,
                                      menu_date: format(date, 'yyyy-MM-dd')
                                    });
                                  }
                                }}
                                disabled={isDateDisabled}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                          <p className="text-xs text-muted-foreground mt-1">
                            Datumi koji već imaju jelovnik su onemogućeni
                          </p>
                        </div>
                        
                        <div>
                          <Label htmlFor="menu-description">Opis</Label>
                          <Textarea id="menu-description" value={menuForm.description} onChange={e => setMenuForm({
                          ...menuForm,
                          description: e.target.value
                        })} placeholder="Kratak opis jelovnika..." />
                        </div>
                        
                        <div>
                          <Label>Pretraži obroke</Label>
                          <div className="flex gap-2 mt-1">
                            <Input placeholder="Pretraži po nazivu..." value={menuMealSearch} onChange={e => setMenuMealSearch(e.target.value)} />
                          </div>
                        </div>
                        
                        <div>
                          <Label>Odaberite obroke</Label>
                          <div className="max-h-48 overflow-y-auto border rounded-md p-2 space-y-2 mt-2">
                            {filteredMenuMeals.map(meal => <div key={meal.id} className="flex items-center space-x-2 p-2 hover:bg-muted rounded">
                                <Checkbox id={`menu-meal-${meal.id}`} checked={menuForm.selectedMeals.includes(meal.id)} onCheckedChange={checked => {
                              if (checked) {
                                setMenuForm({
                                  ...menuForm,
                                  selectedMeals: [...menuForm.selectedMeals, meal.id]
                                });
                              } else {
                                setMenuForm({
                                  ...menuForm,
                                  selectedMeals: menuForm.selectedMeals.filter(id => id !== meal.id)
                                });
                              }
                            }} />
                                <div className="w-8 h-8 rounded overflow-hidden bg-muted mr-2">
                                  {meal.image_url ? <img src={meal.image_url} alt={meal.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center">
                                      <ImageIcon className="h-4 w-4 text-muted-foreground" />
                                    </div>}
                                </div>
                                <div className="flex-1">
                                  <label htmlFor={`menu-meal-${meal.id}`} className="text-sm font-medium cursor-pointer">
                                    {meal.name}
                                  </label>
                                </div>
                              </div>)}
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <Button 
                            onClick={handleCreateMenu} 
                            className="w-full" 
                            disabled={menusLoading || !menuForm.menu_date || menuForm.selectedMeals.length === 0}
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Kreiraj jelovnik za ovaj datum
                          </Button>
                          
                          <Button 
                            onClick={() => setIsCreateMenuOpen(false)}
                            className="w-full"
                            variant="outline"
                          >
                            Završi
                          </Button>
                        </div>
                      </div>
                    </SheetContent>
                  </Sheet>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 md:space-y-6">
                {groupedMenus.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4 text-sm">Nema definisanih jelovnika</p>
                ) : (
                  <div className="space-y-2">
                    {groupedMenus.map(([key, weekData]) => (
                      <Collapsible key={key} defaultOpen={weekData.isCurrentWeek || weekData.isNextWeek}>
                        <div className="flex items-center gap-2">
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" className="flex-1 justify-between p-4 h-auto hover:bg-accent/50 group">
                              <div className="flex items-center gap-2">
                                <h3 className="text-base md:text-lg font-medium">
                                  {weekData.isCurrentWeek 
                                    ? "Tekuća nedelja" 
                                    : weekData.isNextWeek 
                                      ? "Sledeća nedelja"
                                      : `Nedelja ${weekData.weekNumber}`
                                  }
                                </h3>
                                <Badge variant="secondary">
                                  {weekData.menus.length} {weekData.menus.length === 1 ? 'jelovnik' : 'jelovnika'}
                                </Badge>
                              </div>
                              <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                            </Button>
                          </CollapsibleTrigger>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCloneWeek(weekData.menus);
                            }}
                            title="Kloniraj nedelju"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                        
                        <CollapsibleContent className="px-2 pb-4">
                          <div className="grid gap-2 md:gap-3 mt-2">
                            {weekData.menus.map(menu => (
                              <div 
                                key={menu.id} 
                                className="flex items-center gap-3 md:gap-4 p-3 md:p-4 border rounded-lg hover:bg-muted/50 cursor-pointer" 
                                onClick={() => setSelectedMenu({ ...menu })}
                              >
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-sm md:text-base truncate">{menu.name}</p>
                                  {menu.description && (
                                    <p className="text-xs md:text-sm text-muted-foreground mt-1 line-clamp-2">
                                      {menu.description}
                                    </p>
                                  )}
                                  <p className="text-xs md:text-sm text-muted-foreground">
                                    {menu.meals?.length || 0} obroka
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Edit Menu Sheet */}
            <Sheet open={!!selectedMenu} onOpenChange={() => setSelectedMenu(null)}>
              <SheetContent className="w-full md:max-w-lg overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>Detalji jelovnika</SheetTitle>
                </SheetHeader>
                {selectedMenu && <div className="space-y-4 mt-6">
                    <div>
                      <Label>Naziv jelovnika</Label>
                      <Input value={selectedMenu.name} disabled />
                    </div>
                    
                    <div>
                      <Label>Datum</Label>
                      <Input type="date" value={selectedMenu.menu_date} onChange={e => setSelectedMenu({
                    ...selectedMenu,
                    menu_date: e.target.value
                  })} />
                    </div>
                    
                    <div>
                      <Label htmlFor="edit-menu-description">Opis</Label>
                      <Textarea id="edit-menu-description" value={selectedMenu.description || ''} onChange={e => setSelectedMenu({
                    ...selectedMenu,
                    description: e.target.value
                  })} />
                    </div>
                    
                    <div>
                      <Label>Pretraži obroke</Label>
                      <Input placeholder="Pretraži po nazivu..." value={menuMealSearch} onChange={e => setMenuMealSearch(e.target.value)} />
                    </div>
                    
                    <div>
                      <Label>Obroke u jelovniku</Label>
                      <div className="max-h-48 overflow-y-auto border rounded-md p-2 space-y-2 mt-2">
                        {filteredMenuMeals.map(meal => <div key={meal.id} className="flex items-center space-x-2 p-2 hover:bg-muted rounded">
                            <Checkbox id={`edit-menu-meal-${meal.id}`} checked={selectedMenu.meals?.some((m: any) => m.meal_id === meal.id) || false} onCheckedChange={checked => {
                        const currentMeals = selectedMenu.meals || [];
                        if (checked) {
                          setSelectedMenu({
                            ...selectedMenu,
                            meals: [...currentMeals, {
                              meal_id: meal.id,
                              meal: meal
                            }]
                          });
                        } else {
                          setSelectedMenu({
                            ...selectedMenu,
                            meals: currentMeals.filter((m: any) => m.meal_id !== meal.id)
                          });
                        }
                      }} />
                            <div className="w-8 h-8 rounded overflow-hidden bg-muted mr-2">
                              {meal.image_url ? <img src={meal.image_url} alt={meal.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center">
                                  <ImageIcon className="h-4 w-4 text-muted-foreground" />
                                </div>}
                            </div>
                            <div className="flex-1">
                              <label htmlFor={`edit-menu-meal-${meal.id}`} className="text-sm font-medium cursor-pointer">
                                {meal.name}
                              </label>
                            </div>
                          </div>)}
                      </div>
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

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" className="w-full">
                            <Trash2 className="h-4 w-4 mr-2" />
                            Obriši jelovnik
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Potvrdi brisanje</AlertDialogTitle>
                            <AlertDialogDescription>
                              Da li ste sigurni da želite da obrišete ovaj jelovnik? Ova akcija se ne može poništiti.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Otkaži</AlertDialogCancel>
                            <AlertDialogAction onClick={async () => {
                              await deleteMenu(selectedMenu.id);
                              setSelectedMenu(null);
                            }}>
                              Obriši
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>}
              </SheetContent>
            </Sheet>
          </TabsContent>

          <TabsContent value="users">
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
                        <Users className="h-4 w-4 md:h-5 md:w-5" />
                        Upravljanje korisnicima
                      </CardTitle>
                      <CardDescription className="text-xs md:text-sm">Pregled svih registrovanih korisnika</CardDescription>
                    </div>
                  </div>
                  <div className="flex flex-col md:flex-row gap-2">
                    <input ref={csvInputRef} type="file" accept=".csv,.xlsx" onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) setCsvFile(file);
                  }} className="hidden" />
                    <Button variant="outline" onClick={() => csvInputRef.current?.click()} className="w-full md:w-auto">
                      <FileText className="h-4 w-4 mr-2" />
                      Uvezi CSV/XLSX
                    </Button>
                    {csvFile && <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" className="w-full md:w-auto">
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
                      </AlertDialog>}
                    <Sheet open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
                      <SheetTrigger asChild>
                        <Button onClick={() => {
                        resetUserForm();
                        setIsAddUserOpen(true);
                      }} className="w-full md:w-auto">
                          <Plus className="h-4 w-4 mr-2" />
                          Dodaj korisnika
                        </Button>
                      </SheetTrigger>
                      <SheetContent className="w-full md:max-w-lg overflow-y-auto">
                        <SheetHeader>
                          <SheetTitle>Dodaj novog korisnika</SheetTitle>
                        </SheetHeader>
                        <div className="space-y-4 mt-6">
                          <div>
                            <Label htmlFor="user-name">Ime i prezime *</Label>
                            <Input id="user-name" value={userForm.full_name} onChange={e => setUserForm({
                            ...userForm,
                            full_name: e.target.value
                          })} placeholder="Marko Marković" />
                          </div>
                          
                          <div>
                            <Label htmlFor="user-email">Email *</Label>
                            <Input id="user-email" type="email" value={userForm.email} onChange={e => setUserForm({
                            ...userForm,
                            email: e.target.value
                          })} placeholder="marko@example.com" />
                          </div>
                          
                          <div>
                            <Label htmlFor="user-phone">Telefon</Label>
                            <Input id="user-phone" value={userForm.phone} onChange={e => setUserForm({
                            ...userForm,
                            phone: e.target.value
                          })} placeholder="069123456" />
                          </div>
                          
                          <div>
                            <Label>Datum rođenja</Label>
                            <EnhancedDatePicker
                              date={userForm.date_of_birth}
                              onDateChange={(date) => setUserForm({ ...userForm, date_of_birth: date })}
                              disabled={(date) =>
                                date > new Date() || date < new Date("1900-01-01")
                              }
                              placeholder="Izaberite datum"
                            />
                          </div>
                          
                          <div>
                            <Label>Uloga</Label>
                            <Select value={userForm.role} onValueChange={(value: "admin" | "employee") => setUserForm({
                            ...userForm,
                            role: value
                          })}>
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
                {usersLoading ? <div className="text-center py-8">Učitavanje...</div> : <div className="space-y-2 md:space-y-3">
                    {users.map(user => <div key={user.id} className="flex items-center justify-between gap-3 p-3 md:p-4 border rounded-lg hover:bg-muted/50 cursor-pointer" onClick={() => setSelectedUser(user)}>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm md:text-base truncate">{user.full_name || 'Bez imena'}</p>
                          <p className="text-xs md:text-sm text-muted-foreground truncate">{user.email}</p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <Badge variant="outline" className="text-xs">{user.role}</Badge>
                            {user.phone && <span className="text-xs text-muted-foreground">{user.phone}</span>}
                          </div>
                        </div>
                        <div className="flex gap-2 flex-shrink-0" onClick={e => e.stopPropagation()}>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="outline" size="sm" className="h-8 w-8 md:h-9 md:w-auto md:px-3">
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
                      </div>)}
                  </div>}
              </CardContent>
            </Card>

            {/* Edit User Sheet */}
            <Sheet open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
              <SheetContent className="w-full md:max-w-lg overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>Izmeni korisnika</SheetTitle>
                </SheetHeader>
                {selectedUser && <div className="space-y-4 mt-6">
                    <div>
                      <Label htmlFor="edit-user-name">Ime i prezime</Label>
                      <Input id="edit-user-name" value={selectedUser.full_name || ''} onChange={e => setSelectedUser({
                    ...selectedUser,
                    full_name: e.target.value
                  })} placeholder="Marko Marković" />
                    </div>
                    
                    <div>
                      <Label htmlFor="edit-user-email">Email</Label>
                      <Input id="edit-user-email" type="email" value={selectedUser.email || ''} onChange={e => setSelectedUser({
                    ...selectedUser,
                    email: e.target.value
                  })} placeholder="marko@example.com" />
                    </div>
                    
                    <div>
                      <Label htmlFor="edit-user-phone">Telefon</Label>
                      <Input id="edit-user-phone" value={selectedUser.phone || ''} onChange={e => setSelectedUser({
                    ...selectedUser,
                    phone: e.target.value
                  })} placeholder="069123456" />
                    </div>
                    
                    <div>
                      <Label>Datum rođenja</Label>
                      <EnhancedDatePicker
                        date={selectedUser.date_of_birth ? new Date(selectedUser.date_of_birth) : undefined}
                        onDateChange={(date) => setSelectedUser({
                          ...selectedUser,
                          date_of_birth: date ? format(date, 'yyyy-MM-dd') : null
                        })}
                        disabled={(date) =>
                          date > new Date() || date < new Date("1900-01-01")
                        }
                        placeholder="Izaberite datum"
                      />
                    </div>
                    
                    <div>
                      <Label>Uloga</Label>
                      <Select value={selectedUser.role || 'employee'} disabled>
                        <SelectTrigger>
                          <SelectValue placeholder="Odaberite ulogu" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="employee">Zaposleni</SelectItem>
                          <SelectItem value="admin">Administrator</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground mt-1">
                        Uloge se upravljaju posebno iz bezbednosnih razloga
                      </p>
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
                            <AlertDialogAction onClick={async () => {
                          await deleteUser(selectedUser.id);
                          setSelectedUser(null);
                        }}>
                              Obriši
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>}
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
                  
                  {(reportType === 'orders' || reportType === 'revenue') && <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Od datuma</Label>
                        <Input type="date" value={reportDateRange.startDate} onChange={e => setReportDateRange({
                      ...reportDateRange,
                      startDate: e.target.value
                    })} />
                      </div>
                      <div>
                        <Label>Do datuma</Label>
                        <Input type="date" value={reportDateRange.endDate} onChange={e => setReportDateRange({
                      ...reportDateRange,
                      endDate: e.target.value
                    })} />
                      </div>
                    </div>}
                  
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
            </div>
          </TabsContent>

          <TabsContent value="feedback" className="space-y-6">
            <FeedbackManagement />
            <SuggestionsManagement />
          </TabsContent>
        </Tabs>
      </div>

      {/* AI Help Chat */}
      <AIHelpChat />

      {/* Clone Week Dialog */}
      <Sheet open={showCloneDialog} onOpenChange={setShowCloneDialog}>
        <SheetContent className="w-full md:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Kloniranje nedelje</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 mt-6">
            <div className="space-y-2">
              <Label>Izvor:</Label>
              <p className="text-sm text-muted-foreground">
                {cloneSourceMenus.length} {cloneSourceMenus.length === 1 ? 'jelovnik' : 'jelovnika'}
              </p>
            </div>
            <div className="space-y-2">
              <Label>Ciljna nedelja (ponedeljak):</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {cloneTargetDate ? format(cloneTargetDate, "PPP", { locale: require('date-fns/locale/sr-Latn') }) : "Izaberite datum"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={cloneTargetDate}
                    onSelect={(date) => {
                      if (date) {
                        // Pronađi ponedeljak te nedelje
                        const monday = startOfWeek(date, { weekStartsOn: 1 });
                        setCloneTargetDate(monday);
                      }
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <div className="flex gap-2 mt-6">
            <Button variant="outline" onClick={() => setShowCloneDialog(false)} className="flex-1">
              Otkaži
            </Button>
            <Button onClick={handleConfirmClone} disabled={!cloneTargetDate} className="flex-1">
              Kloniraj
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>;
}