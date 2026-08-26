import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  UserRole, 
  PortUser, 
  Vessel, 
  Berth, 
  Container, 
  CustomsDocument, 
  GatePass, 
  NotificationItem, 
  ActivityLog, 
  ToastAlert 
} from '../types';
import { 
  INITIAL_USERS, 
  INITIAL_VESSELS, 
  INITIAL_BERTHS, 
  INITIAL_CONTAINERS, 
  INITIAL_CUSTOMS_DOCS, 
  INITIAL_GATE_PASSES, 
  INITIAL_NOTIFICATIONS, 
  INITIAL_ACTIVITY_LOGS 
} from '../data/mockData';
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
  
  // Data lists & CRUD methods
  users: PortUser[];
  vessels: Vessel[];
  berths: Berth[];
  containers: Container[];
  customsDocs: CustomsDocument[];
  gatePasses: GatePass[];
  notifications: NotificationItem[];
  activityLogs: ActivityLog[];
  toasts: ToastAlert[];
  globalSearchQuery: string;
  setGlobalSearchQuery: (query: string) => void;

  // Centralized Session State & Methods
  isAuthenticated: boolean;
  isAuthLoading: boolean;
  loginUser: (emailInput: string, passwordInput: string) => Promise<{ success: boolean; message?: string }>;
  logoutUser: () => Promise<void>;
  checkAuthSession: () => Promise<void>;

  // Actions
  addToast: (type: ToastAlert['type'], title: string, message: string) => void;
  removeToast: (id: string) => void;
  registerVessel: (vessel: Omit<Vessel, 'id'>) => void;
  assignBerth: (vesselId: string, berthId: string) => void;
  approveCustomsDoc: (docId: string, notes?: string) => void;
  rejectCustomsDoc: (docId: string, reason: string) => void;
  generateGatePass: (pass: Omit<GatePass, 'id' | 'issuedAt' | 'status'>) => void;
  approveGateEntry: (passId: string) => void;
  approveGateExit: (passId: string) => void;
  moveContainer: (containerId: string, newZone: string, newSlot: string) => void;
  addUser: (user: Omit<PortUser, 'id' | 'createdAt'>) => void;
  approveUserRegistration: (userId: string) => void;
  addNotification: (title: string, message: string, type?: NotificationItem['type']) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentView, setCurrentView] = useState<CurrentView>('landing');
  const [activeRole, setActiveRole] = useState<UserRole>('port_administrator');
  const [users, setUsers] = useState<PortUser[]>(INITIAL_USERS);
  const [currentUser, setCurrentUser] = useState<PortUser>({
    id: '',
    name: '',
    email: '',
    role: 'port_administrator',
    organisation: '',
    status: 'pending',
    createdAt: ''
  });
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);

  const [vessels, setVessels] = useState<Vessel[]>(INITIAL_VESSELS);
  const [berths, setBerths] = useState<Berth[]>(INITIAL_BERTHS);
  const [containers, setContainers] = useState<Container[]>(INITIAL_CONTAINERS);
  const [customsDocs, setCustomsDocs] = useState<CustomsDocument[]>(INITIAL_CUSTOMS_DOCS);
  const [gatePasses, setGatePasses] = useState<GatePass[]>(INITIAL_GATE_PASSES);
  const [notifications, setNotifications] = useState<NotificationItem[]>(INITIAL_NOTIFICATIONS);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>(INITIAL_ACTIVITY_LOGS);
  const [toasts, setToasts] = useState<ToastAlert[]>([]);
  const [globalSearchQuery, setGlobalSearchQuery] = useState<string>('');

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);

  // Check auth session on app mount
  const checkAuthSession = async () => {
    setIsAuthLoading(true);
    const storedSession = getStoredSession();
    
    if (!storedSession) {
      setIsAuthenticated(false);
      setIsAuthLoading(false);
      return;
    }

    try {
      const res = await apiFetch('/api/auth/me/');
      const data = await res.json();
      
      if (res.ok && data.status === 'success') {
        const u = data.data;
        const portUser: PortUser = {
          id: String(u.login_id),
          name: u.full_name,
          email: u.email,
          role: u.role as UserRole,
          organisation: u.company_name || 'PORTIDE Port Authority',
          phone: '+1-555-0100',
          status: 'active',
          createdAt: new Date().toISOString().substring(0, 10)
        };
        setCurrentUser(portUser);
        setActiveRole(u.role as UserRole);
        setIsAuthenticated(true);
        setStoredSession({
          id: portUser.id,
          name: portUser.name,
          email: portUser.email,
          role: portUser.role,
          organisation: portUser.organisation,
          status: portUser.status
        });
      } else {
        clearStoredSession();
        setIsAuthenticated(false);
      }
    } catch {
      // Offline fallback: restore valid stored session if available
      try {
        const portUser: PortUser = {
          id: storedSession.id,
          name: storedSession.name,
          email: storedSession.email,
          role: storedSession.role as UserRole,
          organisation: storedSession.organisation || 'PORTIDE Port Authority',
          phone: '+1-555-0100',
          status: 'active',
          createdAt: new Date().toISOString().substring(0, 10)
        };
        setCurrentUser(portUser);
        setActiveRole(storedSession.role as UserRole);
        setIsAuthenticated(true);
      } catch {
        clearStoredSession();
        setIsAuthenticated(false);
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

  const loginUser = async (emailInput: string, passwordInput: string): Promise<{ success: boolean; message?: string }> => {
    try {
      const response = await apiFetch('/api/auth/login/', {
        method: 'POST',
        body: JSON.stringify({ email: emailInput.trim().toLowerCase(), password: passwordInput })
      });
      const result = await response.json();

      if (response.ok && result.status === 'success') {
        const authData = result.data;
        const portUser: PortUser = {
          id: String(authData.login_id),
          name: authData.full_name,
          email: authData.email,
          role: authData.role as UserRole,
          organisation: authData.company_name || 'PORTIDE Port Authority',
          phone: '+1-555-0100',
          status: 'active',
          createdAt: new Date().toISOString().substring(0, 10)
        };
        setCurrentUser(portUser);
        setActiveRole(authData.role as UserRole);
        setIsAuthenticated(true);
        setStoredSession({
          id: portUser.id,
          name: portUser.name,
          email: portUser.email,
          role: portUser.role,
          organisation: portUser.organisation,
          status: portUser.status
        });
        addToast('success', 'Login Successful', `Welcome back, ${authData.full_name}`);
        return { success: true };
      } else {
        return { success: false, message: result.message || 'Invalid email or password.' };
      }
    } catch {
      return { success: false, message: 'Unable to connect to backend server. Please verify Django is running.' };
    }
  };

  const logoutUser = async () => {
    try {
      await apiFetch('/api/auth/logout/', {
        method: 'POST'
      });
    } catch {
      // Ignore network failures on logout
    } finally {
      clearStoredSession();
      setIsAuthenticated(false);
      addToast('info', 'Logged Out', 'Signed out from Portide Enterprise.');
    }
  };

  const toggleDarkMode = () => setIsDarkMode(prev => !prev);

  const addToast = (type: ToastAlert['type'], title: string, message: string) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    setToasts(prev => [...prev, { id, type, title, message }]);

    setTimeout(() => {
      removeToast(id);
    }, 4500);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const logActivity = (action: string, target: string, type: ActivityLog['type']) => {
    const newLog: ActivityLog = {
      id: `act-${Date.now()}`,
      user: currentUser.name,
      role: currentUser.organisation,
      action,
      target,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
      type
    };
    setActivityLogs(prev => [newLog, ...prev]);
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

  const registerVessel = (vesselData: Omit<Vessel, 'id'>) => {
    const id = `vsl-${String(vessels.length + 1).padStart(3, '0')}`;
    const newVessel: Vessel = { ...vesselData, id };
    setVessels(prev => [newVessel, ...prev]);
    logActivity('Registered Vessel', newVessel.name, 'vessel');
    addNotification('New Vessel Registered', `${newVessel.name} (${newVessel.imo}) registered by ${newVessel.shippingCompany}.`, 'info');
    addToast('success', 'Vessel Registered', `${newVessel.name} successfully registered.`);
  };

  const assignBerth = (vesselId: string, berthId: string) => {
    const vessel = vessels.find(v => v.id === vesselId);
    const berth = berths.find(b => b.id === berthId);

    if (!vessel || !berth) return;

    setBerths(prev => prev.map(b => {
      if (b.id === berthId) {
        return {
          ...b,
          status: 'Occupied',
          currentVesselId: vessel.id,
          currentVesselName: vessel.name,
          occupancyPercent: 85
        };
      }
      return b;
    }));

    setVessels(prev => prev.map(v => {
      if (v.id === vesselId) {
        return {
          ...v,
          status: 'At Berth',
          assignedBerthId: berth.id,
          assignedBerthName: berth.name
        };
      }
      return v;
    }));

    logActivity('Assigned Berth', `${berth.name} → ${vessel.name}`, 'berth');
    addNotification('Berth Assigned', `${berth.name} assigned to ${vessel.name}`, 'success');
    addToast('success', 'Berth Allocated', `${vessel.name} is now allocated to ${berth.name}.`);
  };

  const approveCustomsDoc = (docId: string, notes?: string) => {
    setCustomsDocs(prev => prev.map(d => {
      if (d.id === docId) {
        return {
          ...d,
          status: 'Approved',
          officerNotes: notes || 'Cleared by Customs Inspector'
        };
      }
      return d;
    }));

    const doc = customsDocs.find(d => d.id === docId);
    if (doc) {
      logActivity('Approved Customs Declaration', doc.id, 'customs');
      addNotification('Customs Approved', `Declaration ${doc.id} approved for ${doc.vesselName}.`, 'success');
      addToast('success', 'Customs Cleared', `Declaration ${doc.id} approved.`);
    }
  };

  const rejectCustomsDoc = (docId: string, reason: string) => {
    setCustomsDocs(prev => prev.map(d => {
      if (d.id === docId) {
        return {
          ...d,
          status: 'Rejected',
          rejectionReason: reason
        };
      }
      return d;
    }));

    const doc = customsDocs.find(d => d.id === docId);
    if (doc) {
      logActivity('Rejected Customs Declaration', doc.id, 'customs');
      addNotification('Customs Rejected', `Declaration ${doc.id} rejected: ${reason}`, 'warning');
      addToast('error', 'Customs Declaration Rejected', `Reason: ${reason}`);
    }
  };

  const generateGatePass = (passData: Omit<GatePass, 'id' | 'issuedAt' | 'status'>) => {
    const passNumber = Math.floor(1000 + Math.random() * 9000);
    const id = `GP-${passNumber}`;
    const newPass: GatePass = {
      ...passData,
      id,
      issuedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
      status: 'Generated',
      qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${id}`
    };

    setGatePasses(prev => [newPass, ...prev]);
    logActivity('Generated Gate Pass', `${id} (${newPass.truckPlate})`, 'gate');
    addNotification('Gate Pass Generated', `Pass ${id} generated for truck ${newPass.truckPlate}.`, 'info');
    addToast('success', 'Gate Pass Created', `Pass ${id} generated for ${newPass.truckPlate}.`);
  };

  const approveGateEntry = (passId: string) => {
    setGatePasses(prev => prev.map(p => p.id === passId ? { ...p, status: 'In Terminal' } : p));
    const pass = gatePasses.find(p => p.id === passId);
    if (pass) {
      logActivity('Gate Entry Approved', `${pass.id} (${pass.truckPlate})`, 'gate');
      addToast('success', 'Truck Entry Approved', `Truck ${pass.truckPlate} admitted into Terminal.`);
    }
  };

  const approveGateExit = (passId: string) => {
    setGatePasses(prev => prev.map(p => p.id === passId ? { ...p, status: 'Completed' } : p));
    const pass = gatePasses.find(p => p.id === passId);
    if (pass) {
      logActivity('Gate Exit Approved', `${pass.id} (${pass.truckPlate})`, 'gate');
      addToast('success', 'Truck Exit Approved', `Truck ${pass.truckPlate} departure logged.`);
    }
  };

  const moveContainer = (containerId: string, newZone: string, newSlot: string) => {
    setContainers(prev => prev.map(c => {
      if (c.id === containerId) {
        return {
          ...c,
          yardZone: newZone,
          baySlot: newSlot,
          status: 'In Yard'
        };
      }
      return c;
    }));

    logActivity('Container Re-located', `${containerId} → ${newZone}`, 'system');
    addToast('info', 'Container Moved', `Container ${containerId} transferred to ${newZone} (${newSlot}).`);
  };

  const addUser = (userData: Omit<PortUser, 'id' | 'createdAt'>) => {
    const id = `usr-${Date.now().toString().slice(-4)}`;
    const newUser: PortUser = {
      ...userData,
      id,
      createdAt: new Date().toISOString().substring(0, 10)
    };
    setUsers(prev => [newUser, ...prev]);
    logActivity('Added System User', `${newUser.name} (${newUser.role})`, 'user');
    addToast('success', 'User Added', `${newUser.name} account registered.`);
  };

  const approveUserRegistration = (userId: string) => {
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, status: 'active' } : u));
    const user = users.find(u => u.id === userId);
    if (user) {
      logActivity('Approved User Account', user.email, 'user');
      addToast('success', 'User Approved', `${user.name} is now approved for platform access.`);
    }
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
      users,
      vessels,
      berths,
      containers,
      customsDocs,
      gatePasses,
      notifications,
      activityLogs,
      toasts,
      globalSearchQuery,
      setGlobalSearchQuery,
      isAuthenticated,
      isAuthLoading,
      loginUser,
      logoutUser,
      checkAuthSession,
      addToast,
      removeToast,
      registerVessel,
      assignBerth,
      approveCustomsDoc,
      rejectCustomsDoc,
      generateGatePass,
      approveGateEntry,
      approveGateExit,
      moveContainer,
      addUser,
      approveUserRegistration,
      addNotification
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
