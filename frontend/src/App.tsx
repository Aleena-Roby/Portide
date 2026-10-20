import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import { ToastStack } from './components/common/ToastStack';
import { LandingPage } from './components/landing/LandingPage';
import { LoginPage } from './components/auth/LoginPage';
import { RegisterPage } from './components/auth/RegisterPage';
import { ForgotPasswordPage } from './components/auth/ForgotPasswordPage';
import { ResetPasswordPage } from './components/auth/ResetPasswordPage';
import { RegistrationStatusPage } from './components/auth/RegistrationStatusPage';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { Sidebar } from './components/common/Sidebar';
import { Header } from './components/common/Header';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { getStoredSession } from './services/api';

// Role Dashboards
import { AdminDashboard } from './components/dashboards/AdminDashboard';
import { ShippingCompanyDashboard } from './components/dashboards/ShippingCompanyDashboard';
import { PortOperationsDashboard } from './components/dashboards/PortOperationsDashboard';
import { CustomsDashboard } from './components/dashboards/CustomsDashboard';
import { TerminalDashboard } from './components/dashboards/TerminalDashboard';
import { GateDashboard } from './components/dashboards/GateDashboard';

const DashboardLayout: React.FC = () => {
  const { activeRole, isDarkMode } = useApp();
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 1024);
  const location = useLocation();

  const pathParts = location.pathname.split('/').filter(Boolean);
  let subPath = pathParts[1] || 'overview';
  if (pathParts[1] === 'gate-operations' && pathParts[2]) {
    if (pathParts[2] === 'passes' || pathParts[2] === 'directory') {
      subPath = 'gate-passes';
    } else if (pathParts[2] === 'verify' || pathParts[2] === 'verification' || pathParts[2] === 'release-desk') {
      subPath = 'release-desk';
    }
  }
  const activeTab = (subPath === 'dashboard' || !subPath) 
    ? 'overview' 
    : (subPath === 'trucks' 
        ? 'gate-operations' 
        : (subPath === 'clearance' 
            ? 'cargo-management' 
            : (subPath === 'inspections' 
                ? 'normal-review' 
                : (subPath === 'history' ? 'decision-history' : subPath))));
  const [activeTabState, setActiveTabState] = useState(activeTab);

  useEffect(() => {
    setActiveTabState(activeTab);
  }, [activeTab]);

  const renderRoleDashboard = () => {
    switch (activeRole) {
      case 'admin':
      case 'port_administrator':
        return <AdminDashboard activeTab={activeTabState} onNavigate={setActiveTabState} />;
      case 'shipping_company':
        return <ShippingCompanyDashboard activeTab={activeTabState} onNavigate={setActiveTabState} />;
      case 'operations_officer':
      case 'port_operations_officer':
        return <PortOperationsDashboard activeTab={activeTabState} onNavigate={setActiveTabState} />;
      case 'customs_officer':
        return <CustomsDashboard activeTab={activeTabState} onNavigate={setActiveTabState} />;
      case 'terminal_operator':
      case 'terminal_logistics_operator':
        return <TerminalDashboard activeTab={activeTabState} onNavigate={setActiveTabState} />;
      case 'gate_officer':
      case 'gate_truck_officer':
        return <GateDashboard activeTab={activeTabState} onNavigate={setActiveTabState} />;
      default:
        return <AdminDashboard activeTab={activeTabState} onNavigate={setActiveTabState} />;
    }
  };

  return (
    <div className={`min-h-screen ${isDarkMode ? 'dark bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'} flex transition-colors duration-200 relative`}>
      
      {/* Mobile Backdrop Overlay */}
      {isSidebarOpen && (
        <div 
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-30 lg:hidden transition-opacity"
        />
      )}

      <Sidebar
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        activeTab={activeTabState}
        setActiveTab={setActiveTabState}
      />

      <div className="flex-1 flex flex-col min-w-0 min-h-screen overflow-x-hidden">
        <Header
          isSidebarOpen={isSidebarOpen}
          setIsSidebarOpen={setIsSidebarOpen}
          activeTab={activeTabState}
          setActiveTab={setActiveTabState}
        />

        <main className="flex-1 p-3.5 sm:p-6 lg:p-8 max-w-[1600px] w-full mx-auto space-y-4 sm:space-y-6 overflow-x-hidden">
          <ErrorBoundary fallbackTitle="Dashboard Module Error" fallbackMessage="An issue occurred while loading this view. You can reload or navigate to another tab safely.">
            {renderRoleDashboard()}
          </ErrorBoundary>
        </main>

        <footer className="py-4 px-4 sm:px-6 text-center text-[11px] sm:text-xs text-slate-500 border-t border-slate-200 dark:border-slate-800">
          Portide Enterprise Maritime Intelligence • Terminal Logistics Operations System
        </footer>
      </div>
    </div>
  );
};


const AppRoutes: React.FC = () => {
  const location = useLocation();
  const { isAuthenticated, logoutUser } = useApp();
  const searchParams = new URLSearchParams(location.search);
  const viewParam = searchParams.get('view');

  // When navigating back or visiting the public landing page, cleanly terminate any active dashboard session
  useEffect(() => {
    if (location.pathname === '/' && (isAuthenticated || getStoredSession())) {
      logoutUser(true);
    }
  }, [location.pathname, isAuthenticated, logoutUser]);

  // Handle query parameter based routing (e.g. ?view=reset-password&token=...)
  if (viewParam === 'reset-password') {
    return <ResetPasswordPage />;
  }
  if (viewParam === 'login') {
    return <LoginPage />;
  }
  if (viewParam === 'register') {
    return <RegisterPage />;
  }
  if (viewParam === 'forgot-password') {
    return <ForgotPasswordPage />;
  }
  if (viewParam === 'registration-status') {
    return <RegistrationStatusPage />;
  }

  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/registration-status" element={<RegistrationStatusPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      {/* Protected Admin Routes */}
      <Route
        path="/admin/*"
        element={
          <ProtectedRoute allowedRoles={['admin', 'port_administrator']}>
            <DashboardLayout />
          </ProtectedRoute>
        }
      />

      {/* Protected Shipping Company Routes */}
      <Route
        path="/shipping/*"
        element={
          <ProtectedRoute allowedRoles={['shipping_company']}>
            <DashboardLayout />
          </ProtectedRoute>
        }
      />

      {/* Protected Port Operations Officer Routes */}
      <Route
        path="/operations/*"
        element={
          <ProtectedRoute allowedRoles={['operations_officer', 'port_operations_officer']}>
            <DashboardLayout />
          </ProtectedRoute>
        }
      />

      {/* Protected Customs Officer Routes */}
      <Route
        path="/customs/clearance"
        element={
          <ProtectedRoute allowedRoles={['customs_officer']}>
            <Navigate to="/customs/cargo-management" replace />
          </ProtectedRoute>
        }
      />
      <Route
        path="/customs/*"
        element={
          <ProtectedRoute allowedRoles={['customs_officer']}>
            <DashboardLayout />
          </ProtectedRoute>
        }
      />

      {/* Protected Terminal Operator Routes */}
      <Route
        path="/terminal/*"
        element={
          <ProtectedRoute allowedRoles={['terminal_operator', 'terminal_logistics_operator']}>
            <DashboardLayout />
          </ProtectedRoute>
        }
      />

      {/* Protected Gate Officer Routes */}
      <Route
        path="/gate/*"
        element={
          <ProtectedRoute allowedRoles={['gate_officer', 'gate_truck_officer']}>
            <DashboardLayout />
          </ProtectedRoute>
        }
      />

      {/* Direct /gate-operations access alias */}
      <Route
        path="/gate-operations"
        element={
          <ProtectedRoute allowedRoles={['gate_officer', 'gate_truck_officer']}>
            <Navigate to="/gate/gate-operations" replace />
          </ProtectedRoute>
        }
      />
      <Route
        path="/gate-passes"
        element={
          <ProtectedRoute allowedRoles={['gate_officer', 'gate_truck_officer']}>
            <Navigate to="/gate/gate-passes" replace />
          </ProtectedRoute>
        }
      />
      <Route
        path="/release-desk"
        element={
          <ProtectedRoute allowedRoles={['gate_officer', 'gate_truck_officer']}>
            <Navigate to="/gate/release-desk" replace />
          </ProtectedRoute>
        }
      />

      {/* Wildcard Route Redirect */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <AppRoutes />
        <ToastStack />
      </AppProvider>
    </BrowserRouter>
  );
}
