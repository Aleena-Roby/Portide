import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { USER_ROLES_INFO } from '../../data/mockData';
import { PortideLogo } from './PortideLogo';
import { 
  LayoutDashboard, 
  Ship, 
  Boxes, 
  Truck, 
  ChevronRight, 
  Radio, 
  FileCheck,
  Users,
  Shield,
  X,
  LogOut,
  User,
  Anchor,
  Clock
} from 'lucide-react';

interface SidebarProps {
  isSidebarOpen: boolean;
  setIsSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isSidebarOpen,
  setIsSidebarOpen,
  setActiveTab
}) => {
  const { activeRole, isDarkMode, currentUser, logoutUser } = useApp();
  const navigate = useNavigate();
  const location = useLocation();

  const roleInfo = USER_ROLES_INFO.find(r => r.id === activeRole) || USER_ROLES_INFO[0];

  const getRoleBasePath = () => {
    switch (activeRole) {
      case 'admin':
      case 'port_administrator':
        return '/admin';
      case 'shipping_company':
        return '/shipping';
      case 'operations_officer':
      case 'port_operations_officer':
        return '/operations';
      case 'customs_officer':
        return '/customs';
      case 'terminal_operator':
      case 'terminal_logistics_operator':
        return '/terminal';
      case 'gate_officer':
      case 'gate_truck_officer':
        return '/gate';
      default:
        return '/admin';
    }
  };

  const basePath = getRoleBasePath();

  // Role-specific navigation tabs
  const getNavItems = () => {
    switch (activeRole) {
      case 'admin':
      case 'port_administrator':
        return [
          { id: 'overview', label: 'Dashboard', icon: LayoutDashboard, path: `${basePath}/dashboard` },
          { id: 'berths', label: 'Berth Management', icon: Anchor, path: `${basePath}/berths` },
          { id: 'company-approvals', label: 'Company Approvals', icon: FileCheck, path: `${basePath}/company-approvals` },
          { id: 'users', label: 'User & Registration', icon: Users, path: `${basePath}/users` },
          { id: 'audit', label: 'Security & Audit Logs', icon: Shield, path: `${basePath}/audit` }
        ];
      case 'shipping_company':
        return [
          { id: 'overview', label: 'Dashboard', icon: LayoutDashboard, path: `${basePath}/dashboard` },
          { id: 'vessels', label: 'Vessel Management', icon: Ship, path: `${basePath}/vessels` },
          { id: 'arrival-requests', label: 'Arrival Requests', icon: FileCheck, path: `${basePath}/arrival-requests` }
        ];
      case 'operations_officer':
      case 'port_operations_officer':
        return [
          { id: 'overview', label: 'Dashboard', icon: LayoutDashboard, path: `${basePath}/dashboard` },
          { id: 'berth-availability', label: 'Berth Availability', icon: Anchor, path: `${basePath}/berth-availability` },
          { id: 'arrival-requests', label: 'Vessel Arrival Requests', icon: FileCheck, path: `${basePath}/arrival-requests` },
          { id: 'scheduling', label: 'Berth & Scheduling', icon: Clock, path: `${basePath}/scheduling` },
          { id: 'vessels', label: 'Vessel Directory', icon: Ship, path: `${basePath}/vessels` }
        ];
      case 'customs_officer':
        return [
          { id: 'overview', label: 'Dashboard', icon: LayoutDashboard, path: `${basePath}/dashboard` },
          { id: 'clearance', label: 'Cargo Management', icon: Boxes, path: `${basePath}/clearance` }
        ];
      case 'terminal_operator':
      case 'terminal_logistics_operator':
        return [
          { id: 'overview', label: 'Dashboard', icon: LayoutDashboard, path: `${basePath}/dashboard` },
          { id: 'containers', label: 'Cargo Management', icon: Boxes, path: `${basePath}/containers` }
        ];
      case 'gate_officer':
      case 'gate_truck_officer':
        return [
          { id: 'overview', label: 'Dashboard', icon: LayoutDashboard, path: `${basePath}/dashboard` },
          { id: 'trucks', label: 'Gate Operations', icon: Truck, path: `${basePath}/trucks` }
        ];
      default:
        return [
          { id: 'overview', label: 'Dashboard', icon: LayoutDashboard, path: `${basePath}/dashboard` }
        ];
    }
  };

  const getRoleIdentity = (roleId: string) => {
    switch (roleId) {
      case 'admin':
      case 'port_administrator':
        return { label: 'PORT ADMINISTRATOR', title: 'Port Administrator' };
      case 'shipping_company':
        return { label: 'SHIPPING COMPANY / SHIPPING AGENT', title: 'Shipping Company' };
      case 'operations_officer':
      case 'port_operations_officer':
        return { label: 'PORT OPERATIONS OFFICER', title: 'Port Operations Officer' };
      case 'customs_officer':
        return { label: 'CUSTOMS AUTHORITY', title: 'Customs Authority' };
      case 'terminal_operator':
      case 'terminal_logistics_operator':
        return { label: 'TERMINAL & LOGISTICS OPERATOR', title: 'Terminal & Logistics Operator' };
      case 'gate_officer':
      case 'gate_truck_officer':
        return { label: 'GATE OPERATIONS OFFICER', title: 'Gate Operations Officer' };
      default:
        return { label: (roleInfo.name || 'PORT USER').toUpperCase(), title: roleInfo.name || 'Port User' };
    }
  };

  const roleIdentity = getRoleIdentity(activeRole);
  const navItems = getNavItems();

  const handleNavClick = (item: { id: string; path: string }) => {
    setActiveTab(item.id);
    navigate(item.path);
    setIsSidebarOpen(false);
  };

  return (
    <aside
      className={`fixed lg:static inset-y-0 left-0 z-40 w-64 bg-[#f4f7fb] dark:bg-slate-900 text-slate-800 dark:text-slate-300 border-r border-slate-200/90 dark:border-slate-800 flex flex-col justify-between transition-transform duration-300 transform shadow-xl lg:shadow-none ${
        isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}
    >
      <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
        {/* Brand Header */}
        <div className="h-16 px-5 flex items-center justify-between border-b border-slate-200/90 dark:border-slate-800/80 shrink-0">
          <PortideLogo 
            variant="sidebar" 
            theme={isDarkMode ? 'dark' : 'light'}
          />
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="lg:hidden p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
            title="Close Drawer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Active Role Card */}
        <div className="p-3.5 mx-3 my-3 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200/90 dark:border-slate-700/80 space-y-1 shadow-xs shrink-0">
          <div className="text-[10px] uppercase font-black text-sky-600 dark:text-sky-400 tracking-wider flex items-center gap-1.5">
            <Radio className="w-3 h-3 text-sky-500 animate-pulse" />
            <span>{roleIdentity.label}</span>
          </div>
          <div className="text-xs font-bold text-slate-900 dark:text-white truncate">{roleIdentity.title}</div>
        </div>

        {/* Navigation Section */}
        <div className="px-3 py-2 flex-1">
          <div className="px-3 mb-2 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            NAVIGATION MENU
          </div>
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path || 
                (item.id === 'overview' && (location.pathname === basePath || location.pathname === `${basePath}/`));
              
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[#e0f2fe] dark:bg-sky-500 text-sky-700 dark:text-white font-bold shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800/60 font-medium'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-sky-600 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`} />
                    <span className="truncate">{item.label}</span>
                  </div>
                  {isActive && <ChevronRight className="w-3.5 h-3.5 text-sky-600 dark:text-white" />}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Mobile Footer / User Info & Logout */}
        <div className="p-3 m-3 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200/90 dark:border-slate-700/80 space-y-2 lg:hidden shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-sky-500 text-white font-black text-xs flex items-center justify-center shrink-0">
              {(currentUser?.name || 'U').charAt(0)}
            </div>
            <div className="overflow-hidden">
              <div className="text-xs font-bold text-slate-900 dark:text-white truncate">{currentUser?.name || 'User'}</div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{currentUser?.email || ''}</div>
            </div>
          </div>
          <button
            onClick={async () => {
              setIsSidebarOpen(false);
              await logoutUser();
              navigate('/login');
            }}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Logout</span>
          </button>
        </div>

      </div>
    </aside>
  );
};

