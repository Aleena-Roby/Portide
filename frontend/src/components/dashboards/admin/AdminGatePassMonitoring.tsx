import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { apiFetch } from '../../../services/api';
import { BackendGatePass, GatePassStatus } from '../../../types';
import { DigitalGatePassModal } from '../../common/DigitalGatePassModal';
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
  Boxes, 
  Calendar,
  Lock
} from 'lucide-react';

export const AdminGatePassMonitoring: React.FC = () => {
  const [passes, setPasses] = useState<BackendGatePass[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedPass, setSelectedPass] = useState<BackendGatePass | null>(null);

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
        setError(json.message || 'Failed to load gate passes audit list.');
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
      const matchOfficer = (p.issued_by_name || '').toLowerCase().includes(q);
      const matchContainer = (p.containers || []).some(c => 
        (c.container_number || '').toLowerCase().includes(q)
      );
      return matchPassId || matchTruck || matchDriver || matchEmail || matchGate || matchOfficer || matchContainer;
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
            <span>USED (RELEASED)</span>
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

  return (
    <div className="space-y-6 font-sans selection:bg-[#D49A24] selection:text-white animate-fade-in">
      {/* Header */}
      <div className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 space-y-2 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/30 inline-flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-sky-500" />
              <span>Administrative Oversight</span>
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            Digital Gate Passes Monitoring & Audit Trail
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-normal max-w-4xl">
            Real-time audit log and oversight of all port gate movement authorizations, assigned commercial drivers, transport trucks, container manifests, and exit barrier releases.
          </p>
        </div>

        <button
          onClick={fetchPasses}
          disabled={loading}
          className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors cursor-pointer border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Summary metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          onClick={() => setStatusFilter('all')}
          className={`p-5 rounded-2xl bg-white dark:bg-slate-900 border transition-all cursor-pointer shadow-sm ${
            statusFilter === 'all'
              ? 'border-slate-900 dark:border-white ring-2 ring-slate-900/10'
              : 'border-slate-200/90 dark:border-slate-800'
          }`}
        >
          <div className="flex items-center justify-between pb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Movements</span>
            <QrCode className="w-4 h-4 text-sky-500" />
          </div>
          <div className="text-3xl font-black text-slate-900 dark:text-white font-mono">{counts.total}</div>
          <span className="text-[10px] text-slate-400 font-medium block mt-1">All Recorded Gate Passes</span>
        </div>

        <div
          onClick={() => setStatusFilter('ACTIVE')}
          className={`p-5 rounded-2xl bg-white dark:bg-slate-900 border transition-all cursor-pointer shadow-sm ${
            statusFilter === 'ACTIVE'
              ? 'border-emerald-500 ring-2 ring-emerald-500/20'
              : 'border-slate-200/90 dark:border-slate-800'
          }`}
        >
          <div className="flex items-center justify-between pb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Active Passes</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-3xl font-black text-slate-900 dark:text-white font-mono">{counts.active}</div>
          <span className="text-[10px] text-slate-400 font-medium block mt-1">Authorized & Awaiting Exit</span>
        </div>

        <div
          onClick={() => setStatusFilter('USED')}
          className={`p-5 rounded-2xl bg-white dark:bg-slate-900 border transition-all cursor-pointer shadow-sm ${
            statusFilter === 'USED'
              ? 'border-teal-500 ring-2 ring-teal-500/20'
              : 'border-slate-200/90 dark:border-slate-800'
          }`}
        >
          <div className="flex items-center justify-between pb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">Released (Used)</span>
            <Truck className="w-4 h-4 text-teal-500" />
          </div>
          <div className="text-3xl font-black text-slate-900 dark:text-white font-mono">{counts.used}</div>
          <span className="text-[10px] text-slate-400 font-medium block mt-1">Exited Through Port Gates</span>
        </div>

        <div
          onClick={() => setStatusFilter('EXPIRED')}
          className={`p-5 rounded-2xl bg-white dark:bg-slate-900 border transition-all cursor-pointer shadow-sm ${
            statusFilter === 'EXPIRED'
              ? 'border-amber-500 ring-2 ring-amber-500/20'
              : 'border-slate-200/90 dark:border-slate-800'
          }`}
        >
          <div className="flex items-center justify-between pb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">Expired / Cancelled</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-3xl font-black text-slate-900 dark:text-white font-mono">{counts.expired + counts.cancelled}</div>
          <span className="text-[10px] text-slate-400 font-medium block mt-1">Elapsed Validity or Revoked</span>
        </div>
      </div>

      {/* Toolbar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search by Pass ID, Truck, Driver, Gate, Container, or Officer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs focus:outline-none focus:border-sky-500"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-xl font-bold transition-colors cursor-pointer shrink-0 ${
              statusFilter === 'all'
                ? 'bg-slate-800 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
            }`}
          >
            All Passes ({counts.total})
          </button>
          <button
            onClick={() => setStatusFilter('ACTIVE')}
            className={`px-3 py-1.5 rounded-xl font-bold transition-colors cursor-pointer shrink-0 ${
              statusFilter === 'ACTIVE'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20'
            }`}
          >
            Active ({counts.active})
          </button>
          <button
            onClick={() => setStatusFilter('USED')}
            className={`px-3 py-1.5 rounded-xl font-bold transition-colors cursor-pointer shrink-0 ${
              statusFilter === 'USED'
                ? 'bg-teal-600 text-white shadow-xs'
                : 'bg-teal-500/10 text-teal-600 dark:text-teal-400 hover:bg-teal-500/20'
            }`}
          >
            Used ({counts.used})
          </button>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="p-12 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 text-xs text-slate-400 space-y-2">
          <RefreshCw className="w-6 h-6 mx-auto animate-spin text-sky-500" />
          <span>Loading gate pass monitoring log...</span>
        </div>
      ) : filteredPasses.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 text-slate-400 space-y-2">
          <QrCode className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600" />
          <p className="font-bold text-sm text-slate-700 dark:text-slate-300">
            No gate passes recorded
          </p>
          <span className="text-xs text-slate-400 block max-w-sm mx-auto">
            Digital gate passes generated by Gate & Truck Operations Officers will appear here in real time.
          </span>
        </div>
      ) : (
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-black uppercase tracking-wider text-[10px]">
                  <th className="p-3.5">Gate Pass ID</th>
                  <th className="p-3.5">Truck & Haulier</th>
                  <th className="p-3.5">Assigned Driver</th>
                  <th className="p-3.5">Authorized Containers</th>
                  <th className="p-3.5">Designated Gate</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">Timeline (Issued / Valid / Used)</th>
                  <th className="p-3.5 text-right">Audit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium text-slate-700 dark:text-slate-300">
                {filteredPasses.map(pass => (
                  <tr
                    key={pass.id}
                    onClick={() => setSelectedPass(pass)}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors cursor-pointer group"
                  >
                    {/* Pass ID */}
                    <td className="p-3.5 font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <QrCode className="w-3.5 h-3.5 text-sky-500" />
                        <span>{pass.gate_pass_id}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-sans block mt-0.5">
                        By: {pass.issued_by_name || 'Gate Officer'}
                      </span>
                    </td>

                    {/* Truck */}
                    <td className="p-3.5 whitespace-nowrap">
                      <div className="font-mono font-bold text-slate-900 dark:text-white flex items-center gap-1">
                        <Truck className="w-3 h-3 text-sky-500" />
                        <span>{pass.truck?.truck_number || (pass as any).truck_details?.truck_number || '—'}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 block mt-0.5">
                        {pass.truck?.transport_company || pass.truck?.transport_company_name || (pass as any).truck_details?.transport_company || 'Independent'}
                      </span>
                    </td>

                    {/* Driver */}
                    <td className="p-3.5 max-w-xs">
                      <div className="font-bold text-slate-900 dark:text-white truncate">
                        {pass.driver_details?.driver_name || '—'}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">
                        {pass.driver_details?.driver_email || '—'}
                      </div>
                    </td>

                    {/* Containers */}
                    <td className="p-3.5">
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
                        {pass.container_count} unit{pass.container_count !== 1 ? 's' : ''}
                      </span>
                    </td>

                    {/* Gate */}
                    <td className="p-3.5 whitespace-nowrap">
                      <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                        {pass.gate_details?.gate_name || '—'}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400 block">
                        {pass.gate_details?.gate_code}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="p-3.5 whitespace-nowrap">
                      {getStatusBadge(pass.gate_pass_status)}
                    </td>

                    {/* Timeline */}
                    <td className="p-3.5 whitespace-nowrap text-[10px] font-mono">
                      <div>
                        <span className="text-slate-400">Issued: </span>
                        <span>{formatDate(pass.gate_pass_issued_at)}</span>
                      </div>
                      <div>
                        <span className="text-slate-400">Valid: </span>
                        <span>{formatDate(pass.gate_pass_valid_until)}</span>
                      </div>
                      {pass.gate_pass_used_at && (
                        <div className="text-teal-600 font-bold">
                          <span>Used: </span>
                          <span>{formatDate(pass.gate_pass_used_at)}</span>
                        </div>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="p-3.5 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedPass(pass);
                        }}
                        className="p-1.5 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-600 dark:text-sky-400 transition-colors cursor-pointer"
                        title="View Full Digital Gate Pass Audit"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pass Detail Modal */}
      {selectedPass && (
        <DigitalGatePassModal
          isOpen={!!selectedPass}
          onClose={() => setSelectedPass(null)}
          gatePass={selectedPass}
        />
      )}
    </div>
  );
};
