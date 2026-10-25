import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { USER_ROLES_INFO } from '../../data/rolesConfig';
import { ProfileModal } from '../profile/ProfileModal';
import { NotificationItem } from '../../types';
import { 
  Bell, 
  ChevronDown, 
  LogOut, 
  ShieldCheck, 
  Clock, 
  X,
  User,
  Menu
} from 'lucide-react';

interface HeaderProps {
  isSidebarOpen: boolean;
  setIsSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ isSidebarOpen, setIsSidebarOpen, setActiveTab }) => {
  const { 
    currentUser, 
    activeRole, 
    notifications, 
    logoutUser,
    addToast,
    markNotificationAsRead,
    markAllNotificationsAsRead
  } = useApp();

  const navigate = useNavigate();

  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const unreadCount = notifications.filter(n => !n.read).length;
  const currentRoleInfo = USER_ROLES_INFO.find(r => r.id === activeRole) || USER_ROLES_INFO[0];

  const handleNotificationClick = async (n: NotificationItem) => {
    if (!n.read) {
      await markNotificationAsRead(n.id);
    }
    setShowNotifications(false);
    if (n.action_route) {
      if (n.action_route.startsWith('/')) {
        navigate(n.action_route);
      } else if (setActiveTab) {
        setActiveTab(n.action_route);
      }
    }
  };

  const handleLogout = async () => {
    setShowUserMenu(false);
    await logoutUser();
    navigate('/login');
  };

  const getDashboardTitle = (roleId: string) => {
    switch (roleId) {
      case 'admin':
      case 'port_administrator':
        return 'Port Administrator Dashboard';
      case 'shipping_company':
        return 'Shipping Company / Shipping Agent Dashboard';
      case 'operations_officer':
      case 'port_operations_officer':
        return 'Port Operations Officer Dashboard';
      case 'customs_officer':
        return 'Customs Authority Dashboard';
      case 'terminal_operator':
      case 'terminal_logistics_operator':
        return 'Terminal & Logistics Operator Dashboard';
      case 'gate_officer':
      case 'gate_truck_officer':
        return 'Gate & Truck Operations Officer Dashboard';
      default:
        return `${currentRoleInfo?.name || 'User'} Dashboard`;
    }
  };

  return (
    <header className="sticky top-0 z-30 h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-3 sm:px-6 flex items-center justify-between shadow-xs transition-colors duration-200">
      
      {/* Left side: Mobile Hamburger Button & Dashboard Title */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="lg:hidden p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
          title="Toggle Mobile Navigation Drawer"
        >
          <Menu className="w-5 h-5 text-slate-700 dark:text-slate-200" />
        </button>
        <h2 className="text-xs sm:text-sm md:text-base font-black text-slate-900 dark:text-white tracking-tight truncate max-w-[170px] xs:max-w-[220px] sm:max-w-xs md:max-w-none">
          {getDashboardTitle(activeRole)}
        </h2>
      </div>


      {/* Right side: Notifications, Admin Profile & Logout Button */}
      <div className="flex items-center gap-2 sm:gap-3">
        
        {/* Notifications Icon */}

        <div className="relative">
          <button
            onClick={() => {
              setShowNotifications(!showNotifications);
              setShowUserMenu(false);
            }}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors relative cursor-pointer"
            title="System Notifications"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center ring-2 ring-white dark:ring-slate-900 animate-pulse">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-4 z-50 animate-fade-in">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">Notifications</h4>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    unreadCount > 0 
                      ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300' 
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                  }`}>
                    {unreadCount} unread
                  </span>
                </div>
                <button
                  onClick={() => setShowNotifications(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="py-2 space-y-2.5 max-h-80 overflow-y-auto my-1">
                {notifications.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400 space-y-1">
                    <p className="font-semibold text-slate-500 dark:text-slate-400">All caught up</p>
                    <p className="text-[11px]">No operational alerts or notifications at this time.</p>
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => handleNotificationClick(n)}
                      className={`p-3 rounded-xl border text-xs space-y-1.5 transition-all cursor-pointer group hover:border-[#D49A24]/60 ${
                        n.read
                          ? 'bg-slate-50/60 dark:bg-slate-800/30 border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400 opacity-80'
                          : 'bg-sky-50/80 dark:bg-sky-950/40 border-sky-200 dark:border-sky-800/70 text-slate-900 dark:text-slate-100 shadow-xs'
                      }`}
                    >
                      <div className="flex items-center justify-between font-bold gap-2">
                        <div className="flex items-center gap-1.5 truncate">
                          {!n.read && (
                            <span className="w-2 h-2 rounded-full bg-sky-500 shrink-0" />
                          )}
                          <span className="truncate group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                            {n.title}
                          </span>
                        </div>
                        <span className="text-[10px] opacity-70 flex items-center gap-1 shrink-0 font-normal">
                          <Clock className="w-3 h-3" /> {n.time}
                        </span>
                      </div>
                      <p className="text-slate-600 dark:text-slate-300 leading-snug line-clamp-2">{n.message}</p>
                      {n.category && (
                        <div className="flex items-center justify-between pt-1 text-[9px] uppercase tracking-wider font-bold text-slate-400">
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                            {n.category}
                          </span>
                          {n.action_route && (
                            <span className="text-sky-600 dark:text-sky-400 group-hover:underline">
                              Open View →
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>

              {unreadCount > 0 && (
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-center">
                  <button
                    onClick={async () => {
                      await markAllNotificationsAsRead();
                      addToast('info', 'Notifications Cleared', 'All alerts marked as read.');
                    }}
                    className="text-xs font-bold text-sky-600 dark:text-sky-400 hover:underline cursor-pointer"
                  >
                    Mark All Alerts as Read
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* User Profile Dropdown */}
        <div className="relative">
          <button
            onClick={() => {
              setShowUserMenu(!showUserMenu);
              setShowNotifications(false);
            }}
            className="flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left cursor-pointer"
          >
            <div className="w-8 h-8 rounded-lg bg-sky-500 flex items-center justify-center text-white font-black text-xs shadow-xs">
              {(currentUser?.name || 'User').charAt(0)}
            </div>
            <div className="hidden lg:block">
              <div className="text-xs font-bold text-slate-900 dark:text-white leading-tight truncate max-w-[130px]">
                {currentUser?.name || 'User'}
              </div>
              <div className="text-[10px] text-sky-600 dark:text-sky-400 font-semibold truncate max-w-[130px]">
                {currentRoleInfo?.name || 'Port User'}
              </div>
            </div>
            <ChevronDown className="w-4 h-4 text-slate-400 hidden sm:block" />
          </button>

          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-4 z-50 animate-fade-in">
              <div className="pb-3 border-b border-slate-100 dark:border-slate-800 space-y-1">
                <div className="text-xs font-bold text-slate-900 dark:text-white">{currentUser?.name || 'User'}</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">{currentUser?.email || ''}</div>
                <div className="text-[10px] font-semibold text-sky-600 dark:text-sky-400 flex items-center gap-1 mt-1">
                  <ShieldCheck className="w-3.5 h-3.5" /> {currentRoleInfo?.name || 'Port User'}
                </div>
              </div>

              <div className="pt-2 space-y-1">
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    setIsProfileOpen(true);
                  }}
                  className="w-full flex items-center gap-2 p-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <User className="w-4 h-4 text-[#D49A24]" />
                  <span>My Profile & Change Password</span>
                </button>

                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 p-2 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4 text-rose-500" />
                  <span>Logout</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Direct Header Profile & Logout Buttons */}
        <button
          onClick={() => setIsProfileOpen(true)}
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition-colors cursor-pointer border border-slate-200 dark:border-slate-700/80"
          title="User Profile & Security"
        >
          <User className="w-3.5 h-3.5 text-[#D49A24]" />
          <span>Profile</span>
        </button>

        <button
          onClick={handleLogout}
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-rose-500/10 text-slate-600 dark:text-slate-300 hover:text-rose-400 text-xs font-bold transition-colors cursor-pointer border border-slate-200 dark:border-slate-700/80"
          title="Logout"
        >
          <LogOut className="w-3.5 h-3.5 text-rose-500" />
          <span>Logout</span>
        </button>

      </div>

      <ProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
      />

    </header>
  );
};
