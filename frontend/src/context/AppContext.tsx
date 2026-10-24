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
  registerSessionExpiredHandler,
  StoredSession 
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
  fetchNotifications: () => Promise<void>;
  markNotificationAsRead: (id: string | number) => Promise<void>;
  markAllNotificationsAsRead: () => Promise<void>;
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
  const initialSession = getStoredSession();
  const [currentView, setCurrentView] = useState<CurrentView>('landing');
  const [activeRole, setActiveRole] = useState<UserRole>(() => (initialSession?.role as UserRole) || 'port_administrator');
  const [currentUser, setCurrentUser] = useState<PortUser>(() => initialSession ? {
    id: initialSession.id,
    name: initialSession.name,
    email: initialSession.email,
    phone: initialSession.phone || '',
    role: initialSession.role as UserRole,
    organisation: initialSession.organisation || 'PORTIDE Port Authority',
    status: (initialSession.status as any) || 'active',
    createdAt: new Date().toISOString().substring(0, 10),
    mustChangePassword: !!initialSession.mustChangePassword
  } : {
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

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => !!initialSession);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(() => !initialSession);
  const [mustChangePassword, setMustChangePassword] = useState<boolean>(() => !!initialSession?.mustChangePassword);

  const restoreStoredSession = (session: StoredSession) => {
    const isMustChange = !!session.mustChangePassword;
    const portUser: PortUser = {
      id: session.id,
      name: session.name,
      email: session.email,
      role: session.role as UserRole,
      organisation: session.organisation || 'PORTIDE Port Authority',
      phone: session.phone || '',
      status: 'active',
      createdAt: new Date().toISOString().substring(0, 10),
      mustChangePassword: isMustChange
    };
    setCurrentUser(portUser);
    setActiveRole(session.role as UserRole);
    setIsAuthenticated(true);
    setMustChangePassword(isMustChange);
  };

  // Check auth session on app mount
  const checkAuthSession = async () => {
    const storedSession = getStoredSession();
    
    if (!storedSession) {
      setIsAuthenticated(false);
      setMustChangePassword(false);
      setIsAuthLoading(false);
      return;
    }

    try {
      const res = await apiFetch('/api/auth/me/');
      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data && data.status === 'success' && data.data) {
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
          return;
        }
      }
      
      // If server explicitly returned HTTP 401 Unauthorized, invalidate session
      if (res.status === 401) {
        clearStoredSession();
        setIsAuthenticated(false);
        setMustChangePassword(false);
        return;
      }

      // For any non-401 responses (e.g. 502 Bad Gateway during Render spin up, 500, network error),
      // keep the authenticated session active without logging the user out!
      restoreStoredSession(storedSession);
    } catch {
      // Offline fallback: restore valid stored session if available
      restoreStoredSession(storedSession);
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

  const fetchNotifications = async () => {
    if (!isAuthenticated) return;
    try {
      const res = await apiFetch('/api/notifications/');
      if (res.ok) {
        const json = await res.json();
        if (json.status === 'success' && Array.isArray(json.data)) {
          const mapped: NotificationItem[] = json.data.map((item: any) => ({
            id: item.notification_id,
            title: item.notification_title,
            message: item.notification_message,
            time: item.created_at_human || 'Recent',
            type: (item.notification_type === 'danger' ? 'alert' : item.notification_type) as any,
            read: !!item.notification_is_read,
            roleTarget: item.notification_recipient_role || 'all',
            category: item.notification_category,
            action_route: item.notification_action_route,
            target_type: item.notification_target_type,
            target_id: item.notification_target_id,
            event_key: item.notification_event_key
          }));
          setNotifications(mapped);
        }
      }
    } catch {
      // Graceful background sync
    }
  };

  const markNotificationAsRead = async (id: string | number) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    if (typeof id === 'number' || !String(id).startsWith('notif-')) {
      try {
        await apiFetch(`/api/notifications/${id}/read/`, { method: 'POST' });
      } catch {
        // Silently persist
      }
    }
  };

  const markAllNotificationsAsRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    try {
      await apiFetch('/api/notifications/read-all/', { method: 'POST' });
    } catch {
      // Silently persist
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 30000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, activeRole]);

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
      fetchNotifications,
      markNotificationAsRead,
      markAllNotificationsAsRead,
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
