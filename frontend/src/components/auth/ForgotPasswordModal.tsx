import React, { useState } from 'react';
import { Mail, KeyRound, Lock, Eye, EyeOff, ShieldCheck, CheckCircle2, AlertCircle, ArrowLeft } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Modal } from '../common/Modal';
import { checkPasswordRequirements } from '../../utils/passwordValidation';
import { PasswordRequirementChecklist } from '../common/PasswordRequirementChecklist';
import { API_BASE_URL } from '../../services/api';

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialEmail?: string;
}

export const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({
  isOpen,
  onClose,
  initialEmail = ''
}) => {
  const { addToast } = useApp();

  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState(initialEmail);
  const [resetToken, setResetToken] = useState('');
  const [devOtp, setDevOtp] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!email.includes('@')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/password-reset/request/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: email.trim() }),
      });

      const result = await response.json();
      setIsLoading(false);

      if (response.ok && result.status === 'success') {
        setResetToken(result.data.reset_token);
        setDevOtp(result.data.dev_otp || '');
        setStep(2);
        setSuccessMessage(`Reset code sent! Check below or your inbox.`);
        addToast('info', 'Reset Code Generated', `A 6-digit verification code was created for ${email}.`);
      } else {
        setErrorMessage(result.message || 'Unable to find an account with this email address.');
      }
    } catch (err) {
      setIsLoading(false);
      setErrorMessage('Failed to connect to authentication server. Please ensure backend is running.');
    }
  };

  const handleConfirmReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (otpCode.trim().length !== 6) {
      setErrorMessage('Please enter the complete 6-digit verification code.');
      return;
    }

    const reqs = checkPasswordRequirements(newPassword);
    if (!reqs.isValid) {
      setErrorMessage('New password does not satisfy all 5 security requirements.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/password-reset/confirm/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reset_token: resetToken,
          otp_code: otpCode.trim(),
          new_password: newPassword,
          confirm_password: confirmPassword,
        }),
      });

      const result = await response.json();
      setIsLoading(false);

      if (response.ok && result.status === 'success') {
        addToast('success', 'Password Reset Successful', 'Your password has been updated. You can now sign in.');
        onClose();
        // Reset form state
        setStep(1);
        setEmail('');
        setOtpCode('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setErrorMessage(result.message || 'Failed to reset password. Please check your OTP code.');
      }
    } catch (err) {
      setIsLoading(false);
      setErrorMessage('Failed to connect to authentication server.');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Reset Account Password"
      subtitle={step === 1 ? 'Step 1: Request Verification Code' : 'Step 2: Enter Verification Code & New Password'}
      icon={<KeyRound className="w-4 h-4 text-[#D49A24]" />}
      maxWidth="md"
      footer={
        <div className="flex items-center justify-between w-full text-xs text-slate-500 font-medium">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>PORTIDE Security Verification</span>
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Feedback Messages */}
        {errorMessage && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* STEP 1: Request OTP */}
        {step === 1 && (
          <form onSubmit={handleRequestOtp} className="space-y-4">
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
              Enter your registered PORTIDE enterprise email address. We will issue a 6-digit verification code to reset your account password.
            </p>

            <div>
              <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Registered Email Address *
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="user@portide.com"
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:outline-none focus:border-[#D49A24] font-medium"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 rounded-xl text-xs font-bold text-white bg-[#D49A24] hover:bg-[#b8831b] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50 border border-[#D49A24]"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <span>Send Reset Code</span>
              )}
            </button>
          </form>
        )}

        {/* STEP 2: Verify Code & Reset Password */}
        {step === 2 && (
          <form onSubmit={handleConfirmReset} className="space-y-4">
            {/* Dev environment OTP hint box */}
            {devOtp && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs space-y-1">
                <div className="font-bold flex items-center justify-between">
                  <span>🔑 Verification Code (Dev Mode):</span>
                  <span className="font-mono text-sm tracking-wider px-2 py-0.5 rounded bg-amber-500/20 text-[#D49A24]">
                    {devOtp}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400">
                  Use code <strong className="font-mono">{devOtp}</strong> to verify your account password reset.
                </p>
              </div>
            )}

            <div>
              <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                6-Digit Verification Code *
              </label>
              <input
                type="text"
                maxLength={6}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                required
                placeholder="e.g. 123456"
                className="w-full text-center tracking-[0.5em] font-mono font-bold text-base py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-[#D49A24]"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-3 gap-y-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  New Password *
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={6}
                    placeholder="Min. 6 chars"
                    className="w-full pl-9 pr-9 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:outline-none focus:border-[#D49A24] font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Confirm New Password *
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    placeholder="Confirm new password"
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:outline-none focus:border-[#D49A24] font-medium"
                  />
                </div>
                {confirmPassword && newPassword !== confirmPassword && (
                  <div className="text-[10px] font-bold text-rose-500 mt-1">
                    Passwords do not match.
                  </div>
                )}
              </div>
            </div>

            <PasswordRequirementChecklist password={newPassword} />

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="py-2 px-3 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Resend</span>
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="flex-1 py-2 rounded-xl text-xs font-bold text-white bg-[#D49A24] hover:bg-[#b8831b] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50 border border-[#D49A24]"
              >
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <span>Update Password</span>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
};
