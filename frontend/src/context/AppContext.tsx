import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  UserRole, 
  PortUser, 
  NotificationItem, 
  ToastAlert 
} from '../types';
import { 
  apiFetch, 
  getStoredSession, 
  setStoredSession, 
  clearStoredSession, 
  registerSessionExpiredHandler 
} from '../services/api';

export type CurrentView = 'landing' | 'login' | 'register' | 'forgot-password' | 'reset-password' | 'dashboard';

interface AppContextType {
  currentView: CurrentView;
  setCurrentView: (view: CurrentView) => void;
  activeRole: UserRole;
  setActiveRole: (role: UserRole) => void;
  currentUser: PortUser;
  setCurrentUser: (user: PortUser) => void;
  isDarkMode: boolean;
  setIsDarkMode: (dark: boolean | ((prev: boolean) => boolean)) => void;
  toggleDarkMode: () => void;
  
  // Real-time notification & toast alerts
  notifications: NotificationItem[];
  addNotification: (title: string, message: string, type?: NotificationItem['type']) => void;
  toasts: ToastAlert[];
  addToast: (type: ToastAlert['type'] | string, title?: string, message?: string) => void;
  removeToast: (id: string) => void;
  globalSearchQuery: string;
  setGlobalSearchQuery: (query: string) => void;

  // Centralized Session State & Methods
  isAuthenticated: boolean;
  isAuthLoading: boolean;
  mustChangePassword: boolean;
  setMustChangePassword: (mustChange: boolean) => void;
  loginUser: (emailInput: string, passwordInput: string) => Promise<{ 
    success: boolean; 
    message?: string; 
    role?: string;
    must_change_password?: boolean;
    registration_status?: string;
    registration_request_id?: number | string;
  }>;
  logoutUser: (silent?: boolean) => Promise<void>;
  checkAuthSession: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentView, setCurrentView] = useState<CurrentView>('landing');
  const [activeRole, setActiveRole] = useState<UserRole>('port_administrator');
  const [currentUser, setCurrentUser] = useState<PortUser>({
    id: '',
    name: '',
    email: '',
    phone: '',
    role: 'port_administrator',
    organisation: '',
    status: 'pending',
    createdAt: ''
  });
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [toasts, setToasts] = useState<ToastAlert[]>([]);
  const [globalSearchQuery, setGlobalSearchQuery] = useState<string>('');

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);
  const [mustChangePassword, setMustChangePassword] = useState<boolean>(false);

  // Check auth session on app mount
  const checkAuthSession = async () => {
    setIsAuthLoading(true);
    const storedSession = getStoredSession();
    
    if (!storedSession) {
      setIsAuthenticated(false);
      setMustChangePassword(false);
      setIsAuthLoading(false);
      return;
    }

    try {
      const res = await apiFetch('/api/auth/me/');
      const data = await res.json();
      
      if (res.ok && data.status === 'success') {
        const u = data.data;
        const isMustChange = !!u.must_change_password;
        const portUser: PortUser = {
          id: String(u.login_id),
          name: u.full_name,
          email: u.email,
          role: u.role as UserRole,
          organisation: u.company_name || 'PORTIDE Port Authority',
          phone: u.phone || '',
          status: 'active',
          createdAt: new Date().toISOString().substring(0, 10),
          mustChangePassword: isMustChange
        };
        setCurrentUser(portUser);
        setActiveRole(u.role as UserRole);
        setIsAuthenticated(true);
        setMustChangePassword(isMustChange);
        setStoredSession({
          id: portUser.id,
          name: portUser.name,
          email: portUser.email,
          role: portUser.role,
          organisation: portUser.organisation,
          phone: portUser.phone,
          status: portUser.status,
          mustChangePassword: isMustChange
        });
      } else {
        clearStoredSession();
        setIsAuthenticated(false);
        setMustChangePassword(false);
      }
    } catch {
      // Offline fallback: restore valid stored session if available
      try {
        const isMustChange = !!storedSession.mustChangePassword;
        const portUser: PortUser = {
          id: storedSession.id,
          name: storedSession.name,
          email: storedSession.email,
          role: storedSession.role as UserRole,
          organisation: storedSession.organisation || 'PORTIDE Port Authority',
          phone: storedSession.phone || '',
          status: 'active',
          createdAt: new Date().toISOString().substring(0, 10),
          mustChangePassword: isMustChange
        };
        setCurrentUser(portUser);
        setActiveRole(storedSession.role as UserRole);
        setIsAuthenticated(true);
        setMustChangePassword(isMustChange);
      } catch {
        clearStoredSession();
        setIsAuthenticated(false);
        setMustChangePassword(false);
      }
    } finally {
      setIsAuthLoading(false);
    }
  };

  useEffect(() => {
    registerSessionExpiredHandler((msg) => {
      setIsAuthenticated(false);
      addToast('warning', 'Session Expired', msg);
    });
    checkAuthSession();
  }, []);

  const loginUser = async (emailInput: string, passwordInput: string): Promise<{ 
    success: boolean; 
    message?: string; 
    role?: string;
    must_change_password?: boolean;
    registration_status?: string;
    registration_request_id?: number | string;
  }> => {
    try {
      const response = await apiFetch('/api/auth/login/', {
        method: 'POST',
        body: JSON.stringify({ email: emailInput.trim().toLowerCase(), password: passwordInput })
      });
      const result = await response.json();

      if (response.ok && result.status === 'success') {
        const authData = result.data;
        const userRole = authData.role as UserRole;
        const isMustChange = !!authData.must_change_password;
        const portUser: PortUser = {
          id: String(authData.login_id),
          name: authData.full_name,
          email: authData.email,
          role: userRole,
          organisation: authData.company_name || 'PORTIDE Port Authority',
          phone: authData.phone || '',
          status: 'active',
          createdAt: new Date().toISOString().substring(0, 10),
          mustChangePassword: isMustChange
        };
        setCurrentUser(portUser);
        setActiveRole(userRole);
        setIsAuthenticated(true);
        setMustChangePassword(isMustChange);
        setStoredSession({
          id: portUser.id,
          name: portUser.name,
          email: portUser.email,
          role: portUser.role,
          organisation: portUser.organisation,
          phone: portUser.phone,
          status: portUser.status,
          mustChangePassword: isMustChange
        });
        addToast('success', 'Login Successful', `Welcome back, ${authData.full_name}`);
        return { success: true, role: userRole, must_change_password: isMustChange };
      } else {
        return { 
          success: false, 
          message: result.message || 'Invalid email or password.',
          registration_status: result.registration_status,
          registration_request_id: result.registration_request_id
        };
      }
    } catch {
      return { success: false, message: 'Unable to connect to backend server. Please verify Django is running.' };
    }
  };

  const logoutUser = async (silent: boolean = false) => {
    clearStoredSession();
    setIsAuthenticated(false);
    setMustChangePassword(false);
    setCurrentUser({
      id: '',
      name: '',
      email: '',
      phone: '',
      role: 'port_administrator',
      organisation: '',
      status: 'pending',
      createdAt: ''
    });

    if (!silent) {
      addToast('info', 'Logged Out', 'Signed out from Portide Enterprise.');
    }

    try {
      await apiFetch('/api/auth/logout/', {
        method: 'POST'
      });
    } catch {
      // Ignore network failures on logout
    }
  };

  const toggleDarkMode = () => setIsDarkMode(prev => !prev);

  const addToast = (type: ToastAlert['type'] | string, title?: string, message?: string) => {
    let resolvedType: ToastAlert['type'] = 'info';
    let resolvedTitle = '';
    let resolvedMessage = '';

    if (message !== undefined) {
      resolvedType = (['success', 'warning', 'error', 'info'].includes(type) ? type : 'info') as ToastAlert['type'];
      resolvedTitle = title || '';
      resolvedMessage = message;
    } else if (title !== undefined) {
      if (['success', 'warning', 'error', 'info'].includes(title)) {
        resolvedType = title as ToastAlert['type'];
        resolvedTitle = resolvedType.charAt(0).toUpperCase() + resolvedType.slice(1);
        resolvedMessage = type;
      } else if (['success', 'warning', 'error', 'info'].includes(type)) {
        resolvedType = type as ToastAlert['type'];
        resolvedTitle = resolvedType.charAt(0).toUpperCase() + resolvedType.slice(1);
        resolvedMessage = title;
      } else {
        resolvedType = 'info';
        resolvedTitle = type;
        resolvedMessage = title;
      }
    } else {
      resolvedType = 'info';
      resolvedTitle = 'Notification';
      resolvedMessage = type;
    }

    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    setToasts(prev => [...prev, { id, type: resolvedType, title: resolvedTitle, message: resolvedMessage }]);

    setTimeout(() => {
      removeToast(id);
    }, 4500);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const addNotification = (title: string, message: string, type: NotificationItem['type'] = 'info') => {
    const newNotif: NotificationItem = {
      id: `notif-${Date.now()}`,
      title,
      message,
      time: 'Just now',
      type,
      read: false,
      roleTarget: 'all'
    };
    setNotifications(prev => [newNotif, ...prev]);
  };

  return (
    <AppContext.Provider value={{
      currentView,
      setCurrentView,
      activeRole,
      setActiveRole,
      currentUser,
      setCurrentUser,
      isDarkMode,
      setIsDarkMode,
      toggleDarkMode,
      notifications,
      addNotification,
      toasts,
      addToast,
      removeToast,
      globalSearchQuery,
      setGlobalSearchQuery,
      isAuthenticated,
      isAuthLoading,
      mustChangePassword,
      setMustChangePassword,
      loginUser,
      logoutUser,
      checkAuthSession
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
