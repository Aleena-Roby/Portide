import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { PortideLogo } from '../common/PortideLogo';
import { useApp } from '../../context/AppContext';
import { API_BASE_URL } from '../../services/api';
import {
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  UploadCloud,
  FileText,
  Download,
  ArrowLeft,
  Search,
  Building2,
  Mail,
  ShieldCheck,
  RefreshCw,
  FileCheck,
  Info,
  Check,
  ChevronRight
} from 'lucide-react';

interface ShippingCompanyInfo {
  shipping_company_id: number;
  shipping_company_name: string;
  shipping_company_license_number: string;
  shipping_company_email: string;
  shipping_company_phone: string;
  shipping_company_address: string;
  shipping_company_jurisdiction: string;
  shipping_company_status: string;
  shipping_company_created_at: string;
}

interface RegistrationRequestRecord {
  registration_request_id: number;
  shipping_company: ShippingCompanyInfo;
  registration_request_entity_type: string;
  registration_request_applicant_name: string;
  registration_request_license_file: string | null;
  registration_request_id_file: string | null;
  registration_request_previous_license_file?: string | null;
  registration_request_previous_id_file?: string | null;
  registration_request_terms_accepted: boolean;
  registration_request_status: 'PENDING' | 'ACTION_REQUIRED' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
  registration_request_action_required_docs?: string | null;
  registration_request_admin_remarks?: string | null;
  registration_request_rejection_reason?: string | null;
  registration_request_submitted_at: string;
  registration_request_resubmitted_at?: string | null;
  registration_request_reviewed_at?: string | null;
  reviewer_name?: string | null;
}

export const RegistrationStatusPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { addToast } = useApp();

  const [searchInput, setSearchInput] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [registrationData, setRegistrationData] = useState<RegistrationRequestRecord | null>(null);

  // Resubmission state (used when status is ACTION_REQUIRED)
  const [resubmitLicenseFile, setResubmitLicenseFile] = useState<File | null>(null);
  const [resubmitIdFile, setResubmitIdFile] = useState<File | null>(null);
  const [applicantNotes, setApplicantNotes] = useState<string>('');
  const [resubmitting, setResubmitting] = useState<boolean>(false);
  const [resubmitSuccess, setResubmitSuccess] = useState<boolean>(false);

  const licenseInputRef = useRef<HTMLInputElement>(null);
  const idInputRef = useRef<HTMLInputElement>(null);

  const fetchStatus = async (query: string) => {
    if (!query.trim()) {
      setError('Please enter a Registration Request ID or Company Email.');
      return;
    }

    setLoading(true);
    setError('');
    setResubmitSuccess(false);

    try {
      const trimmed = query.trim();
      const isEmail = trimmed.includes('@');
      const paramName = isEmail ? 'email' : 'request_id';
      
      const response = await fetch(`${API_BASE_URL}/api/auth/registration-status/?${paramName}=${encodeURIComponent(trimmed)}`);
      const result = await response.json();

      if (response.ok && result.status === 'success') {
        setRegistrationData(result.data);
      } else {
        setRegistrationData(null);
        setError(result.message || 'No registration record found. Please verify your details and try again.');
      }
    } catch {
      setError('Unable to connect to the PORTIDE verification service. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  // On page load, read query params ?id= or ?email=
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const idParam = params.get('id') || params.get('request_id');
    const emailParam = params.get('email');

    const initialQuery = idParam || emailParam;
    if (initialQuery) {
      setSearchInput(initialQuery);
      fetchStatus(initialQuery);
    }
  }, [location.search]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchStatus(searchInput);
  };

  const handleResubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!registrationData) return;

    if (!resubmitLicenseFile && !resubmitIdFile) {
      setError('Please select at least one corrected document (Company Licence or Representative ID) to upload.');
      return;
    }

    setResubmitting(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('registration_request_id', String(registrationData.registration_request_id));
      if (resubmitLicenseFile) {
        formData.append('request_license_file', resubmitLicenseFile);
      }
      if (resubmitIdFile) {
        formData.append('request_id_file', resubmitIdFile);
      }
      if (applicantNotes.trim()) {
        formData.append('applicant_notes', applicantNotes.trim());
      }

      const response = await fetch(`${API_BASE_URL}/api/auth/registration-resubmit/`, {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (response.ok && result.status === 'success') {
        setRegistrationData(result.data);
        setResubmitSuccess(true);
        setResubmitLicenseFile(null);
        setResubmitIdFile(null);
        setApplicantNotes('');
        addToast('success', 'Documents Resubmitted', 'Your corrected files have been received and returned to the review queue.');
      } else {
        setError(result.message || 'Resubmission failed. Please check the files and try again.');
      }
    } catch {
      setError('Network error while uploading documents. Please verify your connection.');
    } finally {
      setResubmitting(false);
    }
  };

  const formatRequestId = (id: number) => `REG-2026-${String(id).padStart(3, '0')}`;

  const formatDate = (isoString?: string | null) => {
    if (!isoString) return '—';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return isoString;
    }
  };

  const getFileUrl = (path: string | null) => {
    if (!path) return '#';
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    return `${API_BASE_URL}${path.startsWith('/') ? path : '/' + path}`;
  };

  // Determine if specific documents were flagged by admin
  const actionRequiredDocs = registrationData?.registration_request_action_required_docs || '';
  const licenseCorrectionRequested = actionRequiredDocs.toLowerCase().includes('licence') || 
                                     actionRequiredDocs.toLowerCase().includes('license') ||
                                     actionRequiredDocs.toLowerCase().includes('all') ||
                                     !actionRequiredDocs;
  const idCorrectionRequested = actionRequiredDocs.toLowerCase().includes('id') || 
                               actionRequiredDocs.toLowerCase().includes('representative') ||
                               actionRequiredDocs.toLowerCase().includes('all') ||
                               !actionRequiredDocs;

  return (
    <div className="min-h-screen relative bg-slate-100 text-slate-900 flex flex-col justify-between selection:bg-[#D49A24] selection:text-white font-sans">
      
      {/* Background Image Layer with Subtle Dark Overlay */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <img 
          src="/register_bg.jpg" 
          alt="Cargo Vessel Background" 
          className="w-full h-full object-cover"
        />
        <div 
          className="absolute inset-0 z-0" 
          style={{ background: 'rgba(5, 20, 40, 0.40)' }}
        />
      </div>

      {/* Header Bar */}
      <header className="relative z-10 px-6 py-3 flex items-center justify-between border-b border-slate-200/80 bg-white/95 backdrop-blur-md shrink-0 shadow-xs">
        <PortideLogo 
          variant="horizontal" 
          theme="light" 
          onClick={() => navigate('/')} 
          className="hover:opacity-95 transition-opacity scale-90 origin-left"
        />

        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/login')}
            className="text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Login</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 flex-1 max-w-4xl w-full mx-auto px-4 py-6 sm:py-8 flex flex-col justify-center">
        
        {/* Search / Lookup Card */}
        <div className="w-full bg-white rounded-2xl border border-slate-200/90 shadow-xl p-6 sm:p-8 space-y-6 animate-fade-in">
          
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/10 text-[#D49A24] border border-[#D49A24]/30">
                PORTIDE Compliance Tracker
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-[#0b192c] tracking-tight">
              Registration Status & Document Review
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 font-medium">
              Track the live approval status of your Shipping Company registration or submit requested document updates.
            </p>
          </div>

          {/* Search Form */}
          <form onSubmit={handleSearchSubmit} className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-2.5">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Enter Request ID (e.g. REG-2026-001) or Registered Company Email..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 bg-slate-50/50 text-slate-900 text-xs font-medium placeholder:text-slate-400 focus:outline-none focus:border-[#D49A24] focus:bg-white transition-all shadow-inner"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2.5 rounded-xl bg-[#D49A24] hover:bg-[#b8831b] text-white font-bold text-xs uppercase tracking-wider shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shrink-0 border border-[#D49A24]"
              >
                {loading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    <span>Check Status</span>
                  </>
                )}
              </button>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2 animate-fade-in">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
                <span>{error}</span>
              </div>
            )}
          </form>

          {/* RESULTS DISPLAY */}
          {registrationData && (
            <div className="space-y-6 pt-4 border-t border-slate-100 animate-fade-in">

              {/* Status Header Banner */}
              {registrationData.registration_request_status === 'APPROVED' && (
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="font-bold text-emerald-900 text-sm">Registration Approved</div>
                      <div className="text-emerald-700 text-xs mt-0.5">
                        Your account has been fully verified and activated. You can now sign in to the platform.
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => navigate('/login')}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-md transition-all cursor-pointer shrink-0"
                  >
                    <span>Sign In Now</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}

              {registrationData.registration_request_status === 'PENDING' && (
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-3 shadow-xs">
                  <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <Clock className="w-6 h-6 animate-pulse" />
                  </div>
                  <div>
                    <div className="font-bold text-amber-900 text-sm">Pending Port Administrator Review</div>
                    <div className="text-amber-800 text-xs mt-0.5 leading-relaxed">
                      Your application has been received and is currently in the review queue. Standard compliance review takes 24 to 48 hours. You will receive an email as soon as an administrator takes action.
                    </div>
                    {registrationData.registration_request_resubmitted_at && (
                      <div className="mt-2 text-[11px] font-bold text-amber-700 bg-amber-100/70 px-2.5 py-1 rounded-md inline-flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        Corrected files resubmitted on {formatDate(registrationData.registration_request_resubmitted_at)}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {registrationData.registration_request_status === 'ACTION_REQUIRED' && (
                <div className="p-4 rounded-xl bg-orange-50 border border-orange-200 space-y-3 shadow-xs">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-orange-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                      <AlertTriangle className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                      <div className="font-bold text-orange-900 text-sm">Action Required — Additional Documentation Requested</div>
                      <div className="text-orange-800 text-xs mt-0.5 leading-relaxed">
                        The Port Administrator has reviewed your submission and requested corrections or updated documents before access can be approved.
                      </div>
                    </div>
                  </div>

                  {/* Admin Instructions Box */}
                  <div className="p-3.5 rounded-lg bg-white border border-orange-200/90 text-xs space-y-1.5">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-orange-700 flex items-center gap-1">
                      <Info className="w-3.5 h-3.5" />
                      Administrator Instructions / Remarks:
                    </div>
                    <p className="text-slate-800 font-medium whitespace-pre-wrap leading-relaxed">
                      {registrationData.registration_request_admin_remarks || 'Please update your supporting documents as required.'}
                    </p>
                    {registrationData.registration_request_action_required_docs && (
                      <div className="text-[11px] text-slate-600 pt-1 border-t border-slate-100">
                        <span className="font-bold text-slate-700">Flagged Documents: </span>
                        <span className="font-semibold text-orange-800">{registrationData.registration_request_action_required_docs}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {registrationData.registration_request_status === 'REJECTED' && (
                <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-3 shadow-xs">
                  <div className="w-10 h-10 rounded-xl bg-rose-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <XCircle className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="font-bold text-rose-900 text-sm">Registration Request Rejected</div>
                    <div className="text-rose-800 text-xs mt-0.5 leading-relaxed">
                      Your registration request was not approved by the Port Authority.
                    </div>
                    <div className="mt-2 p-2.5 rounded-lg bg-white border border-rose-200 text-xs text-rose-900">
                      <span className="font-bold">Reason: </span>
                      {registrationData.registration_request_rejection_reason || 'Compliance verification requirements not met.'}
                    </div>
                  </div>
                </div>
              )}

              {registrationData.registration_request_status === 'SUSPENDED' && (
                <div className="p-4 rounded-xl bg-slate-100 border border-slate-300 flex items-start gap-3 shadow-xs">
                  <div className="w-10 h-10 rounded-xl bg-slate-700 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <XCircle className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="font-bold text-slate-900 text-sm">Account Suspended</div>
                    <div className="text-slate-700 text-xs mt-0.5 leading-relaxed">
                      This account is currently suspended. Please contact the Port Operations Authority administration office directly for assistance.
                    </div>
                  </div>
                </div>
              )}

              {/* Reference Details Grid */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#D49A24] flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5" />
                    Application Reference Record
                  </div>
                  <span className="font-mono text-xs font-black text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200">
                    {formatRequestId(registrationData.registration_request_id)}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                  <div>
                    <div className="text-[10px] text-slate-500 font-medium">Company Name:</div>
                    <div className="font-bold text-slate-900 mt-0.5">
                      {registrationData.shipping_company?.shipping_company_name}
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] text-slate-500 font-medium">License / Registration No:</div>
                    <div className="font-mono font-bold text-slate-900 mt-0.5">
                      {registrationData.shipping_company?.shipping_company_license_number}
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] text-slate-500 font-medium">Authorized Representative:</div>
                    <div className="font-bold text-slate-900 mt-0.5">
                      {registrationData.registration_request_applicant_name}
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] text-slate-500 font-medium">Registered Email:</div>
                    <div className="font-semibold text-slate-900 mt-0.5">
                      {registrationData.shipping_company?.shipping_company_email}
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] text-slate-500 font-medium">Jurisdiction:</div>
                    <div className="font-semibold text-slate-900 mt-0.5">
                      {registrationData.shipping_company?.shipping_company_jurisdiction || 'International'}
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] text-slate-500 font-medium">Initial Submission:</div>
                    <div className="font-semibold text-slate-900 mt-0.5">
                      {formatDate(registrationData.registration_request_submitted_at)}
                    </div>
                  </div>
                </div>

                {/* Document Links Section */}
                <div className="pt-2 border-t border-slate-200">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Current Attached Documentation
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 rounded-lg bg-white border border-slate-200 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-slate-400" />
                        <div>
                          <div className="font-bold text-slate-800 text-[11px]">Company Licence</div>
                          <div className="text-[10px] text-slate-500">
                            {registrationData.registration_request_license_file ? 'Document on file' : 'Not attached'}
                          </div>
                        </div>
                      </div>
                      {registrationData.registration_request_license_file && (
                        <a
                          href={getFileUrl(registrationData.registration_request_license_file)}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold flex items-center gap-1 transition-colors"
                        >
                          <Download className="w-3 h-3" /> View
                        </a>
                      )}
                    </div>

                    <div className="p-2.5 rounded-lg bg-white border border-slate-200 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileCheck className="w-4 h-4 text-slate-400" />
                        <div>
                          <div className="font-bold text-slate-800 text-[11px]">Representative ID</div>
                          <div className="text-[10px] text-slate-500">
                            {registrationData.registration_request_id_file ? 'Document on file' : 'Not attached'}
                          </div>
                        </div>
                      </div>
                      {registrationData.registration_request_id_file && (
                        <a
                          href={getFileUrl(registrationData.registration_request_id_file)}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold flex items-center gap-1 transition-colors"
                        >
                          <Download className="w-3 h-3" /> View
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* TARGETED RESUBMISSION FORM (Displayed ONLY when status is ACTION_REQUIRED) */}
              {registrationData.registration_request_status === 'ACTION_REQUIRED' && (
                <div className="p-5 sm:p-6 rounded-2xl bg-white border-2 border-orange-300 shadow-md space-y-4 animate-fade-in">
                  
                  <div className="space-y-1">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-orange-700 flex items-center gap-1.5">
                      <UploadCloud className="w-4 h-4" />
                      Document Correction & Resubmission
                    </div>
                    <h3 className="text-base sm:text-lg font-black text-[#0b192c]">
                      Upload Corrected Documentation
                    </h3>
                    <p className="text-xs text-slate-600">
                      Upload only the missing or revised documents requested by the administrator. You do not need to re-enter your company profile information.
                    </p>
                  </div>

                  {resubmitSuccess && (
                    <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 animate-fade-in">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                      <span>
                        <strong>Success!</strong> Your corrected files have been uploaded. Your application status is now updated to <strong>PENDING REVIEW</strong>.
                      </span>
                    </div>
                  )}

                  <form onSubmit={handleResubmit} className="space-y-4 pt-1">

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      
                      {/* Company Licence Upload (Highlighted if requested) */}
                      <div className={`p-4 rounded-xl border-2 transition-all ${
                        licenseCorrectionRequested 
                          ? 'border-orange-300 bg-orange-50/40' 
                          : 'border-slate-200 bg-slate-50/50'
                      }`}>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                            <FileText className="w-4 h-4 text-orange-600" />
                            <span>Updated Company Licence</span>
                          </label>
                          {licenseCorrectionRequested && (
                            <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-orange-500 text-white">
                              Required
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 mb-3">
                          PDF, PNG, JPG up to 10MB. Official operating certificate or registration.
                        </p>

                        <input
                          ref={licenseInputRef}
                          type="file"
                          accept=".pdf,.png,.jpg,.jpeg"
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              setResubmitLicenseFile(e.target.files[0]);
                            }
                          }}
                          className="hidden"
                        />

                        {resubmitLicenseFile ? (
                          <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-between text-xs">
                            <div className="truncate font-semibold text-emerald-800 max-w-[180px]">
                              {resubmitLicenseFile.name}
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setResubmitLicenseFile(null);
                                if (licenseInputRef.current) licenseInputRef.current.value = '';
                              }}
                              className="text-[10px] font-bold text-rose-600 hover:text-rose-800 cursor-pointer ml-2"
                            >
                              Remove
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => licenseInputRef.current?.click()}
                            className="w-full py-2.5 px-3 rounded-lg border border-dashed border-orange-400 bg-white hover:bg-orange-50/60 text-orange-700 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <UploadCloud className="w-4 h-4" />
                            <span>Choose Replacement File</span>
                          </button>
                        )}
                      </div>

                      {/* Representative ID Upload (Highlighted if requested) */}
                      <div className={`p-4 rounded-xl border-2 transition-all ${
                        idCorrectionRequested 
                          ? 'border-orange-300 bg-orange-50/40' 
                          : 'border-slate-200 bg-slate-50/50'
                      }`}>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                            <FileCheck className="w-4 h-4 text-orange-600" />
                            <span>Updated Representative ID</span>
                          </label>
                          {idCorrectionRequested && (
                            <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-orange-500 text-white">
                              Required
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 mb-3">
                          PDF, PNG, JPG up to 10MB. Valid passport, national ID, or port pass.
                        </p>

                        <input
                          ref={idInputRef}
                          type="file"
                          accept=".pdf,.png,.jpg,.jpeg"
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              setResubmitIdFile(e.target.files[0]);
                            }
                          }}
                          className="hidden"
                        />

                        {resubmitIdFile ? (
                          <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-between text-xs">
                            <div className="truncate font-semibold text-emerald-800 max-w-[180px]">
                              {resubmitIdFile.name}
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setResubmitIdFile(null);
                                if (idInputRef.current) idInputRef.current.value = '';
                              }}
                              className="text-[10px] font-bold text-rose-600 hover:text-rose-800 cursor-pointer ml-2"
                            >
                              Remove
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => idInputRef.current?.click()}
                            className="w-full py-2.5 px-3 rounded-lg border border-dashed border-orange-400 bg-white hover:bg-orange-50/60 text-orange-700 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <UploadCloud className="w-4 h-4" />
                            <span>Choose Replacement File</span>
                          </button>
                        )}
                      </div>

                    </div>

                    {/* Applicant Notes / Remarks */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Applicant Notes / Clarifications (Optional):
                      </label>
                      <textarea
                        value={applicantNotes}
                        onChange={(e) => setApplicantNotes(e.target.value)}
                        placeholder="Provide any additional explanation or clarification for the Port Administrator..."
                        rows={2}
                        className="w-full p-2.5 rounded-xl border border-slate-300 bg-slate-50 text-slate-900 text-xs focus:outline-none focus:border-[#D49A24] focus:bg-white transition-all shadow-inner"
                      />
                    </div>

                    {/* Resubmit Button */}
                    <div className="pt-2 flex justify-end">
                      <button
                        type="submit"
                        disabled={resubmitting || (!resubmitLicenseFile && !resubmitIdFile)}
                        className="w-full sm:w-auto px-6 py-3 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-black text-xs uppercase tracking-wider shadow-md hover:shadow-orange-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        {resubmitting ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span>Uploading & Resubmitting...</span>
                          </>
                        ) : (
                          <>
                            <UploadCloud className="w-4 h-4" />
                            <span>Resubmit Documents for Review</span>
                          </>
                        )}
                      </button>
                    </div>

                  </form>
                </div>
              )}

            </div>
          )}

        </div>

      </main>

      {/* Footer */}
      <footer className="relative z-10 py-3 px-6 text-center text-[11px] text-slate-500 bg-white/90 backdrop-blur-xs border-t border-slate-200">
        Portide Enterprise Maritime Intelligence • Port Administrator Verification Desk
      </footer>

    </div>
  );
};
