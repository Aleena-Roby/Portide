import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Search,
  RefreshCw,
  Eye,
  ShieldCheck,
  FileCheck,
  FileText,
  User,
  Calendar,
  AlertOctagon,
  ChevronLeft,
  ChevronRight,
  Filter
} from 'lucide-react';
import { apiFetch } from '../../../services/api';
import { useApp } from '../../../context/AppContext';
import { Modal } from '../../common/Modal';

export interface CustomsAuditRecord {
  audit_log_id: number;
  audit_log_action?: string;
  audit_log_category?: string;
  audit_log_target_type?: string;
  audit_log_target_id?: string | number;
  audit_log_actor_name?: string;
  audit_log_description?: string;
  audit_log_status?: string;
  audit_log_timestamp?: string;
  // Fallbacks provided by standard AuditLogSerializer
  action?: string;
  category?: string;
  target_type?: string;
  target_id?: string | number;
  target_resource?: string;
  actor?: string;
  role?: string;
  description?: string;
  status?: string;
  timestamp?: string;
  iso_timestamp?: string;
}

export const CustomsDecisionHistoryView: React.FC = () => {
  const { addToast } = useApp();

  const [records, setRecords] = useState<CustomsAuditRecord[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [page, setPage] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters & Search
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedRecord, setSelectedRecord] = useState<CustomsAuditRecord | null>(null);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (actionFilter && actionFilter !== 'all') {
        params.append('action', actionFilter);
      }
      if (searchQuery.trim()) {
        params.append('search', searchQuery.trim());
      }
      params.append('page', String(page));
      params.append('page_size', '15');

      const res = await apiFetch(`/api/customs/history/?${params.toString()}`);
      const json = await res.json();

      if (res.ok && json.status === 'success') {
        setRecords(json.data || []);
        setTotalCount(json.total_count || 0);
        setTotalPages(json.total_pages || 1);
      } else {
        addToast(json.message || 'Failed to load customs decision history.', 'error');
      }
    } catch {
      addToast('Network error while retrieving customs decision history.', 'error');
    } finally {
      setLoading(false);
    }
  }, [actionFilter, searchQuery, page, addToast]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const formatDate = (isoString?: string | null) => {
    if (!isoString) return '—';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch {
      return isoString;
    }
  };

  const getActionBadge = (action?: string | null) => {
    const act = (action || '').toUpperCase();
    if (act.includes('CLEAR')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
          <span>Cleared</span>
        </span>
      );
    }
    if (act.includes('HOLD')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30">
          <AlertOctagon className="w-3 h-3 text-rose-500" />
          <span>Customs Hold</span>
        </span>
      );
    }
    if (act.includes('ADDITIONAL') || act.includes('INFO')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30">
          <AlertTriangle className="w-3 h-3 text-amber-500" />
          <span>Info Requested</span>
        </span>
      );
    }
    if (act.includes('INSPECTION')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/30">
          <ShieldCheck className="w-3 h-3 text-purple-500" />
          <span>Inspection</span>
        </span>
      );
    }
    if (act.includes('PRE_ARRIVAL')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30">
          <FileCheck className="w-3 h-3 text-indigo-500" />
          <span>Pre-Arrival Review</span>
        </span>
      );
    }
    const displayAction = (action || 'DECISION').replace(/_/g, ' ');
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
        <FileText className="w-3 h-3" />
        <span>{displayAction}</span>
      </span>
    );
  };

  return (
    <div className="space-y-6 font-sans">
      {/* HEADER SECTION */}
      <div className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/30">
              Audit & Regulatory Integrity
            </span>
            <span className="text-xs text-slate-400 font-mono">
              Total Decisions: {totalCount}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            Customs Decision History & Audit Trail
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 font-normal max-w-3xl">
            Immutable regulatory audit log of all container clearances, customs holds, additional information requests, inspection findings, and documentary reviews.
          </p>
        </div>

        <button
          onClick={() => fetchHistory()}
          disabled={loading}
          className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors cursor-pointer border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 self-start md:self-center"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh History</span>
        </button>
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Action Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: 'all', label: 'All Decisions' },
              { id: 'CLEAR_CONTAINER', label: 'Clearances' },
              { id: 'CUSTOMS_HOLD', label: 'Holds' },
              { id: 'REQUEST_ADDITIONAL_INFO', label: 'Info Requests' },
              { id: 'UNDER_INSPECTION', label: 'Inspections' },
              { id: 'REVIEW_CUSTOMS_DOCUMENT', label: 'Doc Reviews' }
            ].map(f => (
              <button
                key={f.id}
                onClick={() => {
                  setActionFilter(f.id);
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  actionFilter === f.id
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Search box */}
          <div className="relative min-w-[240px] max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search officer, container, ref..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-purple-500"
            />
          </div>
        </div>
      </div>

      {/* DECISION RECORDS TABLE */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-800/40 font-bold uppercase text-[10px] text-slate-500 tracking-wider">
                <th className="p-3.5">Timestamp</th>
                <th className="p-3.5">Decision / Action</th>
                <th className="p-3.5">Target Entity</th>
                <th className="p-3.5">Customs Officer</th>
                <th className="p-3.5">Findings & Description</th>
                <th className="p-3.5 text-right">View</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-purple-600" />
                    <span>Loading customs decision records...</span>
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-slate-400">
                    <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <span className="font-medium block">No customs decision records found.</span>
                    <span className="text-[11px] text-slate-400">
                      Recorded inspection rulings, clearances, and holds will appear here automatically.
                    </span>
                  </td>
                </tr>
              ) : (
                records.map((record) => {
                  const recAction = record.audit_log_action || record.action || 'DECISION';
                  const recTimestamp = record.audit_log_timestamp || record.iso_timestamp || record.timestamp;
                  const recTargetType = record.audit_log_target_type || record.target_type || 'Entity';
                  const recTargetId = record.audit_log_target_id ?? record.target_id ?? '—';
                  const recActor = record.audit_log_actor_name || record.actor || 'Customs Inspector';
                  const recDescription = record.audit_log_description || record.description || '—';

                  return (
                    <tr
                      key={record.audit_log_id}
                      onClick={() => setSelectedRecord(record)}
                      className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                    >
                      <td className="p-3.5 whitespace-nowrap font-mono text-[11px] text-slate-500">
                        {formatDate(recTimestamp)}
                      </td>
                      <td className="p-3.5 whitespace-nowrap">
                        {getActionBadge(recAction)}
                      </td>
                      <td className="p-3.5 whitespace-nowrap">
                        <span className="font-mono font-bold text-slate-900 dark:text-white">
                          {recTargetType}: #{recTargetId}
                        </span>
                      </td>
                      <td className="p-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 font-medium text-slate-800 dark:text-slate-200">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          <span>{recActor}</span>
                        </div>
                      </td>
                      <td className="p-3.5 max-w-md truncate text-slate-600 dark:text-slate-300">
                        {recDescription}
                      </td>
                      <td className="p-3.5 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedRecord(record);
                          }}
                          className="p-1.5 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 dark:text-purple-400 transition-colors"
                          title="View Full Audit Record"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION */}
        <div className="p-3.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
          <div>
            Showing Page <span className="font-bold text-slate-900 dark:text-white">{page}</span> of{' '}
            <span className="font-bold text-slate-900 dark:text-white">{totalPages}</span> ({totalCount} total entries)
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* DETAIL RECORD MODAL */}
      <Modal
        isOpen={!!selectedRecord}
        onClose={() => setSelectedRecord(null)}
        title="Customs Regulatory Audit Record"
        subtitle={`Event #${selectedRecord?.audit_log_id} • Action: ${selectedRecord?.audit_log_action || selectedRecord?.action || 'DECISION'}`}
        icon={<Clock className="w-5 h-5 text-purple-600" />}
        maxWidth="lg"
      >
        {selectedRecord && (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Action Category</span>
                <span className="font-bold text-slate-900 dark:text-white font-mono">
                  {selectedRecord.audit_log_category || selectedRecord.category || 'CUSTOMS'}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Recorded Action</span>
                <div className="mt-0.5">{getActionBadge(selectedRecord.audit_log_action || selectedRecord.action)}</div>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Recorded Timestamp</span>
                <span className="font-mono text-slate-700 dark:text-slate-300">
                  {formatDate(selectedRecord.audit_log_timestamp || selectedRecord.iso_timestamp || selectedRecord.timestamp)}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Customs Officer / Actor</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {selectedRecord.audit_log_actor_name || selectedRecord.actor || 'Customs Inspector'}
                </span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Target Subject</span>
              <div className="font-mono font-bold text-slate-900 dark:text-white">
                {(selectedRecord.audit_log_target_type || selectedRecord.target_type || 'Subject')} Identifier: {selectedRecord.audit_log_target_id ?? selectedRecord.target_id ?? '—'}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Officer Remarks & Audit Description</span>
              <p className="text-slate-700 dark:text-slate-200 leading-relaxed font-normal">
                {selectedRecord.audit_log_description || selectedRecord.description || 'No remarks provided.'}
              </p>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedRecord(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
              >
                Close Audit Record
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
