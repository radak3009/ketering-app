import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ChefHat, LogOut, Calendar, CalendarPlus, User, MessageSquare, Bell, Bot, AlertTriangle } from 'lucide-react';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { LanguageToggle } from '@/components/ui/language-toggle';
import { useAuth } from '@/contexts/AuthContext';
import { useWeekOrders } from '@/hooks/useWeekOrders';
import { useNotifications } from '@/hooks/useNotifications';
import { CurrentWeekView } from './employee/CurrentWeekView';
import { NextWeekView } from './employee/NextWeekView';
import { OrderMealDialog } from './employee/OrderMealDialog';
import { ProfileView } from './employee/ProfileView';
import { FeedbackView } from './employee/FeedbackView';
import { AIHelpChat } from './AIHelpChat';
import { useUpdate } from '@/contexts/UpdateContext';

type View = 'current' | 'next' | 'feedback' | 'profile';

export function EmployeeDashboard() {
  const { t } = useTranslation();
  const { signOut, user, profile, requiresIdSetup } = useAuth();
  
  // Force profile view if password not set
  const [currentView, setCurrentView] = useState<View>(requiresIdSetup ? 'profile' : 'next');
  const [orderDialogOpen, setOrderDialogOpen] = useState(false);
  const [aiChatOpen, setAiChatOpen] = useState(false);
  const [totalMenuDays, setTotalMenuDays] = useState(0);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const {
    currentWeekOrders,
    nextWeekOrders,
    loading,
    canEditNextWeek,
    refetch
  } = useWeekOrders(user?.id);

  const { employeeNotification } = useNotifications(user?.id, false);

  // Force profile view when requiresIdSetup changes
  useEffect(() => {
    if (requiresIdSetup) {
      setCurrentView('profile');
    }
  }, [requiresIdSetup]);

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

  // Handler for navigation - block if password not set
  const handleNavigate = (view: View) => {
    if (requiresIdSetup && view !== 'profile') {
      // Don't allow navigation to other views
      return;
    }
    setCurrentView(view);
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
                <h1 className="text-xl font-bold text-foreground">{t('header.title')}</h1>
                <p className="text-xs text-muted-foreground hidden sm:block">
                  {t('header.subtitle')}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!requiresIdSetup && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setAiChatOpen(true)}
                  className="hidden md:flex"
                  title={t('navigation.aiAssistant')}
                >
                  <Bot className="h-5 w-5" />
                </Button>
              )}
              <LanguageToggle />
              <ThemeToggle />
              {/* User Info - visible on tablet/desktop */}
              {!requiresIdSetup && profile && (
                <div className="hidden sm:flex flex-col items-end text-xs text-muted-foreground border-r pr-2 mr-1">
                  {profile.company_card_id && (
                    <span className="font-mono font-medium text-foreground">
                      ID: {profile.company_card_id}
                    </span>
                  )}
                  {profile.full_name && (
                    <span className="truncate max-w-[150px]">{profile.full_name}</span>
                  )}
                </div>
              )}
              {!requiresIdSetup && (
                <Button onClick={signOut} variant="outline" size="sm" className="gap-2">
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline">{t('common.signOut')}</span>
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6">
        {/* Password Setup Warning Alert */}
        {requiresIdSetup && (
          <Alert className="mb-4 border-destructive bg-destructive/10">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <AlertDescription className="text-destructive font-medium">
              {t('profile.idSetupRequired')}
            </AlertDescription>
          </Alert>
        )}

        {/* Notification Alert */}
        {employeeNotification && !requiresIdSetup && (
          <Alert className="mb-4 border-amber-500 bg-amber-50 dark:bg-amber-950/20">
            <Bell className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800 dark:text-amber-200">
              {employeeNotification}
            </AlertDescription>
          </Alert>
        )}

        {/* Desktop Navigation - Hidden when password not set */}
        {!requiresIdSetup && (
          <div className="hidden md:flex gap-2 mb-6">
            <Button
              variant={currentView === 'next' ? 'default' : 'outline'}
              onClick={() => handleNavigate('next')}
              className="gap-2"
            >
              <CalendarPlus className="h-4 w-4" />
              {t('navigation.nextWeek')}
            </Button>
            <Button
              variant={currentView === 'current' ? 'default' : 'outline'}
              onClick={() => handleNavigate('current')}
              className="gap-2"
            >
              <Calendar className="h-4 w-4" />
              {t('navigation.currentWeek')}
            </Button>
            <Button
              variant={currentView === 'feedback' ? 'default' : 'outline'}
              onClick={() => handleNavigate('feedback')}
              className="gap-2"
            >
              <MessageSquare className="h-4 w-4" />
              {t('navigation.feedback')}
            </Button>
            <Button
              variant={currentView === 'profile' ? 'default' : 'outline'}
              onClick={() => handleNavigate('profile')}
              className="gap-2"
            >
              <User className="h-4 w-4" />
              {t('navigation.profile')}
            </Button>
          </div>
        )}

        {/* Content Area */}
        <div className="max-w-4xl mx-auto">
          {currentView === 'next' && !requiresIdSetup && (
            <NextWeekView
              orders={nextWeekOrders}
              loading={loading}
              canEdit={canEditNextWeek}
              onOpenOrderDialog={() => setOrderDialogOpen(true)}
              onOrderDeleted={handleOrderDeleted}
              totalMenuDays={totalMenuDays}
              profileIncomplete={requiresIdSetup}
            />
          )}
          {currentView === 'current' && !requiresIdSetup && (
            <CurrentWeekView orders={currentWeekOrders} loading={loading} onRefresh={refetch} />
          )}
          {currentView === 'feedback' && !requiresIdSetup && <FeedbackView />}
          {(currentView === 'profile' || requiresIdSetup) && (
            <ProfileView 
              user={user} 
              isIdSetupMode={requiresIdSetup}
            />
          )}
        </div>
      </div>

      {/* Mobile Bottom Navigation - Hidden when password not set */}
      {!requiresIdSetup && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-background border-t z-20">
          <div className="grid grid-cols-5 gap-1 p-2">
            <Button
              variant={currentView === 'next' ? 'default' : 'ghost'}
              onClick={() => handleNavigate('next')}
              className="flex flex-col h-auto py-2 gap-1"
            >
              <CalendarPlus className="h-5 w-5" />
              <span className="text-xs">{t('navigation.next')}</span>
            </Button>
            <Button
              variant={currentView === 'current' ? 'default' : 'ghost'}
              onClick={() => handleNavigate('current')}
              className="flex flex-col h-auto py-2 gap-1"
            >
              <Calendar className="h-5 w-5" />
              <span className="text-xs">{t('navigation.current')}</span>
            </Button>
            <Button
              variant={currentView === 'feedback' ? 'default' : 'ghost'}
              onClick={() => handleNavigate('feedback')}
              className="flex flex-col h-auto py-2 gap-1"
            >
              <MessageSquare className="h-5 w-5" />
              <span className="text-xs">{t('navigation.impressions')}</span>
            </Button>
            <Button
              variant={currentView === 'profile' ? 'default' : 'ghost'}
              onClick={() => handleNavigate('profile')}
              className="flex flex-col h-auto py-2 gap-1"
            >
              <User className="h-5 w-5" />
              <span className="text-xs">{t('navigation.profile')}</span>
            </Button>
            <Button
              variant="ghost"
              onClick={() => setAiChatOpen(true)}
              className="flex flex-col h-auto py-2 gap-1"
            >
              <Bot className="h-5 w-5" />
              <span className="text-xs">AI</span>
            </Button>
          </div>
        </div>
      )}

      {/* Dialogs - Only available when password is set */}
      {!requiresIdSetup && (
        <OrderMealDialog
          open={orderDialogOpen}
          onOpenChange={setOrderDialogOpen}
          userId={user?.id}
          onOrderCreated={handleOrderCreated}
          totalMenuDays={totalMenuDays}
          refreshTrigger={refreshTrigger}
        />
      )}

      {/* AI Help Chat - Only available when password is set */}
      {!requiresIdSetup && (
        <AIHelpChat open={aiChatOpen} onOpenChange={setAiChatOpen} />
      )}
    </div>
  );
}
