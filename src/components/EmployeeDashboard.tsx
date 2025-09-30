import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ChefHat, LogOut, Calendar, CalendarPlus, User, MessageSquare } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useWeekOrders } from '@/hooks/useWeekOrders';
import { CurrentWeekView } from './employee/CurrentWeekView';
import { NextWeekView } from './employee/NextWeekView';
import { OrderMealDialog } from './employee/OrderMealDialog';
import { ProfileView } from './employee/ProfileView';
import { FeedbackView } from './employee/FeedbackView';

type View = 'current' | 'next' | 'feedback' | 'profile';

export function EmployeeDashboard() {
  const { signOut, user } = useAuth();
  const [currentView, setCurrentView] = useState<View>('next');
  const [orderDialogOpen, setOrderDialogOpen] = useState(false);
  const [totalMenuDays, setTotalMenuDays] = useState(0);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const {
    currentWeekOrders,
    nextWeekOrders,
    loading,
    canEditNextWeek,
    refetch
  } = useWeekOrders(user?.id);

  useEffect(() => {
    if (user?.id) {
      fetchTotalMenuDays();
    }
  }, [user?.id, nextWeekOrders]);

  const handleOrderCreated = async () => {
    // Small delay to ensure database transaction is committed
    await new Promise(resolve => setTimeout(resolve, 500));
    refetch();
    fetchTotalMenuDays();
  };

  const handleOrderDeleted = () => {
    refetch();
    fetchTotalMenuDays();
    setRefreshTrigger(prev => prev + 1);
  };

  const fetchTotalMenuDays = async () => {
    const { format, addWeeks, startOfWeek, addDays } = await import('date-fns');
    const { supabase } = await import('@/integrations/supabase/client');
    
    const nextWeekStart = addWeeks(startOfWeek(new Date(), { weekStartsOn: 1 }), 1);
    const nextWeekEnd = addDays(nextWeekStart, 6);

    const { data } = await supabase
      .from('menus')
      .select('menu_date')
      .gte('menu_date', format(nextWeekStart, 'yyyy-MM-dd'))
      .lte('menu_date', format(nextWeekEnd, 'yyyy-MM-dd'))
      .eq('is_active', true);

    setTotalMenuDays(data?.length || 0);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-accent to-background">
      {/* Header */}
      <div className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary rounded-lg">
                <ChefHat className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">Ketering Portal</h1>
                <p className="text-xs text-muted-foreground hidden sm:block">
                  Poručite obroke za narednu sedmicu
                </p>
              </div>
            </div>
            <Button onClick={signOut} variant="outline" size="sm" className="gap-2">
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Odjavi se</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6">
        {/* Desktop Navigation */}
        <div className="hidden md:flex gap-2 mb-6">
          <Button
            variant={currentView === 'next' ? 'default' : 'outline'}
            onClick={() => setCurrentView('next')}
            className="gap-2"
          >
            <CalendarPlus className="h-4 w-4" />
            Iduća nedelja
          </Button>
          <Button
            variant={currentView === 'current' ? 'default' : 'outline'}
            onClick={() => setCurrentView('current')}
            className="gap-2"
          >
            <Calendar className="h-4 w-4" />
            Tekuća nedelja
          </Button>
          <Button
            variant={currentView === 'feedback' ? 'default' : 'outline'}
            onClick={() => setCurrentView('feedback')}
            className="gap-2"
          >
            <MessageSquare className="h-4 w-4" />
            Utisci i predlozi
          </Button>
          <Button
            variant={currentView === 'profile' ? 'default' : 'outline'}
            onClick={() => setCurrentView('profile')}
            className="gap-2"
          >
            <User className="h-4 w-4" />
            Profil
          </Button>
        </div>

        {/* Content Area */}
        <div className="max-w-4xl mx-auto">
          {currentView === 'next' && (
            <NextWeekView
              orders={nextWeekOrders}
              loading={loading}
              canEdit={canEditNextWeek}
              onOpenOrderDialog={() => setOrderDialogOpen(true)}
              onOrderDeleted={handleOrderDeleted}
              totalMenuDays={totalMenuDays}
            />
          )}
          {currentView === 'current' && (
            <CurrentWeekView orders={currentWeekOrders} loading={loading} />
          )}
          {currentView === 'feedback' && <FeedbackView />}
          {currentView === 'profile' && <ProfileView user={user} />}
        </div>
      </div>

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-background border-t z-20">
        <div className="grid grid-cols-4 gap-1 p-2">
          <Button
            variant={currentView === 'next' ? 'default' : 'ghost'}
            onClick={() => setCurrentView('next')}
            className="flex flex-col h-auto py-2 gap-1"
          >
            <CalendarPlus className="h-5 w-5" />
            <span className="text-xs">Iduća</span>
          </Button>
          <Button
            variant={currentView === 'current' ? 'default' : 'ghost'}
            onClick={() => setCurrentView('current')}
            className="flex flex-col h-auto py-2 gap-1"
          >
            <Calendar className="h-5 w-5" />
            <span className="text-xs">Tekuća</span>
          </Button>
          <Button
            variant={currentView === 'feedback' ? 'default' : 'ghost'}
            onClick={() => setCurrentView('feedback')}
            className="flex flex-col h-auto py-2 gap-1"
          >
            <MessageSquare className="h-5 w-5" />
            <span className="text-xs">Utisci</span>
          </Button>
          <Button
            variant={currentView === 'profile' ? 'default' : 'ghost'}
            onClick={() => setCurrentView('profile')}
            className="flex flex-col h-auto py-2 gap-1"
          >
            <User className="h-5 w-5" />
            <span className="text-xs">Profil</span>
          </Button>
        </div>
      </div>

      {/* Dialogs */}
      <OrderMealDialog
        open={orderDialogOpen}
        onOpenChange={setOrderDialogOpen}
        userId={user?.id}
        onOrderCreated={handleOrderCreated}
        totalMenuDays={totalMenuDays}
        refreshTrigger={refreshTrigger}
      />
    </div>
  );
}
