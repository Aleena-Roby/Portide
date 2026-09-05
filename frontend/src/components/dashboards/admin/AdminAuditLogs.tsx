import React, { useState, useEffect, useCallback } from 'react';
import { Shield, Filter, Search, Clock, RefreshCw, AlertCircle, CheckCircle2, XCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { apiFetch } from '../../../services/api';

interface AuditLogRecord {
  audit_log_id: number;
  timestamp: string;
  iso_timestamp?: string;
  actor: string;
  role: string;
  action: string;
  category: string;
  target_type: string;
  target_id: string | null;
  target_resource: string;
  description: string;
  status: 'SUCCESS' | 'FAILED' | string;
  ip_address: string | null;
}

interface AuditLogResponse {
  total_count: number;
  page: number;
  page_size: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
  results: AuditLogRecord[];
}

export const AdminAuditLogs: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogRecord[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [pageSize] = useState<number>(15);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchAuditLogs = useCallback(async (page: number, search: string, category: string) => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const params = new URLSearchParams();
      params.append('page', String(page));
      params.append('page_size', String(pageSize));
      if (search.trim()) {
        params.append('search', search.trim());
      }
      if (category && category !== 'all') {
        params.append('category', category);
      }

      const res = await apiFetch(`/api/audit-logs/?${params.toString()}`);
      if (!res.ok) {
        if (res.status === 403) {
          throw new Error('Access denied. Port Administrator authorization is required.');
        }
        throw new Error(`Failed to load audit logs (HTTP ${res.status}).`);
      }

      const data = await res.json();
      if (data.status === 'success' && data.data) {
        const payload: AuditLogResponse = data.data;
        setLogs(payload.results || []);
        setTotalCount(payload.total_count || 0);
        setCurrentPage(payload.page || 1);
        setTotalPages(payload.total_pages || 1);
      } else {
        throw new Error(data.message || 'Unable to retrieve audit logs.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'An error occurred while fetching audit logs.');
      setLogs([]);
      setTotalCount(0);
    } finally {
      setIsLoading(false);
    }
  }, [pageSize]);

  // Debounced search / filter trigger
  useEffect(() => {
    const handler = setTimeout(() => {
      fetchAuditLogs(currentPage, searchQuery, categoryFilter);
    }, 250);
    return () => clearTimeout(handler);
  }, [currentPage, searchQuery, categoryFilter, fetchAuditLogs]);

  const handleCategoryChange = (newCat: string) => {
    setCategoryFilter(newCat);
    setCurrentPage(1);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  const getActionBadgeClass = (action: string) => {
    const act = action.toUpperCase();
    if (act.includes('LOGIN_FAILED') || act.includes('REJECT') || act.includes('DELETE')) {
      return 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20';
    }
    if (act.includes('APPROVE') || act.includes('LOGIN') || act.includes('PASSWORD_RESET_SUCCESS')) {
      return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
    }
    if (act.includes('CREATE')) {
      return 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20';
    }
    if (act.includes('UPDATE') || act.includes('STATUS_CHANGE')) {
      return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
    }
    return 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20';
  };

  const getCategoryBadgeClass = (category: string) => {
    const cat = category.toUpperCase();
    if (cat === 'AUTHENTICATION') {
      return 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20';
    }
    if (cat === 'VESSEL' || cat === 'ARRIVAL_REQUEST') {
      return 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20';
    }
    if (cat === 'BERTH') {
      return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
    }
    if (cat === 'SHIPPING_COMPANY') {
      return 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20';
    }
    if (cat === 'USER_MANAGEMENT') {
      return 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20';
    }
    return 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20';
  };

  return (
    <div className="space-y-6 animate-fade-in font-sans">
      {/* Header */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
            <Shield className="w-6 h-6 text-[#D49A24]" />
            <span>Port Security & System Audit Logs</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium pt-1">
            Immutable activity trail of important PORTIDE security and operational events.
          </p>
        </div>
        <button
          onClick={() => fetchAuditLogs(currentPage, searchQuery, categoryFilter)}
          disabled={isLoading}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors shadow-xs cursor-pointer disabled:opacity-50"
          title="Refresh Audit Logs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search audit logs by actor, role, action, target, or category..."
            value={searchQuery}
            onChange={handleSearchChange}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-medium focus:outline-none focus:border-[#D49A24] text-slate-900 dark:text-white placeholder-slate-400"
          />
        </div>

        <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={categoryFilter}
            onChange={(e) => handleCategoryChange(e.target.value)}
            className="bg-transparent text-xs font-bold text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer"
          >
            <option value="all">All Audit Categories</option>
            <option value="AUTHENTICATION">Authentication</option>
            <option value="USER_MANAGEMENT">User Management</option>
            <option value="SHIPPING_COMPANY">Shipping Company</option>
            <option value="VESSEL">Vessel</option>
            <option value="ARRIVAL_REQUEST">Arrival Request</option>
            <option value="BERTH">Berth</option>
            <option value="SYSTEM">System Core</option>
          </select>
        </div>
      </div>

      {/* Error state alert */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Logs Table */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-[11px] font-black uppercase tracking-wider text-slate-500">
                <th className="p-4">Timestamp</th>
                <th className="p-4">Actor / Role</th>
                <th className="p-4">Action</th>
                <th className="p-4">Target Resource</th>
                <th className="p-4">Category</th>
                <th className="p-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-slate-500 font-medium">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="w-5 h-5 animate-spin text-[#D49A24]" />
                      <span>Loading real-time audit records...</span>
                    </div>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-slate-500 font-medium">
                    No recent activity logs found.
                  </td>
                </tr>
              ) : (
                logs.map(log => (
                  <tr key={log.audit_log_id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="p-4 font-mono text-slate-500 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>{log.timestamp}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="font-bold text-slate-900 dark:text-white">{log.actor}</div>
                      <div className="text-[10px] text-slate-400 font-medium">{log.role}</div>
                    </td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black tracking-wider border ${getActionBadgeClass(log.action)}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="p-4 font-mono text-slate-700 dark:text-slate-300">
                      <div className="font-semibold">{log.target_resource}</div>
                      {log.description && (
                        <div className="text-[10px] text-slate-400 font-sans truncate max-w-xs" title={log.description}>
                          {log.description}
                        </div>
                      )}
                    </td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${getCategoryBadgeClass(log.category)}`}>
                        {log.category}
                      </span>
                    </td>
                    <td className="p-4">
                      {log.status === 'SUCCESS' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>SUCCESS</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                          <XCircle className="w-3 h-3" />
                          <span>FAILED</span>
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {!isLoading && totalCount > 0 && (
          <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
            <div>
              Showing <span className="font-bold text-slate-700 dark:text-slate-300">{(currentPage - 1) * pageSize + 1}</span> to{' '}
              <span className="font-bold text-slate-700 dark:text-slate-300">{Math.min(currentPage * pageSize, totalCount)}</span> of{' '}
              <span className="font-bold text-slate-700 dark:text-slate-300">{totalCount}</span> log entries
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage <= 1}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="Previous Page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="px-3 py-1 font-bold text-slate-700 dark:text-slate-300">
                Page {currentPage} of {totalPages}
              </div>

              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage >= totalPages}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="Next Page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
