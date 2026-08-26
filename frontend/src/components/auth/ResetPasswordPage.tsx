import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { PortideLogo } from '../common/PortideLogo';
import { Lock, Eye, EyeOff, ArrowLeft, ShieldCheck, CheckCircle2, AlertCircle } from 'lucide-react';
import { apiFetch } from '../../services/api';
import { checkPasswordRequirements } from '../../utils/passwordValidation';
import { PasswordRequirementChecklist } from '../common/PasswordRequirementChecklist';

export const ResetPasswordPage: React.FC = () => {
  const { addToast } = useApp();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    const urlToken = searchParams.get('token') || '';
    setToken(urlToken);

    if (!urlToken) {
      setErrorMessage('Invalid or missing password reset token in URL.');
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!token) {
      setErrorMessage('Invalid or missing password reset token.');
      return;
    }

    const reqs = checkPasswordRequirements(newPassword);
    if (!reqs.isValid) {
      setErrorMessage('Password does not satisfy all 5 security requirements.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await apiFetch('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({
          token: token,
          new_password: newPassword,
          confirm_password: confirmPassword,
        }),
      });

      const result = await response.json();
      setIsLoading(false);

      if (response.ok && result.status === 'success') {
        setIsSuccess(true);
        addToast('success', 'Password Reset Successful', 'Your password has been reset successfully.');
      } else {
        setErrorMessage(result.message || 'Failed to reset password. Token may be expired or already used.');
      }
    } catch (err) {
      setIsLoading(false);
      setErrorMessage('Unable to connect to the backend server. Please try again.');
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-100 text-slate-900 selection:bg-[#c88d27] selection:text-white">

      {/* LEFT SIDE — Hero Image Panel */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <img
          src="/login_bg.jpg"
          alt="Smart Maritime Port"
          className="w-full h-full object-cover"
        />
        <div 
          className="absolute inset-0 z-0" 
          style={{ background: 'rgba(0, 0, 0, 0.30)' }}
        />

        {/* Logo on top-left */}
        <div className="absolute top-8 left-8 z-10 space-y-1.5">
          <PortideLogo 
            variant="horizontal" 
            theme="dark" 
            onClick={() => navigate('/')} 
            className="hover:opacity-95 transition-all"
          />
        </div>

        {/* Text content overlay */}
        <div className="absolute bottom-12 left-8 right-8 z-10 space-y-4 animate-fade-in">
          <h2 
            className="text-3xl lg:text-4xl font-black text-white leading-tight tracking-tight"
            style={{ textShadow: '0 2px 6px rgba(0,0,0,0.65)' }}
          >
            Create New Password
          </h2>
          <p 
            className="text-sm text-slate-100/95 max-w-lg leading-relaxed font-normal"
            style={{ textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}
          >
            Ensure your new password contains at least 6 characters. Once set, your previous credentials will be invalidated immediately across all active sessions.
          </p>
        </div>
      </div>

      {/* RIGHT SIDE — Reset Form Container */}
      <div className="flex-1 flex flex-col bg-slate-50 relative">

        {/* Top Navigation */}
        <div className="flex items-center justify-end p-6 sm:p-8">
          <button
            onClick={() => navigate('/login')}
            className="text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Login</span>
          </button>
        </div>

        {/* Form Centered */}
        <div className="flex-1 flex items-center justify-center px-4 sm:px-8 lg:px-12 py-6">
          
          <div className="w-full max-w-[500px] p-8 sm:p-11 rounded-2xl bg-white border border-slate-200/90 shadow-lg space-y-6 animate-fade-in">

            {/* Mobile Logo View */}
            <div className="lg:hidden pb-2 space-y-1">
              <PortideLogo 
                variant="horizontal" 
                theme="light" 
                onClick={() => navigate('/')} 
                className="scale-105 origin-left"
              />
            </div>

            {/* Heading & Subtitle */}
            <div className="space-y-1 text-left">
              <h1 className="text-2xl sm:text-3xl font-black text-[#0b192c] tracking-tight">
                Reset Password
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 font-medium">
                Create a new secure password for your PORTIDE account.
              </p>
            </div>

            {errorMessage && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 text-xs flex items-center gap-2 animate-fade-in">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{errorMessage}</span>
              </div>
            )}

            {isSuccess ? (
              <div className="p-6 rounded-2xl bg-emerald-50 border border-emerald-200 text-center space-y-4 animate-fade-in">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-emerald-900">Password Reset Complete</h3>
                  <p className="text-xs text-emerald-700 font-medium">
                    Your password has been reset successfully.
                  </p>
                </div>
                <button
                  onClick={() => navigate('/login')}
                  className="w-full py-3 rounded-xl text-xs font-black uppercase tracking-wider text-white bg-[#D49A24] hover:bg-[#b8831b] transition-colors shadow-md"
                >
                  Back to Login
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">

                {/* New Password */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    New Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-4 top-3.5" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      minLength={6}
                      placeholder="At least 6 characters"
                      className="w-full pl-11 pr-11 py-3 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-sm focus:outline-none focus:border-[#D49A24] focus:ring-2 focus:ring-[#D49A24]/20 transition-all font-medium"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-3 p-1 text-slate-400 hover:text-slate-700 rounded-md transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Confirm Password */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-4 top-3.5" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      placeholder="Re-enter new password"
                      className="w-full pl-11 pr-4 py-3 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-sm focus:outline-none focus:border-[#D49A24] focus:ring-2 focus:ring-[#D49A24]/20 transition-all font-medium"
                    />
                  </div>
                  {confirmPassword && newPassword !== confirmPassword && (
                    <div className="text-[10px] font-bold text-rose-500 mt-1">
                      Passwords do not match.
                    </div>
                  )}
                </div>

                <PasswordRequirementChecklist password={newPassword} />

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isLoading || !token}
                  className="w-full py-3.5 rounded-xl text-xs font-black uppercase tracking-wider text-white bg-[#D49A24] hover:bg-[#b8831b] shadow-md hover:shadow-amber-500/20 transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer border border-[#D49A24]"
                >
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <span>Reset Password</span>
                  )}
                </button>

                {/* Security Text Below Button */}
                <div className="text-center text-xs text-slate-500 font-medium flex items-center justify-center gap-1.5 pt-1">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Secure enterprise authentication.</span>
                </div>

              </form>
            )}

            {/* Bottom Back to Login */}
            {!isSuccess && (
              <div className="text-center text-xs text-slate-600 pt-4 border-t border-slate-200/80">
                Cancel request?{' '}
                <button
                  onClick={() => navigate('/login')}
                  className="font-bold text-[#D49A24] hover:text-[#b8831b] hover:underline transition-colors ml-1 cursor-pointer"
                >
                  Back to Login
                </button>
              </div>
            )}

          </div>
        </div>

      </div>

    </div>
  );
};
