import React, { useState } from 'react';
import { Lock, Eye, EyeOff, ShieldAlert, CheckCircle2, AlertCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { apiFetch, getStoredSession, setStoredSession } from '../../services/api';
import { checkPasswordRequirements } from '../../utils/passwordValidation';
import { PasswordRequirementChecklist } from '../common/PasswordRequirementChecklist';

export const MandatoryPasswordChangeModal: React.FC = () => {
  const { 
    currentUser, 
    setCurrentUser, 
    setMustChangePassword, 
    addToast 
  } = useApp();

  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handlePasswordChangeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!newPassword) {
      setErrorMessage('Please enter a new password.');
      return;
    }

    const reqs = checkPasswordRequirements(newPassword);
    if (!reqs.isValid) {
      setErrorMessage('New password does not satisfy all 5 password requirements.');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setErrorMessage('New password and confirmation password do not match.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await apiFetch('/api/auth/first-login-change-password/', {
        method: 'POST',
        body: JSON.stringify({
          new_password: newPassword,
          confirm_new_password: confirmNewPassword,
        })
      });

      const result = await response.json();
      setIsLoading(false);

      if (response.ok && result.status === 'success') {
        // Update user state and session storage
        setMustChangePassword(false);
        setCurrentUser({
          ...currentUser,
          mustChangePassword: false,
        });

        const stored = getStoredSession();
        if (stored) {
          setStoredSession({
            ...stored,
            mustChangePassword: false,
          });
        }

        addToast(
          'success',
          'Password Changed Successfully',
          'Your temporary password has been replaced. You can now access your dashboard.'
        );
      } else {
        const errorDetail = result.errors 
          ? Object.values(result.errors).flat().join(' ') 
          : (result.message || 'Failed to change password.');
        setErrorMessage(errorDetail);
      }
    } catch {
      setIsLoading(false);
      setErrorMessage('Unable to connect to authentication server. Please try again.');
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[99999] overflow-y-auto p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md flex min-h-screen w-screen items-center justify-center font-sans select-none"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mandatory-password-title"
    >
      <div 
        className="relative w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col my-auto animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Gold Accent Bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-amber-600 via-[#D49A24] to-yellow-400" />

        {/* Modal Header */}
        <div className="px-6 pt-6 pb-4 bg-slate-50/80 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-[#D49A24] shrink-0 shadow-xs">
            <ShieldAlert className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div className="space-y-0.5">
            <h2 id="mandatory-password-title" className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
              Password Change Required
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-snug font-medium">
              Your account was created with a temporary password. For security, you must create a new password before continuing.
            </p>
          </div>
        </div>

        {/* Modal Form Body */}
        <form onSubmit={handlePasswordChangeSubmit} className="p-6 space-y-4 text-left">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-400 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
              <span className="font-medium leading-relaxed">{errorMessage}</span>
            </div>
          )}

          {/* New Password Field */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              New Password *
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showNewPassword ? 'text' : 'password'}
                required
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter your new strong password..."
                className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:border-[#D49A24] focus:ring-2 focus:ring-[#D49A24]/20 transition-all placeholder:text-slate-400"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                title={showNewPassword ? 'Hide password' : 'Show password'}
              >
                {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Confirm New Password Field */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Confirm New Password *
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showConfirmNewPassword ? 'text' : 'password'}
                required
                autoComplete="new-password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                placeholder="Confirm your new strong password..."
                className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:border-[#D49A24] focus:ring-2 focus:ring-[#D49A24]/20 transition-all placeholder:text-slate-400"
              />
              <button
                type="button"
                onClick={() => setShowConfirmNewPassword(!showConfirmNewPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                title={showConfirmNewPassword ? 'Hide password' : 'Show password'}
              >
                {showConfirmNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {confirmNewPassword && newPassword !== confirmNewPassword && (
              <div className="text-[11px] font-semibold text-rose-500 flex items-center gap-1 mt-1">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Passwords do not match.</span>
              </div>
            )}
            {confirmNewPassword && newPassword === confirmNewPassword && newPassword.length > 0 && (
              <div className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mt-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Passwords match.</span>
              </div>
            )}
          </div>

          {/* Dynamic Password Policy Checklist */}
          <PasswordRequirementChecklist password={newPassword} />

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoading || !newPassword || !confirmNewPassword || newPassword !== confirmNewPassword}
              className="w-full py-3 px-4 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-[#D49A24] to-[#c38918] hover:from-[#b8831b] hover:to-[#a97514] active:scale-[0.99] transition-all shadow-md shadow-[#D49A24]/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Updating Password...</span>
                </>
              ) : (
                <span>Change Password</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
