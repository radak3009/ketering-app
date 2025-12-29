import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, Users, ChefHat, Calendar, LogOut, MessageSquare, Bell } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminStats } from "@/hooks/useAdminStats";
import { useMeals } from "@/hooks/useMeals";
import { useUsers } from "@/hooks/useUsers";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format, startOfWeek, endOfWeek, addWeeks } from "date-fns";
import { FeedbackManagement } from "./admin/FeedbackManagement";
import { SuggestionsManagement } from "./admin/SuggestionsManagement";
import { MealsManagement } from "./admin/MealsManagement";
import { MenusManagement } from "./admin/MenusManagement";
import { UsersManagement } from "./admin/UsersManagement";
import { OrdersOverview } from "./admin/OrdersOverview";
import { ReportsTab } from "./admin/ReportsTab";
import { AIHelpChat } from "./AIHelpChat";

export function AdminDashboard() {
  const { signOut } = useAuth();
  const { toast } = useToast();
  const { meals } = useMeals();
  const { users } = useUsers();
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  
  // Date range state for filtering - defaults to next week
  const [orderDateRange, setOrderDateRange] = useState({
    startDate: format(startOfWeek(addWeeks(new Date(), 1), { weekStartsOn: 1 }), 'yyyy-MM-dd'),
    endDate: format(endOfWeek(addWeeks(new Date(), 1), { weekStartsOn: 1 }), 'yyyy-MM-dd')
  });
  
  const { stats, loading: statsLoading } = useAdminStats(orderDateRange.startDate, orderDateRange.endDate);

  // Notification functions
  const sendMenuAlert = async () => {
    try {
      setNotificationsLoading(true);
      const { error } = await supabase.functions.invoke('send-admin-menu-alert');
      if (error) throw error;
      toast({ title: 'Uspeh', description: 'Obaveštenje o meniju je uspešno poslato' });
    } catch (error) {
      console.error('Error sending menu alert:', error);
      toast({ title: 'Greška', description: 'Nije moguće poslati obaveštenje', variant: 'destructive' });
    } finally {
      setNotificationsLoading(false);
    }
  };

  const sendEmployeeReminder = async () => {
    try {
      setNotificationsLoading(true);
      const { error } = await supabase.functions.invoke('send-employee-reminder');
      if (error) throw error;
      toast({ title: 'Uspeh', description: 'Podsetnici su uspešno poslati' });
    } catch (error) {
      console.error('Error sending reminder:', error);
      toast({ title: 'Greška', description: 'Nije moguće poslati podsetnike', variant: 'destructive' });
    } finally {
      setNotificationsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-3 md:px-6 py-3 md:py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="w-8 h-8 md:w-10 md:h-10 bg-gradient-to-br from-primary to-primary/80 rounded-lg flex items-center justify-center">
              <ChefHat className="h-4 w-4 md:h-6 md:w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg md:text-xl font-bold text-foreground">Admin Panel</h1>
              <p className="text-xs text-muted-foreground hidden sm:block">Upravljanje sistemom</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <AIHelpChat />
            <Button variant="outline" size="sm" onClick={signOut} className="text-xs md:text-sm">
              <LogOut className="h-4 w-4 mr-1 md:mr-2" />
              <span className="hidden sm:inline">Odjava</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-3 md:px-6 py-4 md:py-8">
        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6 mb-6 md:mb-8">
          <Card className="bg-gradient-to-br from-primary/10 to-primary/5">
            <CardHeader className="pb-2 p-3 md:p-6">
              <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Users className="h-3 w-3 md:h-4 md:w-4" />
                Korisnici
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 md:p-6 pt-0">
              <div className="text-xl md:text-3xl font-bold text-foreground">
                {statsLoading ? "..." : users.length}
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-secondary/10 to-secondary/5">
            <CardHeader className="pb-2 p-3 md:p-6">
              <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground flex items-center gap-2">
                <ChefHat className="h-3 w-3 md:h-4 md:w-4" />
                Obroci
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 md:p-6 pt-0">
              <div className="text-xl md:text-3xl font-bold text-foreground">
                {statsLoading ? "..." : meals.length}
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-accent/10 to-accent/5">
            <CardHeader className="pb-2 p-3 md:p-6">
              <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground flex items-center gap-2">
                <BarChart3 className="h-3 w-3 md:h-4 md:w-4" />
                Porudžbine
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 md:p-6 pt-0">
              <div className="text-xl md:text-3xl font-bold text-foreground">
                {statsLoading ? "..." : stats.totalOrders}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Za izabrani period</p>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-primary/10 to-accent/5">
            <CardHeader className="pb-2 p-3 md:p-6">
              <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Calendar className="h-3 w-3 md:h-4 md:w-4" />
                Prihod
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 md:p-6 pt-0">
              <div className="text-xl md:text-3xl font-bold text-foreground">
                {statsLoading ? "..." : `${stats.totalRevenue.toFixed(0)} RSD`}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Za izabrani period</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="orders" className="space-y-4 md:space-y-6">
          <TabsList className="grid w-full grid-cols-3 md:grid-cols-7 h-auto gap-1 p-1">
            <TabsTrigger value="orders" className="text-xs md:text-sm py-2">
              <BarChart3 className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
              <span className="hidden sm:inline">Porudžbine</span>
              <span className="sm:hidden">Por.</span>
            </TabsTrigger>
            <TabsTrigger value="meals" className="text-xs md:text-sm py-2">
              <ChefHat className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
              <span className="hidden sm:inline">Obroci</span>
              <span className="sm:hidden">Obr.</span>
            </TabsTrigger>
            <TabsTrigger value="menus" className="text-xs md:text-sm py-2">
              <Calendar className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
              <span className="hidden sm:inline">Meniji</span>
              <span className="sm:hidden">Men.</span>
            </TabsTrigger>
            <TabsTrigger value="users" className="text-xs md:text-sm py-2">
              <Users className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
              <span className="hidden sm:inline">Korisnici</span>
              <span className="sm:hidden">Kor.</span>
            </TabsTrigger>
            <TabsTrigger value="feedback" className="text-xs md:text-sm py-2">
              <MessageSquare className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
              <span className="hidden sm:inline">Povratne</span>
              <span className="sm:hidden">Pov.</span>
            </TabsTrigger>
            <TabsTrigger value="notifications" className="text-xs md:text-sm py-2">
              <Bell className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
              <span className="hidden sm:inline">Obaveštenja</span>
              <span className="sm:hidden">Obav.</span>
            </TabsTrigger>
            <TabsTrigger value="reports" className="text-xs md:text-sm py-2">
              <BarChart3 className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
              <span className="hidden sm:inline">Izveštaji</span>
              <span className="sm:hidden">Izv.</span>
            </TabsTrigger>
          </TabsList>

          {/* Orders Tab */}
          <TabsContent value="orders">
            <OrdersOverview 
              orderDateRange={orderDateRange}
              setOrderDateRange={setOrderDateRange}
            />
          </TabsContent>

          {/* Meals Tab */}
          <TabsContent value="meals">
            <MealsManagement />
          </TabsContent>

          {/* Menus Tab */}
          <TabsContent value="menus">
            <MenusManagement />
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users">
            <UsersManagement />
          </TabsContent>

          {/* Feedback Tab */}
          <TabsContent value="feedback">
            <div className="grid gap-6">
              <FeedbackManagement />
              <SuggestionsManagement />
            </div>
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg md:text-xl">Obaveštenja</CardTitle>
                <CardDescription className="text-xs md:text-sm">Slanje obaveštenja korisnicima</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Obaveštenje o meniju</CardTitle>
                      <CardDescription className="text-xs">
                        Pošalji email svim korisnicima o novom sedmičnom meniju
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button 
                        onClick={sendMenuAlert} 
                        disabled={notificationsLoading}
                        className="w-full"
                      >
                        <Bell className="h-4 w-4 mr-2" />
                        {notificationsLoading ? "Slanje..." : "Pošalji obaveštenje o meniju"}
                      </Button>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Podsetnik za porudžbine</CardTitle>
                      <CardDescription className="text-xs">
                        Pošalji podsetnik zaposlenima koji nisu naručili za sledeću nedelju
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button 
                        onClick={sendEmployeeReminder} 
                        disabled={notificationsLoading}
                        variant="outline"
                        className="w-full"
                      >
                        <Bell className="h-4 w-4 mr-2" />
                        {notificationsLoading ? "Slanje..." : "Pošalji podsetnik"}
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Reports Tab */}
          <TabsContent value="reports">
            <ReportsTab />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
