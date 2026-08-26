import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { PortideLogo } from '../common/PortideLogo';
import { Eye, EyeOff, Lock, Mail, ArrowLeft, ShieldCheck } from 'lucide-react';
import { ForgotPasswordModal } from './ForgotPasswordModal';
import { getDefaultDashboardRoute } from './ProtectedRoute';

export const LoginPage: React.FC = () => {
  const { loginUser, isAuthenticated, activeRole } = useApp();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);

  // If already logged in, redirect to user dashboard
  useEffect(() => {
    if (isAuthenticated) {
      const fromPath = (location.state as any)?.from?.pathname;
      const targetRoute = fromPath || getDefaultDashboardRoute(activeRole);
      navigate(targetRoute, { replace: true });
    }
  }, [isAuthenticated, activeRole, navigate, location]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!email.includes('@')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters.');
      return;
    }

    setIsSubmitting(true);
    const result = await loginUser(email, password);
    setIsSubmitting(false);

    if (result.success) {
      const fromPath = (location.state as any)?.from?.pathname;
      const targetRoute = fromPath || getDefaultDashboardRoute(activeRole);
      navigate(targetRoute, { replace: true });
    } else if (result.message) {
      setErrorMessage(result.message);
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
        {/* Dark overlay: rgba(0,0,0,0.30) so image remains visible while improving readability */}
        <div 
          className="absolute inset-0 z-0" 
          style={{ background: 'rgba(0, 0, 0, 0.30)' }}
        />

        {/* Logo & Subtitle on top-left of image */}
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
            Smart Maritime Port<br />Operations Platform
          </h2>
          <p 
            className="text-sm text-slate-100/95 max-w-lg leading-relaxed font-normal"
            style={{ textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}
          >
            Centralize vessel scheduling, berth allocation, cargo operations, customs clearance, terminal coordination, and gate management through one secure enterprise platform.
          </p>
        </div>
      </div>

      {/* RIGHT SIDE — Enterprise Login Form */}
      <div className="flex-1 flex flex-col bg-slate-50 relative">

        {/* Top-Right Simple Text Link Navigation */}
        <div className="flex items-center justify-end p-6 sm:p-8">
          <button
            onClick={() => navigate('/')}
            className="text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Home</span>
          </button>
        </div>

        {/* Form Centered in Remaining Space */}
        <div className="flex-1 flex items-center justify-center px-4 sm:px-8 lg:px-12 py-6">
          
          {/* Clean Enterprise Login Card */}
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

            {/* Main Heading & Subheading */}
            <div className="space-y-1 text-left">
              <h1 className="text-2xl sm:text-3xl font-black text-[#0b192c] tracking-tight">
                Sign in to PORTIDE
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 font-medium">
                Access your PORTIDE enterprise account.
              </p>
            </div>

            {errorMessage && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 text-xs flex items-center gap-2 animate-fade-in">
                <Lock className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">

              {/* Email Input */}
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

              {/* Password Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-4 top-3.5" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="••••••••••••"
                    className="w-full pl-11 pr-11 py-3 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-sm focus:outline-none focus:border-[#D49A24] focus:ring-2 focus:ring-[#D49A24]/20 transition-all placeholder:text-slate-400 font-medium"
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

              {/* Remember Me & Forgot Password */}
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 select-none font-medium">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 bg-white text-[#D49A24] focus:ring-[#D49A24]"
                  />
                  <span>Remember Me</span>
                </label>
                <button
                  type="button"
                  onClick={() => navigate('/forgot-password')}
                  className="text-xs font-semibold text-slate-600 hover:text-[#D49A24] transition-colors cursor-pointer"
                >
                  Forgot Password?
                </button>
              </div>

              {/* Enterprise Gold Login Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 rounded-xl text-xs font-black uppercase tracking-wider text-white bg-[#D49A24] hover:bg-[#b8831b] shadow-md hover:shadow-amber-500/20 transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer border border-[#D49A24]"
              >
                {isSubmitting ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <span>Sign In</span>
                )}
              </button>

              {/* Security Text Below Button */}
              <div className="text-center text-xs text-slate-500 font-medium flex items-center justify-center gap-1.5 pt-1">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Secure enterprise authentication.</span>
              </div>

            </form>

            {/* Bottom Register Prompt */}
            <div className="text-center text-xs text-slate-600 pt-4 border-t border-slate-200/80">
              Don't have an account?{' '}
              <button
                onClick={() => navigate('/register')}
                className="font-bold text-[#D49A24] hover:text-[#b8831b] hover:underline transition-colors ml-1 cursor-pointer"
              >
                Register
              </button>
            </div>

          </div>
        </div>

      </div>

      {/* Forgot Password Modal */}
      <ForgotPasswordModal
        isOpen={isForgotPasswordOpen}
        onClose={() => setIsForgotPasswordOpen(false)}
        initialEmail={email}
      />

    </div>
  );
};
