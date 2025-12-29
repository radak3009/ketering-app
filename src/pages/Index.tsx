import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { LandingPage } from '@/components/LandingPage';
import { EmployeeDashboard } from '@/components/EmployeeDashboard';
import { AdminDashboard } from '@/components/AdminDashboard';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

const Index = () => {
  const { user, profile, loading, isPasswordRecovery } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Check if we're processing hash parameters (email verification or magic link)
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const hasAuthParams = hashParams.has('access_token') || hashParams.has('type');
    const isRecoveryFromHash = hashParams.get('type') === 'recovery';
    
    // Ako je recovery mode (bilo iz URL hash-a ili iz AuthContext), redirektuj na /auth
    if (isRecoveryFromHash || isPasswordRecovery) {
      console.log('[Index] Recovery mode detected, redirecting to /auth?recovery=true');
      navigate('/auth?recovery=true', { replace: true });
      return;
    }
    
    // Don't redirect if we're still loading or processing auth parameters
    if (loading || hasAuthParams) {
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
    return <EmployeeDashboard />;
  }
  
  return <AdminDashboard />;
};

export default Index;
