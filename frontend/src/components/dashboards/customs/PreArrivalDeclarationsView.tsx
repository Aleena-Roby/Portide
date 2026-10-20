import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  FileText,
  User,
  Calendar,
  AlertOctagon,
  ExternalLink,
  Building,
  Check,
  Download
} from 'lucide-react';
import { apiFetch } from '../../../services/api';
import { useApp } from '../../../context/AppContext';
import { Modal } from '../../common/Modal';
import { PreArrivalCustomsDeclaration, PreArrivalCustomsStatus, CustomsDocumentItem } from '../../../types';

export const PreArrivalDeclarationsView: React.FC = () => {
  const { addToast } = useApp();

  const [declarations, setDeclarations] = useState<PreArrivalCustomsDeclaration[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Review Modal State
  const [selectedDeclaration, setSelectedDeclaration] = useState<PreArrivalCustomsDeclaration | null>(null);
  const [reviewDecision, setReviewDecision] = useState<PreArrivalCustomsStatus>('CLEARED');
  const [reviewRemarks, setReviewRemarks] = useState<string>('');
  const [holdReason, setHoldReason] = useState<string>('Documentation verification required');
  const [submittingReview, setSubmittingReview] = useState<boolean>(false);
  const [downloadingDocId, setDownloadingDocId] = useState<number | null>(null);

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

  // Fetch Declarations
  const fetchDeclarations = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/customs/pre-arrival/');
      const data = await res.json();
      const list = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
      setDeclarations(list);
    } catch (err: any) {
      addToast(err?.message || 'Failed to load pre-arrival customs declarations.', 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    fetchDeclarations();
  }, [fetchDeclarations]);

  // Counts
  const counts = useMemo(() => {
    return {
      total: declarations.length,
      pending: declarations.filter(d => d.declaration_status === 'PENDING_REVIEW').length,
      cleared: declarations.filter(d => d.declaration_status === 'CLEARED').length,
      info_required: declarations.filter(d => d.declaration_status === 'ADDITIONAL_INFORMATION_REQUIRED').length,
      inspection: declarations.filter(d => d.declaration_status === 'UNDER_INSPECTION').length,
      hold: declarations.filter(d => d.declaration_status === 'CUSTOMS_HOLD').length,
    };
  }, [declarations]);

  // Filtered Declarations
  const filteredDeclarations = useMemo(() => {
    return declarations.filter(d => {
      const matchesStatus = statusFilter === 'all' || d.declaration_status === statusFilter;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q ||
        (d.declaration_reference && d.declaration_reference.toLowerCase().includes(q)) ||
        (d.container_number && d.container_number.toLowerCase().includes(q)) ||
        (d.vessel_name && d.vessel_name.toLowerCase().includes(q)) ||
        (d.company_name && d.company_name.toLowerCase().includes(q));
      return matchesStatus && matchesSearch;
    });
  }, [declarations, statusFilter, searchQuery]);

  // Handle Review Submission
  const handleSubmitReview = async () => {
    if (!selectedDeclaration) return;

    if (reviewDecision === 'CUSTOMS_HOLD' && !holdReason.trim()) {
      addToast('Hold reason is mandatory when placing a declaration on Customs Hold.', 'warning');
      return;
    }

    setSubmittingReview(true);
    try {
      const payload = {
        decision: reviewDecision,
        remarks: reviewRemarks.trim(),
        hold_reason: reviewDecision === 'CUSTOMS_HOLD' ? holdReason.trim() : ''
      };

      const res = await apiFetch(`/api/customs/pre-arrival/${selectedDeclaration.declaration_id}/review/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok || data?.status === 'error') {
        throw new Error(data?.message || 'Failed to submit customs review decision.');
      }

      addToast(data?.message || `Declaration ${selectedDeclaration.declaration_reference} marked ${reviewDecision}!`, 'success');
      setSelectedDeclaration(null);
      setReviewRemarks('');
      fetchDeclarations();
    } catch (err: any) {
      addToast(err?.message || 'Failed to submit customs decision.', 'error');
    } finally {
      setSubmittingReview(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* SUMMARY STAT CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {/* PENDING REVIEW */}
        <div
          onClick={() => setStatusFilter(statusFilter === 'PENDING_REVIEW' ? 'all' : 'PENDING_REVIEW')}
          className={`p-4 rounded-2xl bg-white dark:bg-slate-900 border transition-all cursor-pointer shadow-sm ${
            statusFilter === 'PENDING_REVIEW'
              ? 'border-amber-500 ring-2 ring-amber-500/20'
              : 'border-slate-200/90 dark:border-slate-800 hover:border-amber-500/40'
          }`}
        >
          <div className="flex items-center justify-between pb-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              Pending Review
            </span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">
            {counts.pending}
          </div>
          <span className="text-[10px] text-slate-400 font-medium block mt-0.5">
            Advance declarations awaiting review
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
              Pre-Cleared
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">
            {counts.cleared}
          </div>
          <span className="text-[10px] text-slate-400 font-medium block mt-0.5">
            Eligible for direct quayside transfer
          </span>
        </div>

        {/* UNDER INSPECTION */}
        <div
          onClick={() => setStatusFilter(statusFilter === 'UNDER_INSPECTION' ? 'all' : 'UNDER_INSPECTION')}
          className={`p-4 rounded-2xl bg-white dark:bg-slate-900 border transition-all cursor-pointer shadow-sm ${
            statusFilter === 'UNDER_INSPECTION'
              ? 'border-purple-500 ring-2 ring-purple-500/20'
              : 'border-slate-200/90 dark:border-slate-800 hover:border-purple-500/40'
          }`}
        >
          <div className="flex items-center justify-between pb-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
              Inspection Flagged
            </span>
            <ShieldCheck className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">
            {counts.inspection}
          </div>
          <span className="text-[10px] text-slate-400 font-medium block mt-0.5">
            Requires physical quayside check
          </span>
        </div>

        {/* CUSTOMS HOLD */}
        <div
          onClick={() => setStatusFilter(statusFilter === 'CUSTOMS_HOLD' ? 'all' : 'CUSTOMS_HOLD')}
          className={`p-4 rounded-2xl bg-white dark:bg-slate-900 border transition-all cursor-pointer shadow-sm ${
            statusFilter === 'CUSTOMS_HOLD'
              ? 'border-rose-500 ring-2 ring-rose-500/20'
              : 'border-slate-200/90 dark:border-slate-800 hover:border-rose-500/40'
          }`}
        >
          <div className="flex items-center justify-between pb-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
              Customs Hold
            </span>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">
            {counts.hold}
          </div>
          <span className="text-[10px] text-slate-400 font-medium block mt-0.5">
            Release strictly prohibited
          </span>
        </div>

        {/* INFO REQUIRED */}
        <div
          onClick={() => setStatusFilter(statusFilter === 'ADDITIONAL_INFORMATION_REQUIRED' ? 'all' : 'ADDITIONAL_INFORMATION_REQUIRED')}
          className={`p-4 rounded-2xl bg-white dark:bg-slate-900 border transition-all cursor-pointer shadow-sm ${
            statusFilter === 'ADDITIONAL_INFORMATION_REQUIRED'
              ? 'border-blue-500 ring-2 ring-blue-500/20'
              : 'border-slate-200/90 dark:border-slate-800 hover:border-blue-500/40'
          }`}
        >
          <div className="flex items-center justify-between pb-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
              Info Required
            </span>
            <FileText className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">
            {counts.info_required}
          </div>
          <span className="text-[10px] text-slate-400 font-medium block mt-0.5">
            Awaiting line response
          </span>
        </div>
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search reference, container, vessel, shipping line..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#D49A24]"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchDeclarations}
            disabled={loading}
            className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors cursor-pointer border border-slate-200 dark:border-slate-700 flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* DECLARATIONS TABLE */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-black text-slate-900 dark:text-white">
            Advance Manifest Customs Declarations ({filteredDeclarations.length})
          </h3>
          <span className="text-xs text-slate-400">
            Official Pre-Arrival Clearance Decisions
          </span>
        </div>

        {loading ? (
          <div className="py-12 text-center text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-amber-500" />
            <p className="text-xs">Loading pre-arrival declarations...</p>
          </div>
        ) : filteredDeclarations.length === 0 ? (
          <div className="p-8 text-center rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-300 dark:border-slate-700">
            <FileCheck className="w-8 h-8 text-slate-400 mx-auto mb-2 opacity-50" />
            <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
              No Advance Customs Declarations Found
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Advance declarations submitted by shipping lines prior to vessel berthing will appear here for review.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-black uppercase text-slate-500 tracking-wider">
                  <th className="py-3 px-3">Reference</th>
                  <th className="py-3 px-3">Container</th>
                  <th className="py-3 px-3">Vessel & Berth</th>
                  <th className="py-3 px-3">Submitting Line</th>
                  <th className="py-3 px-3">Documentation</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Submitted At</th>
                  <th className="py-3 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredDeclarations.map((d) => (
                  <tr key={d.declaration_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-3 font-mono font-bold text-slate-900 dark:text-white">
                      {d.declaration_reference}
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-mono font-black text-slate-900 dark:text-white">
                        {d.container_number}
                      </span>
                      <span className="block text-[10px] text-slate-400">
                        {d.container_type}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {d.vessel_name}
                      </span>
                      <span className="block text-[10px] text-slate-400">
                        {d.berth_name}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {d.company_name}
                      </span>
                      <span className="block text-[10px] text-slate-400">
                        By: {d.submitted_by_name || 'Shipping Line'}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      {d.documents && d.documents.length > 0 ? (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <FileText className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                            <span className="font-semibold text-slate-800 dark:text-slate-200">
                              {d.documents.length} File{d.documents.length > 1 ? 's' : ''}
                            </span>
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-teal-500/10 text-teal-600 border border-teal-500/20">
                              Advance Docs
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1 max-w-[200px]">
                            {d.documents.slice(0, 2).map((doc) => (
                              <button
                                key={doc.document_id}
                                type="button"
                                onClick={() => handleDownloadDoc(doc, true)}
                                className="text-[10px] text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-0.5 truncate max-w-[180px] cursor-pointer"
                                title={`Preview ${doc.original_filename} (${doc.document_type_display || doc.document_type})`}
                              >
                                <span className="truncate">{doc.original_filename}</span>
                                <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                              </button>
                            ))}
                            {d.documents.length > 2 && (
                              <span className="text-[10px] text-slate-400 font-bold">
                                +{d.documents.length - 2} more
                              </span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="flex items-center gap-1.5">
                            <FileText className="w-3.5 h-3.5 text-blue-500" />
                            <span className="font-semibold text-slate-800 dark:text-slate-200">
                              {d.declaration_document_type}
                            </span>
                          </div>
                          {d.declaration_document && (
                            <a
                              href={d.declaration_document}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5 mt-0.5"
                            >
                              <span>{d.declaration_document_name || 'View Document'}</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          d.declaration_status === 'CLEARED'
                            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                            : d.declaration_status === 'CUSTOMS_HOLD'
                            ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30'
                            : d.declaration_status === 'UNDER_INSPECTION'
                            ? 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30'
                            : d.declaration_status === 'ADDITIONAL_INFORMATION_REQUIRED'
                            ? 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30'
                            : 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                        }`}
                      >
                        {d.declaration_status_display}
                      </span>
                      {d.declaration_hold_reason && (
                        <span className="block text-[10px] text-rose-500 mt-0.5 max-w-xs truncate" title={d.declaration_hold_reason}>
                          Hold: {d.declaration_hold_reason}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-slate-500 text-[11px]">
                      {new Date(d.declaration_submitted_at).toLocaleString()}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => {
                          setSelectedDeclaration(d);
                          setReviewDecision(d.declaration_status === 'CLEARED' ? 'CLEARED' : 'CLEARED');
                          setReviewRemarks(d.declaration_review_remarks || '');
                          setHoldReason(d.declaration_hold_reason || 'Documentation verification required');
                        }}
                        className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-sm"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Review</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* REVIEW & DECISION MODAL */}
      <Modal
        isOpen={!!selectedDeclaration}
        onClose={() => setSelectedDeclaration(null)}
        title={`Customs Officer Review: ${selectedDeclaration?.declaration_reference}`}
        maxWidth="xl"
      >
        {selectedDeclaration && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400 font-semibold">Container Number:</span>
                <span className="font-mono font-black text-slate-900 dark:text-white">
                  {selectedDeclaration.container_number} ({selectedDeclaration.container_type})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-semibold">Carrier Vessel:</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {selectedDeclaration.vessel_name} ({selectedDeclaration.berth_name})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-semibold">Submitting Line:</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {selectedDeclaration.company_name}
                </span>
              </div>
            </div>

            {/* Supporting Documents Section */}
            <div className="space-y-2">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-teal-700 dark:text-teal-300 flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-1">
                <span className="flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-teal-600" />
                  <span>Submitted Advance Supporting Documents ({selectedDeclaration.documents?.length || (selectedDeclaration.declaration_document ? 1 : 0)})</span>
                </span>
                <span className="text-[10px] font-mono text-slate-400">Advance Manifest Filing</span>
              </h4>

              {selectedDeclaration.documents && selectedDeclaration.documents.length > 0 ? (
                <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                  {selectedDeclaration.documents.map((doc) => (
                    <div
                      key={doc.document_id}
                      className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs hover:border-teal-500/40 transition-colors"
                    >
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
                              ({doc.file_size_formatted || doc.formatted_file_size || '—'})
                            </span>
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                              v{doc.document_version || doc.version || 1}
                            </span>
                            {!doc.document_is_active && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-slate-200 dark:bg-slate-800 text-slate-500 border border-slate-300">
                                SUPERSEDED
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-2 mt-0.5">
                            <span className="font-semibold text-teal-700 dark:text-teal-300">
                              {doc.document_type_display || doc.document_type}
                            </span>
                            <span>•</span>
                            <span>Uploaded by {doc.uploaded_by_name || 'Shipping Line'}</span>
                            {doc.document_uploaded_at && (
                              <>
                                <span>•</span>
                                <span className="font-mono">{new Date(doc.document_uploaded_at).toLocaleString()}</span>
                              </>
                            )}
                          </div>
                          {doc.amendment_reason && (
                            <div className="text-[10px] text-amber-600 dark:text-amber-400 font-medium mt-0.5">
                              Correction/Amendment Reason: {doc.amendment_reason}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        <button
                          type="button"
                          onClick={() => handleDownloadDoc(doc, true)}
                          disabled={downloadingDocId === doc.document_id}
                          className="p-1.5 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-600 dark:text-sky-400 transition-colors cursor-pointer"
                          title="Preview in new tab"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDownloadDoc(doc, false)}
                          disabled={downloadingDocId === doc.document_id}
                          className="p-1.5 rounded-lg bg-teal-500/10 hover:bg-teal-500/20 text-teal-600 dark:text-teal-400 transition-colors cursor-pointer"
                          title="Download document file"
                        >
                          {downloadingDocId === doc.document_id ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Download className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : selectedDeclaration.declaration_document ? (
                <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="w-4 h-4 text-teal-600 shrink-0" />
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 dark:text-white truncate">
                        {selectedDeclaration.declaration_document_name || 'Pre-Arrival Filing Document'}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {selectedDeclaration.declaration_document_type}
                      </div>
                    </div>
                  </div>
                  <a
                    href={selectedDeclaration.declaration_document}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs inline-flex items-center gap-1 shadow-sm"
                  >
                    <Download className="w-3 h-3" />
                    <span>Download</span>
                  </a>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800/40 text-slate-400 text-xs text-center">
                  No files attached to this pre-arrival declaration.
                </div>
              )}
            </div>

            {/* Filing Remarks / Notes if present */}
            {selectedDeclaration.declaration_notes && (
              <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/20 text-xs">
                <span className="font-bold text-blue-700 dark:text-blue-300 block uppercase text-[10px]">
                  Filer Remarks / Consignment Notes:
                </span>
                <span className="text-slate-700 dark:text-slate-300 mt-0.5 block">
                  {selectedDeclaration.declaration_notes}
                </span>
              </div>
            )}

            {/* Review History / Resubmissions if present */}
            {selectedDeclaration.declaration_review_history && selectedDeclaration.declaration_review_history.length > 0 && (
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 text-xs space-y-1.5">
                <span className="font-bold text-slate-500 dark:text-slate-400 uppercase text-[10px] block">
                  Audit & Version History ({selectedDeclaration.declaration_review_history.length} events):
                </span>
                <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                  {selectedDeclaration.declaration_review_history.map((hist: any, i: number) => (
                    <div key={i} className="text-[11px] text-slate-600 dark:text-slate-300 flex items-start gap-1.5 border-b border-slate-200/50 dark:border-slate-700/50 pb-1">
                      <span className="font-mono text-slate-400 shrink-0">
                        {hist.timestamp ? new Date(hist.timestamp).toLocaleTimeString() : ''}
                      </span>
                      <span>
                        <strong>{hist.actor_name || hist.actor_email || 'User'}</strong>: {hist.action}
                        {hist.remarks && ` — "${hist.remarks}"`}
                        {hist.reason && ` (Reason: ${hist.reason})`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Decision Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Customs Authority Decision
              </label>
              <select
                value={reviewDecision}
                onChange={(e) => setReviewDecision(e.target.value as PreArrivalCustomsStatus)}
                className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-[#D49A24]"
              >
                <option value="CLEARED">CLEARED — Authorize Pre-Arrival Clearance (Direct Release Eligible)</option>
                <option value="ADDITIONAL_INFORMATION_REQUIRED">ADDITIONAL_INFORMATION_REQUIRED — Request Further Documentation</option>
                <option value="UNDER_INSPECTION">UNDER_INSPECTION — Mandatory Quayside Inspection Required</option>
                <option value="CUSTOMS_HOLD">CUSTOMS_HOLD — Strict Customs Hold (Block Release)</option>
              </select>
            </div>

            {/* Hold Reason (Conditional) */}
            {reviewDecision === 'CUSTOMS_HOLD' && (
              <div className="space-y-1.5 animate-fade-in">
                <label className="text-xs font-bold text-rose-600 dark:text-rose-400">
                  Mandatory Hold Reason
                </label>
                <select
                  value={holdReason}
                  onChange={(e) => setHoldReason(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-rose-300 dark:border-rose-700 text-xs font-bold text-rose-900 dark:text-rose-200 focus:outline-none"
                >
                  <option value="Documentation discrepancy or missing certification">Documentation discrepancy or missing certification</option>
                  <option value="Manifest weight or quantity mismatch">Manifest weight or quantity mismatch</option>
                  <option value="Restricted or prohibited cargo suspected">Restricted or prohibited cargo suspected</option>
                  <option value="High-risk security flag requiring inter-agency clearance">High-risk security flag requiring inter-agency clearance</option>
                  <option value="Regulatory inspection required prior to discharge">Regulatory inspection required prior to discharge</option>
                </select>
              </div>
            )}

            {/* Remarks */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Official Customs Remarks
              </label>
              <textarea
                rows={3}
                placeholder="Enter formal customs officer inspection/clearance remarks..."
                value={reviewRemarks}
                onChange={(e) => setReviewRemarks(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#D49A24]"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setSelectedDeclaration(null)}
                disabled={submittingReview}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitReview}
                disabled={submittingReview}
                className="flex items-center gap-2 px-5 py-2 text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white rounded-xl transition-all disabled:opacity-50 cursor-pointer shadow-md"
              >
                {submittingReview ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Recording Decision...
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    Confirm Official Decision
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
