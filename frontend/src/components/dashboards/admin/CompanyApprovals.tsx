import React, { useState, useEffect } from 'react';
import { useApp } from '../../../context/AppContext';
import { Modal } from '../../common/Modal';
import { 
  Building2, 
  Search, 
  Filter, 
  CheckCircle2, 
  XCircle, 
  Eye, 
  Clock, 
  FileText, 
  Download,
  Globe, 
  Mail, 
  Phone, 
  MapPin, 
  FileCheck, 
  X, 
  RefreshCw,
  ShieldCheck,
  AlertTriangle,
  User
} from 'lucide-react';

interface ShippingCompanyData {
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

interface RegistrationRequestData {
  registration_request_id: number;
  shipping_company: ShippingCompanyData;
  registration_request_entity_type: string;
  registration_request_applicant_name: string;
  registration_request_license_file: string | null;
  registration_request_id_file: string | null;
  registration_request_previous_license_file?: string | null;
  registration_request_previous_id_file?: string | null;
  registration_request_terms_accepted: boolean;
  registration_request_status: 'PENDING' | 'ACTION_REQUIRED' | 'APPROVED' | 'REJECTED';
  registration_request_action_required_docs?: string | null;
  registration_request_admin_remarks?: string | null;
  registration_request_rejection_reason?: string | null;
  registration_request_submitted_at: string;
  registration_request_resubmitted_at?: string | null;
  registration_request_reviewed_at?: string | null;
  user_id?: number | null;
  reviewer_name?: string | null;
}

export const CompanyApprovals: React.FC = () => {
  const { addToast } = useApp();

  const [requests, setRequests] = useState<RegistrationRequestData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  
  const [statusFilter, setStatusFilter] = useState<'PENDING' | 'ACTION_REQUIRED' | 'APPROVED' | 'REJECTED' | 'ALL'>('PENDING');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Selected request for View Application Modal
  const [selectedRequest, setSelectedRequest] = useState<RegistrationRequestData | null>(null);
  
  // Review remarks inside the modal
  const [reviewRemarks, setReviewRemarks] = useState<string>('');
  const [remarksError, setRemarksError] = useState<string>('');

  // Selected request for Rejection Confirmation Dialog
  const [rejectingRequest, setRejectingRequest] = useState<RegistrationRequestData | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('');
  
  // Selected request for Action Required Dialog
  const [actionRequiredRequest, setActionRequiredRequest] = useState<RegistrationRequestData | null>(null);
  const [reqDocLicence, setReqDocLicence] = useState<boolean>(true);
  const [reqDocId, setReqDocId] = useState<boolean>(false);
  const [reqDocOther, setReqDocOther] = useState<boolean>(false);
  const [actionRequiredRemarks, setActionRequiredRemarks] = useState<string>('');

  const [actionLoading, setActionLoading] = useState<boolean>(false);

  const fetchRegistrationRequests = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('http://127.0.0.1:8000/api/admin/registration-requests/');
      const result = await response.json();

      if (response.ok && result.status === 'success') {
        setRequests(result.data || []);
      } else {
        setError(result.message || 'Failed to load registration requests.');
      }
    } catch (err) {
      setError('Unable to connect to the backend server. Please verify Django is running.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRegistrationRequests();
  }, []);

  const openApplicationModal = (req: RegistrationRequestData) => {
    setSelectedRequest(req);
    setReviewRemarks(req.registration_request_rejection_reason || '');
    setRemarksError('');
  };

  const handleApprove = async (req: RegistrationRequestData, remarksOverride?: string) => {
    setActionLoading(true);
    setRemarksError('');
    const remarksToSave = remarksOverride !== undefined ? remarksOverride : reviewRemarks;
    try {
      const response = await fetch(`http://127.0.0.1:8000/api/admin/registration-requests/${req.registration_request_id}/approve/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          review_remarks: remarksToSave.trim()
        })
      });
      const result = await response.json();

      if (response.ok) {
        addToast('success', 'Registration Approved', `Shipping Company "${req.shipping_company.shipping_company_name}" approved successfully.`);
        if (selectedRequest?.registration_request_id === req.registration_request_id) {
          setSelectedRequest(null);
        }
        fetchRegistrationRequests();
      } else {
        addToast('error', 'Approval Failed', result.message || 'Unable to process the registration request. Please try again.');
      }
    } catch (err) {
      addToast('error', 'Network Error', 'Unable to process the registration request. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectClickInModal = (req: RegistrationRequestData) => {
    const trimmedRemarks = reviewRemarks.trim();
    if (!trimmedRemarks) {
      setRemarksError('Review remarks / rejection reason is required to reject an application.');
      return;
    }
    setRemarksError('');
    setRejectingRequest(req);
    setRejectionReason(trimmedRemarks);
  };

  const handleConfirmReject = async () => {
    if (!rejectingRequest) return;
    const finalReason = rejectionReason.trim();
    if (!finalReason) {
      setRemarksError('Rejection reason is required.');
      return;
    }

    setActionLoading(true);
    try {
      const response = await fetch(`http://127.0.0.1:8000/api/admin/registration-requests/${rejectingRequest.registration_request_id}/reject/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rejection_reason: finalReason
        })
      });
      const result = await response.json();

      if (response.ok) {
        addToast('info', 'Registration Rejected', 'Shipping Company registration rejected.');
        if (selectedRequest?.registration_request_id === rejectingRequest.registration_request_id) {
          setSelectedRequest(null);
        }
        setRejectingRequest(null);
        setRejectionReason('');
        setReviewRemarks('');
        fetchRegistrationRequests();
      } else {
        addToast('error', 'Rejection Failed', result.message || 'Unable to process the registration request. Please try again.');
      }
    } catch (err) {
      addToast('error', 'Network Error', 'Unable to process the registration request. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmActionRequired = async () => {
    if (!actionRequiredRequest) return;
    const remarks = actionRequiredRemarks.trim();
    if (!remarks) {
      addToast('error', 'Remarks Required', 'Please enter admin instructions or remarks for the applicant.');
      return;
    }

    const docs = [];
    if (reqDocLicence) docs.push('Company Operating Licence');
    if (reqDocId) docs.push('Representative Identification Document');
    if (reqDocOther) docs.push('Other Registration Details');
    const docsString = docs.join(', ') || 'Supporting Documentation';

    setActionLoading(true);
    try {
      const response = await fetch(`http://127.0.0.1:8000/api/admin/registration-requests/${actionRequiredRequest.registration_request_id}/action-required/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action_required_docs: docsString,
          admin_remarks: remarks
        })
      });
      const result = await response.json();

      if (response.ok) {
        addToast('success', 'Action Required Triggered', `Notification email sent to "${actionRequiredRequest.shipping_company?.shipping_company_name}".`);
        if (selectedRequest?.registration_request_id === actionRequiredRequest.registration_request_id) {
          setSelectedRequest(null);
        }
        setActionRequiredRequest(null);
        setActionRequiredRemarks('');
        fetchRegistrationRequests();
      } else {
        addToast('error', 'Update Failed', result.message || 'Unable to update registration status.');
      }
    } catch {
      addToast('error', 'Network Error', 'Unable to connect to backend service.');
    } finally {
      setActionLoading(false);
    }
  };

  // Filter requests
  const filteredRequests = requests.filter(req => {
    const matchesStatus = statusFilter === 'ALL' || req.registration_request_status === statusFilter;
    const query = searchQuery.toLowerCase().trim();
    const company = req.shipping_company || {};
    const matchesSearch = !query || 
      (company.shipping_company_name && company.shipping_company_name.toLowerCase().includes(query)) ||
      (company.shipping_company_license_number && company.shipping_company_license_number.toLowerCase().includes(query)) ||
      (company.shipping_company_email && company.shipping_company_email.toLowerCase().includes(query)) ||
      (req.registration_request_applicant_name && req.registration_request_applicant_name.toLowerCase().includes(query)) ||
      (company.shipping_company_address && company.shipping_company_address.toLowerCase().includes(query));

    return matchesStatus && matchesSearch;
  });

  const getStatusBadge = (status: 'PENDING' | 'ACTION_REQUIRED' | 'APPROVED' | 'REJECTED') => {
    switch (status) {
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-3 h-3" /> Approved
          </span>
        );
      case 'ACTION_REQUIRED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-orange-500/10 border border-orange-500/30 text-orange-600 dark:text-orange-400">
            <AlertTriangle className="w-3 h-3" /> Action Required
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400">
            <XCircle className="w-3 h-3" /> Rejected
          </span>
        );
      case 'PENDING':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400">
            <Clock className="w-3 h-3 animate-pulse" /> Pending Review
          </span>
        );
    }
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  const getFileUrl = (filePath: string | null) => {
    if (!filePath) return '';
    return filePath.startsWith('http') ? filePath : `http://127.0.0.1:8000${filePath}`;
  };

  return (
    <div className="space-y-6">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-[#D49A24]" />
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              Shipping Company Registration Review
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Review submitted company details and supporting compliance documents to approve or reject registration requests.
          </p>
        </div>

        <button
          onClick={fetchRegistrationRequests}
          disabled={loading}
          className="self-start sm:self-auto px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Requests</span>
        </button>
      </div>

      {/* Filter and Search Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        
        {/* Status Tabs */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60">
          {(['PENDING', 'ACTION_REQUIRED', 'APPROVED', 'REJECTED', 'ALL'] as const).map((status) => {
            const count = status === 'ALL' 
              ? requests.length 
              : requests.filter(r => r.registration_request_status === status).length;

            const label = status === 'ALL' 
              ? 'All Requests' 
              : status === 'ACTION_REQUIRED' 
              ? 'Action Required' 
              : status === 'PENDING' 
              ? 'Pending Review' 
              : status.charAt(0) + status.slice(1).toLowerCase();

            return (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all cursor-pointer flex items-center gap-1.5 ${
                  statusFilter === status
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span>{label}</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  statusFilter === status
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by company name, license #, email..."
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-xs focus:outline-none focus:border-[#D49A24] transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
        
        {loading ? (
          <div className="p-12 text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-[#D49A24] animate-spin mx-auto" />
            <div className="text-xs font-bold text-slate-600 dark:text-slate-400">
              Loading Shipping Company registration requests...
            </div>
          </div>
        ) : error ? (
          <div className="p-8 text-center space-y-3">
            <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto" />
            <div className="text-sm font-bold text-rose-600 dark:text-rose-400">{error}</div>
            <button
              onClick={fetchRegistrationRequests}
              className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-200 transition-colors"
            >
              Try Again
            </button>
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Building2 className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto" />
            <div className="text-sm font-bold text-slate-700 dark:text-slate-300">
              No registration requests found
            </div>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              {searchQuery || statusFilter !== 'ALL'
                ? 'Try adjusting your search filters or status tab selection.'
                : 'No shipping companies have submitted registration requests yet.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 uppercase tracking-wider text-[10px] font-bold text-slate-400">
                <tr>
                  <th className="px-5 py-3">Company Details</th>
                  <th className="px-5 py-3">License / Registration #</th>
                  <th className="px-5 py-3">Email & Phone</th>
                  <th className="px-5 py-3">Submitted Date</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {filteredRequests.map((req) => {
                  const company = req.shipping_company || {};

                  return (
                    <tr 
                      key={req.registration_request_id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* Company Name */}
                      <td className="px-5 py-3.5">
                        <div 
                          onClick={() => openApplicationModal(req)}
                          className="font-bold text-slate-900 dark:text-white text-xs cursor-pointer hover:text-[#D49A24] dark:hover:text-[#D49A24] transition-colors group"
                          title="Click to view company registration application details"
                        >
                          <span className="group-hover:underline">{company.shipping_company_name || 'N/A'}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                          <User className="w-3 h-3 text-[#D49A24]" />
                          <span>Applicant: {req.registration_request_applicant_name || 'N/A'}</span>
                        </div>
                      </td>

                      {/* License Number */}
                      <td className="px-5 py-3.5 font-mono font-bold text-slate-700 dark:text-slate-300">
                        {company.shipping_company_license_number || 'N/A'}
                      </td>

                      {/* Contact Info */}
                      <td className="px-5 py-3.5 space-y-0.5">
                        <div className="text-slate-900 dark:text-white font-medium flex items-center gap-1">
                          <Mail className="w-3 h-3 text-slate-400" />
                          <span>{company.shipping_company_email || 'N/A'}</span>
                        </div>
                        <div className="text-slate-400 text-[11px] flex items-center gap-1">
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span>{company.shipping_company_phone || 'N/A'}</span>
                        </div>
                      </td>

                      {/* Submitted Date */}
                      <td className="px-5 py-3.5 text-slate-600 dark:text-slate-400">
                        <div>{formatDate(req.registration_request_submitted_at)}</div>
                        {req.registration_request_resubmitted_at && (
                          <div className="text-[10px] text-sky-600 dark:text-sky-400 font-bold mt-1 flex items-center gap-1">
                            <RefreshCw className="w-2.5 h-2.5 shrink-0" />
                            <span>Resubmitted: {formatDate(req.registration_request_resubmitted_at)}</span>
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-5 py-3.5">
                        {getStatusBadge(req.registration_request_status)}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3.5 text-right">
                        <button
                          onClick={(e) => { e.stopPropagation(); openApplicationModal(req); }}
                          className="px-3 py-1.5 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-600 dark:text-sky-400 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer ml-auto"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View Application</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* DETAILED REGISTRATION REVIEW MODAL */}
      <Modal
        isOpen={!!selectedRequest}
        onClose={() => setSelectedRequest(null)}
        title="Shipping Company Registration Review"
        subtitle={selectedRequest?.shipping_company?.shipping_company_name}
        icon={<Building2 className="w-4 h-4 text-[#D49A24]" />}
        maxWidth="3xl"
        footer={
          <div className="flex items-center justify-between w-full">
            <button
              onClick={() => setSelectedRequest(null)}
              className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors cursor-pointer"
            >
              Close
            </button>

            {(selectedRequest?.registration_request_status === 'PENDING' || selectedRequest?.registration_request_status === 'ACTION_REQUIRED') && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleRejectClickInModal(selectedRequest)}
                  disabled={actionLoading}
                  className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-md transition-all cursor-pointer disabled:opacity-50"
                >
                  <XCircle className="w-4 h-4" /> Reject
                </button>
                <button
                  onClick={() => {
                    setActionRequiredRequest(selectedRequest);
                    setActionRequiredRemarks(selectedRequest.registration_request_admin_remarks || '');
                  }}
                  disabled={actionLoading}
                  className="px-3.5 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-md transition-all cursor-pointer disabled:opacity-50"
                >
                  <AlertTriangle className="w-4 h-4" /> Action Required
                </button>
                <button
                  onClick={() => handleApprove(selectedRequest)}
                  disabled={actionLoading}
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-md transition-all cursor-pointer disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" /> Approve
                </button>
              </div>
            )}
          </div>
        }
      >
        {selectedRequest && (
          <div className="space-y-4">
            {/* Status Header Banner */}
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
              <div>
                <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Current Approval Status</div>
                <div className="mt-0.5">{getStatusBadge(selectedRequest.registration_request_status)}</div>
              </div>
              <div className="text-right">
                <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Submission Date</div>
                <div className="text-slate-900 dark:text-white font-bold text-xs mt-0.5">
                  {formatDate(selectedRequest.registration_request_submitted_at)}
                </div>
              </div>
            </div>

            {/* Company Information Section */}
            <div className="space-y-2">
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-[#D49A24] border-b border-slate-200 dark:border-slate-800 pb-1">
                1. Official Shipping Company Information
              </h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                <div className="p-2.5 px-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                  <div className="text-slate-400 text-[10px] font-medium">Company Name:</div>
                  <div className="font-bold text-slate-900 dark:text-white text-xs mt-0.5 truncate">
                    {selectedRequest.shipping_company?.shipping_company_name || 'N/A'}
                  </div>
                </div>

                <div className="p-2.5 px-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                  <div className="text-slate-400 text-[10px] font-medium">License / Registration Number:</div>
                  <div className="font-mono font-bold text-slate-900 dark:text-white text-xs mt-0.5 truncate">
                    {selectedRequest.shipping_company?.shipping_company_license_number || 'N/A'}
                  </div>
                </div>

                <div className="p-2.5 px-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                  <div className="text-slate-400 text-[10px] font-medium">Registered Company Email:</div>
                  <div className="font-semibold text-slate-900 dark:text-white text-xs mt-0.5 truncate">
                    {selectedRequest.shipping_company?.shipping_company_email || 'N/A'}
                  </div>
                </div>

                <div className="p-2.5 px-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                  <div className="text-slate-400 text-[10px] font-medium">Direct Contact Phone:</div>
                  <div className="font-semibold text-slate-900 dark:text-white text-xs mt-0.5 truncate">
                    {selectedRequest.shipping_company?.shipping_company_phone || 'N/A'}
                  </div>
                </div>

                <div className="p-2.5 px-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                  <div className="text-slate-400 text-[10px] font-medium">Jurisdiction / Country:</div>
                  <div className="font-semibold text-slate-900 dark:text-white text-xs mt-0.5 truncate">
                    {selectedRequest.shipping_company?.shipping_company_jurisdiction || 'N/A'}
                  </div>
                </div>

                <div className="p-2.5 px-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                  <div className="text-slate-400 text-[10px] font-medium">Lifecycle Status:</div>
                  <div className="font-bold text-slate-900 dark:text-white text-xs mt-0.5 truncate">
                    {selectedRequest.shipping_company?.shipping_company_status || 'PENDING'}
                  </div>
                </div>
              </div>

              <div className="p-2.5 px-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                <div className="text-slate-400 text-[10px] font-medium">Headquarters Address:</div>
                <div className="font-semibold text-slate-900 dark:text-white text-xs mt-0.5 truncate">
                  {selectedRequest.shipping_company?.shipping_company_address || 'N/A'}
                </div>
              </div>
            </div>

            {/* Representative & Documents Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-[#D49A24] border-b border-slate-200 dark:border-slate-800 pb-1">
                  2. Representative & Governance
                </h3>
                <div className="space-y-2">
                  <div className="p-2.5 px-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                    <div className="text-slate-400 text-[10px] font-medium">Representative Name:</div>
                    <div className="font-bold text-slate-900 dark:text-white text-xs mt-0.5 truncate">
                      {selectedRequest.registration_request_applicant_name || 'N/A'}
                    </div>
                  </div>

                  <div className="p-2.5 px-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                    <div className="text-slate-400 text-[10px] font-medium">Submitted Entity Type:</div>
                    <div className="font-bold text-slate-900 dark:text-white text-xs mt-0.5 truncate">
                      {selectedRequest.registration_request_entity_type || 'Shipping Company / Shipping Agent'}
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-[#D49A24] border-b border-slate-200 dark:border-slate-800 pb-1">
                  3. Supporting Documents
                </h3>
                <div className="space-y-2">
                  <div className="p-2.5 px-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white text-xs">Company License / Maritime Permit</div>
                      <div className="text-[10px] mt-0.5">
                        {selectedRequest.registration_request_license_file ? (
                          <span className="font-bold text-emerald-600 dark:text-emerald-400">✓ Uploaded</span>
                        ) : (
                          <span className="font-medium text-rose-500">✕ Not Uploaded</span>
                        )}
                      </div>
                    </div>

                    {selectedRequest.registration_request_license_file ? (
                      <div className="flex items-center gap-1.5">
                        <a
                          href={getFileUrl(selectedRequest.registration_request_license_file)}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2.5 py-1 rounded-md bg-sky-500/10 hover:bg-sky-500/20 text-sky-600 dark:text-sky-400 font-bold text-[10px] flex items-center gap-1 transition-colors"
                        >
                          <FileText className="w-3 h-3" /> View
                        </a>
                        <a
                          href={getFileUrl(selectedRequest.registration_request_license_file)}
                          download
                          className="px-2.5 py-1 rounded-md bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold text-[10px] flex items-center gap-1 transition-colors"
                        >
                          <Download className="w-3 h-3" /> Download
                        </a>
                      </div>
                    ) : (
                      <span className="text-[10px] font-medium text-slate-400">N/A</span>
                    )}
                  </div>

                  {selectedRequest.registration_request_previous_license_file && (
                    <div className="p-2 px-3 rounded-lg bg-slate-100/80 dark:bg-slate-800/40 border border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-semibold text-slate-700 dark:text-slate-300 text-[11px]">Previous Licence File (Preserved)</div>
                        <div className="text-[9px] text-slate-400">Archived copy prior to resubmission</div>
                      </div>
                      <a
                        href={getFileUrl(selectedRequest.registration_request_previous_license_file)}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-[10px] flex items-center gap-1 transition-colors"
                      >
                        <Download className="w-3 h-3" /> View Archive
                      </a>
                    </div>
                  )}

                  <div className="p-2.5 px-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white text-xs">Representative ID Document</div>
                      <div className="text-[10px] mt-0.5">
                        {selectedRequest.registration_request_id_file ? (
                          <span className="font-bold text-emerald-600 dark:text-emerald-400">✓ Uploaded</span>
                        ) : (
                          <span className="font-medium text-rose-500">✕ Not Uploaded</span>
                        )}
                      </div>
                    </div>

                    {selectedRequest.registration_request_id_file ? (
                      <div className="flex items-center gap-1.5">
                        <a
                          href={getFileUrl(selectedRequest.registration_request_id_file)}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2.5 py-1 rounded-md bg-sky-500/10 hover:bg-sky-500/20 text-sky-600 dark:text-sky-400 font-bold text-[10px] flex items-center gap-1 transition-colors"
                        >
                          <FileText className="w-3 h-3" /> View
                        </a>
                        <a
                          href={getFileUrl(selectedRequest.registration_request_id_file)}
                          download
                          className="px-2.5 py-1 rounded-md bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold text-[10px] flex items-center gap-1 transition-colors"
                        >
                          <Download className="w-3 h-3" /> Download
                        </a>
                      </div>
                    ) : (
                      <span className="text-[10px] font-medium text-slate-400">N/A</span>
                    )}
                  </div>

                  {selectedRequest.registration_request_previous_id_file && (
                    <div className="p-2 px-3 rounded-lg bg-slate-100/80 dark:bg-slate-800/40 border border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-semibold text-slate-700 dark:text-slate-300 text-[11px]">Previous Representative ID (Preserved)</div>
                        <div className="text-[9px] text-slate-400">Archived copy prior to resubmission</div>
                      </div>
                      <a
                        href={getFileUrl(selectedRequest.registration_request_previous_id_file)}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-[10px] flex items-center gap-1 transition-colors"
                      >
                        <Download className="w-3 h-3" /> View Archive
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Decision Remarks */}
            <div className="space-y-2 pt-1 border-t border-slate-200 dark:border-slate-800">
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-[#D49A24]">
                4. Admin Review & Decision
              </h3>

              {selectedRequest.registration_request_status === 'PENDING' ? (
                <div className="space-y-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                      Review Remarks:
                    </label>
                    <textarea
                      value={reviewRemarks}
                      onChange={(e) => {
                        setReviewRemarks(e.target.value);
                        if (e.target.value.trim()) setRemarksError('');
                      }}
                      placeholder="Enter review remarks, approval notes, or required rejection reason..."
                      rows={2}
                      className={`w-full p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border text-slate-900 dark:text-white text-xs focus:outline-none transition-all ${
                        remarksError 
                          ? 'border-rose-500 focus:border-rose-500' 
                          : 'border-slate-300 dark:border-slate-700 focus:border-[#D49A24]'
                      }`}
                    />
                    {remarksError && (
                      <div className="text-[10px] font-bold text-rose-500 mt-0.5">
                        {remarksError}
                      </div>
                    )}
                  </div>
                </div>
              ) : selectedRequest.registration_request_status === 'ACTION_REQUIRED' ? (
                <div className="p-3.5 rounded-xl bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 space-y-2 text-xs">
                  <div className="flex items-center gap-2 text-orange-900 dark:text-orange-200 font-bold">
                    <AlertTriangle className="w-4 h-4 text-orange-600" />
                    <span>Correction Request Active</span>
                  </div>
                  <div className="text-[11px] text-orange-800 dark:text-orange-300">
                    <span className="font-bold">Required Documents: </span>
                    {selectedRequest.registration_request_action_required_docs || 'Supporting Documents'}
                  </div>
                  <div className="text-[11px] text-orange-800 dark:text-orange-300 bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-orange-200 dark:border-orange-800">
                    <span className="font-bold block mb-0.5">Instructions Given to Applicant:</span>
                    {selectedRequest.registration_request_admin_remarks || 'No specific instructions recorded.'}
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-1.5 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <span className="text-slate-400 font-medium">Reviewed On: </span>
                      <span className="font-bold text-slate-900 dark:text-white">
                        {formatDate(selectedRequest.registration_request_reviewed_at)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 font-medium">Reviewed By: </span>
                      <span className="font-bold text-slate-900 dark:text-white">
                        {selectedRequest.reviewer_name || 'Port Administrator'}
                      </span>
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-400 font-medium">Review Remarks / Reason: </span>
                    <div className="font-semibold text-slate-900 dark:text-white mt-0.5 bg-white dark:bg-slate-900 p-2 rounded border border-slate-200 dark:border-slate-800">
                      {selectedRequest.registration_request_rejection_reason || 'No remarks recorded.'}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* REJECTION CONFIRMATION DIALOG */}
      <Modal
        isOpen={!!rejectingRequest}
        onClose={() => {
          setRejectingRequest(null);
          setRejectionReason('');
        }}
        title="Confirm Registration Rejection"
        subtitle={rejectingRequest?.shipping_company?.shipping_company_name}
        icon={<AlertTriangle className="w-4 h-4 text-rose-500" />}
        maxWidth="xl"
        footer={
          <div className="flex items-center justify-end gap-2.5 w-full">
            <button
              onClick={() => {
                setRejectingRequest(null);
                setRejectionReason('');
              }}
              className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmReject}
              disabled={actionLoading || !rejectionReason.trim()}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md transition-all cursor-pointer disabled:opacity-50"
            >
              {actionLoading ? 'Rejecting...' : 'Yes, Reject Request'}
            </button>
          </div>
        }
      >
        {rejectingRequest && (
          <div className="space-y-3">
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Are you sure you want to reject this registration request for{' '}
              <span className="font-bold text-slate-900 dark:text-white">
                {rejectingRequest.shipping_company?.shipping_company_name}
              </span>?
            </p>

            <div>
              <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Rejection Reason / Remarks (Required):
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Enter detailed feedback / rejection reason..."
                rows={3}
                className="w-full p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:outline-none focus:border-rose-500 transition-all"
              />
            </div>
          </div>
        )}
      </Modal>

      {/* ACTION REQUIRED MODAL */}
      <Modal
        isOpen={!!actionRequiredRequest}
        onClose={() => {
          setActionRequiredRequest(null);
          setActionRequiredRemarks('');
        }}
        title="Request Document Corrections"
        subtitle={actionRequiredRequest?.shipping_company?.shipping_company_name}
        icon={<AlertTriangle className="w-4 h-4 text-orange-500" />}
        maxWidth="lg"
        footer={
          <div className="flex items-center justify-end gap-2.5 w-full">
            <button
              onClick={() => {
                setActionRequiredRequest(null);
                setActionRequiredRemarks('');
              }}
              className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmActionRequired}
              disabled={actionLoading || !actionRequiredRemarks.trim()}
              className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs shadow-md transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>{actionLoading ? 'Sending...' : 'Send Correction Request'}</span>
            </button>
          </div>
        }
      >
        {actionRequiredRequest && (
          <div className="space-y-4 text-xs">
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
              Specify which documents or details require applicant correction. The applicant will receive an email notification and can upload revised files via their Registration Status portal.
            </p>

            <div className="space-y-2">
              <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Select Documents Requiring Correction:
              </label>
              
              <div className="space-y-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-800 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={reqDocLicence}
                    onChange={(e) => setReqDocLicence(e.target.checked)}
                    className="w-4 h-4 rounded text-orange-600 focus:ring-orange-500"
                  />
                  <span>Company Operating Licence / Maritime Authority Permit</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-800 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={reqDocId}
                    onChange={(e) => setReqDocId(e.target.checked)}
                    className="w-4 h-4 rounded text-orange-600 focus:ring-orange-500"
                  />
                  <span>Authorized Representative Identification Document (Passport / National ID)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-800 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={reqDocOther}
                    onChange={(e) => setReqDocOther(e.target.checked)}
                    className="w-4 h-4 rounded text-orange-600 focus:ring-orange-500"
                  />
                  <span>Other Registration Particulars / Clarifications</span>
                </label>
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Administrator Remarks & Specific Instructions (Required):
              </label>
              <textarea
                value={actionRequiredRemarks}
                onChange={(e) => setActionRequiredRemarks(e.target.value)}
                placeholder="e.g. The uploaded operating license expired on Jan 2026. Please upload the valid 2026 renewal certificate."
                rows={3}
                className="w-full p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:outline-none focus:border-orange-500 transition-all"
              />
            </div>
          </div>
        )}
      </Modal>

    </div>
  );
};
