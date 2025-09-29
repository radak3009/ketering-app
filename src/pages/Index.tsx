import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { LandingPage } from '@/components/LandingPage';
import { EmployeeDashboard } from '@/components/EmployeeDashboard';
import { AdminDashboard } from '@/components/AdminDashboard';

const Index = () => {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // If user is not authenticated OR user has no profile, redirect to auth page
    if (!loading && (!user || (user && !profile))) {
      navigate('/auth');
    }
  }, [user, profile, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-accent/10 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Učitavanje...</p>
        </div>
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
