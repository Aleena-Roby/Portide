import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { getStoredSession } from '../../services/api';

export const getDefaultDashboardRoute = (role?: string): string => {
  switch (role) {
    case 'admin':
    case 'port_administrator':
      return '/admin/dashboard';
    case 'shipping_company':
      return '/shipping/dashboard';
    case 'operations_officer':
    case 'port_operations_officer':
      return '/operations/dashboard';
    case 'customs_officer':
      return '/customs/dashboard';
    case 'terminal_operator':
    case 'terminal_logistics_operator':
      return '/terminal/dashboard';
    case 'gate_officer':
    case 'gate_truck_officer':
      return '/gate/dashboard';
    default:
      return '/login';
  }
};

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { isAuthenticated, isAuthLoading, activeRole } = useApp();
  const location = useLocation();
  const storedSession = getStoredSession();

  // Protect against browser Back-Forward Cache (BFCache) page restorations
  useEffect(() => {
    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted && (!isAuthenticated || !getStoredSession())) {
        window.location.href = '/login';
      }
    };
    window.addEventListener('pageshow', handlePageShow);
    return () => window.removeEventListener('pageshow', handlePageShow);
  }, [isAuthenticated]);

  // Loading state only applies if there is a candidate session being verified
  if (isAuthLoading && storedSession) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-center space-y-4 font-sans selection:bg-[#D49A24] selection:text-white">
        <div className="w-12 h-12 rounded-2xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center animate-pulse">
          <div className="w-6 h-6 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
        </div>
        <div className="space-y-1">
          <h2 className="text-base font-bold text-white tracking-wide">PORTIDE Platform</h2>
          <p className="text-xs text-slate-400 font-medium">Initializing secure session and restoring user context...</p>
        </div>
      </div>
    );
  }

  // 1. Authentication Check - must be authenticated and have valid active stored session
  if (!isAuthenticated || !storedSession) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 2. Role Authorization Check
  if (allowedRoles && allowedRoles.length > 0) {
    const isRoleAllowed = allowedRoles.some(
      r => r.toLowerCase() === (activeRole || '').toLowerCase()
    );

    if (!isRoleAllowed) {
      const redirectRoute = getDefaultDashboardRoute(activeRole);
      return <Navigate to={redirectRoute} replace />;
    }
  }

  return <>{children}</>;
};
