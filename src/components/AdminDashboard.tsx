import { useState, useEffect, lazy, Suspense, useRef } from "react";
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, Users, ChefHat, Calendar, LogOut, MessageSquare, Bell, Settings, ArrowUp, RefreshCw } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from "recharts";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminStats } from "@/hooks/useAdminStats";
import { usePermissions } from "@/hooks/usePermissions";
import { Can } from "@/components/auth/Can";


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


// AdminDashboard component
export function AdminDashboard() {
  const { t } = useTranslation();
  const { signOut } = useAuth();
  const { toast } = useToast();
  const { has, hasAny, loading: permsLoading } = usePermissions();

  
  
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [broadcastSubject, setBroadcastSubject] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastTags, setBroadcastTags] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);

  // Date range state for filtering - defaults to current week
  const [orderDateRange, setOrderDateRange] = useState({
    startDate: format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'),
    endDate: format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')
  });

  const { stats, loading: statsLoading, refetch: refetchStats } = useAdminStats(orderDateRange.startDate, orderDateRange.endDate);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const wasLoadingRef = useRef(false);

  // Track when stats finish loading to update timestamp
  useEffect(() => {
    if (wasLoadingRef.current && !statsLoading) {
      setLastRefreshed(new Date());
    }
    wasLoadingRef.current = statsLoading;
  }, [statsLoading]);

  // Auto-refresh KPI every 3 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      refetchStats();
    }, 3 * 60 * 1000);
    return () => clearInterval(interval);
  }, [refetchStats]);

  // Fetch available tags for broadcast filtering
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('tag')
        .eq('role', 'employee')
        .not('tag', 'is', null);
      if (data) {
        const uniq = [...new Set(data.map((p: any) => p.tag).filter(Boolean))] as string[];
        setAvailableTags(uniq.sort());
      }
    })();
  }, []);

  const handleManualRefresh = async () => {
    await refetchStats();
    setLastRefreshed(new Date());
  };

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

  const sendBroadcast = async () => {
    const subject = broadcastSubject.trim();
    const msg = broadcastMessage.trim();
    if (!subject || !msg) {
      toast({ title: 'Greška', description: 'Unesite naslov i poruku', variant: 'destructive' });
      return;
    }
    const targetDesc = broadcastTags.length === 0
      ? 'svim zaposlenima'
      : `zaposlenima sa tagom: ${broadcastTags.join(', ')}`;
    if (!confirm(`Da li ste sigurni da želite poslati ovaj email ${targetDesc}?`)) return;
    try {
      setNotificationsLoading(true);
      const { data, error } = await supabase.functions.invoke('send-custom-broadcast', {
        body: { subject, message: msg, tags: broadcastTags },
      });
      if (error) throw error;
      const sent = data?.sent ?? 0;
      const total = data?.total ?? 0;
      const failed = data?.failed ?? 0;
      setBroadcastSubject('');
      setBroadcastMessage('');
      toast({
        title: 'Email poslat',
        description: `Poslato ${sent}/${total}${failed > 0 ? ` (neuspešno: ${failed})` : ''}`,
      });
    } catch (error: any) {
      console.error('Error sending broadcast email:', error);
      toast({
        title: 'Greška',
        description: error?.message || 'Došlo je do greške pri slanju emaila',
        variant: 'destructive',
      });
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
        {/* Stats Overview — samo ako korisnik ima dashboard.view */}
        {has("dashboard.view") && (
          <div className="flex items-center justify-between gap-2 mb-2 md:mb-3">
            <span className="text-xs md:text-sm text-muted-foreground">
              {lastRefreshed
                ? `Poslednje osveženo: ${lastRefreshed.toLocaleTimeString('sr-RS')}`
                : 'Učitavanje...'}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleManualRefresh}
              disabled={statsLoading}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${statsLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Osveži</span>
            </Button>
          </div>
        )}
        {has("dashboard.view") && (

          {/* Card 1: Top 3 obroka */}
          <Card className="bg-gradient-to-br from-secondary/10 to-secondary/5">
            <CardHeader className="pb-1 p-2 md:p-4 md:pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <ChefHat className="h-3 w-3 md:h-4 md:w-4" />
                Top 3 obroka
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2 md:p-4 pt-0">
              {statsLoading ? (
                <div className="text-lg md:text-2xl font-bold text-foreground">...</div>
              ) : stats.topMeals.length === 0 ? (
                <div className="text-xs text-muted-foreground">Nema podataka</div>
              ) : (
                <div className="h-[80px] md:h-[100px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={stats.topMeals.map(m => ({
                        name: m.name.length > 12 ? m.name.slice(0, 12) + '…' : m.name,
                        fullName: m.name,
                        value: m.count,
                      }))}
                      layout="vertical"
                      margin={{ top: 0, right: 30, left: 0, bottom: 0 }}
                    >
                      <XAxis type="number" hide />
                      <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                      <Tooltip
                        formatter={(value: number, _name: string, props: any) => [value, props.payload.fullName]}
                        contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '8px', color: 'hsl(var(--foreground))' }}
                        itemStyle={{ color: 'hsl(var(--foreground))' }}
                        labelStyle={{ display: 'none' }}
                        cursor={false}
                      />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={14} label={{ position: 'right', fontSize: 11, fill: 'hsl(var(--foreground))' }}>
                        {stats.topMeals.map((_, i) => (
                          <Cell key={i} fill={['hsl(var(--primary))', 'hsl(var(--accent))', 'hsl(var(--secondary))'][i] || 'hsl(var(--muted))'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
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
          
          {/* Card 3: Po smenama - Bar Chart */}
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
                    <BarChart
                      data={(() => {
                        const shiftOrder = ['prva', 'druga', 'treća'];
                        const sorted = [...stats.shiftBreakdown].sort((a, b) => shiftOrder.indexOf(a.shift) - shiftOrder.indexOf(b.shift));
                        return sorted.map(s => ({
                          name: s.shift === 'prva' ? 'I smena' : s.shift === 'druga' ? 'II smena' : s.shift === 'treća' ? 'III smena' : s.shift,
                          value: s.count,
                          shift: s.shift,
                        }));
                      })()}
                      layout="vertical"
                      margin={{ top: 0, right: 30, left: 0, bottom: 0 }}
                    >
                      <XAxis type="number" hide />
                      <YAxis type="category" dataKey="name" width={55} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                      
                      <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={14} label={{ position: 'right', fontSize: 11, fill: 'hsl(var(--foreground))' }}>
                        {(() => {
                          const shiftOrder = ['prva', 'druga', 'treća'];
                          const colors: Record<string, string> = { prva: 'hsl(var(--primary))', druga: 'hsl(var(--accent))', 'treća': 'hsl(var(--secondary))' };
                          const sorted = [...stats.shiftBreakdown].sort((a, b) => shiftOrder.indexOf(a.shift) - shiftOrder.indexOf(b.shift));
                          return sorted.map((s, i) => (
                            <Cell key={i} fill={colors[s.shift] || 'hsl(var(--muted))'} />
                          ));
                        })()}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Card 4: Danas */}
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
              <p className="text-[10px] md:text-xs text-muted-foreground">Obroka</p>
              <div className="text-sm md:text-lg font-semibold text-foreground mt-1">
                {statsLoading ? "..." : stats.todayPickedUp}
              </div>
              <p className="text-[10px] md:text-xs text-muted-foreground">Preuzeto</p>
            </CardContent>
          </Card>
        </div>
        )}


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
                <div className="grid gap-4 grid-cols-1 md:grid-cols-3 max-w-4xl mx-auto">
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

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Custom obaveštenje (email)</CardTitle>
                      <CardDescription className="text-xs">
                        Pošaljite email zaposlenima — opciono filtrirano po organizacionoj jedinici (tagu)
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Naslov</Label>
                        <Input
                          placeholder="Naslov emaila..."
                          value={broadcastSubject}
                          onChange={(e) => setBroadcastSubject(e.target.value)}
                          maxLength={150}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Poruka</Label>
                        <textarea
                          className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                          placeholder="Unesite poruku..."
                          value={broadcastMessage}
                          onChange={(e) => setBroadcastMessage(e.target.value)}
                          maxLength={2000}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">
                          Primaoci {broadcastTags.length === 0 ? '(svi zaposleni)' : `(${broadcastTags.length} tagova izabrano)`}
                        </Label>
                        {availableTags.length === 0 ? (
                          <p className="text-xs text-muted-foreground">Nema dostupnih tagova — email će biti poslat svim zaposlenima.</p>
                        ) : (
                          <div className="flex flex-wrap gap-3 p-2 border rounded-md max-h-32 overflow-y-auto">
                            {availableTags.map((tag) => {
                              const checked = broadcastTags.includes(tag);
                              return (
                                <label key={tag} className="flex items-center gap-2 text-sm cursor-pointer">
                                  <Checkbox
                                    checked={checked}
                                    onCheckedChange={(v) => {
                                      if (v) setBroadcastTags(prev => [...prev, tag]);
                                      else setBroadcastTags(prev => prev.filter(t => t !== tag));
                                    }}
                                  />
                                  <span>{tag}</span>
                                </label>
                              );
                            })}
                          </div>
                        )}
                        {broadcastTags.length > 0 && (
                          <button
                            type="button"
                            className="text-xs text-muted-foreground hover:text-foreground underline"
                            onClick={() => setBroadcastTags([])}
                          >
                            Pošalji svim zaposlenima
                          </button>
                        )}
                      </div>
                      <Button
                        onClick={sendBroadcast}
                        disabled={notificationsLoading || !broadcastSubject.trim() || !broadcastMessage.trim()}
                        variant="outline"
                        className="w-full"
                      >
                        <MessageSquare className="h-4 w-4 mr-2" />
                        {notificationsLoading ? 'Slanje...' : 'Pošalji email'}
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
