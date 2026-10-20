import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { apiFetch } from '../../../services/api';
import { BackendGatePass, GatePassStatus } from '../../../types';
import { 
  Truck, 
  Search, 
  RefreshCw, 
  QrCode, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  AlertTriangle, 
  Mail, 
  Eye, 
  ShieldCheck, 
  Send, 
  Ban
} from 'lucide-react';

interface GatePassDirectoryProps {
  onSelectPass: (pass: BackendGatePass) => void;
  onNavigateToVerify?: (passId: string) => void;
}

export const GatePassDirectory: React.FC<GatePassDirectoryProps> = ({
  onSelectPass,
  onNavigateToVerify
}) => {
  const [passes, setPasses] = useState<BackendGatePass[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [actionMessage, setActionMessage] = useState<string>('');

  const fetchPasses = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const url = statusFilter === 'all' 
        ? '/api/gate/passes/' 
        : `/api/gate/passes/?status=${statusFilter}`;
      const res = await apiFetch(url);
      const json = await res.json();
      if (res.ok && json.status === 'success') {
        setPasses(json.data || []);
      } else {
        setError(json.message || 'Failed to load digital gate passes.');
      }
    } catch {
      setError('Communication error while fetching gate passes.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchPasses();
  }, [fetchPasses]);

  // Counts
  const counts = useMemo(() => {
    const active = passes.filter(p => p.gate_pass_status === 'ACTIVE').length;
    const used = passes.filter(p => p.gate_pass_status === 'USED').length;
    const expired = passes.filter(p => p.gate_pass_status === 'EXPIRED').length;
    const cancelled = passes.filter(p => p.gate_pass_status === 'CANCELLED').length;
    return {
      total: passes.length,
      active,
      used,
      expired,
      cancelled
    };
  }, [passes]);

  // Filtered passes
  const filteredPasses = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return passes;
    return passes.filter(p => {
      const matchPassId = String(p.gate_pass_pass_number || p.gate_pass_id || '').toLowerCase().includes(q);
      const matchTruck = (p.truck?.truck_number || (p as any).truck_details?.truck_number || '').toLowerCase().includes(q);
      const matchDriver = (p.driver?.driver_name || (p as any).driver_details?.driver_name || '').toLowerCase().includes(q);
      const matchEmail = (p.driver?.driver_email || (p as any).driver_details?.driver_email || '').toLowerCase().includes(q);
      const matchGate = (p.gate?.gate_name || (p as any).gate_details?.gate_name || '').toLowerCase().includes(q);
      const matchContainer = (p.containers || []).some(c => 
        (c.container_number || '').toLowerCase().includes(q)
      );
      return matchPassId || matchTruck || matchDriver || matchEmail || matchGate || matchContainer;
    });
  }, [passes, searchQuery]);

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

  const getStatusBadge = (status: GatePassStatus) => {
    switch (status) {
      case 'ACTIVE':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 inline-flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
            <span>ACTIVE</span>
          </span>
        );
      case 'USED':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/30 inline-flex items-center gap-1">
            <Truck className="w-3 h-3 text-teal-500" />
            <span>RELEASED (USED)</span>
          </span>
        );
      case 'EXPIRED':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 inline-flex items-center gap-1">
            <Clock className="w-3 h-3 text-amber-500" />
            <span>EXPIRED</span>
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30 inline-flex items-center gap-1">
            <XCircle className="w-3 h-3 text-rose-500" />
            <span>CANCELLED</span>
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-slate-100 text-slate-600">
            {status}
          </span>
        );
    }
  };

  // Handle Cancel Pass
  const handleCancelPass = async (passId: number, passCode: string) => {
    if (!window.confirm(`Are you sure you want to cancel Digital Gate Pass ${passCode}? This cannot be undone.`)) {
      return;
    }
    setActionLoadingId(passId);
    setActionMessage('');
    try {
      const res = await apiFetch(`/api/gate/passes/${passId}/cancel/`, { method: 'POST' });
      const json = await res.json();
      if (res.ok && json.status === 'success') {
        setActionMessage(`Pass ${passCode} cancelled successfully.`);
        fetchPasses();
      } else {
        setError(json.message || 'Failed to cancel gate pass.');
      }
    } catch {
      setError('Communication error while cancelling gate pass.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Handle Resend Email
  const handleResendEmail = async (passId: number, passCode: string) => {
    setActionLoadingId(passId);
    setActionMessage('');
    try {
      const res = await apiFetch(`/api/gate/passes/${passId}/resend-email/`, { method: 'POST' });
      const json = await res.json();
      if (res.ok && json.status === 'success') {
        setActionMessage(`Digital Gate Pass emailed to driver successfully.`);
        fetchPasses();
      } else {
        setError(json.message || 'Failed to resend gate pass email.');
      }
    } catch {
      setError('Communication error while dispatching email.');
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div 
          onClick={() => setStatusFilter('all')}
          className={`p-4 rounded-xl border transition-all cursor-pointer ${
            statusFilter === 'all'
              ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
              : 'bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between pb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Passes</span>
            <QrCode className="w-4 h-4 text-teal-500" />
          </div>
          <div className="text-2xl font-black font-mono">{counts.total}</div>
        </div>

        <div 
          onClick={() => setStatusFilter('ACTIVE')}
          className={`p-4 rounded-xl border transition-all cursor-pointer ${
            statusFilter === 'ACTIVE'
              ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
              : 'bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800 hover:border-emerald-500/40'
          }`}
        >
          <div className="flex items-center justify-between pb-1">
            <span className={`text-[10px] font-bold uppercase tracking-wider ${statusFilter === 'ACTIVE' ? 'text-emerald-100' : 'text-emerald-600 dark:text-emerald-400'}`}>
              Active Valid Passes
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black font-mono">{counts.active}</div>
        </div>

        <div 
          onClick={() => setStatusFilter('USED')}
          className={`p-4 rounded-xl border transition-all cursor-pointer ${
            statusFilter === 'USED'
              ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
              : 'bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800 hover:border-teal-500/40'
          }`}
        >
          <div className="flex items-center justify-between pb-1">
            <span className={`text-[10px] font-bold uppercase tracking-wider ${statusFilter === 'USED' ? 'text-teal-100' : 'text-teal-600 dark:text-teal-400'}`}>
              Released & Exited
            </span>
            <Truck className="w-4 h-4 text-teal-400" />
          </div>
          <div className="text-2xl font-black font-mono">{counts.used}</div>
        </div>

        <div 
          onClick={() => setStatusFilter('EXPIRED')}
          className={`p-4 rounded-xl border transition-all cursor-pointer ${
            statusFilter === 'EXPIRED'
              ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
              : 'bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800 hover:border-amber-500/40'
          }`}
        >
          <div className="flex items-center justify-between pb-1">
            <span className={`text-[10px] font-bold uppercase tracking-wider ${statusFilter === 'EXPIRED' ? 'text-amber-100' : 'text-amber-600 dark:text-amber-400'}`}>
              Expired / Cancelled
            </span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black font-mono">{counts.expired + counts.cancelled}</div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by Pass ID, Truck, Driver, Gate, or Container..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs focus:outline-none focus:border-teal-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchPasses}
            disabled={loading}
            className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors cursor-pointer border border-slate-200 dark:border-slate-700 flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {actionMessage && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
          <span>{actionMessage}</span>
        </div>
      )}

      {error && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-400 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Passes Table */}
      {loading ? (
        <div className="p-10 text-center rounded-xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 text-xs text-slate-400 space-y-2">
          <RefreshCw className="w-5 h-5 mx-auto animate-spin text-teal-600" />
          <span>Loading Digital Gate Passes...</span>
        </div>
      ) : filteredPasses.length === 0 ? (
        <div className="p-10 text-center rounded-xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 text-slate-400 space-y-2">
          <QrCode className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
          <p className="font-bold text-xs text-slate-700 dark:text-slate-300">
            No gate passes found matching criteria
          </p>
          <span className="text-[11px] text-slate-400 block max-w-sm mx-auto">
            Generate digital gate passes for customs-cleared containers from the Release Manifest tab.
          </span>
        </div>
      ) : (
        <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-black uppercase tracking-wider text-[10px]">
                  <th className="p-3">Gate Pass ID</th>
                  <th className="p-3">Truck & Haulier</th>
                  <th className="p-3">Assigned Driver</th>
                  <th className="p-3">Designated Gate</th>
                  <th className="p-3">Authorized Containers</th>
                  <th className="p-3">Validity Window</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium text-slate-700 dark:text-slate-300">
                {filteredPasses.map(pass => {
                  const passPk = pass.gate_pass_id || (pass as any).id;
                  const passCode = pass.gate_pass_pass_number || `GP-${passPk}`;
                  const isActive = pass.gate_pass_status === 'ACTIVE';
                  const isUsed = pass.gate_pass_status === 'USED';
                  const truckNumber = pass.truck?.truck_number || (pass as any).truck_details?.truck_number || '—';
                  const transportCo = pass.truck?.transport_company_name || (pass as any).truck_details?.transport_company || 'Independent';
                  const driverName = pass.driver?.driver_name || (pass as any).driver_details?.driver_name || '—';
                  const driverEmail = pass.driver?.driver_email || (pass as any).driver_details?.driver_email || '—';
                  const gateName = pass.gate?.gate_name || (pass as any).gate_details?.gate_name || 'Main Port Gate';
                  const gateCode = pass.gate?.gate_code || (pass as any).gate_details?.gate_code;
                  const containerCount = pass.containers?.length ?? (pass as any).container_count ?? 0;
                  const isEmailed = pass.gate_pass_email_status === 'SENT' || (pass as any).email_status?.dispatched;

                  return (
                    <tr
                      key={passPk}
                      onClick={() => onSelectPass(pass)}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors cursor-pointer group"
                    >
                      {/* Pass ID */}
                      <td className="p-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 font-mono font-black text-slate-900 dark:text-white group-hover:text-teal-600 transition-colors">
                          <QrCode className="w-3.5 h-3.5 text-teal-600" />
                          <span>{passCode}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-sans block mt-0.5">
                          Issued {formatDate(pass.gate_pass_issued_at)} • #{passPk}
                        </span>
                      </td>

                      {/* Truck */}
                      <td className="p-3 whitespace-nowrap">
                        <div className="font-mono font-bold text-slate-900 dark:text-white flex items-center gap-1">
                          <Truck className="w-3 h-3 text-teal-500" />
                          <span>{truckNumber}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 block mt-0.5">
                          {transportCo}
                        </span>
                      </td>

                      {/* Driver */}
                      <td className="p-3 max-w-xs">
                        <div className="font-bold text-slate-900 dark:text-white truncate">
                          {driverName}
                        </div>
                        <div className="text-[10px] text-purple-600 dark:text-purple-400 flex items-center gap-1 mt-0.5">
                          <Mail className="w-3 h-3 shrink-0" />
                          <span className="truncate">{driverEmail}</span>
                        </div>
                      </td>

                      {/* Gate */}
                      <td className="p-3 whitespace-nowrap">
                        <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                          {gateName}
                        </span>
                        {gateCode && (
                          <span className="text-[10px] font-mono text-slate-400 block">
                            {gateCode}
                          </span>
                        )}
                      </td>

                      {/* Containers */}
                      <td className="p-3">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {(pass.containers || []).map(c => (
                            <span 
                              key={c.container_id}
                              className="px-1.5 py-0.5 rounded font-mono text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700"
                            >
                              {c.container_number}
                            </span>
                          ))}
                        </div>
                        <span className="text-[10px] text-slate-400 block mt-0.5">
                          {containerCount} container{containerCount !== 1 ? 's' : ''} authorized
                        </span>
                      </td>

                      {/* Validity */}
                      <td className="p-3 whitespace-nowrap text-[11px]">
                        <div>
                          <span className="text-slate-400 text-[10px] block">Valid Until</span>
                          <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                            {formatDate(pass.gate_pass_valid_until)}
                          </span>
                        </div>
                        {isUsed && pass.gate_pass_used_at && (
                          <span className="text-[10px] font-mono text-teal-600 block mt-0.5">
                            Released: {formatDate(pass.gate_pass_used_at)}
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="p-3 whitespace-nowrap">
                        {getStatusBadge(pass.gate_pass_status)}
                        {/* Email status tag */}
                        <div className="mt-1">
                          {isEmailed ? (
                            <span className="text-[9px] text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                              <Mail className="w-2.5 h-2.5" />
                              <span>Emailed</span>
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleResendEmail(passPk, passCode);
                              }}
                              disabled={actionLoadingId === passPk}
                              className="text-[9px] text-amber-600 hover:underline flex items-center gap-0.5 cursor-pointer"
                              title="Email not dispatched. Click to send."
                            >
                              <Send className="w-2.5 h-2.5" />
                              <span>Send Email</span>
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="p-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectPass(pass);
                            }}
                            className="p-1.5 rounded-lg bg-teal-500/10 hover:bg-teal-500/20 text-teal-600 dark:text-teal-400 transition-colors cursor-pointer"
                            title="View Digital Gate Pass & QR Code"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {isActive && onNavigateToVerify && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onNavigateToVerify(passCode || String(passPk));
                              }}
                              className="px-2.5 py-1 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold text-[11px] transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                              title="Process Verification at Gate"
                            >
                              <ShieldCheck className="w-3 h-3" />
                              <span>Verify at Gate</span>
                            </button>
                          )}

                          {isActive && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCancelPass(passPk, passCode);
                              }}
                              disabled={actionLoadingId === passPk}
                              className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                              title="Cancel Digital Gate Pass"
                            >
                              <Ban className="w-3.5 h-3.5" />
                            </button>
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
  );
};
