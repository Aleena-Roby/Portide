import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { apiFetch } from '../../services/api';
import { BackendContainer, CustomsDocumentItem, CustomsInspectionData } from '../../types';
import { Modal } from '../common/Modal';
import { ReadOnlyCargoDirectory } from '../common/ReadOnlyCargoDirectory';
import {
  ShieldCheck,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Search,
  RefreshCw,
  Eye,
  Ship,
  Boxes,
  FileCheck,
  Scale,
  MapPin,
  ArrowRight,
  User,
  Calendar,
  AlertOctagon,
  FileText,
  Download,
  CheckCircle,
  UploadCloud,
  LayoutDashboard,
  Info,
  Check
} from 'lucide-react';
import { PreArrivalDeclarationsView } from './customs/PreArrivalDeclarationsView';
import { CustomsDecisionHistoryView, CustomsAuditRecord } from './customs/CustomsDecisionHistoryView';

interface CustomsDashboardProps {
  activeTab?: string;
  onNavigate?: (tab: string) => void;
}

interface CustomsCounts {
  pending_customs: number;
  under_inspection: number;
  cleared: number;
  on_hold: number;
  info_required?: number;
  total_customs: number;
}

const HOLD_REASONS = [
  'Documentation issue',
  'Cargo mismatch',
  'Weight discrepancy',
  'Inspection issue',
  'Other'
];

/**
 * Extracts and formats user-friendly error messages from DRF validation error payloads.
 */
const extractInspectionErrorMessage = (json: any): string => {
  if (!json) return 'Failed to submit customs inspection decision.';

  const fieldLabelMap: Record<string, string> = {
    customs_inspection_document_status: 'Document verification status',
    document_verification_status: 'Document verification status',
    customs_inspection_result: 'Inspection result',
    inspection_result: 'Inspection result',
    remarks: 'Inspection remarks',
    customs_inspection_remarks: 'Inspection remarks',
    hold_reason: 'Hold reason',
    customs_inspection_hold_reason: 'Hold reason',
  };

  const formatMessage = (field: string, rawMsg: string): string => {
    const msg = rawMsg.trim();
    const lower = msg.toLowerCase();
    const label = fieldLabelMap[field] || field.replace(/_/g, ' ');

    if (
      lower === 'this field is required.' ||
      lower === 'this field may not be null.' ||
      lower === 'this field is required'
    ) {
      return `${label} is required.`;
    }
    if (
      lower === 'invalid value.' ||
      lower === 'invalid value' ||
      lower.includes('not a valid choice')
    ) {
      return `Invalid ${label.toLowerCase()}.`;
    }
    if (lower.startsWith(label.toLowerCase())) {
      return msg;
    }
    return msg;
  };

  // 1. Check if json.errors or json itself has field error entries
  const errorObj =
    json.errors && typeof json.errors === 'object' && !Array.isArray(json.errors)
      ? json.errors
      : typeof json === 'object' && !Array.isArray(json) && !json.message && !json.detail && !json.status
      ? json
      : null;

  if (errorObj) {
    for (const [key, val] of Object.entries(errorObj)) {
      if (Array.isArray(val) && val.length > 0) {
        const first = val[0];
        if (typeof first === 'string') {
          return formatMessage(key, first);
        }
      } else if (typeof val === 'string') {
        return formatMessage(key, val);
      }
    }
  }

  // 2. If json.message is present and NOT the generic validation failure string
  if (
    json.message &&
    typeof json.message === 'string' &&
    json.message !== 'Inspection submission validation failed.'
  ) {
    return json.message;
  }

  // 3. Check json.detail
  if (json.detail && typeof json.detail === 'string') {
    return json.detail;
  }

  // 4. Fallback to json.message or default message
  return json.message || 'Failed to submit customs inspection decision.';
};

export const CustomsDashboard: React.FC<CustomsDashboardProps> = ({ activeTab = 'overview', onNavigate }) => {
  const { currentUser, activeRole, addToast, addNotification } = useApp();
  const navigate = useNavigate();

  const normalizedActiveTab = useMemo(() => {
    if (activeTab === 'pre-arrival' || activeTab === 'pre_arrival') return 'pre-arrival';
    if (activeTab === 'cargo-management' || activeTab === 'clearance' || activeTab === 'cargo') return 'cargo-management';
    if (activeTab === 'decision-history' || activeTab === 'history') return 'decision-history';
    if (activeTab === 'normal-review' || activeTab === 'inspections') return 'normal-review';
    return 'overview';
  }, [activeTab]);

  const [currentTab, setCurrentTab] = useState<string>(normalizedActiveTab);

  useEffect(() => {
    setCurrentTab(normalizedActiveTab);
  }, [normalizedActiveTab]);

  const handleTabChange = (tabId: string) => {
    setCurrentTab(tabId);
    if (onNavigate) {
      onNavigate(tabId);
    }
    const path = tabId === 'overview' ? '/customs/dashboard' : `/customs/${tabId}`;
    navigate(path);
  };

  const [containers, setContainers] = useState<BackendContainer[]>([]);
  const [counts, setCounts] = useState<CustomsCounts>({
    pending_customs: 0,
    under_inspection: 0,
    cleared: 0,
    on_hold: 0,
    info_required: 0,
    total_customs: 0
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  // Recent decisions for Overview tab
  const [recentDecisions, setRecentDecisions] = useState<CustomsAuditRecord[]>([]);
  const [loadingRecent, setLoadingRecent] = useState<boolean>(false);

  const fetchRecentDecisions = useCallback(async () => {
    setLoadingRecent(true);
    try {
      const res = await apiFetch('/api/customs/history/?page_size=5');
      const json = await res.json();
      if (res.ok && json.status === 'success') {
        setRecentDecisions(json.data || []);
      }
    } catch {
      // non-fatal
    } finally {
      setLoadingRecent(false);
    }
  }, []);

  useEffect(() => {
    if (currentTab === 'overview') {
      fetchRecentDecisions();
    }
  }, [currentTab, fetchRecentDecisions]);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Modals state
  const [selectedContainer, setSelectedContainer] = useState<BackendContainer | null>(null);
  const [inspectingContainer, setInspectingContainer] = useState<BackendContainer | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);

  // Inspection form state
  const [inspectionResult, setInspectionResult] = useState<'CLEARED' | 'HOLD' | 'ADDITIONAL_INFORMATION_REQUIRED' | 'UNDER_INSPECTION'>('CLEARED');
  const [docVerificationStatus, setDocVerificationStatus] = useState<'VERIFIED' | 'PENDING' | 'ISSUE_FOUND'>('VERIFIED');
  const [inspectionRemarks, setInspectionRemarks] = useState<string>('');
  const [holdReason, setHoldReason] = useState<string>(HOLD_REASONS[0]);
  const [submittingInspection, setSubmittingInspection] = useState<boolean>(false);
  const [formError, setFormError] = useState<string>('');

  // Customs Document Review & Download state
  const [reviewingDocId, setReviewingDocId] = useState<number | null>(null);
  const [downloadingDocId, setDownloadingDocId] = useState<number | null>(null);
  const [docRejectRemarks, setDocRejectRemarks] = useState<{ [docId: number]: string }>({});
  const [rejectingDocId, setRejectingDocId] = useState<number | null>(null);

  const handleDownloadDoc = async (doc: CustomsDocumentItem, preview: boolean = false) => {
    setDownloadingDocId(doc.document_id);
    try {
      const res = await apiFetch(`/api/customs/documents/${doc.document_id}/download/?preview=${preview ? 'true' : 'false'}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        addToast(err.message || 'Failed to download document.', 'error');
        return;
      }
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      if (preview) {
        window.open(blobUrl, '_blank');
      } else {
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = doc.original_filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 60000);
    } catch {
      addToast('Network error while retrieving document file.', 'error');
    } finally {
      setDownloadingDocId(null);
    }
  };

  const handleReviewDocument = async (docId: number, status: 'VERIFIED' | 'REJECTED', remarks?: string) => {
    setReviewingDocId(docId);
    try {
      const res = await apiFetch(`/api/customs/documents/${docId}/review/`, {
        method: 'POST',
        body: JSON.stringify({
          review_status: status,
          review_remarks: remarks || ''
        })
      });
      const json = await res.json();
      if (res.ok && json.status === 'success') {
        addToast(`Document marked as ${status === 'VERIFIED' ? 'Verified' : 'Rejected'}.`, 'success');
        setRejectingDocId(null);
        if (selectedContainer && selectedContainer.customs_documents) {
          const updatedDocs = selectedContainer.customs_documents.map(d =>
            d.document_id === docId ? json.data : d
          );
          setSelectedContainer({ ...selectedContainer, customs_documents: updatedDocs });
        }
        if (inspectingContainer && inspectingContainer.customs_documents) {
          const updatedDocs = inspectingContainer.customs_documents.map(d =>
            d.document_id === docId ? json.data : d
          );
          setInspectingContainer({ ...inspectingContainer, customs_documents: updatedDocs });
        }
        await fetchCustomsContainers();
      } else {
        addToast(json.message || 'Failed to submit document review.', 'error');
      }
    } catch {
      addToast('Network error while updating document review status.', 'error');
    } finally {
      setReviewingDocId(null);
    }
  };

  // Fetch Customs Containers
  const fetchCustomsContainers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch('/api/customs/containers/');
      const json = await res.json();

      if (res.ok && json.status === 'success') {
        setContainers(json.data || []);
        if (json.counts) {
          setCounts({
            pending_customs: json.counts.pending_customs ?? 0,
            under_inspection: json.counts.under_inspection ?? 0,
            cleared: json.counts.cleared ?? 0,
            on_hold: json.counts.on_hold ?? 0,
            info_required: json.counts.info_required ?? 0,
            total_customs: json.counts.total_customs ?? json.counts.total_customs_containers ?? 0
          });
        }
      } else {
        setError(json.message || 'Failed to load customs container manifest.');
      }
    } catch {
      setError('Network error while connecting to customs intelligence service.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCustomsContainers();
  }, [fetchCustomsContainers]);

  // Filtered containers
  const filteredContainers = useMemo(() => {
    return containers.filter(c => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        q === '' ||
        c.container_number.toLowerCase().includes(q) ||
        (c.cargo_context?.cargo_description || '').toLowerCase().includes(q) ||
        (c.cargo_context?.vessel_name || '').toLowerCase().includes(q) ||
        (c.cargo_context?.vessel_imo_number || '').includes(q) ||
        String(c.cargo_context?.cargo_id || '').includes(q);

      const matchStatus =
        statusFilter === 'all' ||
        (statusFilter === 'PENDING' && c.container_status === 'AWAITING_CUSTOMS') ||
        (statusFilter === 'INSPECTION' && c.container_status === 'UNDER_INSPECTION') ||
        (statusFilter === 'CLEARED' && c.container_status === 'CLEARED') ||
        (statusFilter === 'HOLD' && (c.container_status === 'CUSTOMS_HOLD' || c.container_customs_status === 'CUSTOMS_HOLD')) ||
        (statusFilter === 'ADDITIONAL_INFO' && c.container_customs_status === 'ADDITIONAL_INFORMATION_REQUIRED');

      return matchSearch && matchStatus;
    });
  }, [containers, searchQuery, statusFilter]);

  // Start Inspection Handler
  const handleStartInspection = async (container: BackendContainer) => {
    setActionLoadingId(container.container_id);
    try {
      const res = await apiFetch(`/api/customs/containers/${container.container_id}/start-inspection/`, {
        method: 'POST',
        body: JSON.stringify({})
      });
      const json = await res.json();

      if (res.ok && json.status === 'success') {
        addToast(`Customs inspection initiated for Container ${container.container_number}.`, 'success');
        addNotification(
          'Customs Inspection Started',
          `Physical and documentary inspection started for Container ${container.container_number}.`,
          'info'
        );
        await fetchCustomsContainers();
        // Automatically open inspection form for newly started inspection
        if (json.data) {
          handleOpenInspectionForm(json.data);
        }
      } else {
        addToast(json.message || 'Unable to start customs inspection.', 'error');
      }
    } catch {
      addToast('Network error while initiating inspection.', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Open Inspection Form Modal
  const handleOpenInspectionForm = (container: BackendContainer) => {
    setInspectingContainer(container);
    const existing = container.latest_customs_inspection;
    const res = existing?.customs_inspection_result;
    if (res === 'HOLD' || res === 'ADDITIONAL_INFORMATION_REQUIRED' || res === 'UNDER_INSPECTION' || res === 'CLEARED') {
      setInspectionResult(res);
    } else {
      setInspectionResult('CLEARED');
    }
    setDocVerificationStatus(existing?.customs_inspection_document_status || 'VERIFIED');
    setInspectionRemarks(existing?.customs_inspection_remarks || '');
    const existingReason = existing?.customs_inspection_hold_reason;
    const matchedReason = HOLD_REASONS.find(
      r => r.toUpperCase().replace(/\s+/g, '_') === existingReason
    ) || (HOLD_REASONS.includes(existingReason as any) ? existingReason : HOLD_REASONS[0]);
    setHoldReason(matchedReason || HOLD_REASONS[0]);
    setFormError('');
  };

  // Submit Inspection Handler (Clear / Hold / Info Required / Under Inspection)
  const handleSubmitInspection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inspectingContainer) return;
    setFormError('');

    // Verification check for clearance
    if (inspectionResult === 'CLEARED') {
      if (docVerificationStatus !== 'VERIFIED') {
        setFormError('Cannot clear container: Document Verification Status must be Verified before granting customs clearance.');
        return;
      }
    }

    if (inspectionResult === 'HOLD') {
      if (!holdReason) {
        setFormError('Please specify a valid Reason for Customs Hold.');
        return;
      }
      if (!inspectionRemarks.trim()) {
        setFormError('Detailed inspection remarks are mandatory when placing a container on Customs Hold.');
        return;
      }
    }

    if (inspectionResult === 'ADDITIONAL_INFORMATION_REQUIRED') {
      if (!inspectionRemarks.trim()) {
        setFormError('Please specify the required additional information or documentation in the remarks field.');
        return;
      }
    }

    setSubmittingInspection(true);
    try {
      const payload = {
        inspection_result: inspectionResult,
        document_verification_status: docVerificationStatus,
        remarks: inspectionRemarks.trim(),
        hold_reason: inspectionResult === 'HOLD' ? holdReason : undefined
      };

      const res = await apiFetch(`/api/customs/containers/${inspectingContainer.container_id}/submit-inspection/`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      const json = await res.json();

      if (res.ok && json.status === 'success') {
        let actionText = '';
        if (inspectionResult === 'CLEARED') actionText = 'CLEARED and ready for release';
        else if (inspectionResult === 'HOLD') actionText = 'placed on CUSTOMS HOLD';
        else if (inspectionResult === 'ADDITIONAL_INFORMATION_REQUIRED') actionText = 'flagged for ADDITIONAL INFORMATION REQUIRED';
        else if (inspectionResult === 'UNDER_INSPECTION') actionText = 'marked for PHYSICAL INSPECTION';

        addToast(`Container ${inspectingContainer.container_number} successfully ${actionText}.`, 'success');
        addNotification(
          inspectionResult === 'CLEARED' ? 'Customs Cleared' : inspectionResult === 'HOLD' ? 'Customs Hold' : 'Customs Decision Recorded',
          `Container ${inspectingContainer.container_number} decision '${inspectionResult}' recorded by Customs.`,
          inspectionResult === 'CLEARED' ? 'success' : inspectionResult === 'HOLD' ? 'warning' : 'info'
        );
        setInspectingContainer(null);
        await fetchCustomsContainers();
      } else {
        setFormError(extractInspectionErrorMessage(json));
      }
    } catch {
      setFormError('Network communication error while submitting customs inspection.');
    } finally {
      setSubmittingInspection(false);
    }
  };

  const formatDate = (isoString?: string | null) => {
    if (!isoString) return '—';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return isoString;
    }
  };

  const getStatusBadge = (status: string, display?: string) => {
    switch (status) {
      case 'AWAITING_CUSTOMS':
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 inline-flex items-center gap-1">
            <Clock className="w-3 h-3 text-amber-500" />
            <span>{display || 'Awaiting Customs'}</span>
          </span>
        );
      case 'UNDER_INSPECTION':
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/30 inline-flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-purple-500" />
            <span>{display || 'Under Inspection'}</span>
          </span>
        );
      case 'CLEARED':
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 inline-flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
            <span>{display || 'Cleared'}</span>
          </span>
        );
      case 'CUSTOMS_HOLD':
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30 inline-flex items-center gap-1">
            <XCircle className="w-3 h-3 text-rose-500" />
            <span>{display || 'Customs Hold'}</span>
          </span>
        );
      case 'RELEASED':
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/30 inline-flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-teal-500" />
            <span>{display || 'Released'}</span>
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
            {display || status}
          </span>
        );
    }
  };

  const getInspectionBadge = (inspection?: CustomsInspectionData | null) => {
    if (!inspection) {
      return (
        <span className="text-[10px] font-semibold text-slate-400">
          Not Started
        </span>
      );
    }

    if (inspection.customs_inspection_result === 'CLEARED') {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
          <span>Cleared</span>
        </span>
      );
    }

    if (inspection.customs_inspection_result === 'HOLD') {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-600 dark:text-rose-400">
          <AlertOctagon className="w-3 h-3 text-rose-500" />
          <span>On Hold</span>
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-purple-600 dark:text-purple-400">
        <Clock className="w-3 h-3 text-purple-500" />
        <span>In Progress</span>
      </span>
    );
  };

  return (
    <div className="space-y-6 font-sans selection:bg-[#D49A24] selection:text-white animate-fade-in">
      {/* ===================================================================== */}
      {/* 1. CUSTOMS AUTHORITY DIVISION PERSISTENT HEADER & TAB NAVIGATION */}
      {/* ===================================================================== */}
      <div className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/30">
              Customs Authority Division
            </span>
            <span className="text-xs text-slate-400 font-mono">
              Officer: {currentUser?.name || currentUser?.email || 'Customs Inspector'}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            Customs Clearance & Regulatory Intelligence
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 font-normal max-w-3xl">
            Customs manifest review, terminal container inspections, advance pre-arrival clearances, and immutable regulatory decision audit records.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => {
              fetchCustomsContainers();
              if (currentTab === 'overview') fetchRecentDecisions();
            }}
            disabled={loading || loadingRecent}
            className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors cursor-pointer border border-slate-200 dark:border-slate-700 flex items-center gap-1.5"
            title="Refresh Customs Manifest"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading || loadingRecent ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* 5 VISIBLE NAVIGATION TABS */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {[
          { id: 'overview', label: 'Dashboard Overview', icon: LayoutDashboard },
          { id: 'normal-review', label: 'Normal Customs Review', icon: ShieldCheck, badge: counts.pending_customs > 0 ? counts.pending_customs : undefined },
          { id: 'pre-arrival', label: 'Pre-Arrival Review', icon: FileCheck },
          { id: 'cargo-management', label: 'Cargo Manifest Oversight', icon: Boxes },
          { id: 'decision-history', label: 'Customs Decision History', icon: Clock }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
                isActive
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                  isActive ? 'bg-white text-purple-700' : 'bg-purple-500/10 text-purple-600'
                }`}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* VIEW 1: CARGO MANIFEST OVERSIGHT */}
      {currentTab === 'cargo-management' && (
        <ReadOnlyCargoDirectory
          title="Customs Cargo Manifest Oversight"
          subtitle="Pre-arrival cargo declarations and vessel consignment manifests (Read-Only Review)"
          roleBadgeText="Customs Authority Cargo Review"
        />
      )}

      {/* VIEW 2: PRE-ARRIVAL REVIEW */}
      {currentTab === 'pre-arrival' && (
        <PreArrivalDeclarationsView />
      )}

      {/* VIEW 3: CUSTOMS DECISION HISTORY */}
      {currentTab === 'decision-history' && (
        <CustomsDecisionHistoryView />
      )}

      {/* VIEW 4: DASHBOARD OVERVIEW */}
      {currentTab === 'overview' && (
        <div className="space-y-6">
          {/* EXECUTIVE METRICS */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
            <div
              onClick={() => {
                setStatusFilter('PENDING');
                handleTabChange('normal-review');
              }}
              className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 hover:border-amber-500/40 shadow-sm transition-all cursor-pointer"
            >
              <div className="flex items-center justify-between pb-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                  Pending Customs
                </span>
                <Clock className="w-4 h-4 text-amber-500" />
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">
                {counts.pending_customs}
              </div>
              <span className="text-[10px] text-slate-400 font-medium block mt-0.5">
                Terminal handed over • Awaiting review
              </span>
            </div>

            <div
              onClick={() => {
                setStatusFilter('INSPECTION');
                handleTabChange('normal-review');
              }}
              className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 hover:border-purple-500/40 shadow-sm transition-all cursor-pointer"
            >
              <div className="flex items-center justify-between pb-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                  Under Inspection
                </span>
                <ShieldCheck className="w-4 h-4 text-purple-500" />
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">
                {counts.under_inspection}
              </div>
              <span className="text-[10px] text-slate-400 font-medium block mt-0.5">
                Active documentary & physical checks
              </span>
            </div>

            <div
              onClick={() => {
                setStatusFilter('ADDITIONAL_INFO');
                handleTabChange('normal-review');
              }}
              className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 hover:border-blue-500/40 shadow-sm transition-all cursor-pointer"
            >
              <div className="flex items-center justify-between pb-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                  Additional Info Required
                </span>
                <AlertTriangle className="w-4 h-4 text-blue-500" />
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">
                {counts.info_required || 0}
              </div>
              <span className="text-[10px] text-slate-400 font-medium block mt-0.5">
                Inquiries sent to shipping lines
              </span>
            </div>

            <div
              onClick={() => {
                setStatusFilter('CLEARED');
                handleTabChange('normal-review');
              }}
              className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 hover:border-emerald-500/40 shadow-sm transition-all cursor-pointer"
            >
              <div className="flex items-center justify-between pb-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  Cleared Containers
                </span>
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">
                {counts.cleared}
              </div>
              <span className="text-[10px] text-slate-400 font-medium block mt-0.5">
                Clearance granted • Gate pass eligible
              </span>
            </div>

            <div
              onClick={() => {
                setStatusFilter('HOLD');
                handleTabChange('normal-review');
              }}
              className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 hover:border-rose-500/40 shadow-sm transition-all cursor-pointer"
            >
              <div className="flex items-center justify-between pb-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                  Customs Hold
                </span>
                <AlertOctagon className="w-4 h-4 text-rose-500" />
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">
                {counts.on_hold}
              </div>
              <span className="text-[10px] text-slate-400 font-medium block mt-0.5">
                Discrepancies found • Release blocked
              </span>
            </div>
          </div>

          {/* 6-STAGE OPERATIONAL LIFECYCLE COMPLIANCE PIPELINE */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-purple-600" />
                  <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white uppercase tracking-wider">
                    6-Stage Operational Tracking Pipeline Compliance
                  </h3>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Standardized port logistics pipeline. Customs Authority governs transition between Stage 4 and Stage 5.
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-600 border border-purple-500/30 self-start sm:self-auto">
                Regulatory Jurisdiction: Stage 4 → Stage 5
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
              {[
                { step: 1, key: 'REGISTERED', label: '1. Registered', desc: 'Consignment booked in manifest', color: 'slate' },
                { step: 2, key: 'ARRIVED', label: '2. Arrived', desc: 'Vessel berthed at harbor', color: 'slate' },
                { step: 3, key: 'AT_TERMINAL', label: '3. At Terminal', desc: 'Unloaded & terminal receipt recorded', color: 'slate' },
                { step: 4, key: 'UNDER_INSPECTION', label: '4. Under Inspection', desc: 'Customs review & physical checks', color: 'purple', highlight: true },
                { step: 5, key: 'CLEARED', label: '5. Cleared', desc: 'Customs clearance granted', color: 'emerald', highlight: true },
                { step: 6, key: 'RELEASED', label: '6. Gate Exit Completed', desc: 'Gate pass verified & truck exit logged', color: 'teal' }
              ].map((s) => (
                <div
                  key={s.step}
                  className={`p-3 rounded-xl border transition-all ${
                    s.highlight
                      ? s.step === 4
                        ? 'bg-purple-500/5 border-purple-500/40 ring-1 ring-purple-500/20'
                        : 'bg-emerald-500/5 border-emerald-500/40 ring-1 ring-emerald-500/20'
                      : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between pb-1">
                    <span className={`text-[10px] font-black uppercase tracking-wider ${
                      s.highlight ? (s.step === 4 ? 'text-purple-600' : 'text-emerald-600') : 'text-slate-500'
                    }`}>
                      Stage {s.step}
                    </span>
                    {s.highlight && (
                      <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                    )}
                  </div>
                  <div className="font-bold text-xs text-slate-900 dark:text-white">
                    {s.label.split('. ')[1]}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1 leading-snug">
                    {s.desc}
                  </p>
                </div>
              ))}
            </div>

            <div className="p-3 rounded-xl bg-purple-500/5 border border-purple-500/20 text-[11px] text-purple-900 dark:text-purple-300 flex items-start gap-2">
              <Info className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
              <span>
                <strong>Gate Release Guard:</strong> Stage 6 (Gate Exit Completed) is reached <strong>ONLY</strong> after valid Delivery Order issuance, Digital Gate Pass verification, and actual gate exit recording by the Gate Officer. Advance pre-arrival filing or document upload does not auto-clear or bypass gate verification.
              </span>
            </div>
          </div>

          {/* QUICK ACTION WORKLIST MODULES */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div
              onClick={() => handleTabChange('normal-review')}
              className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 hover:border-purple-500/40 hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-600 group-hover:scale-105 transition-transform">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                  Normal Customs Review
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Inspect terminal containers, examine uploaded shipping documents, record findings, and issue clearance or holds.
                </p>
              </div>
              <div className="pt-4 flex items-center gap-1 text-xs font-bold text-purple-600 group-hover:gap-2 transition-all">
                <span>Open Worklist</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>

            <div
              onClick={() => handleTabChange('pre-arrival')}
              className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 hover:border-indigo-500/40 hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-600 group-hover:scale-105 transition-transform">
                  <FileCheck className="w-5 h-5" />
                </div>
                <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                  Pre-Arrival Review
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Evaluate advance declarations for direct ship-to-truck transfer submitted by Shipping Companies.
                </p>
              </div>
              <div className="pt-4 flex items-center gap-1 text-xs font-bold text-indigo-600 group-hover:gap-2 transition-all">
                <span>Review Declarations</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>

            <div
              onClick={() => handleTabChange('cargo-management')}
              className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 hover:border-sky-500/40 hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="w-10 h-10 rounded-xl bg-sky-500/10 flex items-center justify-center text-sky-600 group-hover:scale-105 transition-transform">
                  <Boxes className="w-5 h-5" />
                </div>
                <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                  Cargo Manifest Oversight
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Cross-examine vessel arrival manifests and consignment records across all active port calls.
                </p>
              </div>
              <div className="pt-4 flex items-center gap-1 text-xs font-bold text-sky-600 group-hover:gap-2 transition-all">
                <span>View Manifests</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>

            <div
              onClick={() => handleTabChange('decision-history')}
              className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 hover:border-teal-500/40 hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="w-10 h-10 rounded-xl bg-teal-500/10 flex items-center justify-center text-teal-600 group-hover:scale-105 transition-transform">
                  <Clock className="w-5 h-5" />
                </div>
                <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                  Customs Decision History
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Immutable regulatory audit trail of all clearances, holds, info requests, and document rulings.
                </p>
              </div>
              <div className="pt-4 flex items-center gap-1 text-xs font-bold text-teal-600 group-hover:gap-2 transition-all">
                <span>View Audit Trail</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>

          {/* RECENT DECISIONS AUDIT STREAM */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white uppercase tracking-wider">
                  Recent Customs Decisions & Audit Feed
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Live feed of the latest decisions recorded by Customs Officers.
                </p>
              </div>
              <button
                onClick={() => handleTabChange('decision-history')}
                className="text-xs font-bold text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>View Full History</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {loadingRecent ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-purple-600" />
                <span>Loading recent decisions...</span>
              </div>
            ) : recentDecisions.length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-xs">
                No recent customs decisions recorded yet.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {recentDecisions.map((dec) => (
                  <div key={dec.audit_log_id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div className="shrink-0 mt-0.5">
                        {dec.audit_log_action.includes('CLEAR') ? (
                          <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 block">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </span>
                        ) : dec.audit_log_action.includes('HOLD') ? (
                          <span className="p-1.5 rounded-lg bg-rose-500/10 text-rose-600 block">
                            <AlertOctagon className="w-3.5 h-3.5" />
                          </span>
                        ) : dec.audit_log_action.includes('ADDITIONAL') ? (
                          <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600 block">
                            <AlertTriangle className="w-3.5 h-3.5" />
                          </span>
                        ) : (
                          <span className="p-1.5 rounded-lg bg-purple-500/10 text-purple-600 block">
                            <ShieldCheck className="w-3.5 h-3.5" />
                          </span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-slate-900 dark:text-white">
                            {dec.audit_log_target_type || 'Container'} #{dec.audit_log_target_id}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400">
                            {formatDate(dec.audit_log_timestamp)}
                          </span>
                        </div>
                        <p className="text-slate-600 dark:text-slate-300 text-[11px] truncate mt-0.5 max-w-xl">
                          {dec.audit_log_description}
                        </p>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <span className="text-[10px] text-slate-400 block">Recorded by</span>
                      <span className="font-medium text-slate-700 dark:text-slate-300 text-[11px]">
                        {dec.audit_log_actor_name || 'Customs Inspector'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW 5: NORMAL CUSTOMS REVIEW */}
      {currentTab === 'normal-review' && (
        <div className="space-y-6">
          {/* SUMMARY CARDS */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
            {/* PENDING CUSTOMS */}
            <div
              onClick={() => setStatusFilter(statusFilter === 'PENDING' ? 'all' : 'PENDING')}
              className={`p-4 rounded-2xl bg-white dark:bg-slate-900 border transition-all cursor-pointer shadow-sm ${
                statusFilter === 'PENDING'
                  ? 'border-amber-500 ring-2 ring-amber-500/20'
                  : 'border-slate-200/90 dark:border-slate-800 hover:border-amber-500/40'
              }`}
            >
              <div className="flex items-center justify-between pb-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                  Pending Customs
                </span>
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600">
                  <Clock className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">
                {counts.pending_customs}
              </div>
              <span className="text-[10px] text-slate-400 font-medium block mt-0.5">
                Handed over by Terminal • Awaiting review
              </span>
            </div>

            {/* UNDER INSPECTION */}
            <div
              onClick={() => setStatusFilter(statusFilter === 'INSPECTION' ? 'all' : 'INSPECTION')}
              className={`p-4 rounded-2xl bg-white dark:bg-slate-900 border transition-all cursor-pointer shadow-sm ${
                statusFilter === 'INSPECTION'
                  ? 'border-purple-500 ring-2 ring-purple-500/20'
                  : 'border-slate-200/90 dark:border-slate-800 hover:border-purple-500/40'
              }`}
            >
              <div className="flex items-center justify-between pb-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                  Under Inspection
                </span>
                <div className="w-8 h-8 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-600">
                  <ShieldCheck className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">
                {counts.under_inspection}
              </div>
              <span className="text-[10px] text-slate-400 font-medium block mt-0.5">
                Active inspections currently in progress
              </span>
            </div>

            {/* ADDITIONAL INFO REQUIRED */}
            <div
              onClick={() => setStatusFilter(statusFilter === 'ADDITIONAL_INFO' ? 'all' : 'ADDITIONAL_INFO')}
              className={`p-4 rounded-2xl bg-white dark:bg-slate-900 border transition-all cursor-pointer shadow-sm ${
                statusFilter === 'ADDITIONAL_INFO'
                  ? 'border-blue-500 ring-2 ring-blue-500/20'
                  : 'border-slate-200/90 dark:border-slate-800 hover:border-blue-500/40'
              }`}
            >
              <div className="flex items-center justify-between pb-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                  Info Required
                </span>
                <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-600">
                  <AlertTriangle className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">
                {counts.info_required || 0}
              </div>
              <span className="text-[10px] text-slate-400 font-medium block mt-0.5">
                Inquiries sent to shipping lines
              </span>
            </div>

            {/* CLEARED */}
            <div
              onClick={() => setStatusFilter(statusFilter === 'CLEARED' ? 'all' : 'CLEARED')}
              className={`p-4 rounded-2xl bg-white dark:bg-slate-900 border transition-all cursor-pointer shadow-sm ${
                statusFilter === 'CLEARED'
                  ? 'border-emerald-500 ring-2 ring-emerald-500/20'
                  : 'border-slate-200/90 dark:border-slate-800 hover:border-emerald-500/40'
              }`}
            >
              <div className="flex items-center justify-between pb-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  Cleared
                </span>
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">
                {counts.cleared}
              </div>
              <span className="text-[10px] text-slate-400 font-medium block mt-0.5">
                Customs cleared • Ready for gate release
              </span>
            </div>

            {/* ON HOLD */}
            <div
              onClick={() => setStatusFilter(statusFilter === 'HOLD' ? 'all' : 'HOLD')}
              className={`p-4 rounded-2xl bg-white dark:bg-slate-900 border transition-all cursor-pointer shadow-sm ${
                statusFilter === 'HOLD'
                  ? 'border-rose-500 ring-2 ring-rose-500/20'
                  : 'border-slate-200/90 dark:border-slate-800 hover:border-rose-500/40'
              }`}
            >
              <div className="flex items-center justify-between pb-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                  On Hold
                </span>
                <div className="w-8 h-8 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-600">
                  <AlertOctagon className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">
                {counts.on_hold}
              </div>
              <span className="text-[10px] text-slate-400 font-medium block mt-0.5">
                Discrepancies found • Release strictly blocked
              </span>
            </div>
          </div>

      {/* ===================================================================== */}
      {/* 3. FILTERS & SEARCH WORKLIST BAR */}
      {/* ===================================================================== */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search by container number, vessel, cargo description, or IMO..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#D49A24]"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 text-xs">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-xl font-bold transition-colors cursor-pointer shrink-0 ${
              statusFilter === 'all'
                ? 'bg-[#D49A24] text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
            }`}
          >
            All Worklist ({counts.total_customs})
          </button>
          <button
            onClick={() => setStatusFilter('PENDING')}
            className={`px-3 py-1.5 rounded-xl font-bold transition-colors cursor-pointer shrink-0 ${
              statusFilter === 'PENDING'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20'
            }`}
          >
            Pending ({counts.pending_customs})
          </button>
          <button
            onClick={() => setStatusFilter('INSPECTION')}
            className={`px-3 py-1.5 rounded-xl font-bold transition-colors cursor-pointer shrink-0 ${
              statusFilter === 'INSPECTION'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-purple-500/10 text-purple-700 dark:text-purple-400 hover:bg-purple-500/20'
            }`}
          >
            Under Inspection ({counts.under_inspection})
          </button>
          <button
            onClick={() => setStatusFilter('CLEARED')}
            className={`px-3 py-1.5 rounded-xl font-bold transition-colors cursor-pointer shrink-0 ${
              statusFilter === 'CLEARED'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20'
            }`}
          >
            Cleared ({counts.cleared})
          </button>
          <button
            onClick={() => setStatusFilter('HOLD')}
            className={`px-3 py-1.5 rounded-xl font-bold transition-colors cursor-pointer shrink-0 ${
              statusFilter === 'HOLD'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-rose-500/10 text-rose-700 dark:text-rose-400 hover:bg-rose-500/20'
            }`}
          >
            On Hold ({counts.on_hold})
          </button>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 4. CUSTOMS WORKLIST TABLE */}
      {/* ===================================================================== */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-400 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 text-xs text-slate-400 space-y-2">
          <RefreshCw className="w-6 h-6 mx-auto animate-spin text-[#D49A24]" />
          <span>Loading customs containers worklist...</span>
        </div>
      ) : filteredContainers.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 text-slate-400 space-y-3">
          <Boxes className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600" />
          <p className="font-bold text-sm text-slate-700 dark:text-slate-300">
            No customs containers matching filter
          </p>
          <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
            Only containers that have completed Terminal Operator processing (<strong>Awaiting Customs</strong>, <strong>Under Inspection</strong>, <strong>Cleared</strong>, or <strong>Customs Hold</strong>) appear in this worklist.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-black uppercase tracking-wider text-[10px]">
                  <th className="p-3.5">Container Number</th>
                  <th className="p-3.5">Cargo ID</th>
                  <th className="p-3.5">Vessel Name</th>
                  <th className="p-3.5">Arrival Request ID</th>
                  <th className="p-3.5">Cargo Description</th>
                  <th className="p-3.5">Cargo Type</th>
                  <th className="p-3.5">Quantity</th>
                  <th className="p-3.5">Gross Weight</th>
                  <th className="p-3.5">Current Status</th>
                  <th className="p-3.5">Inspection Status</th>
                  <th className="p-3.5">Last Updated</th>
                  <th className="p-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium text-slate-700 dark:text-slate-300">
                {filteredContainers.map((container) => {
                  const cargo = container.cargo_context;
                  const inspection = container.latest_customs_inspection;
                  const isActionLoading = actionLoadingId === container.container_id;

                  return (
                    <tr
                      key={container.container_id}
                      onClick={() => setSelectedContainer(container)}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors cursor-pointer group"
                      title="Click to view detailed customs consignment profile"
                    >
                      {/* Container Number */}
                      <td className="p-3.5 font-mono font-bold text-slate-900 dark:text-white group-hover:text-[#D49A24] transition-colors whitespace-nowrap">
                        {container.container_number}
                        <span className="block text-[9px] text-slate-400 font-normal font-sans">
                          {container.container_type_display || container.container_type} • {container.teu_equivalent} TEU
                        </span>
                      </td>

                      {/* Cargo ID */}
                      <td className="p-3.5 font-mono font-bold text-[#D49A24] whitespace-nowrap">
                        #CRG-00{cargo?.cargo_id || container.container_cargo_id}
                      </td>

                      {/* Vessel Name */}
                      <td className="p-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white">
                          <Ship className="w-3.5 h-3.5 text-[#D49A24] shrink-0" />
                          <span>{cargo?.vessel_name || 'Vessel'}</span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-400 block">
                          IMO: {cargo?.vessel_imo_number || '—'}
                        </span>
                      </td>

                      {/* Arrival Request ID */}
                      <td className="p-3.5 font-mono font-bold text-sky-600 dark:text-sky-400 whitespace-nowrap">
                        AR-00{cargo?.arrival_request_id || '—'}
                      </td>

                      {/* Cargo Description */}
                      <td className="p-3.5 max-w-xs truncate font-semibold text-slate-800 dark:text-slate-200">
                        {cargo?.cargo_description || '—'}
                      </td>

                      {/* Cargo Type */}
                      <td className="p-3.5 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                          {cargo?.cargo_type_display || cargo?.cargo_type || 'CONTAINERIZED'}
                        </span>
                      </td>

                      {/* Quantity */}
                      <td className="p-3.5 font-mono whitespace-nowrap">
                        {cargo?.cargo_quantity ? `${cargo.cargo_quantity} ${cargo.cargo_unit}` : '1 UNIT'}
                      </td>

                      {/* Gross Weight */}
                      <td className="p-3.5 font-mono font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                        {container.container_gross_weight} MT
                      </td>

                      {/* Current Status */}
                      <td className="p-3.5 whitespace-nowrap">
                        {getStatusBadge(container.container_status, container.container_status_display)}
                      </td>

                      {/* Inspection Status */}
                      <td className="p-3.5 whitespace-nowrap">
                        {getInspectionBadge(inspection)}
                        {container.customs_documents && container.customs_documents.length > 0 ? (
                          <div className="mt-1">
                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold ${
                              container.customs_documents.every(d => d.review_status === 'VERIFIED')
                                ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/30'
                                : container.customs_documents.some(d => d.review_status === 'REJECTED')
                                ? 'bg-rose-500/10 text-rose-600 border border-rose-500/30'
                                : 'bg-teal-500/10 text-teal-600 border border-teal-500/30'
                            }`}>
                              <FileText className="w-2.5 h-2.5" />
                              <span>
                                {container.customs_documents.every(d => d.review_status === 'VERIFIED')
                                  ? 'Docs Verified'
                                  : container.customs_documents.some(d => d.review_status === 'REJECTED')
                                  ? 'Issue Found'
                                  : 'Docs Under Review'}
                              </span>
                            </span>
                          </div>
                        ) : (
                          <div className="mt-1 text-[9px] text-slate-400 font-normal">
                            No Docs Uploaded
                          </div>
                        )}
                      </td>

                      {/* Last Updated */}
                      <td className="p-3.5 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                        {formatDate(container.container_updated_at)}
                      </td>

                      {/* Action */}
                      <td className="p-3.5 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          {/* View details button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedContainer(container);
                            }}
                            className="p-1.5 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-600 dark:text-sky-400 transition-colors cursor-pointer"
                            title="View Container Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* Action button based on state */}
                          {container.container_status === 'AWAITING_CUSTOMS' && (
                            <button
                              type="button"
                              disabled={isActionLoading}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStartInspection(container);
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold text-[11px] transition-colors cursor-pointer inline-flex items-center gap-1 shadow-xs disabled:opacity-50"
                              title="Start Customs Inspection"
                            >
                              {isActionLoading ? (
                                <RefreshCw className="w-3 h-3 animate-spin" />
                              ) : (
                                <ShieldCheck className="w-3 h-3" />
                              )}
                              <span>Start Inspection</span>
                            </button>
                          )}

                          {container.container_status === 'UNDER_INSPECTION' && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenInspectionForm(container);
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-[11px] transition-colors cursor-pointer inline-flex items-center gap-1 shadow-xs"
                              title="Complete Inspection & Clear / Hold"
                            >
                              <FileCheck className="w-3 h-3" />
                              <span>Inspect / Decide</span>
                            </button>
                          )}

                          {container.container_status === 'CUSTOMS_HOLD' && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenInspectionForm(container);
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11px] transition-colors cursor-pointer inline-flex items-center gap-1 shadow-xs"
                              title="Review or Update Hold Decision"
                            >
                              <AlertTriangle className="w-3 h-3" />
                              <span>Review Hold</span>
                            </button>
                          )}

                          {container.container_status === 'CLEARED' && (
                            <span className="px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-[10px] font-bold inline-flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                              <span>Cleared</span>
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* 5. CUSTOMS CONTAINER DETAILS MODAL */}
      {/* ===================================================================== */}
      <Modal
        isOpen={!!selectedContainer}
        onClose={() => setSelectedContainer(null)}
        title="Customs Inspection Consignment Profile"
        subtitle={`Container #${selectedContainer?.container_number} • Cargo ID #CRG-00${selectedContainer?.cargo_context?.cargo_id || selectedContainer?.container_cargo_id}`}
        icon={<ShieldCheck className="w-5 h-5 text-purple-600" />}
        maxWidth="3xl"
      >
        {selectedContainer && (
          <div className="space-y-4">
            {/* Header info banner */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Container Number (ISO-6346)
                </span>
                <h3 className="text-xl font-black font-mono text-slate-900 dark:text-white mt-0.5">
                  {selectedContainer.container_number}
                </h3>
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  {selectedContainer.container_type_display || selectedContainer.container_type} • {selectedContainer.teu_equivalent} TEU Equivalent
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Customs State
                </span>
                {getStatusBadge(selectedContainer.container_status, selectedContainer.container_status_display)}
              </div>
            </div>

            {/* SECTION 1: CONTAINER INFORMATION */}
            <div className="space-y-2">
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400 border-b border-slate-200 dark:border-slate-800 pb-1 flex items-center gap-1.5">
                <Boxes className="w-3.5 h-3.5" />
                <span>1. Container Information</span>
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                  <span className="text-slate-400 text-[10px] font-medium block">Container Number</span>
                  <div className="font-mono font-bold text-slate-900 dark:text-white text-xs mt-0.5">
                    {selectedContainer.container_number}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                  <span className="text-slate-400 text-[10px] font-medium block">Container Type / Size</span>
                  <div className="font-bold text-slate-900 dark:text-white text-xs mt-0.5">
                    {selectedContainer.container_type_display || selectedContainer.container_type}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                  <span className="text-slate-400 text-[10px] font-medium block">TEU Capacity</span>
                  <div className="font-mono font-bold text-[#D49A24] text-xs mt-0.5">
                    {selectedContainer.teu_equivalent} TEU
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                  <span className="text-slate-400 text-[10px] font-medium block">Gross Weight</span>
                  <div className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-xs mt-0.5">
                    {selectedContainer.container_gross_weight} MT
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION 2: CARGO INFORMATION */}
            <div className="space-y-2">
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 border-b border-slate-200 dark:border-slate-800 pb-1 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" />
                <span>2. Cargo Consignment Information</span>
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                  <span className="text-slate-400 text-[10px] font-medium block">Cargo ID</span>
                  <div className="font-mono font-bold text-[#D49A24] text-xs mt-0.5">
                    #CRG-00{selectedContainer.cargo_context?.cargo_id || selectedContainer.container_cargo_id}
                  </div>
                </div>

                <div className="col-span-2 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                  <span className="text-slate-400 text-[10px] font-medium block">Cargo Description</span>
                  <div className="font-bold text-slate-900 dark:text-white text-xs mt-0.5">
                    {selectedContainer.cargo_context?.cargo_description || '—'}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                  <span className="text-slate-400 text-[10px] font-medium block">Cargo Type</span>
                  <div className="font-bold text-slate-900 dark:text-white text-xs mt-0.5">
                    {selectedContainer.cargo_context?.cargo_type_display || selectedContainer.cargo_context?.cargo_type || 'CONTAINERIZED'}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                  <span className="text-slate-400 text-[10px] font-medium block">Declared Quantity & Unit</span>
                  <div className="font-mono font-bold text-slate-900 dark:text-white text-xs mt-0.5">
                    {selectedContainer.cargo_context?.cargo_quantity || '—'} {selectedContainer.cargo_context?.cargo_unit || 'UNITS'}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                  <span className="text-slate-400 text-[10px] font-medium block">Port Routing (Origin → Dest)</span>
                  <div className="font-medium text-slate-900 dark:text-white text-xs mt-0.5 flex items-center gap-1 truncate">
                    <span>{selectedContainer.cargo_context?.cargo_origin || '—'}</span>
                    <ArrowRight className="w-3 h-3 text-[#D49A24] shrink-0" />
                    <span>{selectedContainer.cargo_context?.cargo_destination || '—'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION 3: VESSEL INFORMATION */}
            <div className="space-y-2">
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 border-b border-slate-200 dark:border-slate-800 pb-1 flex items-center gap-1.5">
                <Ship className="w-3.5 h-3.5" />
                <span>3. Vessel & Arrival Request Information</span>
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                  <span className="text-slate-400 text-[10px] font-medium block">Carrier Vessel</span>
                  <div className="font-bold text-slate-900 dark:text-white text-xs mt-0.5 truncate">
                    {selectedContainer.cargo_context?.vessel_name || 'Vessel'}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                  <span className="text-slate-400 text-[10px] font-medium block">IMO Number</span>
                  <div className="font-mono font-bold text-[#D49A24] text-xs mt-0.5">
                    {selectedContainer.cargo_context?.vessel_imo_number || '—'}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                  <span className="text-slate-400 text-[10px] font-medium block">Arrival Request ID</span>
                  <div className="font-mono font-bold text-sky-600 dark:text-sky-400 text-xs mt-0.5">
                    AR-00{selectedContainer.cargo_context?.arrival_request_id || '—'}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                  <span className="text-slate-400 text-[10px] font-medium block">Shipping Company</span>
                  <div className="font-bold text-slate-900 dark:text-white text-xs mt-0.5 truncate">
                    {selectedContainer.cargo_context?.company_name || 'Shipping Line'}
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION 4: CUSTOMS INFORMATION */}
            <div className="space-y-2">
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 border-b border-slate-200 dark:border-slate-800 pb-1 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>4. Customs Inspection & Clearance Audit</span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                  <span className="text-slate-400 text-[10px] font-medium block">Inspection Result</span>
                  <div className="mt-0.5">
                    {selectedContainer.latest_customs_inspection ? (
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                        selectedContainer.latest_customs_inspection.customs_inspection_result === 'CLEARED'
                          ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/30'
                          : selectedContainer.latest_customs_inspection.customs_inspection_result === 'HOLD'
                          ? 'bg-rose-500/10 text-rose-600 border border-rose-500/30'
                          : 'bg-purple-500/10 text-purple-600 border border-purple-500/30'
                      }`}>
                        {selectedContainer.latest_customs_inspection.customs_inspection_result}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400 font-medium">Pending Inspection</span>
                    )}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                  <span className="text-slate-400 text-[10px] font-medium block">Document Verification</span>
                  <div className="font-bold text-xs mt-0.5 text-slate-900 dark:text-white">
                    {selectedContainer.latest_customs_inspection?.customs_inspection_document_status || 'NOT_VERIFIED'}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                  <span className="text-slate-400 text-[10px] font-medium block">Customs Officer</span>
                  <div className="font-bold text-xs mt-0.5 text-slate-900 dark:text-white">
                    {selectedContainer.latest_customs_inspection?.customs_inspection_officer_name || '—'}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                  <span className="text-slate-400 text-[10px] font-medium block">Inspection Started At</span>
                  <div className="font-mono text-xs mt-0.5 text-slate-700 dark:text-slate-300">
                    {formatDate(selectedContainer.latest_customs_inspection?.customs_inspection_started_at)}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                  <span className="text-slate-400 text-[10px] font-medium block">Clearance Date</span>
                  <div className="font-mono text-xs mt-0.5 text-emerald-600 dark:text-emerald-400 font-bold">
                    {formatDate(selectedContainer.latest_customs_inspection?.customs_inspection_clearance_date)}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                  <span className="text-slate-400 text-[10px] font-medium block">Inspection Completed At</span>
                  <div className="font-mono text-xs mt-0.5 text-slate-700 dark:text-slate-300">
                    {formatDate(selectedContainer.latest_customs_inspection?.customs_inspection_completed_at)}
                  </div>
                </div>

                {selectedContainer.latest_customs_inspection?.customs_inspection_hold_reason && (
                  <div className="sm:col-span-3 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-400 text-xs">
                    <span className="font-bold block uppercase text-[10px]">Hold Reason:</span>
                    <span>{selectedContainer.latest_customs_inspection.customs_inspection_hold_reason}</span>
                  </div>
                )}

                {selectedContainer.latest_customs_inspection?.customs_inspection_remarks && (
                  <div className="sm:col-span-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 text-xs">
                    <span className="font-bold text-slate-400 block uppercase text-[10px]">Inspection Remarks:</span>
                    <span className="text-slate-700 dark:text-slate-300">
                      {selectedContainer.latest_customs_inspection.customs_inspection_remarks}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* SECTION 5: CUSTOMS SUPPORTING DOCUMENTS & PRE-ARRIVAL FILINGS */}
            <div className="space-y-2">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-1">
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" />
                  <span>5. Customs Supporting Documents & Pre-Arrival Filings ({selectedContainer.customs_documents?.length || 0})</span>
                </h4>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-400">
                    {selectedContainer.customs_documents?.filter(d => d.review_status === 'VERIFIED').length || 0} Verified •{' '}
                    {selectedContainer.customs_documents?.filter(d => d.review_status === 'PENDING').length || 0} Pending
                  </span>
                </div>
              </div>

              {(!selectedContainer.customs_documents || selectedContainer.customs_documents.length === 0) ? (
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/30 border border-dashed border-slate-200 dark:border-slate-700 text-center text-xs text-slate-400">
                  No customs supporting documents have been submitted for this container. Request shipping company to submit Bill of Lading, Commercial Invoice, Packing List, or Import Declaration.
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {selectedContainer.customs_documents.map((doc) => (
                    <div
                      key={doc.document_id}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 flex flex-col gap-2 text-xs"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-start gap-2.5 min-w-0">
                          <div className="p-2 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 shrink-0 mt-0.5">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="font-bold text-slate-900 dark:text-white truncate">
                                {doc.original_filename}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                ({doc.file_size_formatted})
                              </span>
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                                v{doc.document_version || doc.version || 1}
                              </span>
                              {!doc.document_is_active && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-slate-200 dark:bg-slate-800 text-slate-500 border border-slate-300">
                                  SUPERSEDED
                                </span>
                              )}
                              <span className={`px-1.5 py-0.2 rounded text-[9px] font-black uppercase ${
                                doc.workflow_type === 'PRE_ARRIVAL'
                                  ? 'bg-purple-500/10 text-purple-600 border border-purple-500/20'
                                  : 'bg-teal-500/10 text-teal-600 border border-teal-500/20'
                              }`}>
                                {doc.workflow_type_display || doc.workflow_type}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-2 mt-0.5">
                              <span className="font-semibold text-slate-700 dark:text-slate-300">
                                {doc.document_type_display || doc.document_type}
                              </span>
                              <span>•</span>
                              <span>Uploaded by {doc.uploader_name || 'Shipping Line'}</span>
                              <span>•</span>
                              <span className="font-mono">{formatDate(doc.submitted_at)}</span>
                            </div>
                            {doc.amendment_reason && (
                              <div className="text-[10px] text-amber-600 dark:text-amber-400 font-medium mt-0.5">
                                Correction/Amendment Reason: {doc.amendment_reason}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase flex items-center gap-1 ${
                            doc.review_status === 'VERIFIED'
                              ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/30'
                              : doc.review_status === 'REJECTED'
                              ? 'bg-rose-500/10 text-rose-600 border border-rose-500/30'
                              : doc.review_status === 'SUPERSEDED'
                              ? 'bg-slate-200 dark:bg-slate-800 text-slate-500 border border-slate-300'
                              : 'bg-amber-500/10 text-amber-600 border border-amber-500/30'
                          }`}>
                            {doc.review_status === 'VERIFIED' && <CheckCircle className="w-3 h-3 text-emerald-500" />}
                            {doc.review_status === 'REJECTED' && <XCircle className="w-3 h-3 text-rose-500" />}
                            {doc.review_status === 'PENDING' && <Clock className="w-3 h-3 text-amber-500" />}
                            <span>{doc.review_status_display || doc.review_status}</span>
                          </span>

                          <button
                            type="button"
                            onClick={() => handleDownloadDoc(doc, true)}
                            disabled={downloadingDocId === doc.document_id}
                            className="p-1.5 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-600 dark:text-sky-400 transition-colors cursor-pointer"
                            title="Preview Document in New Tab"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDownloadDoc(doc, false)}
                            disabled={downloadingDocId === doc.document_id}
                            className="p-1.5 rounded-lg bg-teal-500/10 hover:bg-teal-500/20 text-teal-600 dark:text-teal-400 transition-colors cursor-pointer"
                            title="Download Secure Document File"
                          >
                            {downloadingDocId === doc.document_id ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Download className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Officer Review Actions */}
                      <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex flex-wrap items-center justify-between gap-2">
                        <div className="text-[11px] text-slate-500">
                          {doc.reviewed_at && (
                            <span>
                              Reviewed by {doc.reviewer_name || 'Customs'} on {formatDate(doc.reviewed_at)}
                            </span>
                          )}
                          {doc.review_remarks && (
                            <div className="text-rose-600 dark:text-rose-400 font-medium">
                              Remarks: {doc.review_remarks}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 ml-auto">
                          {doc.review_status !== 'VERIFIED' && (
                            <button
                              type="button"
                              disabled={reviewingDocId === doc.document_id}
                              onClick={() => handleReviewDocument(doc.document_id, 'VERIFIED')}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] uppercase tracking-wider flex items-center gap-1 cursor-pointer disabled:opacity-50"
                            >
                              {reviewingDocId === doc.document_id ? (
                                <RefreshCw className="w-3 h-3 animate-spin" />
                              ) : (
                                <CheckCircle className="w-3 h-3" />
                              )}
                              <span>Verify Document</span>
                            </button>
                          )}

                          {doc.review_status !== 'REJECTED' && (
                            <button
                              type="button"
                              disabled={reviewingDocId === doc.document_id}
                              onClick={() => {
                                if (rejectingDocId === doc.document_id) {
                                  setRejectingDocId(null);
                                } else {
                                  setRejectingDocId(doc.document_id);
                                }
                              }}
                              className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-300 font-bold text-[10px] uppercase tracking-wider border border-rose-500/30 flex items-center gap-1 cursor-pointer"
                            >
                              <XCircle className="w-3 h-3 text-rose-500" />
                              <span>Reject / Flag Issue</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Inline Reject Input Form */}
                      {rejectingDocId === doc.document_id && (
                        <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900 flex items-center gap-2 animate-fade-in">
                          <input
                            type="text"
                            value={docRejectRemarks[doc.document_id] || ''}
                            onChange={(e) => setDocRejectRemarks({ ...docRejectRemarks, [doc.document_id]: e.target.value })}
                            placeholder="Enter reason for rejecting this document (e.g. illegible stamp, discrepancy in HS code)..."
                            className="flex-1 px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-rose-300 dark:border-rose-800 text-xs focus:outline-none focus:border-rose-500"
                          />
                          <button
                            type="button"
                            disabled={reviewingDocId === doc.document_id}
                            onClick={() => handleReviewDocument(doc.document_id, 'REJECTED', docRejectRemarks[doc.document_id])}
                            className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs uppercase cursor-pointer"
                          >
                            Confirm Rejection
                          </button>
                          <button
                            type="button"
                            onClick={() => setRejectingDocId(null)}
                            className="px-2 py-1.5 rounded-lg text-slate-500 text-xs hover:bg-slate-200 cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ACTION FOOTER */}
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
              <div>
                {selectedContainer.container_status === 'AWAITING_CUSTOMS' && (
                  <button
                    type="button"
                    disabled={actionLoadingId === selectedContainer.container_id}
                    onClick={() => {
                      const c = selectedContainer;
                      setSelectedContainer(null);
                      handleStartInspection(c);
                    }}
                    className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-sm"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Start Inspection</span>
                  </button>
                )}

                {(selectedContainer.container_status === 'UNDER_INSPECTION' || selectedContainer.container_status === 'CUSTOMS_HOLD') && (
                  <button
                    type="button"
                    onClick={() => {
                      const c = selectedContainer;
                      setSelectedContainer(null);
                      handleOpenInspectionForm(c);
                    }}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-sm"
                  >
                    <FileCheck className="w-3.5 h-3.5" />
                    <span>{selectedContainer.container_status === 'CUSTOMS_HOLD' ? 'Review Hold Decision' : 'Enter Inspection Decision'}</span>
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => setSelectedContainer(null)}
                className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs hover:bg-slate-300 transition-colors cursor-pointer"
              >
                Close Profile
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ===================================================================== */}
      {/* 6. INSPECTION / CLEARANCE DECISION FORM MODAL */}
      {/* ===================================================================== */}
      <Modal
        isOpen={!!inspectingContainer}
        onClose={() => setInspectingContainer(null)}
        title="Customs Inspection & Decision Record"
        subtitle={`Container #${inspectingContainer?.container_number} • Consignment Review`}
        icon={<FileCheck className="w-5 h-5 text-emerald-600" />}
        maxWidth="2xl"
      >
        {inspectingContainer && (
          <form onSubmit={handleSubmitInspection} className="space-y-4">
            {/* Header info */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Inspecting Officer</span>
                <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1 mt-0.5">
                  <User className="w-3.5 h-3.5 text-purple-600" />
                  <span>{currentUser?.name || currentUser?.email || 'Logged-in Officer'}</span>
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Current Status</span>
                <span className="font-bold text-purple-600 dark:text-purple-400">
                  {inspectingContainer.container_status_display || inspectingContainer.container_status}
                </span>
              </div>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-400 text-xs flex items-center gap-2 animate-fade-in">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {/* Supporting Documents Checklist & Status Banner */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-teal-600" />
                  <span>Submitted Customs Supporting Documents</span>
                </span>
                <span className="text-[11px] font-bold">
                  {inspectingContainer.customs_documents?.filter(d => d.review_status === 'VERIFIED').length || 0} of {inspectingContainer.customs_documents?.length || 0} Verified
                </span>
              </div>

              {(!inspectingContainer.customs_documents || inspectingContainer.customs_documents.length === 0) ? (
                <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-[11px] flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                  <span>No supporting documents have been submitted yet. Physical clearance cannot proceed without verified documents.</span>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {inspectingContainer.customs_documents.map(doc => (
                    <div
                      key={doc.document_id}
                      className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px]"
                    >
                      <div className="truncate mr-2">
                        <span className="font-medium text-slate-900 dark:text-white truncate block">
                          {doc.original_filename}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {doc.document_type_display}
                        </span>
                      </div>
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase shrink-0 ${
                        doc.review_status === 'VERIFIED'
                          ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/30'
                          : doc.review_status === 'REJECTED'
                          ? 'bg-rose-500/10 text-rose-600 border border-rose-500/30'
                          : 'bg-amber-500/10 text-amber-600 border border-amber-500/30'
                      }`}>
                        {doc.review_status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Document Verification Status */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                Document Verification Status *
              </label>
              <select
                value={docVerificationStatus}
                onChange={(e) => setDocVerificationStatus(e.target.value as 'VERIFIED' | 'PENDING' | 'ISSUE_FOUND')}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-bold text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#D49A24]"
              >
                <option value="VERIFIED">Verified (Documentation Authenticated & Complete)</option>
                <option value="PENDING">Pending (Awaiting Document Submission)</option>
                <option value="ISSUE_FOUND">Issue Found (Discrepancy in Manifest / Invoices)</option>
              </select>
              <span className="text-[10px] text-slate-400 mt-1 block">
                Rule: A container can only be Cleared if document verification is <strong>Verified</strong>.
              </span>
            </div>

            {/* Inspection Result Choice */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2">
                Customs Inspection Result *
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* 1. CLEAR CONTAINER */}
                <button
                  type="button"
                  onClick={() => setInspectionResult('CLEARED')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-3 ${
                    inspectionResult === 'CLEARED'
                      ? 'border-emerald-500 bg-emerald-500/10 ring-2 ring-emerald-500/20 text-emerald-800 dark:text-emerald-300'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-slate-600 dark:text-slate-400 hover:border-emerald-500/40'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                    inspectionResult === 'CLEARED' ? 'bg-emerald-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-400'
                  }`}>
                    ✓
                  </div>
                  <div>
                    <div className="font-bold text-xs">Clear Container</div>
                    <div className="text-[10px] text-slate-400">Grant clearance for gate release</div>
                  </div>
                </button>

                {/* 2. REQUEST ADDITIONAL INFORMATION */}
                <button
                  type="button"
                  onClick={() => setInspectionResult('ADDITIONAL_INFORMATION_REQUIRED')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-3 ${
                    inspectionResult === 'ADDITIONAL_INFORMATION_REQUIRED'
                      ? 'border-amber-500 bg-amber-500/10 ring-2 ring-amber-500/20 text-amber-800 dark:text-amber-300'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-slate-600 dark:text-slate-400 hover:border-amber-500/40'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                    inspectionResult === 'ADDITIONAL_INFORMATION_REQUIRED' ? 'bg-amber-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-400'
                  }`}>
                    ?
                  </div>
                  <div>
                    <div className="font-bold text-xs">Request Info</div>
                    <div className="text-[10px] text-slate-400">Require additional docs/details</div>
                  </div>
                </button>

                {/* 3. MARK FOR PHYSICAL INSPECTION */}
                <button
                  type="button"
                  onClick={() => setInspectionResult('UNDER_INSPECTION')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-3 ${
                    inspectionResult === 'UNDER_INSPECTION'
                      ? 'border-purple-500 bg-purple-500/10 ring-2 ring-purple-500/20 text-purple-800 dark:text-purple-300'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-slate-600 dark:text-slate-400 hover:border-purple-500/40'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                    inspectionResult === 'UNDER_INSPECTION' ? 'bg-purple-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-400'
                  }`}>
                    🔍
                  </div>
                  <div>
                    <div className="font-bold text-xs">Physical Inspection</div>
                    <div className="text-[10px] text-slate-400">Order physical cargo/seal check</div>
                  </div>
                </button>

                {/* 4. CUSTOMS HOLD */}
                <button
                  type="button"
                  onClick={() => setInspectionResult('HOLD')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-3 ${
                    inspectionResult === 'HOLD'
                      ? 'border-rose-500 bg-rose-500/10 ring-2 ring-rose-500/20 text-rose-800 dark:text-rose-300'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-slate-600 dark:text-slate-400 hover:border-rose-500/40'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                    inspectionResult === 'HOLD' ? 'bg-rose-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-400'
                  }`}>
                    ✕
                  </div>
                  <div>
                    <div className="font-bold text-xs">Customs Hold</div>
                    <div className="text-[10px] text-slate-400">Block release & flag violation</div>
                  </div>
                </button>
              </div>
            </div>

            {/* Hold Reason (Conditional if HOLD) */}
            {inspectionResult === 'HOLD' && (
              <div className="p-3.5 rounded-xl bg-rose-500/5 border border-rose-500/20 space-y-2 animate-fade-in">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400">
                  Customs Hold Reason *
                </label>
                <select
                  required
                  value={holdReason}
                  onChange={(e) => setHoldReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-rose-300 dark:border-rose-800 font-bold text-xs text-rose-900 dark:text-rose-200 focus:outline-none focus:border-rose-500"
                >
                  {HOLD_REASONS.map((reason) => (
                    <option key={reason} value={reason}>
                      {reason}
                    </option>
                  ))}
                </select>
                <span className="text-[10px] text-rose-600/80 block">
                  A container placed on Customs Hold is strictly blocked from the gate release stage.
                </span>
              </div>
            )}

            {/* Inspection Remarks */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                Inspection Remarks / Officer Findings {inspectionResult === 'HOLD' || inspectionResult === 'ADDITIONAL_INFORMATION_REQUIRED' ? '*' : '(Optional)'}
              </label>
              <textarea
                rows={3}
                required={inspectionResult === 'HOLD' || inspectionResult === 'ADDITIONAL_INFORMATION_REQUIRED'}
                value={inspectionRemarks}
                onChange={(e) => setInspectionRemarks(e.target.value)}
                placeholder={
                  inspectionResult === 'HOLD'
                    ? 'State specific discrepancies, missing documents, or inspection findings...'
                    : inspectionResult === 'ADDITIONAL_INFORMATION_REQUIRED'
                    ? 'State the specific missing documents or clarifications required from shipping line...'
                    : inspectionResult === 'UNDER_INSPECTION'
                    ? 'Specify physical examination instructions, seal inspection, or cargo sampling requirements...'
                    : 'Notes on cargo condition, seal verification, and documentary checks...'
                }
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#D49A24]"
              />
            </div>

            {/* Footer Buttons */}
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setInspectingContainer(null)}
                className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingInspection}
                className={`px-5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider text-white transition-colors cursor-pointer shadow-sm disabled:opacity-50 flex items-center gap-1.5 ${
                  inspectionResult === 'CLEARED'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : inspectionResult === 'ADDITIONAL_INFORMATION_REQUIRED'
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : inspectionResult === 'UNDER_INSPECTION'
                    ? 'bg-purple-600 hover:bg-purple-700'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {submittingInspection && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>
                  {submittingInspection
                    ? 'Recording Decision...'
                    : inspectionResult === 'CLEARED'
                    ? 'Clear Container'
                    : inspectionResult === 'ADDITIONAL_INFORMATION_REQUIRED'
                    ? 'Request Additional Info'
                    : inspectionResult === 'UNDER_INSPECTION'
                    ? 'Mark for Inspection'
                    : 'Place on Customs Hold'}
                </span>
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};
