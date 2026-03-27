import { useState, useEffect, lazy, Suspense } from "react";
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, Users, ChefHat, Calendar, LogOut, MessageSquare, Bell, Settings, ArrowUp } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminStats } from "@/hooks/useAdminStats";
import { useMeals } from "@/hooks/useMeals";

import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format, startOfWeek, endOfWeek, addWeeks } from "date-fns";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { LanguageToggle } from "@/components/ui/language-toggle";

// Lazy load admin components
const FeedbackManagement = lazy(() => import("./admin/FeedbackManagement").then(m => ({ default: m.FeedbackManagement })));
const SuggestionsManagement = lazy(() => import("./admin/SuggestionsManagement").then(m => ({ default: m.SuggestionsManagement })));
const MealsManagement = lazy(() => import("./admin/MealsManagement").then(m => ({ default: m.MealsManagement })));
const MenusManagement = lazy(() => import("./admin/MenusManagement").then(m => ({ default: m.MenusManagement })));
const UsersManagement = lazy(() => import("./admin/UsersManagement").then(m => ({ default: m.UsersManagement })));
const OrdersOverview = lazy(() => import("./admin/OrdersOverview").then(m => ({ default: m.OrdersOverview })));
const ReportsTab = lazy(() => import("./admin/ReportsTab").then(m => ({ default: m.ReportsTab })));
const SettingsTab = lazy(() => import("./admin/SettingsTab").then(m => ({ default: m.SettingsTab })));

const TabLoader = () => {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-center py-12">
      <LoadingSpinner size="lg" text={t('common.loading')} />
    </div>
  );
};


export function AdminDashboard() {
  const { t } = useTranslation();
  const { signOut } = useAuth();
  const { toast } = useToast();
  const { meals } = useMeals();
  
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  
  // Date range state for filtering - defaults to current week
  const [orderDateRange, setOrderDateRange] = useState({
    startDate: format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'),
    endDate: format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')
  });
  
  const { stats, loading: statsLoading } = useAdminStats(orderDateRange.startDate, orderDateRange.endDate);

  // Notification functions
  const sendMenuAlert = async () => {
    try {
      setNotificationsLoading(true);
      const { data, error } = await supabase.functions.invoke('notify-menu-ready');
      if (error) throw error;
      const result = data;
      const totalSent = (result?.email?.sent || 0) + (result?.push?.sent || 0);
      toast({ 
        title: t('toast.success'), 
        description: `Obaveštenje o jelovniku poslato ${totalSent} zaposlenom/ih` 
      });
    } catch (error) {
      console.error('Error sending menu notification:', error);
      toast({ title: t('toast.error'), description: t('toast.errorOccurred'), variant: 'destructive' });
    } finally {
      setNotificationsLoading(false);
    }
  };

  const sendEmployeeReminder = async () => {
    try {
      setNotificationsLoading(true);
      const { error } = await supabase.functions.invoke('send-employee-reminder');
      if (error) throw error;
      toast({ title: t('toast.success'), description: t('toast.reminderSent') });
    } catch (error) {
      console.error('Error sending reminder:', error);
      toast({ title: t('toast.error'), description: t('toast.errorOccurred'), variant: 'destructive' });
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
              <h1 className="text-lg md:text-xl font-bold text-foreground">{t('header.adminTitle')}</h1>
              <p className="text-xs text-muted-foreground hidden sm:block">{t('header.adminSubtitle')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <LanguageToggle />
            <ThemeToggle />
            <Button variant="outline" size="sm" onClick={signOut} className="text-xs md:text-sm">
              <LogOut className="h-4 w-4 mr-1 md:mr-2" />
              <span className="hidden sm:inline">{t('common.logout')}</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-3 md:px-6 py-4 md:py-8">
        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6 mb-6 md:mb-8">
          {/* Card 1: Obroci */}
          <Card className="bg-gradient-to-br from-secondary/10 to-secondary/5">
            <CardHeader className="pb-1 p-2 md:p-4 md:pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <ChefHat className="h-3 w-3 md:h-4 md:w-4" />
                {t('stats.meals')}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2 md:p-4 pt-0">
              <div className="text-lg md:text-2xl font-bold text-foreground">
                {statsLoading ? "..." : meals.length}
              </div>
            </CardContent>
          </Card>
          
          {/* Card 2: Porudžbine */}
          <Card className="bg-gradient-to-br from-accent/10 to-accent/5">
            <CardHeader className="pb-1 p-2 md:p-4 md:pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <BarChart3 className="h-3 w-3 md:h-4 md:w-4" />
                {t('stats.orders')}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2 md:p-4 pt-0">
              <div className="text-lg md:text-2xl font-bold text-foreground">
                {statsLoading ? "..." : stats.totalOrders}
              </div>
              <p className="text-[10px] md:text-xs text-muted-foreground">{t('stats.forSelectedPeriod')}</p>
            </CardContent>
          </Card>
          
          {/* Card 3: Danas */}
          <Card className="bg-gradient-to-br from-primary/10 to-accent/5">
            <CardHeader className="pb-1 p-2 md:p-4 md:pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Calendar className="h-3 w-3 md:h-4 md:w-4" />
                Danas
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2 md:p-4 pt-0">
              <div className="text-lg md:text-2xl font-bold text-foreground">
                {statsLoading ? "..." : stats.todayOrders}
              </div>
              <p className="text-[10px] md:text-xs text-muted-foreground">Porudžbina</p>
              <div className="text-sm md:text-lg font-semibold text-foreground mt-1">
                {statsLoading ? "..." : stats.todayPickedUp}
              </div>
              <p className="text-[10px] md:text-xs text-muted-foreground">Preuzeto</p>
            </CardContent>
          </Card>

          {/* Card 4: Po smenama - Pie Chart */}
          <Card className="bg-gradient-to-br from-primary/10 to-primary/5">
            <CardHeader className="pb-1 p-2 md:p-4 md:pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <BarChart3 className="h-3 w-3 md:h-4 md:w-4" />
                Po smenama
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2 md:p-4 pt-0">
              {statsLoading ? (
                <div className="text-lg md:text-2xl font-bold text-foreground">...</div>
              ) : stats.shiftBreakdown.length === 0 ? (
                <div className="text-xs text-muted-foreground">Nema podataka</div>
              ) : (
                <div className="h-[80px] md:h-[100px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={stats.shiftBreakdown.map(s => ({
                          name: s.shift === 'prva' ? 'I' : s.shift === 'druga' ? 'II' : s.shift === 'treća' ? 'III' : s.shift,
                          value: s.count,
                        }))}
                        cx="50%"
                        cy="50%"
                        innerRadius={20}
                        outerRadius={35}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        labelLine={false}
                      >
                        {stats.shiftBreakdown.map((_, index) => (
                          <Cell key={index} fill={['hsl(var(--primary))', 'hsl(var(--accent))', 'hsl(var(--secondary))'][index % 3]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => [value, 'Porudžbina']} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="orders" className="space-y-4 md:space-y-6">
          <TabsList className="grid w-full grid-cols-4 md:grid-cols-8 h-auto gap-1 p-1">
            <TabsTrigger value="orders" className="text-xs md:text-sm py-2">
              <BarChart3 className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
              <span className="hidden sm:inline">{t('admin.tabs.orders')}</span>
              <span className="sm:hidden">Por.</span>
            </TabsTrigger>
            <TabsTrigger value="meals" className="text-xs md:text-sm py-2">
              <ChefHat className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
              <span className="hidden sm:inline">{t('admin.tabs.meals')}</span>
              <span className="sm:hidden">Obr.</span>
            </TabsTrigger>
            <TabsTrigger value="menus" className="text-xs md:text-sm py-2">
              <Calendar className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
              <span className="hidden sm:inline">{t('admin.tabs.menus')}</span>
              <span className="sm:hidden">Men.</span>
            </TabsTrigger>
            <TabsTrigger value="users" className="text-xs md:text-sm py-2">
              <Users className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
              <span className="hidden sm:inline">{t('admin.tabs.users')}</span>
              <span className="sm:hidden">Kor.</span>
            </TabsTrigger>
            <TabsTrigger value="feedback" className="text-xs md:text-sm py-2">
              <MessageSquare className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
              <span className="hidden sm:inline">{t('admin.tabs.feedback')}</span>
              <span className="sm:hidden">Pov.</span>
            </TabsTrigger>
            <TabsTrigger value="notifications" className="text-xs md:text-sm py-2">
              <Bell className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
              <span className="hidden sm:inline">{t('admin.tabs.notifications')}</span>
              <span className="sm:hidden">Obav.</span>
            </TabsTrigger>
            <TabsTrigger value="reports" className="text-xs md:text-sm py-2">
              <BarChart3 className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
              <span className="hidden sm:inline">{t('admin.tabs.reports')}</span>
              <span className="sm:hidden">Izv.</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="text-xs md:text-sm py-2">
              <Settings className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
              <span className="hidden sm:inline">{t('admin.tabs.settings')}</span>
              <span className="sm:hidden">Pod.</span>
            </TabsTrigger>
          </TabsList>

          {/* Orders Tab */}
          <TabsContent value="orders">
            <Suspense fallback={<TabLoader />}>
              <OrdersOverview 
                orderDateRange={orderDateRange}
                setOrderDateRange={setOrderDateRange}
              />
            </Suspense>
          </TabsContent>

          {/* Meals Tab */}
          <TabsContent value="meals">
            <Suspense fallback={<TabLoader />}>
              <MealsManagement />
            </Suspense>
          </TabsContent>

          {/* Menus Tab */}
          <TabsContent value="menus">
            <Suspense fallback={<TabLoader />}>
              <MenusManagement />
            </Suspense>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users">
            <Suspense fallback={<TabLoader />}>
              <UsersManagement />
            </Suspense>
          </TabsContent>

          {/* Feedback Tab */}
          <TabsContent value="feedback">
            <Tabs defaultValue="utisci">
              <TabsList>
                <TabsTrigger value="utisci">Knjiga utisaka</TabsTrigger>
                <TabsTrigger value="predlozi">Predlozi za nova jela</TabsTrigger>
              </TabsList>
              <TabsContent value="utisci">
                <Suspense fallback={<TabLoader />}>
                  <FeedbackManagement />
                </Suspense>
              </TabsContent>
              <TabsContent value="predlozi">
                <Suspense fallback={<TabLoader />}>
                  <SuggestionsManagement />
                </Suspense>
              </TabsContent>
            </Tabs>
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg md:text-xl">{t('admin.notifications.title')}</CardTitle>
                <CardDescription className="text-xs md:text-sm">{t('admin.notifications.description')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">{t('admin.notifications.menuAlert.title')}</CardTitle>
                      <CardDescription className="text-xs">
                        {t('admin.notifications.menuAlert.description')}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button 
                        onClick={sendMenuAlert} 
                        disabled={notificationsLoading}
                        className="w-full"
                      >
                        <Bell className="h-4 w-4 mr-2" />
                        {notificationsLoading ? t('admin.notifications.menuAlert.sending') : t('admin.notifications.menuAlert.button')}
                      </Button>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">{t('admin.notifications.reminder.title')}</CardTitle>
                      <CardDescription className="text-xs">
                        {t('admin.notifications.reminder.description')}
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
                        {notificationsLoading ? t('admin.notifications.reminder.sending') : t('admin.notifications.reminder.button')}
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Reports Tab */}
          <TabsContent value="reports">
            <Suspense fallback={<TabLoader />}>
              <ReportsTab />
            </Suspense>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings">
            <Suspense fallback={<TabLoader />}>
              <SettingsTab />
            </Suspense>
          </TabsContent>
        </Tabs>
      </main>
      <ScrollToTopButton />
    </div>
  );
}

function ScrollToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 300);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (!visible) return null;

  return (
    <Button
      size="icon"
      className="fixed bottom-6 right-6 z-50 rounded-full shadow-lg"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="Povratak na vrh"
    >
      <ArrowUp className="h-5 w-5" />
    </Button>
  );
}
