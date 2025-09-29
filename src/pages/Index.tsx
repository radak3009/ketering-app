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
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

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

  if (!user) {
    return null; // Will redirect to auth
  }

  // If user doesn't have a profile yet, show registration message
  if (!profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-accent/10 flex items-center justify-center">
        <div className="text-center space-y-4 max-w-md mx-auto p-6">
          <h2 className="text-2xl font-bold text-foreground">Registracija potrebna</h2>
          <p className="text-muted-foreground">
            Morate se registrovati da biste koristili aplikaciju. Molimo vas kontaktirajte administratora.
          </p>
        </div>
      </div>
    );
  }

  // Show appropriate dashboard based on user role
  if (profile.role === 'employee') {
    return <EmployeeDashboard />;
  }
  
  return <AdminDashboard />;
};

export default Index;
