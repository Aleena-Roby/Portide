import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { USER_ROLES_INFO } from '../../data/rolesConfig';
import { PortideLogo } from './PortideLogo';
import { 
  LayoutDashboard, 
  Ship, 
  Boxes, 
  Truck, 
  ChevronRight, 
  ChevronDown,
  Radio, 
  FileCheck,
  Users,
  Shield,
  X,
  LogOut,
  User,
  Anchor,
  Clock,
  QrCode,
  ShieldCheck,
  Warehouse,
  MapPin,
  MoveHorizontal,
  ArrowDownToLine,
  BarChart3,
  Sliders
} from 'lucide-react';

interface NavChildItem {
  id: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  path: string;
}

interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
  children?: NavChildItem[];
}

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
          { id: 'analytics', label: 'Port Telemetry & Analytics', icon: BarChart3, path: `${basePath}/analytics` },
          { id: 'berths', label: 'Berth Management', icon: Anchor, path: `${basePath}/berths` },
          { id: 'master-data', label: 'Master Infrastructure Registry', icon: Sliders, path: `${basePath}/master-data` },
          { id: 'company-approvals', label: 'Company Approvals', icon: FileCheck, path: `${basePath}/company-approvals` },
          { id: 'users', label: 'User & Registration', icon: Users, path: `${basePath}/users` },
          { id: 'gate-passes', label: 'Gate Passes Monitor', icon: Truck, path: `${basePath}/gate-passes` },
          { id: 'audit', label: 'Security & Audit Logs', icon: Shield, path: `${basePath}/audit` }
        ];
      case 'shipping_company':
        return [
          { id: 'overview', label: 'Dashboard', icon: LayoutDashboard, path: `${basePath}/dashboard` },
          { id: 'vessels', label: 'Vessel Management', icon: Ship, path: `${basePath}/vessels` },
          { id: 'arrival-requests', label: 'Arrival Requests', icon: FileCheck, path: `${basePath}/arrival-requests` },
          { id: 'cargo', label: 'Cargo Registration', icon: Boxes, path: `${basePath}/cargo` }
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
          { id: 'overview', label: 'Dashboard Overview', icon: LayoutDashboard, path: `${basePath}/dashboard` },
          { id: 'normal-review', label: 'Normal Customs Review', icon: ShieldCheck, path: `${basePath}/normal-review` },
          { id: 'pre-arrival', label: 'Pre-Arrival Review', icon: FileCheck, path: `${basePath}/pre-arrival` },
          { id: 'cargo-management', label: 'Cargo Manifest Oversight', icon: Boxes, path: `${basePath}/cargo-management` },
          { id: 'decision-history', label: 'Customs Decision History', icon: Clock, path: `${basePath}/decision-history` }
        ];
      case 'terminal_operator':
      case 'terminal_logistics_operator':
        return [
          { id: 'overview', label: 'Dashboard', icon: LayoutDashboard, path: `${basePath}/dashboard` },
          { id: 'unloading-operations', label: 'Unloading Operations', icon: ArrowDownToLine, path: `${basePath}/unloading-operations` },
          { id: 'yard-master', label: 'Yard Master', icon: Warehouse, path: `${basePath}/yard-master` },
          { id: 'yard-allocation', label: 'Yard Allocation', icon: MapPin, path: `${basePath}/yard-allocation` },
          { id: 'yard-operations', label: 'Yard Operations', icon: MoveHorizontal, path: `${basePath}/yard-operations` },
          { id: 'crane-management', label: 'Crane Management', icon: Anchor, path: `${basePath}/crane-management` },
          { id: 'containers', label: 'Cargo Management', icon: Boxes, path: `${basePath}/containers` },
          { id: 'delivery-tracking', label: 'Delivery Tracking', icon: Truck, path: `${basePath}/delivery-tracking` }
        ];
      case 'gate_officer':
      case 'gate_truck_officer':
        return [
          { id: 'overview', label: 'Dashboard', icon: LayoutDashboard, path: `${basePath}/dashboard` },
          { 
            id: 'gate-operations', 
            label: 'Gate Operations', 
            icon: Truck, 
            path: `${basePath}/gate-operations`,
            children: [
              { id: 'worklist', label: 'Container Release Worklist', icon: Boxes, path: `${basePath}/gate-operations` },
              { id: 'gate-passes', label: 'Digital Gate Passes', icon: QrCode, path: `${basePath}/gate-passes` },
              { id: 'release-desk', label: 'QR Verification & Release Desk', icon: ShieldCheck, path: `${basePath}/release-desk` }
            ]
          }
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

  const [expandedMenus, setExpandedMenus] = React.useState<Record<string, boolean>>({});

  const isChildActive = (child: NavChildItem) => {
    if (child.id === 'worklist') {
      return (
        location.pathname === `${basePath}/gate-operations` || 
        location.pathname === `${basePath}/gate-operations/` || 
        location.pathname === `${basePath}/worklist` || 
        location.pathname === `${basePath}/trucks` || 
        location.pathname === '/gate-operations' ||
        location.pathname.startsWith(`${basePath}/gate-operations/manifest`) ||
        location.pathname.startsWith(`${basePath}/gate-operations/worklist`)
      );
    }
    if (child.id === 'gate-passes') {
      return (
        location.pathname === `${basePath}/gate-passes` || 
        location.pathname === `${basePath}/gate-passes/` || 
        location.pathname.startsWith(`${basePath}/gate-operations/passes`) || 
        location.pathname.startsWith(`${basePath}/gate-operations/directory`)
      );
    }
    if (child.id === 'release-desk') {
      return (
        location.pathname === `${basePath}/release-desk` || 
        location.pathname === `${basePath}/release-desk/` || 
        location.pathname === `${basePath}/verify` || 
        location.pathname === `${basePath}/verification` || 
        location.pathname.startsWith(`${basePath}/gate-operations/verify`) || 
        location.pathname.startsWith(`${basePath}/gate-operations/release-desk`)
      );
    }
    return location.pathname === child.path;
  };

  const isItemActive = (item: NavItem) => {
    if (item.children && item.children.length > 0) {
      return (
        item.children.some(child => isChildActive(child)) ||
        location.pathname.startsWith(`${basePath}/gate-operations`) ||
        location.pathname.startsWith(`${basePath}/gate-passes`) ||
        location.pathname.startsWith(`${basePath}/release-desk`) ||
        location.pathname.startsWith(`${basePath}/verify`) ||
        location.pathname.startsWith(`${basePath}/verification`) ||
        location.pathname.startsWith(`${basePath}/trucks`) ||
        location.pathname === '/gate-operations'
      );
    }

    return (
      location.pathname === item.path || 
      ((item.id === 'overview' || item.id === 'dashboard') && (
        location.pathname === basePath || 
        location.pathname === `${basePath}/` || 
        location.pathname === `${basePath}/dashboard`
      )) ||
      (item.id === 'cargo-management' && (
        location.pathname === `${basePath}/cargo-management` || 
        location.pathname === `${basePath}/clearance`
      ))
    );
  };

  const isItemExpanded = (item: NavItem) => {
    if (!item.children || item.children.length === 0) return false;
    if (expandedMenus[item.id] !== undefined) {
      return expandedMenus[item.id];
    }
    // Default to expanded whenever any child or parent is active
    return isItemActive(item);
  };

  const toggleExpand = (itemId: string, currentlyExpanded: boolean) => {
    setExpandedMenus(prev => ({
      ...prev,
      [itemId]: !currentlyExpanded
    }));
  };

  const handleNavClick = (item: NavItem) => {
    if (item.children && item.children.length > 0) {
      const expanded = isItemExpanded(item);
      // If clicking parent when already on its root page, toggle expansion
      const isAlreadyOnWorklist = 
        location.pathname === item.path ||
        location.pathname === `${basePath}/gate-operations` ||
        location.pathname === '/gate-operations';

      setActiveTab('gate-operations');
      navigate(item.path);

      if (isAlreadyOnWorklist) {
        toggleExpand(item.id, expanded);
      } else {
        // Expand when navigating into parent from another top-level page
        setExpandedMenus(prev => ({ ...prev, [item.id]: true }));
      }
      setIsSidebarOpen(false);
      return;
    }

    setActiveTab(item.id);
    navigate(item.path);
    setIsSidebarOpen(false);
  };

  const handleChildNavClick = (child: NavChildItem, parentId: string) => {
    setActiveTab(child.id);
    navigate(child.path);
    setExpandedMenus(prev => ({ ...prev, [parentId]: true }));
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
              const hasChildren = Boolean(item.children && item.children.length > 0);
              const isActive = isItemActive(item);
              const isExpanded = isItemExpanded(item);

              return (
                <div key={item.id} className="space-y-1">
                  <div className="flex items-center">
                    <button
                      onClick={() => handleNavClick(item)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs transition-all cursor-pointer ${
                        isActive
                          ? 'bg-[#e0f2fe] dark:bg-sky-500 text-sky-700 dark:text-white font-bold shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800/60 font-medium'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-sky-600 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`} />
                        <span className="truncate">{item.label}</span>
                      </div>
                      
                      {hasChildren ? (
                        <div
                          role="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleExpand(item.id, isExpanded);
                          }}
                          className={`p-1 -mr-1 rounded-lg transition-colors cursor-pointer ${
                            isActive 
                              ? 'hover:bg-sky-600/20 text-sky-700 dark:text-white' 
                              : 'hover:bg-slate-200/60 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500'
                          }`}
                          title={isExpanded ? 'Collapse' : 'Expand'}
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5" />
                          )}
                        </div>
                      ) : (
                        isActive && <ChevronRight className="w-3.5 h-3.5 text-sky-600 dark:text-white" />
                      )}
                    </button>
                  </div>

                  {/* Nested Child Items */}
                  {hasChildren && isExpanded && item.children && (
                    <div className="pl-3 pr-1 py-1 space-y-1 ml-3 border-l-2 border-slate-200/80 dark:border-slate-800 transition-all">
                      {item.children.map((child) => {
                        const ChildIcon = child.icon;
                        const isChildCurrent = isChildActive(child);

                        return (
                          <button
                            key={child.id}
                            onClick={() => handleChildNavClick(child, item.id)}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-all cursor-pointer ${
                              isChildCurrent
                                ? 'bg-[#e0f2fe] dark:bg-sky-500 text-sky-700 dark:text-white font-bold shadow-xs'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800/60 font-medium'
                            }`}
                          >
                            <div className="flex items-center gap-2 truncate">
                              {ChildIcon && (
                                <ChildIcon className={`w-3.5 h-3.5 shrink-0 ${isChildCurrent ? 'text-sky-600 dark:text-white' : 'text-slate-400 dark:text-slate-500'}`} />
                              )}
                              <span className="truncate">{child.label}</span>
                            </div>
                            {isChildCurrent && (
                              <ChevronRight className="w-3.5 h-3.5 text-sky-600 dark:text-white shrink-0 ml-1" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
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

