import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { PortideLogo } from '../common/PortideLogo';
import { checkPasswordRequirements } from '../../utils/passwordValidation';
import { PasswordRequirementChecklist } from '../common/PasswordRequirementChecklist';
import { InternationalPhoneInput } from '../common/InternationalPhoneInput';
import { API_BASE_URL } from '../../services/api';
import { 
  SUPPORTED_COUNTRIES, 
  SUPPORTED_COUNTRY_NAMES, 
  getCountryByName 
} from '../../utils/countryConfig';
import { 


  Ship, 
  ArrowLeft, 
  Upload, 
  Clock, 
  FileText, 
  ShieldCheck, 
  UserPlus, 
  Building2, 
  User, 
  Mail, 
  Phone, 
  Lock, 
  MapPin, 
  FileCheck,
  Globe,
  Eye,
  EyeOff,
  Loader2
} from 'lucide-react';

export const RegisterPage: React.FC = () => {
  const { addToast } = useApp();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    orgName: '',
    fullName: '',
    email: '',
    phone: '',
    orgId: '',
    address: '',
    country: 'Singapore',
    password: '',
    confirmPassword: '',
    acceptTerms: false
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [licenseFile, setLicenseFile] = useState<string | null>(null);
  const [idFile, setIdFile] = useState<string | null>(null);
  const [licenseFileObj, setLicenseFileObj] = useState<File | null>(null);
  const [idFileObj, setIdFileObj] = useState<File | null>(null);
  const licenseInputRef = React.useRef<HTMLInputElement>(null);
  const idInputRef = React.useRef<HTMLInputElement>(null);

  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedRequestId, setSubmittedRequestId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [isPhoneValid, setIsPhoneValid] = useState(false);


  const handleLicenseSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setLicenseFileObj(file);
      setLicenseFile(file.name);
    }
  };

  const handleIdSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setIdFileObj(file);
      setIdFile(file.name);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setErrorMessage('');

    if (!formData.orgName.trim()) {
      setErrorMessage('Please enter your Company Name.');
      return;
    }

    if (!formData.orgId.trim()) {
      setErrorMessage('Please enter your Company Registration Number.');
      return;
    }

    if (!formData.email.includes('@')) {
      setErrorMessage('Please enter a valid Registered Email Address.');
      return;
    }

    if (!formData.phone || !isPhoneValid) {
      setErrorMessage('Please enter a valid phone number for the selected country.');
      return;
    }

    const reqs = checkPasswordRequirements(formData.password);

    if (!reqs.isValid) {
      setErrorMessage('Password does not satisfy all 5 security requirements.');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    if (!formData.acceptTerms) {
      setErrorMessage('Please accept the Terms of Service and Data Governance Policy.');
      return;
    }

    setIsSubmitting(true);

    try {
      const bodyFormData = new FormData();
      bodyFormData.append('request_company_name', formData.orgName.trim());
      bodyFormData.append('request_registration_no', formData.orgId.trim());
      bodyFormData.append('request_entity_type', 'Shipping Company / Shipping Agent');
      bodyFormData.append('request_applicant_name', formData.fullName.trim() || formData.orgName.trim());
      bodyFormData.append('request_email', formData.email.trim().toLowerCase());
      bodyFormData.append('request_phone', formData.phone.trim() || 'N/A');
      bodyFormData.append('request_jurisdiction', formData.country);
      bodyFormData.append('request_address', formData.address.trim() || 'N/A');
      bodyFormData.append('password', formData.password);
      bodyFormData.append('confirm_password', formData.confirmPassword);
      bodyFormData.append('request_terms_accepted', formData.acceptTerms ? 'true' : 'false');

      if (licenseFileObj) {
        bodyFormData.append('request_license_file', licenseFileObj);
      }
      if (idFileObj) {
        bodyFormData.append('request_id_file', idFileObj);
      }

      const response = await fetch(`${API_BASE_URL}/api/auth/registration/`, {
        method: 'POST',
        body: bodyFormData,
      });

      const result = await response.json();

      if (response.ok) {
        const regId = result.data?.registration_request_id;
        if (regId) {
          setSubmittedRequestId(regId);
        }

        setIsSubmitted(true);
        addToast('info', 'Registration Request Submitted', 'Forwarded to the Port Administrator for verification.');
      } else {
        const backendError = result.errors 
          ? Object.values(result.errors).flat().join(' ')
          : result.message || 'Registration request failed.';
        setErrorMessage(backendError);
      }
    } catch (error) {
      setErrorMessage('Unable to connect to the backend server. Please ensure the server is running.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen relative bg-slate-100 text-slate-900 flex flex-col justify-between selection:bg-[#D49A24] selection:text-white font-sans">
      
      {/* Background Image Layer with Subtle Dark Navy Overlay (rgba(5, 20, 40, 0.20)) */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <img 
          src="/register_bg.jpg" 
          alt="Cargo Container Ship Background" 
          className="w-full h-full object-cover"
        />
        <div 
          className="absolute inset-0 z-0" 
          style={{ background: 'rgba(5, 20, 40, 0.20)' }}
        />
      </div>

      {/* Header */}
      <header className="relative z-10 px-6 py-2.5 flex items-center justify-between border-b border-slate-200/80 bg-white/90 backdrop-blur-md shrink-0">
        <PortideLogo 
          variant="horizontal" 
          theme="light" 
          onClick={() => navigate('/')} 
          className="hover:opacity-95 transition-opacity scale-90 origin-left"
        />

        <button
          onClick={() => navigate('/login')}
          className="text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Login</span>
        </button>
      </header>

      {/* Main Container */}
      <main className="relative z-10 flex-1 max-w-4xl w-full mx-auto px-4 py-3 flex items-center justify-center">
        {isSubmitted ? (
          /* SUCCESS SUBMISSION VIEW */
          <div className="w-full p-6 sm:p-8 rounded-2xl bg-white border border-slate-200/90 text-center space-y-4 shadow-lg animate-fade-in">
            <div className="w-14 h-14 mx-auto rounded-full bg-emerald-500/10 border-2 border-emerald-500/40 flex items-center justify-center text-emerald-600">
              <Clock className="w-7 h-7 animate-pulse" />
            </div>

            <div className="space-y-1">
              <h2 className="text-xl sm:text-2xl font-black text-[#0b192c] tracking-tight">
                Registration Request Submitted Successfully!
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 max-w-lg mx-auto leading-relaxed">
                Your request has been forwarded to the Port Administrator for verification. Once approved, you will receive an email notification and can log in using your registered credentials.
              </p>
            </div>

            {submittedRequestId && (
              <div className="max-w-md mx-auto p-4 bg-amber-500/10 border border-[#D49A24]/40 rounded-xl text-center shadow-xs">
                <div className="text-[10px] font-black uppercase tracking-wider text-[#D49A24]">
                  Assigned Application Tracking Reference
                </div>
                <div className="text-2xl font-black font-mono text-[#0b192c] mt-1">
                  REG-2026-{String(submittedRequestId).padStart(3, '0')}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Keep this Reference ID handy. You can check your review status or submit additional documents anytime.
                </div>
              </div>
            )}

            <div className="max-w-md mx-auto p-4 rounded-xl bg-slate-50 border border-slate-200 text-left space-y-2 shadow-inner">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#D49A24]">Application Reference Summary</div>
              
              <div className="flex justify-between text-xs">
                <span className="text-slate-500 font-medium">Company Name:</span>
                <span className="font-bold text-[#0b192c]">{formData.orgName}</span>
              </div>
              
              <div className="flex justify-between text-xs">
                <span className="text-slate-500 font-medium">Registration Number:</span>
                <span className="font-bold text-[#0b192c]">{formData.orgId}</span>
              </div>

              <div className="flex justify-between text-xs">
                <span className="text-slate-500 font-medium">Authorized Representative:</span>
                <span className="font-bold text-[#0b192c]">{formData.fullName}</span>
              </div>
              
              <div className="flex justify-between text-xs">
                <span className="text-slate-500 font-medium">Entity Type:</span>
                <span className="font-bold text-[#D49A24]">Shipping Company / Shipping Agent</span>
              </div>

              <div className="flex justify-between text-xs">
                <span className="text-slate-500 font-medium">Country:</span>
                <span className="font-bold text-[#0b192c]">{formData.country}</span>
              </div>

              <div className="flex justify-between text-xs pt-1 border-t border-slate-200">
                <span className="text-slate-500 font-medium">Verification Status:</span>
                <span className="font-bold text-amber-600 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Pending Compliance Review
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
              Once reviewed, an email notification will be sent to <span className="text-[#D49A24] font-semibold">{formData.email}</span>.
            </p>

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              {submittedRequestId && (
                <button
                  onClick={() => navigate(`/registration-status?id=${submittedRequestId}`)}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#D49A24] hover:bg-[#b8831b] text-white font-bold text-xs uppercase tracking-wider shadow-md transition-all border border-[#D49A24] cursor-pointer flex items-center justify-center gap-2"
                >
                  <Clock className="w-4 h-4" />
                  <span>Check Registration Status</span>
                </button>
              )}
              <button
                onClick={() => navigate('/login')}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs uppercase tracking-wider transition-all border border-slate-300 cursor-pointer"
              >
                Return to Login
              </button>
              <button
                onClick={() => navigate('/')}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs uppercase tracking-wider transition-all border border-slate-300 cursor-pointer"
              >
                Return to Home Page
              </button>
            </div>
          </div>
        ) : (
          /* FORM ENTRY VIEW - Enterprise Registration Card */
          <div className="w-full px-6 py-4 rounded-2xl bg-white border border-slate-200/90 shadow-lg space-y-3 animate-fade-in">
            
            {/* Title & Subtitle */}
            <div className="space-y-0.5 border-b border-slate-200/80 pb-2 text-left">
              <h1 className="text-xl sm:text-2xl font-black text-[#0b192c] tracking-tight">
                PORTIDE Entity Registration
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                Request access to the PORTIDE maritime operations platform.
              </p>
            </div>

            {errorMessage && (
              <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-700 text-xs flex items-center gap-2 animate-fade-in">
                <ShieldCheck className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3">
              
              {/* 2-Column Form Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                
                {/* LEFT COLUMN 1: Company Name */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-0.5">
                    Company Name
                  </label>
                  <div className="relative">
                    <Building2 className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      required
                      value={formData.orgName}
                      onChange={(e) => setFormData({ ...formData, orgName: e.target.value })}
                      placeholder="e.g. Pacific Freight Carriers Ltd."
                      className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-50 border border-slate-300 text-slate-900 text-xs focus:outline-none focus:border-[#D49A24] focus:ring-1 focus:ring-[#D49A24]/20 transition-all placeholder:text-slate-400 font-medium"
                    />
                  </div>
                </div>

                {/* RIGHT COLUMN 1: Company License / Registration Number */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-0.5">
                    Company License / Registration Number
                  </label>
                  <div className="relative">
                    <FileText className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      required
                      value={formData.orgId}
                      onChange={(e) => setFormData({ ...formData, orgId: e.target.value })}
                      placeholder="e.g. LIC-PORT-2026-001"
                      className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-50 border border-slate-300 text-slate-900 text-xs focus:outline-none focus:border-[#D49A24] focus:ring-1 focus:ring-[#D49A24]/20 transition-all placeholder:text-slate-400 font-medium"
                    />
                  </div>
                </div>

                {/* LEFT COLUMN 2: Authorized Representative Name */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-0.5">
                    Authorized Representative Name
                  </label>
                  <div className="relative">
                    <User className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      required
                      value={formData.fullName}
                      onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                      placeholder="Capt. Arthur Pendelton"
                      className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-50 border border-slate-300 text-slate-900 text-xs focus:outline-none focus:border-[#D49A24] focus:ring-1 focus:ring-[#D49A24]/20 transition-all placeholder:text-slate-400 font-medium"
                    />
                  </div>
                </div>

                {/* RIGHT COLUMN 2: Entity Type */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-0.5">
                    Entity Type
                  </label>
                  <div className="relative">
                    <Ship className="w-3.5 h-3.5 text-[#D49A24] absolute left-3 top-2.5" />
                    <input
                      type="text"
                      readOnly
                      value="Shipping Company / Shipping Agent"
                      className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-100 border border-slate-300 text-[#0b192c] text-xs font-semibold cursor-not-allowed select-none"
                    />
                  </div>
                </div>

                {/* LEFT COLUMN 3: Email Address */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-0.5">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="representative@shipping.com"
                      className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-50 border border-slate-300 text-slate-900 text-xs focus:outline-none focus:border-[#D49A24] focus:ring-1 focus:ring-[#D49A24]/20 transition-all placeholder:text-slate-400 font-medium"
                    />
                  </div>
                </div>

                {/* RIGHT COLUMN 3: Direct Contact Phone */}
                <div>
                  <InternationalPhoneInput
                    label="Direct Contact Phone"
                    required
                    value={formData.phone}
                    selectedCountryCode={getCountryByName(formData.country)?.iso2 || 'SG'}
                    defaultCountry="SG"
                    onChange={(e164, isValid) => {
                      setFormData({ ...formData, phone: e164 });
                      setIsPhoneValid(isValid);
                    }}
                  />
                </div>


                {/* LEFT COLUMN 4: Jurisdiction / Country of Origin */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-0.5">
                    Jurisdiction / Country of Origin
                  </label>
                  <div className="relative">
                    <Globe className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                    <select
                      value={formData.country}
                      onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                      className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-50 border border-slate-300 text-slate-900 text-xs focus:outline-none focus:border-[#D49A24] focus:ring-1 focus:ring-[#D49A24]/20 transition-all font-medium cursor-pointer"
                    >
                      {SUPPORTED_COUNTRY_NAMES.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* RIGHT COLUMN 4: Headquarters Address */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-0.5">
                    Headquarters Address
                  </label>
                  <div className="relative">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      required
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      placeholder="12 Marina Boulevard, Singapore"
                      className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-50 border border-slate-300 text-slate-900 text-xs focus:outline-none focus:border-[#D49A24] focus:ring-1 focus:ring-[#D49A24]/20 transition-all placeholder:text-slate-400 font-medium"
                    />
                  </div>
                </div>

                {/* LEFT COLUMN 5: Account Password */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-0.5">
                    Account Password
                  </label>
                  <div className="relative">
                    <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder="••••••••••••"
                      className="w-full pl-9 pr-9 py-1.5 rounded-lg bg-slate-50 border border-slate-300 text-slate-900 text-xs focus:outline-none focus:border-[#D49A24] focus:ring-1 focus:ring-[#D49A24]/20 transition-all placeholder:text-slate-400 font-medium"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-2 p-0.5 text-slate-400 hover:text-slate-700 rounded-md transition-colors cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* RIGHT COLUMN 5: Confirm Password */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-0.5">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                      placeholder="••••••••••••"
                      className="w-full pl-9 pr-9 py-1.5 rounded-lg bg-slate-50 border border-slate-300 text-slate-900 text-xs focus:outline-none focus:border-[#D49A24] focus:ring-1 focus:ring-[#D49A24]/20 transition-all placeholder:text-slate-400 font-medium"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-2.5 top-2 p-0.5 text-slate-400 hover:text-slate-700 rounded-md transition-colors cursor-pointer"
                    >
                      {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                    <div className="text-[10px] font-bold text-rose-500 mt-0.5">
                      Passwords do not match.
                    </div>
                  )}
                </div>

                <div className="col-span-1 sm:col-span-2">
                  <PasswordRequirementChecklist password={formData.password} />
                </div>
              </div>

              {/* Document Uploads */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-0.5">
                
                {/* Upload Company Licence / Maritime Permit */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-0.5">
                    Upload Company Licence / Maritime Permit
                  </label>
                  <input
                    type="file"
                    ref={licenseInputRef}
                    onChange={handleLicenseSelect}
                    accept=".pdf,.png,.jpg,.jpeg"
                    className="hidden"
                  />
                  <div 
                    onClick={() => licenseInputRef.current?.click()}
                    className="px-3 py-1.5 rounded-lg bg-slate-50 border border-dashed border-slate-300 hover:border-[#D49A24] cursor-pointer text-center transition-all group flex items-center justify-center gap-2"
                  >
                    {licenseFile ? (
                      <div className="flex items-center justify-center gap-1.5 text-emerald-600 text-xs font-bold truncate">
                        <FileCheck className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{licenseFile}</span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-1.5 text-xs font-medium text-slate-600 group-hover:text-[#D49A24]">
                        <Upload className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#D49A24]" />
                        <span>Upload licence (PDF/PNG/JPG)</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Upload Authorized Representative ID */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-0.5">
                    Upload Representative ID
                  </label>
                  <input
                    type="file"
                    ref={idInputRef}
                    onChange={handleIdSelect}
                    accept=".pdf,.png,.jpg,.jpeg"
                    className="hidden"
                  />
                  <div 
                    onClick={() => idInputRef.current?.click()}
                    className="px-3 py-1.5 rounded-lg bg-slate-50 border border-dashed border-slate-300 hover:border-[#D49A24] cursor-pointer text-center transition-all group flex items-center justify-center gap-2"
                  >
                    {idFile ? (
                      <div className="flex items-center justify-center gap-1.5 text-emerald-600 text-xs font-bold truncate">
                        <FileCheck className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{idFile}</span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-1.5 text-xs font-medium text-slate-600 group-hover:text-[#D49A24]">
                        <Upload className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#D49A24]" />
                        <span>Upload ID document (PDF/PNG/JPG)</span>
                      </div>
                    )}
                  </div>
                </div>

              </div>

              {/* Terms and Authorization Checkbox */}
              <div>
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 select-none">
                  <input
                    type="checkbox"
                    checked={formData.acceptTerms}
                    onChange={(e) => setFormData({ ...formData, acceptTerms: e.target.checked })}
                    className="w-3.5 h-3.5 rounded bg-white border-slate-300 text-[#D49A24] focus:ring-[#D49A24]"
                  />
                  <span className="font-medium text-[11px]">
                    I confirm I am an authorized representative and agree to the Terms of Service & Privacy Policy.
                  </span>
                </label>
              </div>

              {/* Action Button: Primary Submit Registration Request */}
              <div>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`w-full py-2.5 px-6 rounded-xl text-xs font-black uppercase tracking-wider text-white transition-all flex items-center justify-center gap-2 border ${
                    isSubmitting 
                      ? 'bg-amber-600/70 border-amber-600/70 cursor-not-allowed opacity-80 shadow-none' 
                      : 'bg-[#D49A24] hover:bg-[#b8831b] border-[#D49A24] shadow-md cursor-pointer'
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>SUBMITTING REGISTRATION APPLICATION...</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" />
                      <span>SUBMIT REGISTRATION REQUEST</span>
                    </>
                  )}
                </button>
              </div>

              {/* Security Message */}
              <div className="text-center text-[10px] text-slate-500 font-medium flex items-center justify-center gap-1.5 pt-1 border-t border-slate-200/80">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>All submitted information is securely stored and verified before account activation.</span>
              </div>

            </form>

          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="relative z-10 py-1.5 px-4 text-center text-[10px] text-slate-600 border-t border-slate-200/80 bg-white/90 backdrop-blur-md shrink-0">
        Portide Express Service Infrastructure • Registration Compliance Submissions
      </footer>

    </div>
  );
};
