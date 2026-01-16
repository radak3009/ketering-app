import { useEffect, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

// Lazy load heavy dashboard components
const EmployeeDashboard = lazy(() => import('@/components/EmployeeDashboard').then(m => ({ default: m.EmployeeDashboard })));
const AdminDashboard = lazy(() => import('@/components/AdminDashboard').then(m => ({ default: m.AdminDashboard })));

const DashboardLoader = () => (
  <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-accent/10 flex items-center justify-center">
    <LoadingSpinner size="xl" text="Učitavanje dashboard-a..." />
  </div>
);

const Index = () => {
  const { user, profile, loading, isPasswordRecovery } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Check if we're processing auth parameters (email verification, magic link, or invite)
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const queryParams = new URLSearchParams(window.location.search);
    
    // PKCE flow uses ?code= query param, implicit flow uses #access_token hash
    const hasHashParams = hashParams.has('access_token') || hashParams.has('type');
    const hasCodeParam = queryParams.has('code');
    const hasAuthParams = hasHashParams || hasCodeParam;
    
    const isRecoveryFromHash = hashParams.get('type') === 'recovery';
    
    // Ako je recovery mode (bilo iz URL hash-a ili iz AuthContext), redirektuj na /auth
    if (isRecoveryFromHash || isPasswordRecovery) {
      console.log('[Index] Recovery mode detected, redirecting to /auth?recovery=true');
      navigate('/auth?recovery=true', { replace: true });
      return;
    }
    
    // Don't redirect if we're still loading or processing auth parameters
    if (loading || hasAuthParams) {
      console.log('[Index] Waiting for auth processing...', { loading, hasAuthParams });
      return;
    }

    // Samo redirektuj na auth ako nema user-a
    if (!user) {
      navigate('/auth');
      return;
    }

    // Ako ima user ali nema profil, i loading je završen, onda redirektuj
    if (user && !profile && !loading) {
      navigate('/auth');
    }
  }, [user, profile, loading, navigate, isPasswordRecovery]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-accent/10 flex items-center justify-center">
        <LoadingSpinner size="xl" text="Učitavanje..." />
      </div>
    );
  }

  // Ako ima user i profile, ali još nema role, prikaži loading
  if (user && profile && !profile.role) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-accent/10 flex items-center justify-center">
        <LoadingSpinner size="xl" text="Učitavanje korisničkih podataka..." />
      </div>
    );
  }

  // If user is not authenticated or no profile, show nothing (will redirect in useEffect)
  if (!user || !profile) {
    return null;
  }

  // Show appropriate dashboard based on user role
  if (profile.role === 'employee') {
    return (
      <Suspense fallback={<DashboardLoader />}>
        <EmployeeDashboard />
      </Suspense>
    );
  }
  
  return (
    <Suspense fallback={<DashboardLoader />}>
      <AdminDashboard />
    </Suspense>
  );
};

export default Index;
