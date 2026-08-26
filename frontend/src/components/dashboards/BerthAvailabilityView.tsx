import React, { useState } from 'react';
import { BackendBerth } from '../../types';
import { useApp } from '../../context/AppContext';
import { Modal } from '../common/Modal';
import { 
  Anchor, 
  Search, 
  RefreshCw, 
  SlidersHorizontal, 
  Grid, 
  List, 
  Ship, 
  Clock, 
  Wrench, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight,
  Maximize2,
  Layers,
  Ruler,
  Boxes,
  Calendar,
  Building2
} from 'lucide-react';

interface BerthAvailabilityViewProps {
  berths: BackendBerth[];
  loading: boolean;
  onRefresh: () => void;
}

export const BerthAvailabilityView: React.FC<BerthAvailabilityViewProps> = ({
  berths,
  loading,
  onRefresh
}) => {
  const { currentUser, addToast } = useApp();

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Maintenance Toggle Modal state
  const [maintenanceModalBerth, setMaintenanceModalBerth] = useState<BackendBerth | null>(null);
  const [targetMaintenanceStatus, setTargetMaintenanceStatus] = useState<'MAINTENANCE' | 'AVAILABLE'>('MAINTENANCE');
  const [maintenanceLoading, setMaintenanceLoading] = useState<boolean>(false);

  // Detail Modal state
  const [selectedBerthDetail, setSelectedBerthDetail] = useState<BackendBerth | null>(null);

  // Statistics
  const totalBerths = berths.length;
  const availableCount = berths.filter(b => b.berth_status === 'AVAILABLE').length;
  const reservedCount = berths.filter(b => b.berth_status === 'RESERVED').length;
  const occupiedCount = berths.filter(b => b.berth_status === 'OCCUPIED').length;
  const maintenanceCount = berths.filter(b => b.berth_status === 'MAINTENANCE').length;

  const filteredBerths = berths.filter(b => {
    const q = searchQuery.toLowerCase().trim();
    const matchesQuery = !q ||
      b.berth_name.toLowerCase().includes(q) ||
      (b.berth_code && b.berth_code.toLowerCase().includes(q)) ||
      (b.current_vessel?.vessel_name && b.current_vessel.vessel_name.toLowerCase().includes(q)) ||
      (b.current_vessel?.company_name && b.current_vessel.company_name.toLowerCase().includes(q));

    const matchesStatus = statusFilter === 'all' || b.berth_status === statusFilter;
    const matchesType = typeFilter === 'all' || b.berth_type === typeFilter;

    return matchesQuery && matchesStatus && matchesType;
  });

  const getStatusBadge = (status: BackendBerth['berth_status']) => {
    switch (status) {
      case 'AVAILABLE':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            AVAILABLE
          </span>
        );
      case 'RESERVED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            RESERVED
          </span>
        );
      case 'OCCUPIED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            OCCUPIED
          </span>
        );
      case 'MAINTENANCE':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
            <Wrench className="w-3 h-3 text-purple-500" />
            MAINTENANCE
          </span>
        );
      default:
        return null;
    }
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  const handleToggleMaintenance = async () => {
    if (!maintenanceModalBerth) return;
    setMaintenanceLoading(true);
    try {
      const response = await fetch(`http://127.0.0.1:8000/api/berths/${maintenanceModalBerth.berth_id}/status/`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Email': currentUser?.email || '',
          'X-User-Role': 'port_operations_officer',
          'X-User-Id': currentUser?.id || ''
        },
        body: JSON.stringify({
          status: targetMaintenanceStatus
        })
      });

      const resJson = await response.json();
      setMaintenanceLoading(false);

      if (response.ok && resJson.status === 'success') {
        addToast(
          'success', 
          'Berth Status Updated', 
          `${maintenanceModalBerth.berth_name} status updated to ${targetMaintenanceStatus}.`
        );
        setMaintenanceModalBerth(null);
        onRefresh();
      } else {
        addToast('error', 'Update Failed', resJson.message || 'Failed to update berth status.');
      }
    } catch (err) {
      setMaintenanceLoading(false);
      addToast('error', 'Network Error', 'Unable to connect to backend server.');
    }
  };

  const openMaintenanceModal = (berth: BackendBerth, target: 'MAINTENANCE' | 'AVAILABLE') => {
    setMaintenanceModalBerth(berth);
    setTargetMaintenanceStatus(target);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-r from-sky-900 via-indigo-900 to-slate-900 text-white shadow-lg relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-64 h-64 rounded-full bg-sky-500/10 blur-3xl pointer-events-none" />
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-bold text-sky-400 uppercase tracking-wider">
              <Anchor className="w-4 h-4 text-sky-400" />
              <span>PORT OPERATIONS MONITORING</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight">Berth Availability Management</h1>
            <p className="text-xs sm:text-sm text-slate-300">
              Live operational condition, specifications, and vessel occupancy status for all port berths.
            </p>
          </div>
          <button
            onClick={onRefresh}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold backdrop-blur-md transition-all cursor-pointer border border-white/15 shrink-0"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Live Data</span>
          </button>
        </div>
      </div>

      {/* KPI Overview Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Berths</span>
            <Anchor className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">{totalBerths}</div>
          <div className="text-[11px] font-medium text-slate-500">Configured Facilities</div>
        </div>

        <div className="p-4 rounded-2xl bg-emerald-500/5 dark:bg-emerald-950/20 border border-emerald-500/20 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Available</span>
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{availableCount}</div>
          <div className="text-[11px] font-medium text-emerald-600/70 dark:text-emerald-400/70">Ready for Assignment</div>
        </div>

        <div className="p-4 rounded-2xl bg-amber-500/5 dark:bg-amber-950/20 border border-amber-500/20 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-amber-600 dark:text-amber-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Reserved</span>
            <Clock className="w-4 h-4" />
          </div>
          <div className="text-2xl font-black text-amber-600 dark:text-amber-400">{reservedCount}</div>
          <div className="text-[11px] font-medium text-amber-600/70 dark:text-amber-400/70">Scheduled Vessel</div>
        </div>

        <div className="p-4 rounded-2xl bg-rose-500/5 dark:bg-rose-950/20 border border-rose-500/20 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-rose-600 dark:text-rose-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Occupied</span>
            <Ship className="w-4 h-4" />
          </div>
          <div className="text-2xl font-black text-rose-600 dark:text-rose-400">{occupiedCount}</div>
          <div className="text-[11px] font-medium text-rose-600/70 dark:text-rose-400/70">Vessel At Berth</div>
        </div>

        <div className="p-4 rounded-2xl bg-purple-500/5 dark:bg-purple-950/20 border border-purple-500/20 shadow-xs space-y-1 col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-purple-600 dark:text-purple-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Maintenance</span>
            <Wrench className="w-4 h-4" />
          </div>
          <div className="text-2xl font-black text-purple-600 dark:text-purple-400">{maintenanceCount}</div>
          <div className="text-[11px] font-medium text-purple-600/70 dark:text-purple-400/70">Out of Service</div>
        </div>
      </div>

      {/* Filter & Controls Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by berth name, code, or vessel name..."
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>

        {/* Filters & View Toggle */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            <option value="all">All Operational Statuses</option>
            <option value="AVAILABLE">AVAILABLE</option>
            <option value="RESERVED">RESERVED</option>
            <option value="OCCUPIED">OCCUPIED</option>
            <option value="MAINTENANCE">MAINTENANCE</option>
          </select>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            <option value="all">All Berth Types</option>
            <option value="CONTAINER_TERMINAL">Container Terminal</option>
            <option value="BULK_CARGO">Bulk Cargo</option>
            <option value="OIL_TANKER">Oil & Liquid Tanker</option>
            <option value="GENERAL_CARGO">General Cargo</option>
            <option value="RO_RO">Ro-Ro Berth</option>
            <option value="MULTI_PURPOSE">Multi-Purpose</option>
          </select>

          {/* View Toggle Buttons */}
          <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                viewMode === 'grid' 
                  ? 'bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-400 font-bold shadow-xs' 
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
              title="Grid View"
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                viewMode === 'table' 
                  ? 'bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-400 font-bold shadow-xs' 
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
              title="Table View"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Grid / Table */}
      {loading ? (
        <div className="py-16 text-center space-y-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800">
          <RefreshCw className="w-8 h-8 text-sky-500 animate-spin mx-auto" />
          <p className="text-xs font-semibold text-slate-500">Loading berth operational status from database...</p>
        </div>
      ) : filteredBerths.length === 0 ? (
        <div className="py-16 text-center space-y-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800">
          <Anchor className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
          <div className="text-sm font-bold text-slate-800 dark:text-slate-200">No berths match filter criteria</div>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">Try resetting search filters or selecting another operational status.</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredBerths.map((berth) => {
            const v = berth.current_vessel;
            const sch = berth.current_schedule;

            return (
              <div
                key={berth.berth_id}
                className={`rounded-2xl border transition-all duration-200 shadow-xs flex flex-col justify-between overflow-hidden bg-white dark:bg-slate-900 ${
                  berth.berth_status === 'OCCUPIED'
                    ? 'border-rose-500/40 hover:border-rose-500/60'
                    : berth.berth_status === 'RESERVED'
                    ? 'border-amber-500/40 hover:border-amber-500/60'
                    : berth.berth_status === 'MAINTENANCE'
                    ? 'border-purple-500/40 hover:border-purple-500/60'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                {/* Card Header */}
                <div className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                        <span>{berth.berth_name}</span>
                        {berth.berth_code && (
                          <span className="text-[11px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                            {berth.berth_code}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] font-semibold text-slate-500 flex items-center gap-1 mt-0.5">
                        <Building2 className="w-3 h-3 text-slate-400" />
                        <span>{berth.berth_type_display || berth.berth_type || 'General Cargo Berth'}</span>
                      </div>
                    </div>
                    {getStatusBadge(berth.berth_status)}
                  </div>

                  {/* Operational Metrics Pill */}
                  <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-center border border-slate-100 dark:border-slate-800">
                    <div>
                      <div className="text-[10px] font-semibold text-slate-400 uppercase">Max Length</div>
                      <div className="text-xs font-black text-slate-800 dark:text-slate-200">
                        {berth.berth_max_length ? `${berth.berth_max_length} m` : '300.00 m'}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] font-semibold text-slate-400 uppercase">Max Draft</div>
                      <div className="text-xs font-black text-slate-800 dark:text-slate-200">{berth.berth_max_draft} m</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-semibold text-slate-400 uppercase">Capacity</div>
                      <div className="text-xs font-black text-slate-800 dark:text-slate-200">{berth.berth_capacity_teu} TEU</div>
                    </div>
                  </div>

                  {/* Vessel Information Block */}
                  {v ? (
                    <div className="p-3 rounded-xl bg-sky-500/5 dark:bg-sky-950/20 border border-sky-500/15 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5 truncate">
                          <Ship className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                          <span className="truncate">{v.vessel_name}</span>
                        </div>
                        <span className="text-[10px] font-bold text-sky-600 dark:text-sky-400 bg-sky-500/10 px-1.5 py-0.5 rounded">
                          IMO: {v.vessel_imo_number}
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-600 dark:text-slate-300 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Shipping Line:</span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[140px]">{v.company_name || '—'}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Cargo:</span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">{v.cargo_type} ({v.cargo_quantity} TEU/Tons)</span>
                        </div>
                      </div>

                      {sch && (
                        <div className="pt-2 border-t border-sky-500/15 text-[10px] text-slate-500 dark:text-slate-400 space-y-1">
                          <div className="flex items-center justify-between">
                            <span>Scheduled Arrival:</span>
                            <span className="font-medium text-slate-700 dark:text-slate-300">{formatDate(sch.scheduled_arrival_at)}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>Scheduled Departure:</span>
                            <span className="font-medium text-slate-700 dark:text-slate-300">{formatDate(sch.scheduled_departure_at)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/60 text-center text-xs text-slate-400 font-medium">
                      {berth.berth_status === 'MAINTENANCE' ? (
                        <span className="flex items-center justify-center gap-1.5 text-purple-600 dark:text-purple-400 font-semibold">
                          <Wrench className="w-3.5 h-3.5" />
                          Under Operational Maintenance
                        </span>
                      ) : (
                        <span>No active vessel assigned to this berth</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Card Footer Actions */}
                <div className="p-3 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-2">
                  <button
                    onClick={() => setSelectedBerthDetail(berth)}
                    className="flex-1 py-1.5 px-3 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-700 transition-colors text-center cursor-pointer"
                  >
                    View Details
                  </button>

                  {berth.berth_status === 'MAINTENANCE' ? (
                    <button
                      onClick={() => openMaintenanceModal(berth, 'AVAILABLE')}
                      className="py-1.5 px-3 rounded-lg text-xs font-bold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 transition-colors cursor-pointer"
                    >
                      Restore Available
                    </button>
                  ) : berth.berth_status !== 'OCCUPIED' ? (
                    <button
                      onClick={() => openMaintenanceModal(berth, 'MAINTENANCE')}
                      className="py-1.5 px-3 rounded-lg text-xs font-bold bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 dark:text-purple-400 transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <Wrench className="w-3 h-3" />
                      Mark Maintenance
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Data Table View */
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto shadow-xs">
          <table className="w-full text-left text-xs min-w-[800px]">
            <thead>
              <tr className="border-b border-slate-200/80 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-slate-400 uppercase tracking-wider font-bold">
                <th className="py-3.5 px-4">Berth Info</th>
                <th className="py-3.5 px-4">Type</th>
                <th className="py-3.5 px-4">Max Length</th>
                <th className="py-3.5 px-4">Max Draft</th>
                <th className="py-3.5 px-4">Capacity</th>
                <th className="py-3.5 px-4">Current Status</th>
                <th className="py-3.5 px-4">Assigned Vessel</th>
                <th className="py-3.5 px-4">Scheduled Arrival</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {filteredBerths.map((b) => (
                <tr key={b.berth_id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="py-3 px-4">
                    <div className="font-black text-slate-900 dark:text-white text-xs">{b.berth_name}</div>
                    <div className="text-[10px] text-slate-400">{b.berth_code || '—'}</div>
                  </td>
                  <td className="py-3 px-4 font-semibold">{b.berth_type_display || b.berth_type || 'General Cargo'}</td>
                  <td className="py-3 px-4 font-semibold">{b.berth_max_length ? `${b.berth_max_length} m` : '300.00 m'}</td>
                  <td className="py-3 px-4 font-semibold">{b.berth_max_draft} m</td>
                  <td className="py-3 px-4 font-semibold">{b.berth_capacity_teu} TEU</td>
                  <td className="py-3 px-4">{getStatusBadge(b.berth_status)}</td>
                  <td className="py-3 px-4">
                    {b.current_vessel ? (
                      <div>
                        <div className="font-bold text-sky-600 dark:text-sky-400">{b.current_vessel.vessel_name}</div>
                        <div className="text-[10px] text-slate-400">IMO: {b.current_vessel.vessel_imo_number}</div>
                      </div>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-slate-500 font-medium">
                    {b.current_schedule ? formatDate(b.current_schedule.scheduled_arrival_at) : '—'}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setSelectedBerthDetail(b)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-sky-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        title="View Details"
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                      </button>
                      {b.berth_status === 'MAINTENANCE' ? (
                        <button
                          onClick={() => openMaintenanceModal(b, 'AVAILABLE')}
                          className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[11px] font-bold hover:bg-emerald-500/20 cursor-pointer"
                        >
                          Available
                        </button>
                      ) : b.berth_status !== 'OCCUPIED' ? (
                        <button
                          onClick={() => openMaintenanceModal(b, 'MAINTENANCE')}
                          className="px-2.5 py-1 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 text-[11px] font-bold hover:bg-purple-500/20 cursor-pointer"
                        >
                          Maintenance
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Maintenance Toggle Confirmation Modal */}
      {maintenanceModalBerth && (
        <Modal
          isOpen={true}
          onClose={() => setMaintenanceModalBerth(null)}
          title={`Update Berth Operational Status`}
        >
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-700 dark:text-purple-300 text-xs space-y-1">
              <div className="font-bold flex items-center gap-2">
                <Wrench className="w-4 h-4 text-purple-500" />
                <span>Operational Status Change</span>
              </div>
              <p>
                You are changing <strong>{maintenanceModalBerth.berth_name}</strong> status to{' '}
                <strong className="uppercase">{targetMaintenanceStatus}</strong>.
              </p>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400">
              {targetMaintenanceStatus === 'MAINTENANCE'
                ? 'Marking a berth under maintenance will prevent new vessel arrival requests from being assigned to this berth until maintenance is completed.'
                : 'Restoring a berth to AVAILABLE will allow Port Operations Officers to schedule approved vessels for this berth.'}
            </p>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setMaintenanceModalBerth(null)}
                disabled={maintenanceLoading}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleToggleMaintenance}
                disabled={maintenanceLoading}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white shadow-xs flex items-center gap-2 cursor-pointer"
              >
                {maintenanceLoading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Updating Status...</span>
                  </>
                ) : (
                  <span>Confirm Status Update</span>
                )}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Berth Details Modal */}
      {selectedBerthDetail && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedBerthDetail(null)}
          title={`Berth Specification - ${selectedBerthDetail.berth_name}`}
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60">
              <div>
                <div className="text-xs font-black text-slate-900 dark:text-white">{selectedBerthDetail.berth_name}</div>
                <div className="text-[11px] text-slate-400">Code: {selectedBerthDetail.berth_code || 'N/A'}</div>
              </div>
              {getStatusBadge(selectedBerthDetail.berth_status)}
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 space-y-1">
                <div className="text-slate-400 font-semibold">Berth Type</div>
                <div className="font-bold text-slate-900 dark:text-white">
                  {selectedBerthDetail.berth_type_display || selectedBerthDetail.berth_type || 'General Cargo'}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 space-y-1">
                <div className="text-slate-400 font-semibold">Capacity TEU</div>
                <div className="font-bold text-slate-900 dark:text-white">{selectedBerthDetail.berth_capacity_teu} TEU</div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 space-y-1">
                <div className="text-slate-400 font-semibold">Maximum Vessel Length</div>
                <div className="font-bold text-slate-900 dark:text-white">
                  {selectedBerthDetail.berth_max_length ? `${selectedBerthDetail.berth_max_length} m` : '300.00 m'}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 space-y-1">
                <div className="text-slate-400 font-semibold">Maximum Allowed Draft</div>
                <div className="font-bold text-slate-900 dark:text-white">{selectedBerthDetail.berth_max_draft} m</div>
              </div>
            </div>

            {selectedBerthDetail.current_vessel ? (
              <div className="p-4 rounded-xl bg-sky-500/10 border border-sky-500/20 space-y-2">
                <div className="text-xs font-bold text-sky-700 dark:text-sky-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Ship className="w-4 h-4 text-sky-500" />
                  <span>Assigned Vessel Details</span>
                </div>
                <div className="text-sm font-black text-slate-900 dark:text-white">
                  {selectedBerthDetail.current_vessel.vessel_name} (IMO: {selectedBerthDetail.current_vessel.vessel_imo_number})
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1">
                  <div>Company: <strong>{selectedBerthDetail.current_vessel.company_name}</strong></div>
                  <div>Cargo: <strong>{selectedBerthDetail.current_vessel.cargo_type}</strong> ({selectedBerthDetail.current_vessel.cargo_quantity} TEU)</div>
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-center text-xs text-slate-500">
                No vessel currently assigned or occupying this berth.
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedBerthDetail(null)}
                className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold cursor-pointer"
              >
                Close Specification
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
