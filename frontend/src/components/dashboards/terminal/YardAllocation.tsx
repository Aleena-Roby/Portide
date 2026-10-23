import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Boxes,
  Warehouse,
  MapPin,
  Search,
  Filter,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Clock,
  CheckCircle2,
  XCircle,
  ArrowRight,
  ShieldCheck,
  Ship,
  ChevronRight,
  ChevronDown,
  Info,
  Building2,
  Calendar,
  User,
  Unlock,
  Archive,
  ArrowUpDown,
  Hash
} from 'lucide-react';
import { apiFetch } from '../../../services/api';
import { useApp } from '../../../context/AppContext';
import { Modal } from '../../common/Modal';
import {
  PendingContainerItem,
  AvailableSlotItem,
  YardAllocationItem,
  YardItem,
  YardBlockItem,
  CreateYardAllocationPayload,
  ReleaseYardAllocationPayload
} from '../../../types';

export const YardAllocation: React.FC = () => {
  const { addToast } = useApp();

  // Navigation Sub-tab: 'pending' (simple code allocation) | 'history' (active & history)
  const [activeSubTab, setActiveSubTab] = useState<'pending' | 'history'>('pending');

  // Master Data State
  const [pendingContainers, setPendingContainers] = useState<PendingContainerItem[]>([]);
  const [allocations, setAllocations] = useState<YardAllocationItem[]>([]);
  const [availableSlots, setAvailableSlots] = useState<AvailableSlotItem[]>([]);
  const [yards, setYards] = useState<YardItem[]>([]);
  const [loadingPending, setLoadingPending] = useState<boolean>(true);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(true);
  const [loadingSlots, setLoadingSlots] = useState<boolean>(true);
  const [loadingYards, setLoadingYards] = useState<boolean>(false);

  // Per-row chosen simple position code: { [container_id]: string }
  const [rowSelectedCodes, setRowSelectedCodes] = useState<Record<number, string>>({});

  // Filters for Pending Containers
  const [pendingSearch, setPendingSearch] = useState<string>('');
  const [pendingStatusFilter, setPendingStatusFilter] = useState<string>('ALL');

  // Filters for History / Active Allocations
  const [historySearch, setHistorySearch] = useState<string>('');
  const [historyStatusFilter, setHistoryStatusFilter] = useState<string>('ALL');

  // Inline allocating state: { [container_id]: boolean }
  const [allocatingContainerIds, setAllocatingContainerIds] = useState<Record<number, boolean>>({});

  // Release Modal State
  const [isReleaseModalOpen, setIsReleaseModalOpen] = useState<boolean>(false);
  const [allocationToRelease, setAllocationToRelease] = useState<YardAllocationItem | null>(null);
  const [releaseRemarks, setReleaseRemarks] = useState<string>('');
  const [submittingRelease, setSubmittingRelease] = useState<boolean>(false);

  // Optional Remarks Modal State (for advanced notes)
  const [isRemarksModalOpen, setIsRemarksModalOpen] = useState<boolean>(false);
  const [remarksContainer, setRemarksContainer] = useState<PendingContainerItem | null>(null);
  const [remarksCode, setRemarksCode] = useState<string>('');
  const [customRemarks, setCustomRemarks] = useState<string>('');

  // =========================================================================
  // DATA FETCHING & RESPONSE PARSING
  // =========================================================================

  const parseApiResponse = async (res: Response) => {
    let data: any = null;
    try {
      data = await res.json();
    } catch {
      throw new Error(`Server returned HTTP ${res.status} with unparseable response.`);
    }

    if (!res.ok || data?.status === 'error') {
      const errMsg = data?.message || data?.detail || `HTTP error ${res.status}`;
      throw new Error(errMsg);
    }

    return data;
  };

  const fetchAvailableSlots = useCallback(async () => {
    setLoadingSlots(true);
    try {
      const res = await apiFetch('/api/terminal/yard-allocations/available-slots/');
      const data = await parseApiResponse(res);
      if (data && data.status === 'success' && Array.isArray(data.data)) {
        setAvailableSlots(data.data);
      } else {
        setAvailableSlots([]);
      }
    } catch (err: any) {
      console.error('Failed to load available slots:', err);
      setAvailableSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  }, []);

  const fetchPendingContainers = useCallback(async () => {
    setLoadingPending(true);
    try {
      let url = '/api/terminal/yard-allocations/pending/';
      const params = new URLSearchParams();
      if (pendingSearch.trim()) params.append('search', pendingSearch.trim());
      if (pendingStatusFilter !== 'ALL') params.append('status', pendingStatusFilter);
      if (params.toString()) url += `?${params.toString()}`;

      const res = await apiFetch(url);
      const data = await parseApiResponse(res);
      if (data && data.status === 'success' && Array.isArray(data.data)) {
        setPendingContainers(data.data);
      } else {
        setPendingContainers([]);
      }
    } catch (err: any) {
      console.error('Failed to load pending containers:', err);
      addToast(
        'error',
        'Load Error',
        err.message || 'Unable to fetch pending container records.'
      );
      setPendingContainers([]);
    } finally {
      setLoadingPending(false);
    }
  }, [pendingSearch, pendingStatusFilter, addToast]);

  const fetchAllocations = useCallback(async () => {
    setLoadingHistory(true);
    try {
      let url = '/api/terminal/yard-allocations/';
      const params = new URLSearchParams();
      if (historySearch.trim()) params.append('search', historySearch.trim());
      if (historyStatusFilter !== 'ALL') params.append('status', historyStatusFilter);
      if (params.toString()) url += `?${params.toString()}`;

      const res = await apiFetch(url);
      const data = await parseApiResponse(res);
      if (data && data.status === 'success' && Array.isArray(data.data)) {
        setAllocations(data.data);
      } else {
        setAllocations([]);
      }
    } catch (err: any) {
      console.error('Failed to load yard allocations history:', err);
      setAllocations([]);
    } finally {
      setLoadingHistory(false);
    }
  }, [historySearch, historyStatusFilter]);

  const fetchYards = useCallback(async () => {
    setLoadingYards(true);
    try {
      const res = await apiFetch('/api/terminal/yards/?status=ACTIVE');
      const data = await parseApiResponse(res);
      if (data && data.status === 'success' && Array.isArray(data.data)) {
        setYards(data.data);
      }
    } catch (err: any) {
      console.error('Failed to load yards:', err);
    } finally {
      setLoadingYards(false);
    }
  }, []);

  const refreshAll = useCallback(() => {
    fetchPendingContainers();
    fetchAllocations();
    fetchAvailableSlots();
    fetchYards();
  }, [fetchPendingContainers, fetchAllocations, fetchAvailableSlots, fetchYards]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  // Pre-populate row selection with the first available simple code if not already set
  useEffect(() => {
    if (availableSlots.length > 0 && pendingContainers.length > 0) {
      setRowSelectedCodes(prev => {
        const next = { ...prev };
        const defaultCode = availableSlots[0].simple_code || `Y${String(availableSlots[0].slot_id).padStart(3, '0')}`;
        pendingContainers.forEach((c, idx) => {
          if (!next[c.container_id]) {
            // Assign available slots sequentially by default for operator convenience
            const slotItem = availableSlots[idx % availableSlots.length];
            next[c.container_id] = slotItem.simple_code || `Y${String(slotItem.slot_id).padStart(3, '0')}`;
          }
        });
        return next;
      });
    }
  }, [availableSlots, pendingContainers]);

  // =========================================================================
  // SIMPLIFIED ALLOCATION ACTION
  // =========================================================================

  const handleAllocatePosition = async (container: PendingContainerItem, explicitRemarks?: string) => {
    const chosenCode = rowSelectedCodes[container.container_id] || (availableSlots[0]?.simple_code ?? '');
    if (!chosenCode) {
      addToast(
        'warning',
        'Position Code Required',
        'Please select a valid simple yard position code (e.g., Y001, Y002).'
      );
      return;
    }

    setAllocatingContainerIds(prev => ({ ...prev, [container.container_id]: true }));
    try {
      const payload: CreateYardAllocationPayload = {
        container_id: container.container_id,
        simple_code: chosenCode,
        remarks: explicitRemarks ? explicitRemarks.trim() : `Allocated to position ${chosenCode}.`
      };

      const res = await apiFetch('/api/terminal/yard-allocations/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await parseApiResponse(res);

      if (data && (data.status === 'success' || res.status === 201)) {
        addToast(
          'success',
          'Position Allocated',
          `Container ${container.container_number} successfully allocated to position ${chosenCode} (${data.data?.yard_slot_code || 'Yard Slot'}).`
        );
        if (isRemarksModalOpen) {
          setIsRemarksModalOpen(false);
          setRemarksContainer(null);
          setCustomRemarks('');
        }
        refreshAll();
      } else {
        throw new Error(data?.message || 'Failed to allocate position.');
      }
    } catch (err: any) {
      console.error('Allocation error:', err);
      addToast(
        'error',
        'Allocation Failed',
        err.message || 'Failed to complete container allocation. Please re-check position code.'
      );
    } finally {
      setAllocatingContainerIds(prev => ({ ...prev, [container.container_id]: false }));
    }
  };

  // =========================================================================
  // RELEASE MODAL WORKFLOW
  // =========================================================================

  const handleOpenReleaseModal = (alloc: YardAllocationItem) => {
    setAllocationToRelease(alloc);
    setReleaseRemarks('');
    setIsReleaseModalOpen(true);
  };

  const handleConfirmRelease = async () => {
    if (!allocationToRelease) return;

    setSubmittingRelease(true);
    try {
      const payload: ReleaseYardAllocationPayload = {
        remarks: releaseRemarks.trim()
      };

      const res = await apiFetch(`/api/terminal/yard-allocations/${allocationToRelease.yard_allocation_id}/release/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await parseApiResponse(res);

      if (data && data.status === 'success') {
        const releasedCode = allocationToRelease.simple_code || allocationToRelease.slot_code || allocationToRelease.yard_slot_code;
        addToast(
          'success',
          'Position Released',
          `Container ${allocationToRelease.container_number} released from position ${releasedCode}. Position is now AVAILABLE.`
        );
        setIsReleaseModalOpen(false);
        setAllocationToRelease(null);
        setReleaseRemarks('');
        refreshAll();
      } else {
        throw new Error(data?.message || 'Release failed.');
      }
    } catch (err: any) {
      console.error('Release error:', err);
      addToast('error', 'Release Failed', err.message || 'Failed to release position.');
    } finally {
      setSubmittingRelease(false);
    }
  };

  // =========================================================================
  // COMPUTED STATS
  // =========================================================================

  const stats = useMemo(() => {
    const activeAllocCount = allocations.filter(a => a.yard_allocation_status === 'ACTIVE').length;
    const totalCap = yards.reduce((acc, y) => acc + (y.yard_capacity || 0), 0);
    const totalOcc = yards.reduce((acc, y) => acc + (y.yard_occupied || 0), 0);
    const overallRate = totalCap > 0 ? ((totalOcc / totalCap) * 100).toFixed(1) : '0.0';

    return {
      pendingCount: pendingContainers.length,
      availablePositionsCount: availableSlots.length,
      activeAllocations: activeAllocCount,
      occupancyPercentage: overallRate
    };
  }, [pendingContainers, availableSlots, allocations, yards]);

  // Find slot item details by simple code
  const getSlotDetails = (code: string): AvailableSlotItem | undefined => {
    return availableSlots.find(
      s => s.simple_code === code || s.yard_slot_code === code || `Y${String(s.slot_id).padStart(3, '0')}` === code
    );
  };

  return (
    <div className="space-y-6">
      {/* ===================================================================== */}
      {/* 1. COMPACT EXECUTIVE HEADER */}
      {/* ===================================================================== */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-6 rounded-3xl text-white shadow-lg border border-slate-700/50">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-[#D49A24]/20 text-[#E0A838] border border-[#D49A24]/30 mb-2">
            <Hash className="w-3.5 h-3.5" />
            <span>Code-Based Yard Management</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-3">
            <span>Yard Position Allocation</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Assign successfully discharged containers directly to available yard positions using simple codes (e.g., Y001, Y002, Y003).
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <button
            id="refresh-yard-allocation-btn"
            onClick={refreshAll}
            className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-200 bg-slate-800 hover:bg-slate-700 transition-colors inline-flex items-center gap-2 border border-slate-700 cursor-pointer shadow-xs"
            title="Refresh All Records"
          >
            <RefreshCw className={`w-4 h-4 ${loadingPending || loadingSlots || loadingHistory ? 'animate-spin text-[#D49A24]' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 2. STATS OVERVIEW CARDS */}
      {/* ===================================================================== */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Pending Containers */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            <span>Awaiting Allocation</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-amber-600 dark:text-amber-400 font-mono">
            {stats.pendingCount}
          </div>
          <span className="text-[11px] text-slate-400 block">Discharged containers ready for placement</span>
        </div>

        {/* Available Positions */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            <span>Available Positions</span>
            <MapPin className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
            {stats.availablePositionsCount}
          </div>
          <span className="text-[11px] text-slate-400 block">Real operational yard positions free</span>
        </div>

        {/* Active Stored Containers */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            <span>Active Yard Storage</span>
            <Boxes className="w-4 h-4 text-sky-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-sky-600 dark:text-sky-400 font-mono">
            {stats.activeAllocations}
          </div>
          <span className="text-[11px] text-slate-400 block">Containers currently parked in positions</span>
        </div>

        {/* Yard Occupancy */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            <span>Terminal Occupancy</span>
            <Warehouse className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-purple-600 dark:text-purple-400 font-mono">
            {stats.occupancyPercentage}%
          </div>
          <span className="text-[11px] text-slate-400 block">Overall yard capacity utilization</span>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 3. REAL AVAILABLE SIMPLE CODES QUICK STRIP */}
      {/* ===================================================================== */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Warehouse className="w-4 h-4 text-[#D49A24]" />
            <span className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
              Operational Yard Positions Directory
            </span>
          </div>
          <span className="text-[11px] font-bold text-slate-400">
            {availableSlots.length} available code{availableSlots.length === 1 ? '' : 's'}
          </span>
        </div>

        {loadingSlots ? (
          <div className="py-3 text-xs text-slate-400 flex items-center gap-2">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#D49A24]" />
            <span>Loading real position codes...</span>
          </div>
        ) : availableSlots.length === 0 ? (
          <div className="py-3 px-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-xs text-amber-700 dark:text-amber-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
            <span>All yard slots are currently occupied or unavailable. Release active slots to free positions.</span>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2 pt-1">
            {availableSlots.map((slot) => {
              const code = slot.simple_code || `Y${String(slot.slot_id).padStart(3, '0')}`;
              return (
                <div
                  key={slot.slot_id}
                  id={`slot-badge-${code}`}
                  className="px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-xs font-mono font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-2 shadow-2xs"
                  title={`${slot.location_display} (Row ${slot.slot_row}, Bay ${slot.slot_bay}, Tier ${slot.slot_tier})`}
                >
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="font-black text-emerald-900 dark:text-emerald-200">{code}</span>
                  <span className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 font-sans font-medium">
                    {slot.block_code}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ===================================================================== */}
      {/* 4. SUB-TABS NAVIGATION */}
      {/* ===================================================================== */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800">
        <button
          id="tab-pending-allocations"
          onClick={() => setActiveSubTab('pending')}
          className={`pb-3 px-3 text-sm font-black transition-all cursor-pointer relative flex items-center gap-2 ${
            activeSubTab === 'pending'
              ? 'text-[#D49A24] border-b-2 border-[#D49A24]'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Pending Yard Allocation</span>
          <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold">
            {pendingContainers.length}
          </span>
        </button>

        <button
          id="tab-active-allocations"
          onClick={() => setActiveSubTab('history')}
          className={`pb-3 px-3 text-sm font-black transition-all cursor-pointer relative flex items-center gap-2 ${
            activeSubTab === 'history'
              ? 'text-[#D49A24] border-b-2 border-[#D49A24]'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Boxes className="w-4 h-4" />
          <span>Active Allocations</span>
          <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold">
            {allocations.length}
          </span>
        </button>
      </div>

      {/* ===================================================================== */}
      {/* 5. TAB 1: PENDING YARD ALLOCATION (SIMPLIFIED 5-ITEM TABLE) */}
      {/* ===================================================================== */}
      {activeSubTab === 'pending' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-xs">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                id="search-pending-containers"
                type="text"
                value={pendingSearch}
                onChange={(e) => setPendingSearch(e.target.value)}
                placeholder="Search container number or vessel..."
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-[#D49A24]"
              />
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                <Filter className="w-3.5 h-3.5" />
                <span className="font-bold">Status:</span>
              </div>
              <select
                id="filter-pending-status"
                value={pendingStatusFilter}
                onChange={(e) => setPendingStatusFilter(e.target.value)}
                className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:border-[#D49A24]"
              >
                <option value="ALL">All Eligible Statuses</option>
                <option value="AT_TERMINAL">At Terminal</option>
                <option value="ARRIVED">Arrived</option>
                <option value="REGISTERED">Registered</option>
                <option value="CLEARED">Cleared</option>
              </select>
            </div>
          </div>

          {/* SIMPLIFIED ALLOCATION TABLE */}
          <div className="overflow-x-auto rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
            <table id="yard-allocation-screen-table" className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-black uppercase tracking-wider text-[10px]">
                  <th className="p-4 w-1/4">Container Number</th>
                  <th className="p-4 w-1/4">Vessel</th>
                  <th className="p-4 w-1/6">Allocation Status</th>
                  <th className="p-4 w-1/4">Simple Yard Position Code</th>
                  <th className="p-4 w-1/6 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium text-slate-700 dark:text-slate-300">
                {loadingPending ? (
                  <tr>
                    <td colSpan={5} className="p-10 text-center text-slate-400">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#D49A24]" />
                      <span>Loading pending discharged containers...</span>
                    </td>
                  </tr>
                ) : pendingContainers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-12 text-center text-slate-400">
                      <Boxes className="w-10 h-10 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                      <p className="font-bold text-slate-600 dark:text-slate-300 text-sm">No Pending Containers Awaiting Allocation</p>
                      <p className="text-xs text-slate-400 mt-1">All eligible unloaded containers currently have physical yard positions assigned.</p>
                    </td>
                  </tr>
                ) : (
                  pendingContainers.map((container) => {
                    const currentCode = rowSelectedCodes[container.container_id] || (availableSlots[0]?.simple_code ?? '');
                    const currentSlot = getSlotDetails(currentCode);
                    const isAllocating = Boolean(allocatingContainerIds[container.container_id]);

                    return (
                      <tr
                        key={container.container_id}
                        id={`allocation-row-${container.container_id}`}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        {/* 1. Container Number */}
                        <td className="p-4">
                          <div className="font-mono font-black text-sm text-slate-900 dark:text-white">
                            {container.container_number}
                          </div>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold ${
                              container.trade_direction === 'EXPORT'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                                : 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-300 dark:border-blue-800'
                            }`}>
                              {container.trade_direction === 'EXPORT' ? '📤 EXPORT' : '📥 IMPORT'}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {container.container_type_display || container.container_type} • {container.container_gross_weight} MT
                            </span>
                          </div>
                        </td>

                        {/* 2. Vessel */}
                        <td className="p-4">
                          <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                            <Ship className="w-3.5 h-3.5 text-[#D49A24] shrink-0" />
                            <span className="truncate max-w-[200px]">{container.vessel_name || 'Carrier Vessel'}</span>
                          </div>
                          {container.arrival_request_id && (
                            <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                              Arrival Req #{container.arrival_request_id}
                            </span>
                          )}
                        </td>

                        {/* 3. Allocation Status */}
                        <td className="p-4">
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                            <Clock className="w-3 h-3 text-amber-500 shrink-0" />
                            <span>UNALLOCATED</span>
                          </div>
                          {container.is_discharged && (
                            <span className="block mt-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                              ✓ Successfully Discharged
                            </span>
                          )}
                        </td>

                        {/* 4. Simple Yard Position Code */}
                        <td className="p-4">
                          {availableSlots.length === 0 ? (
                            <div className="text-xs text-rose-500 font-bold flex items-center gap-1">
                              <AlertCircle className="w-3.5 h-3.5" />
                              <span>No positions available</span>
                            </div>
                          ) : (
                            <div className="space-y-1 max-w-[240px]">
                              <div className="relative">
                                <select
                                  id={`select-position-code-${container.container_id}`}
                                  value={currentCode}
                                  onChange={(e) => {
                                    const newCode = e.target.value;
                                    setRowSelectedCodes(prev => ({
                                      ...prev,
                                      [container.container_id]: newCode
                                    }));
                                  }}
                                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-mono font-bold text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#D49A24] focus:ring-1 focus:ring-[#D49A24]"
                                >
                                  {availableSlots.map(slot => {
                                    const code = slot.simple_code || `Y${String(slot.slot_id).padStart(3, '0')}`;
                                    return (
                                      <option key={slot.slot_id} value={code}>
                                        {code} ({slot.block_code} • Row {slot.slot_row}, Bay {slot.slot_bay}, Tier {slot.slot_tier})
                                      </option>
                                    );
                                  })}
                                </select>
                              </div>
                              {currentSlot && (
                                <div className="text-[10px] text-slate-400 font-mono truncate" title={currentSlot.location_display}>
                                  Mapped: {currentSlot.location_display}
                                </div>
                              )}
                            </div>
                          )}
                        </td>

                        {/* 5. Allocate Position Action */}
                        <td className="p-4 text-right">
                          <button
                            id={`allocate-position-btn-${container.container_id}`}
                            disabled={availableSlots.length === 0 || isAllocating}
                            onClick={() => handleAllocatePosition(container)}
                            className="px-4 py-2 rounded-xl bg-[#D49A24] hover:bg-[#b88219] disabled:bg-slate-300 dark:disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-bold text-xs transition-all inline-flex items-center gap-1.5 shadow-sm cursor-pointer hover:shadow"
                          >
                            {isAllocating ? (
                              <>
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                <span>Allocating...</span>
                              </>
                            ) : (
                              <>
                                <MapPin className="w-3.5 h-3.5" />
                                <span>Allocate Position</span>
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 6. TAB 2: ACTIVE ALLOCATIONS */}
      {/* ===================================================================== */}
      {activeSubTab === 'history' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-xs">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                id="search-allocations-history"
                type="text"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder="Search container, vessel, or position code..."
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-[#D49A24]"
              />
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                <Filter className="w-3.5 h-3.5" />
                <span className="font-bold">Status:</span>
              </div>
              <select
                id="filter-history-status"
                value={historyStatusFilter}
                onChange={(e) => setHistoryStatusFilter(e.target.value)}
                className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:border-[#D49A24]"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active Storage</option>
                <option value="RELEASED">Released</option>
              </select>
            </div>
          </div>

          {/* Active Allocations Table */}
          <div className="overflow-x-auto rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
            <table id="allocations-history-table" className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-black uppercase tracking-wider text-[10px]">
                  <th className="p-4">Container Number</th>
                  <th className="p-4">Vessel</th>
                  <th className="p-4">Allocation Status</th>
                  <th className="p-4">Simple Yard Position Code</th>
                  <th className="p-4">Allocated At</th>
                  <th className="p-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium text-slate-700 dark:text-slate-300">
                {loadingHistory ? (
                  <tr>
                    <td colSpan={6} className="p-10 text-center text-slate-400">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#D49A24]" />
                      <span>Loading allocation records...</span>
                    </td>
                  </tr>
                ) : allocations.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-12 text-center text-slate-400">
                      <Archive className="w-10 h-10 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                      <p className="font-bold text-slate-600 dark:text-slate-300 text-sm">No Allocation Records Found</p>
                      <p className="text-xs text-slate-400 mt-1">Containers allocated to yard positions will be listed here.</p>
                    </td>
                  </tr>
                ) : (
                  allocations.map((alloc) => {
                    const positionCode = alloc.simple_code || `Y${String(alloc.slot_id).padStart(3, '0')}`;
                    const isActive = alloc.yard_allocation_status === 'ACTIVE';

                    return (
                      <tr
                        key={alloc.yard_allocation_id}
                        id={`history-row-${alloc.yard_allocation_id}`}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        {/* Container Number */}
                        <td className="p-4">
                          <div className="font-mono font-black text-sm text-slate-900 dark:text-white">
                            {alloc.container_number}
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {alloc.container_type_display || alloc.container_type} • {alloc.container_gross_weight} MT
                          </span>
                        </td>

                        {/* Vessel */}
                        <td className="p-4">
                          <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                            <Ship className="w-3.5 h-3.5 text-[#D49A24] shrink-0" />
                            <span>{alloc.vessel_name || 'Carrier Vessel'}</span>
                          </div>
                        </td>

                        {/* Allocation Status */}
                        <td className="p-4">
                          {isActive ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                              <CheckCircle className="w-3 h-3 text-emerald-500" />
                              <span>ACTIVE</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/30">
                              <Archive className="w-3 h-3 text-slate-500" />
                              <span>RELEASED</span>
                            </span>
                          )}
                        </td>

                        {/* Simple Yard Position Code */}
                        <td className="p-4">
                          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-mono font-black text-xs border border-slate-200 dark:border-slate-700">
                            <MapPin className="w-3.5 h-3.5 text-[#D49A24]" />
                            <span>{positionCode}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono block mt-1" title={alloc.location_display || alloc.current_location}>
                            {alloc.current_location || alloc.location_display}
                          </span>
                        </td>

                        {/* Allocated At */}
                        <td className="p-4 text-slate-500 dark:text-slate-400 text-xs">
                          <div>{new Date(alloc.yard_allocation_allocated_at).toLocaleDateString()}</div>
                          <span className="text-[10px] text-slate-400">
                            {new Date(alloc.yard_allocation_allocated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </td>

                        {/* Action */}
                        <td className="p-4 text-right">
                          {isActive && (
                            <button
                              id={`release-position-btn-${alloc.yard_allocation_id}`}
                              onClick={() => handleOpenReleaseModal(alloc)}
                              className="px-3 py-1.5 rounded-xl border border-rose-300 dark:border-rose-800/80 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-bold transition-colors inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Unlock className="w-3.5 h-3.5" />
                              <span>Release</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 7. RELEASE POSITION CONFIRMATION MODAL */}
      {/* ===================================================================== */}
      {isReleaseModalOpen && allocationToRelease && (
        <Modal
          isOpen={isReleaseModalOpen}
          onClose={() => setIsReleaseModalOpen(false)}
          title="Release Yard Position"
        >
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-800 dark:text-amber-200 space-y-1">
                <p className="font-bold">Are you sure you want to release this position?</p>
                <p>
                  Container <span className="font-mono font-bold">{allocationToRelease.container_number}</span> will be released from position{' '}
                  <span className="font-mono font-bold">{allocationToRelease.simple_code || allocationToRelease.slot_code}</span>. The position will become AVAILABLE for subsequent container assignments.
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Release Remarks (Optional)
              </label>
              <textarea
                value={releaseRemarks}
                onChange={(e) => setReleaseRemarks(e.target.value)}
                placeholder="Reason for releasing position (e.g., Gate-Out, relocation)..."
                rows={3}
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-[#D49A24]"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsReleaseModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submittingRelease}
                onClick={handleConfirmRelease}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-bold transition-colors inline-flex items-center gap-1.5"
              >
                {submittingRelease ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Releasing...</span>
                  </>
                ) : (
                  <>
                    <Unlock className="w-3.5 h-3.5" />
                    <span>Confirm Release</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
