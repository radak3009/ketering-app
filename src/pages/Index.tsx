import { useState } from "react";
import { LandingPage } from "@/components/LandingPage";
import { EmployeeDashboard } from "@/components/EmployeeDashboard";
import { AdminDashboard } from "@/components/AdminDashboard";

const Index = () => {
  const [currentView, setCurrentView] = useState<'landing' | 'employee' | 'admin'>('landing');

  const handleRoleSelect = (role: 'employee' | 'admin') => {
    setCurrentView(role);
  };

  if (currentView === 'employee') {
    return <EmployeeDashboard />;
  }

  if (currentView === 'admin') {
    return <AdminDashboard />;
  }

  return <LandingPage onRoleSelect={handleRoleSelect} />;
};

export default Index;
