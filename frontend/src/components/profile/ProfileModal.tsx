import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Modal } from '../common/Modal';
import { checkPasswordRequirements } from '../../utils/passwordValidation';
import { PasswordRequirementChecklist } from '../common/PasswordRequirementChecklist';
import { API_BASE_URL } from '../../services/api';
import { 
  User, 
  Mail, 
  Phone, 
  ShieldCheck, 
  Building2, 
  BadgeCheck, 
  Eye, 
  EyeOff, 
  AlertTriangle,
  KeyRound,
  IdCard
} from 'lucide-react';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, onClose }) => {
  const { currentUser, addToast } = useApp();

  const isPortAdmin = currentUser?.role === 'port_administrator' || currentUser?.role === 'admin';

  const [activeTab, setActiveTab] = useState<'details' | 'password'>('details');

  // Change Password Form State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!currentPassword) {
      setErrorMsg('Please enter your current password.');
      return;
    }
    const reqs = checkPasswordRequirements(newPassword);
    if (!reqs.isValid) {
      setErrorMsg('New password does not satisfy all 5 security requirements.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/change-password/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': currentUser?.id || '',
          'X-User-Email': currentUser?.email || '',
        },
        body: JSON.stringify({
          email: currentUser?.email,
          current_password: currentPassword,
          new_password: newPassword,
          confirm_new_password: confirmNewPassword
        })
      });

      const result = await response.json();
      setIsSubmitting(false);

      if (response.ok && result.status === 'success') {
        addToast('success', 'Password Changed', 'Password changed successfully.');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmNewPassword('');
        setActiveTab('details');
      } else {
        setErrorMsg(result.message || 'Failed to change password. Please check your current password.');
      }
    } catch (err) {
      setIsSubmitting(false);
      setErrorMsg('Unable to connect to server. Please try again.');
    }
  };

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case 'port_administrator':
      case 'admin':
        return 'Port Administrator';
      case 'shipping_company':
        return 'Shipping Company / Shipping Agent';
      case 'port_operations_officer':
      case 'operations_officer':
        return 'Port Operations Officer';
      case 'customs_officer':
        return 'Customs Officer';
      case 'terminal_logistics_operator':
      case 'terminal_operator':
        return 'Terminal & Logistics Operator';
      case 'gate_truck_officer':
      case 'gate_officer':
        return 'Gate & Truck Operations Officer';
      default:
        return role.replace(/_/g, ' ');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="User Profile & Credentials"
      subtitle={currentUser?.email}
      icon={<User className="w-4 h-4 text-[#D49A24]" />}
      maxWidth="2xl"
      footer={
        <button
          onClick={onClose}
          className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors cursor-pointer"
        >
          Close
        </button>
      }
    >
      {/* MODAL TABS */}
      {!isPortAdmin && (
        <div className="flex border-b border-slate-200 dark:border-slate-800 -mx-6 -mt-6 px-6 mb-4 bg-slate-50/50 dark:bg-slate-800/30">
          <button
            onClick={() => setActiveTab('details')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'details'
                ? 'border-[#D49A24] text-[#D49A24]'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <User className="w-4 h-4" />
            <span>Profile Details</span>
          </button>
          <button
            onClick={() => setActiveTab('password')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'password'
                ? 'border-[#D49A24] text-[#D49A24]'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <KeyRound className="w-4 h-4" />
            <span>Change Password</span>
          </button>
        </div>
      )}

      {/* TAB 1: PROFILE DETAILS */}
      {activeTab === 'details' && (
        <div className="space-y-4">
          {/* Account Status Badge */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400">
            <div className="flex items-center gap-2">
              <BadgeCheck className="w-5 h-5 text-emerald-600" />
              <div>
                <div className="font-bold text-xs">Account Status: ACTIVE</div>
                <div className="text-[10px] opacity-80">Verified Platform Authorization Credentials</div>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-600 text-white uppercase tracking-wider">
              Active
            </span>
          </div>

          {/* Profile Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-[#D49A24]" /> Full Name
              </div>
              <div className="font-bold text-slate-900 dark:text-white text-sm">
                {currentUser?.name || 'N/A'}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-[#D49A24]" /> Email Address
              </div>
              <div className="font-bold text-slate-900 dark:text-white truncate">
                {currentUser?.email || 'N/A'}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <IdCard className="w-3.5 h-3.5 text-[#D49A24]" /> Staff Employee ID
              </div>
              <div className="font-mono font-bold text-[#D49A24] text-sm">
                {currentUser?.employeeId || 'N/A'}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-[#D49A24]" /> Department
              </div>
              <div className="font-bold text-slate-900 dark:text-white">
                {currentUser?.department || currentUser?.organisation || 'PORTIDE Operations'}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-1 sm:col-span-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-[#D49A24]" /> System Role
              </div>
              <div className="font-bold text-slate-900 dark:text-white text-sm">
                {getRoleDisplayName(currentUser?.role || '')}
              </div>
            </div>

            {currentUser?.phone && (
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-1 sm:col-span-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-[#D49A24]" /> Direct Contact Phone
                </div>
                <div className="font-medium text-slate-800 dark:text-slate-200">
                  {currentUser.phone}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: CHANGE PASSWORD */}
      {activeTab === 'password' && !isPortAdmin && (
        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-400 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3">
            <div className="md:col-span-2">
              <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Current Password *
              </label>
              <div className="relative">
                <input
                  type={showCurrentPassword ? 'text' : 'password'}
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password..."
                  className="w-full pl-3 pr-10 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-medium focus:outline-none focus:border-[#D49A24]"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                New Password *
              </label>
              <div className="relative">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min. 6 chars..."
                  className="w-full pl-3 pr-10 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-medium focus:outline-none focus:border-[#D49A24]"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Confirm New Password *
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  placeholder="Re-enter new password..."
                  className="w-full pl-3 pr-10 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-medium focus:outline-none focus:border-[#D49A24]"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {confirmNewPassword && newPassword !== confirmNewPassword && (
                <div className="text-[10px] font-bold text-rose-500 mt-1">
                  Passwords do not match.
                </div>
              )}
            </div>

            <div className="md:col-span-2">
              <PasswordRequirementChecklist password={newPassword} />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl bg-[#D49A24] hover:bg-[#b8831b] text-white font-bold text-xs shadow-md transition-all cursor-pointer disabled:opacity-50 border border-[#D49A24]"
            >
              {isSubmitting ? 'Updating Password...' : 'Save New Password'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
};
