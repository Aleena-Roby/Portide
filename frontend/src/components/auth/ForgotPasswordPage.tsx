import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PortideLogo } from '../common/PortideLogo';
import { Mail, ArrowLeft, ShieldCheck, CheckCircle2, AlertCircle } from 'lucide-react';
import { apiFetch } from '../../services/api';

export const ForgotPasswordPage: React.FC = () => {
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [statusMessage, setStatusMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setStatusMessage('');

    if (!email.includes('@')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await apiFetch('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });

      const result = await response.json();
      setIsLoading(false);

      if (response.ok && result.status === 'success') {
        setStatusMessage('If an account exists with this email, a password reset link has been sent.');
      } else {
        setErrorMessage(result.message || 'Unable to process password reset request.');
      }
    } catch (err) {
      setIsLoading(false);
      setErrorMessage('Unable to connect to the backend server. Please ensure Django is running.');
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

        {/* Logo on top-left of image */}
        <div className="absolute top-8 left-8 z-10 space-y-1.5">
          <PortideLogo 
            variant="horizontal" 
            theme="dark" 
            onClick={() => navigate('/')} 
            className="hover:opacity-95 transition-all"
          />
        </div>

        {/* Text content overlay on left image */}
        <div className="absolute bottom-12 left-8 right-8 z-10 space-y-4 animate-fade-in">
          <h2 
            className="text-3xl lg:text-4xl font-black text-white leading-tight tracking-tight"
            style={{ textShadow: '0 2px 6px rgba(0,0,0,0.65)' }}
          >
            Account Recovery &<br />Security Controls
          </h2>
          <p 
            className="text-sm text-slate-100/95 max-w-lg leading-relaxed font-normal"
            style={{ textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}
          >
            Reset your PORTIDE enterprise account password securely. An encrypted, time-limited reset link will be dispatched to your registered address.
          </p>
        </div>
      </div>

      {/* RIGHT SIDE — Forgot Password Form Container */}
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
                Forgot Password?
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 font-medium">
                Enter your registered email address and we'll send you instructions to reset your password.
              </p>
            </div>

            {errorMessage && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 text-xs flex items-center gap-2 animate-fade-in">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{errorMessage}</span>
              </div>
            )}

            {statusMessage && (
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs space-y-2 animate-fade-in">
                <div className="flex items-center gap-2 font-bold text-emerald-900 text-sm">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span>Request Received</span>
                </div>
                <p className="leading-relaxed font-medium">
                  {statusMessage}
                </p>
                <p className="text-[11px] text-emerald-700 pt-1">
                  Please check your email inbox and follow the instructions in the reset link (valid for 30 minutes).
                </p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">

              {/* Registered Email Field */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Registered Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-4 top-3.5" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="user@portide.com"
                    className="w-full pl-11 pr-4 py-3 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-sm focus:outline-none focus:border-[#D49A24] focus:ring-2 focus:ring-[#D49A24]/20 transition-all placeholder:text-slate-400 font-medium"
                  />
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 rounded-xl text-xs font-black uppercase tracking-wider text-white bg-[#D49A24] hover:bg-[#b8831b] shadow-md hover:shadow-amber-500/20 transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer border border-[#D49A24]"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <span>Send Reset Link</span>
                )}
              </button>

              {/* Security Text Below Button */}
              <div className="text-center text-xs text-slate-500 font-medium flex items-center justify-center gap-1.5 pt-1">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Secure enterprise authentication.</span>
              </div>

            </form>

            {/* Back to Login Prompt */}
            <div className="text-center text-xs text-slate-600 pt-4 border-t border-slate-200/80">
              Remembered your password?{' '}
              <button
                onClick={() => navigate('/login')}
                className="font-bold text-[#D49A24] hover:text-[#b8831b] hover:underline transition-colors ml-1 cursor-pointer"
              >
                Back to Login
              </button>
            </div>

          </div>
        </div>

      </div>

    </div>
  );
};
