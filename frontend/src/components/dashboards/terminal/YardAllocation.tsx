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
  Truck,
  Ship,
  Layers,
  ChevronRight,
  ChevronDown,
  Info,
  Building2,
  Calendar,
  User,
  SlidersHorizontal,
  Unlock,
  Archive,
  ArrowUpDown
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
  YardSlotItem,
  CreateYardAllocationPayload,
  ReleaseYardAllocationPayload
} from '../../../types';

export const YardAllocation: React.FC = () => {
  const { addToast } = useApp();

  // Navigation Sub-tab
  const [activeSubTab, setActiveSubTab] = useState<'pending' | 'history'>('pending');

  // Master Data State
  const [pendingContainers, setPendingContainers] = useState<PendingContainerItem[]>([]);
  const [allocations, setAllocations] = useState<YardAllocationItem[]>([]);
  const [yards, setYards] = useState<YardItem[]>([]);
  const [loadingPending, setLoadingPending] = useState<boolean>(true);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(true);
  const [loadingYards, setLoadingYards] = useState<boolean>(false);

  // Filters for Pending Containers
  const [pendingSearch, setPendingSearch] = useState<string>('');
  const [pendingStatusFilter, setPendingStatusFilter] = useState<string>('ALL');

  // Filters for Allocation History
  const [historySearch, setHistorySearch] = useState<string>('');
  const [historyYardFilter, setHistoryYardFilter] = useState<string>('ALL');
  const [historyBlockFilter, setHistoryBlockFilter] = useState<string>('ALL');
  const [historyStatusFilter, setHistoryStatusFilter] = useState<string>('ALL');

  // Allocation Modal State
  const [isAllocateModalOpen, setIsAllocateModalOpen] = useState<boolean>(false);
  const [selectedPendingContainer, setSelectedPendingContainer] = useState<PendingContainerItem | null>(null);
  const [modalYards, setModalYards] = useState<YardItem[]>([]);
  const [modalBlocks, setModalBlocks] = useState<YardBlockItem[]>([]);
  const [modalSlots, setModalSlots] = useState<AvailableSlotItem[]>([]);
  const [selectedYardId, setSelectedYardId] = useState<string>('');
  const [selectedBlockId, setSelectedBlockId] = useState<string>('');
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlotItem | null>(null);
  const [allocationRemarks, setAllocationRemarks] = useState<string>('');
  const [loadingSlots, setLoadingSlots] = useState<boolean>(false);
  const [submittingAllocation, setSubmittingAllocation] = useState<boolean>(false);

  // Release Modal State
  const [isReleaseModalOpen, setIsReleaseModalOpen] = useState<boolean>(false);
  const [allocationToRelease, setAllocationToRelease] = useState<YardAllocationItem | null>(null);
  const [releaseRemarks, setReleaseRemarks] = useState<string>('');
  const [submittingRelease, setSubmittingRelease] = useState<boolean>(false);

  // Detail Modal State
  const [selectedAllocationDetail, setSelectedAllocationDetail] = useState<YardAllocationItem | null>(null);

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
        throw new Error('Invalid response envelope from server.');
      }
    } catch (err: any) {
      console.error('Failed to load pending containers:', err);
      addToast(
        'error',
        'Pending Load Error',
        err.message || 'Unable to fetch pending container allocation records.'
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
      if (historyYardFilter !== 'ALL') params.append('yard_id', historyYardFilter);
      if (historyBlockFilter !== 'ALL') params.append('block_id', historyBlockFilter);
      if (historyStatusFilter !== 'ALL') params.append('status', historyStatusFilter);
      if (params.toString()) url += `?${params.toString()}`;

      const res = await apiFetch(url);
      const data = await parseApiResponse(res);
      if (data && data.status === 'success' && Array.isArray(data.data)) {
        setAllocations(data.data);
      } else {
        throw new Error('Invalid response envelope from server.');
      }
    } catch (err: any) {
      console.error('Failed to load yard allocations history:', err);
      addToast(
        'error',
        'History Load Error',
        err.message || 'Unable to fetch yard allocation records.'
      );
      setAllocations([]);
    } finally {
      setLoadingHistory(false);
    }
  }, [historySearch, historyYardFilter, historyBlockFilter, historyStatusFilter, addToast]);

  const fetchYards = useCallback(async () => {
    setLoadingYards(true);
    try {
      const res = await apiFetch('/api/terminal/yards/?status=ACTIVE');
      const data = await parseApiResponse(res);
      if (data && data.status === 'success' && Array.isArray(data.data)) {
        setYards(data.data);
      } else {
        throw new Error('Invalid response envelope from server.');
      }
    } catch (err: any) {
      console.error('Failed to load operational yards:', err);
      addToast(
        'error',
        'Yards Load Error',
        err.message || 'Unable to load operational yards.'
      );
    } finally {
      setLoadingYards(false);
    }
  }, [addToast]);

  useEffect(() => {
    fetchPendingContainers();
    fetchAllocations();
    fetchYards();
  }, [fetchPendingContainers, fetchAllocations, fetchYards]);

  // =========================================================================
  // ALLOCATION MODAL WORKFLOW
  // =========================================================================

  const handleOpenAllocateModal = async (container: PendingContainerItem) => {
    setSelectedPendingContainer(container);
    setSelectedSlot(null);
    setAllocationRemarks('');
    setSelectedYardId('');
    setSelectedBlockId('');
    setModalBlocks([]);
    setModalSlots([]);
    setIsAllocateModalOpen(true);

    try {
      const res = await apiFetch('/api/terminal/yards/?status=ACTIVE');
      const data = await parseApiResponse(res);
      if (data && data.status === 'success' && Array.isArray(data.data)) {
        setModalYards(data.data);
        if (data.data.length > 0) {
          const firstYard = data.data[0];
          setSelectedYardId(String(firstYard.yard_id));
          await loadBlocksForYard(firstYard.yard_id);
        }
      }
    } catch (err) {
      console.error('Failed to load yards for allocation modal:', err);
    }
  };

  const loadBlocksForYard = async (yardId: number) => {
    try {
      const res = await apiFetch(`/api/terminal/yards/${yardId}/blocks/?status=ACTIVE`);
      const data = await parseApiResponse(res);
      if (data && data.status === 'success' && Array.isArray(data.data)) {
        setModalBlocks(data.data);
        if (data.data.length > 0) {
          const firstBlock = data.data[0];
          setSelectedBlockId(String(firstBlock.yard_block_id));
          await loadAvailableSlots(yardId, firstBlock.yard_block_id);
        } else {
          setSelectedBlockId('');
          setModalSlots([]);
        }
      }
    } catch (err) {
      console.error('Failed to load blocks for yard:', err);
      setModalBlocks([]);
      setModalSlots([]);
    }
  };

  const loadAvailableSlots = async (yardId?: number, blockId?: number) => {
    setLoadingSlots(true);
    setSelectedSlot(null);
    try {
      let url = '/api/terminal/yard-allocations/available-slots/';
      const params = new URLSearchParams();
      if (yardId) params.append('yard_id', String(yardId));
      if (blockId) params.append('block_id', String(blockId));
      if (params.toString()) url += `?${params.toString()}`;

      const res = await apiFetch(url);
      const data = await parseApiResponse(res);
      if (data && data.status === 'success' && Array.isArray(data.data)) {
        setModalSlots(data.data);
      } else {
        setModalSlots([]);
      }
    } catch (err: any) {
      console.error('Failed to load available slots:', err);
      addToast(
        'error',
        'Slots Error',
        err.message || 'Unable to retrieve available storage slots.'
      );
      setModalSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleYardChange = async (newYardId: string) => {
    setSelectedYardId(newYardId);
    setSelectedSlot(null);
    if (!newYardId) {
      setModalBlocks([]);
      setModalSlots([]);
      setSelectedBlockId('');
      return;
    }
    await loadBlocksForYard(Number(newYardId));
  };

  const handleBlockChange = async (newBlockId: string) => {
    setSelectedBlockId(newBlockId);
    setSelectedSlot(null);
    if (!newBlockId) {
      setModalSlots([]);
      return;
    }
    await loadAvailableSlots(Number(selectedYardId), Number(newBlockId));
  };

  const handleConfirmAllocation = async () => {
    if (!selectedPendingContainer || !selectedSlot) {
      addToast(
        'warning',
        'Slot Required',
        'Please choose an available storage slot to allocate the container.'
      );
      return;
    }

    setSubmittingAllocation(true);
    try {
      const payload: CreateYardAllocationPayload = {
        container_id: selectedPendingContainer.container_id,
        slot_id: selectedSlot.yard_slot_id || selectedSlot.slot_id,
        remarks: allocationRemarks.trim()
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
          'Allocation Successful',
          `Container ${selectedPendingContainer.container_number} successfully allocated to slot ${selectedSlot.slot_code || selectedSlot.yard_slot_code}.`
        );
        setIsAllocateModalOpen(false);
        setSelectedPendingContainer(null);
        setSelectedSlot(null);
        setAllocationRemarks('');
        // Refresh views
        fetchPendingContainers();
        fetchAllocations();
        fetchYards();
      } else {
        throw new Error(data?.message || 'Allocation failed.');
      }
    } catch (err: any) {
      console.error('Allocation error:', err);
      addToast(
        'error',
        'Allocation Failed',
        err.message || 'Failed to complete container allocation. Please re-check slot availability.'
      );
    } finally {
      setSubmittingAllocation(false);
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
        addToast(
          'success',
          'Slot Released',
          `Container ${allocationToRelease.container_number} released from slot ${allocationToRelease.slot_code || allocationToRelease.yard_slot_code}. Slot is now AVAILABLE.`
        );
        setIsReleaseModalOpen(false);
        setAllocationToRelease(null);
        setReleaseRemarks('');
        // Refresh views
        fetchPendingContainers();
        fetchAllocations();
        fetchYards();
      } else {
        throw new Error(data?.message || 'Release failed.');
      }
    } catch (err: any) {
      console.error('Release error:', err);
      addToast(
        'error',
        'Release Failed',
        err.message || 'Failed to release slot.'
      );
    } finally {
      setSubmittingRelease(false);
    }
  };

  // =========================================================================
  // STATS CALCULATIONS
  // =========================================================================

  const stats = useMemo(() => {
    const activeAllocCount = allocations.filter(a => a.yard_allocation_status === 'ACTIVE').length;
    const totalCap = yards.reduce((acc, y) => acc + (y.yard_capacity || 0), 0);
    const totalOcc = yards.reduce((acc, y) => acc + (y.yard_occupied || 0), 0);
    const overallRate = totalCap > 0 ? ((totalOcc / totalCap) * 100).toFixed(1) : '0.0';

    return {
      pendingCount: pendingContainers.length,
      activeAllocations: activeAllocCount,
      totalCapacity: totalCap,
      occupiedSlots: totalOcc,
      occupancyPercentage: overallRate
    };
  }, [pendingContainers, allocations, yards]);

  // Helper for status badge
  const renderStatusBadge = (status: string, display?: string) => {
    const text = display || status;
    switch (status) {
      case 'ACTIVE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
            <CheckCircle className="w-3 h-3 text-emerald-500" />
            <span>ACTIVE</span>
          </span>
        );
      case 'RELEASED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/30">
            <Archive className="w-3 h-3 text-slate-500" />
            <span>RELEASED</span>
          </span>
        );
      case 'AVAILABLE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/30">
            <CheckCircle2 className="w-3 h-3 text-sky-500" />
            <span>AVAILABLE</span>
          </span>
        );
      case 'OCCUPIED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30">
            <Boxes className="w-3 h-3 text-amber-500" />
            <span>OCCUPIED</span>
          </span>
        );
      case 'AT_TERMINAL':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30">
            <Warehouse className="w-3 h-3 text-amber-500" />
            <span>At Terminal</span>
          </span>
        );
      case 'ARRIVED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30">
            <Ship className="w-3 h-3 text-indigo-500" />
            <span>Arrived</span>
          </span>
        );
      case 'REGISTERED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/30">
            <Clock className="w-3 h-3 text-blue-500" />
            <span>Registered</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            {text}
          </span>
        );
    }
  };

  const formatDate = (isoStr?: string | null) => {
    if (!isoStr) return '—';
    try {
      const d = new Date(isoStr);
      return d.toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return isoStr;
    }
  };

  return (
    <div id="yard-allocation-page" className="space-y-6 font-sans selection:bg-[#D49A24] selection:text-white animate-fade-in pb-12">
      {/* ===================================================================== */}
      {/* 1. PAGE HEADER */}
      {/* ===================================================================== */}
      <div className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center font-black">
              <MapPin className="w-5 h-5 text-[#D49A24]" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                Container Yard Allocation & Storage
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-normal">
                Allocate inbound and terminal containers to operational physical yard slots with coordinate mapping and history tracking.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => {
              fetchPendingContainers();
              fetchAllocations();
              fetchYards();
            }}
            className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
            title="Refresh Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingPending || loadingHistory ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 2. STATS SUMMARY CARDS */}
      {/* ===================================================================== */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Pending Containers */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            <span>Pending Allocation</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-amber-600 dark:text-amber-400 font-mono">
            {stats.pendingCount}
          </div>
          <span className="text-[11px] text-slate-400 block">Eligible containers awaiting slot placement</span>
        </div>

        {/* Active Allocations */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            <span>Active Yard Storage</span>
            <Boxes className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
            {stats.activeAllocations}
          </div>
          <span className="text-[11px] text-slate-400 block">Containers currently parked in slots</span>
        </div>

        {/* Total Occupancy Rate */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            <span>Yard Occupancy</span>
            <Warehouse className="w-4 h-4 text-sky-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-sky-600 dark:text-sky-400 font-mono">
            {stats.occupancyPercentage}%
          </div>
          <span className="text-[11px] text-slate-400 block">
            {stats.occupiedSlots} / {stats.totalCapacity} total yard capacity
          </span>
        </div>

        {/* Operational Yards */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            <span>Active Storage Yards</span>
            <Building2 className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-purple-600 dark:text-purple-400 font-mono">
            {yards.length}
          </div>
          <span className="text-[11px] text-slate-400 block">Configured physical terminal yards</span>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 3. NAVIGATION SUB-TABS */}
      {/* ===================================================================== */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800">
        <button
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
          onClick={() => setActiveSubTab('history')}
          className={`pb-3 px-3 text-sm font-black transition-all cursor-pointer relative flex items-center gap-2 ${
            activeSubTab === 'history'
              ? 'text-[#D49A24] border-b-2 border-[#D49A24]'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Boxes className="w-4 h-4" />
          <span>Active Allocations & Movement History</span>
          <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold">
            {allocations.length}
          </span>
        </button>
      </div>

      {/* ===================================================================== */}
      {/* 4. SECTION: PENDING YARD ALLOCATION */}
      {/* ===================================================================== */}
      {activeSubTab === 'pending' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-xs">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
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
                value={pendingStatusFilter}
                onChange={(e) => setPendingStatusFilter(e.target.value)}
                className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:border-[#D49A24]"
              >
                <option value="ALL">All Eligible Statuses</option>
                <option value="AT_TERMINAL">At Terminal</option>
                <option value="ARRIVED">Arrived</option>
                <option value="REGISTERED">Registered</option>
                <option value="AWAITING_CUSTOMS">Awaiting Customs</option>
                <option value="UNDER_INSPECTION">Under Inspection</option>
                <option value="CLEARED">Cleared</option>
              </select>
            </div>
          </div>

          {/* Pending Container Table */}
          <div className="overflow-x-auto rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
            <table id="pending-container-table" className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-black uppercase tracking-wider text-[10px]">
                  <th className="p-3.5">Container Number</th>
                  <th className="p-3.5">Type & Size</th>
                  <th className="p-3.5">Gross Weight</th>
                  <th className="p-3.5">Current Status</th>
                  <th className="p-3.5">Vessel & Manifest</th>
                  <th className="p-3.5">Customs Status</th>
                  <th className="p-3.5">Allocation Status</th>
                  <th className="p-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium text-slate-700 dark:text-slate-300">
                {loadingPending ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-400">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#D49A24]" />
                      <span>Loading pending containers...</span>
                    </td>
                  </tr>
                ) : pendingContainers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-12 text-center text-slate-400">
                      <Boxes className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                      <p className="font-bold text-slate-600 dark:text-slate-300 text-sm">No Pending Containers Awaiting Allocation</p>
                      <p className="text-xs text-slate-400 mt-1">All eligible unloaded containers currently have physical yard allocations assigned.</p>
                    </td>
                  </tr>
                ) : (
                  pendingContainers.map((container) => (
                    <tr
                      key={container.container_id}
                      id={`pending-container-row-${container.container_id}`}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="p-3.5 font-mono font-bold text-slate-900 dark:text-white">
                        {container.container_number}
                      </td>

                      <td className="p-3.5">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {container.container_type_display || container.container_type}
                        </span>
                        <span className="text-[10px] text-slate-400 block font-mono">
                          {container.teu_equivalent} TEU
                        </span>
                      </td>

                      <td className="p-3.5 font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                        {container.container_gross_weight} MT
                      </td>

                      <td className="p-3.5">
                        {renderStatusBadge(container.container_status, container.container_status_display)}
                      </td>

                      <td className="p-3.5">
                        <div className="font-bold text-slate-800 dark:text-slate-200 truncate max-w-[160px]">
                          {container.vessel_name}
                        </div>
                        {container.arrival_request_id && (
                          <span className="text-[10px] text-slate-400 font-mono block">
                            Req #{container.arrival_request_id}
                          </span>
                        )}
                      </td>

                      <td className="p-3.5">
                        <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                          {container.customs_status_display || 'Not Inspected'}
                        </span>
                      </td>

                      <td className="p-3.5">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-600 border border-amber-500/30">
                          <Clock className="w-2.5 h-2.5" />
                          <span>UNALLOCATED</span>
                        </span>
                      </td>

                      <td className="p-3.5 text-right">
                        <button
                          id={`allocate-container-btn-${container.container_id}`}
                          onClick={() => handleOpenAllocateModal(container)}
                          className="px-3.5 py-1.5 rounded-xl bg-[#D49A24] hover:bg-[#b88219] text-white font-bold text-xs transition-colors inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
                        >
                          <MapPin className="w-3.5 h-3.5" />
                          <span>Allocate</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 5. SECTION: ALLOCATION HISTORY & CURRENT LOCATIONS */}
      {/* ===================================================================== */}
      {activeSubTab === 'history' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 shadow-xs">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder="Search container or slot..."
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-[#D49A24]"
              />
            </div>

            <div>
              <select
                value={historyYardFilter}
                onChange={(e) => {
                  setHistoryYardFilter(e.target.value);
                  setHistoryBlockFilter('ALL');
                }}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:border-[#D49A24]"
              >
                <option value="ALL">All Storage Yards</option>
                {yards.map(y => (
                  <option key={y.yard_id} value={String(y.yard_id)}>
                    {y.yard_name} ({y.yard_code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <select
                value={historyStatusFilter}
                onChange={(e) => setHistoryStatusFilter(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:border-[#D49A24]"
              >
                <option value="ALL">All Allocation Statuses</option>
                <option value="ACTIVE">ACTIVE (Currently in Slot)</option>
                <option value="RELEASED">RELEASED (Historical)</option>
              </select>
            </div>

            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={() => {
                  setHistorySearch('');
                  setHistoryYardFilter('ALL');
                  setHistoryBlockFilter('ALL');
                  setHistoryStatusFilter('ALL');
                }}
                className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors cursor-pointer w-full"
              >
                Reset Filters
              </button>
            </div>
          </div>

          {/* Allocation History Table */}
          <div className="overflow-x-auto rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
            <table id="allocation-history-table" className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-black uppercase tracking-wider text-[10px]">
                  <th className="p-3.5">Container</th>
                  <th className="p-3.5">Current Physical Location</th>
                  <th className="p-3.5">Coordinates</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">Allocated At</th>
                  <th className="p-3.5">Allocated By</th>
                  <th className="p-3.5">Release Info</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium text-slate-700 dark:text-slate-300">
                {loadingHistory ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-400">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#D49A24]" />
                      <span>Loading allocation records...</span>
                    </td>
                  </tr>
                ) : allocations.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-12 text-center text-slate-400">
                      <Warehouse className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                      <p className="font-bold text-slate-600 dark:text-slate-300 text-sm">No Yard Allocations Found</p>
                      <p className="text-xs text-slate-400 mt-1">Allocate pending containers to storage slots to view records here.</p>
                    </td>
                  </tr>
                ) : (
                  allocations.map((alloc) => (
                    <tr
                      key={alloc.yard_allocation_id}
                      id={`allocation-history-row-${alloc.yard_allocation_id}`}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="p-3.5 font-mono font-bold text-slate-900 dark:text-white">
                        <span className="block">{alloc.container_number}</span>
                        <span className="text-[10px] text-slate-400 font-sans font-normal">
                          {alloc.container_type_display || alloc.container_type}
                        </span>
                      </td>

                      <td className="p-3.5">
                        <div id={`current-location-${alloc.container_id}`} className="space-y-0.5">
                          <span className="font-mono font-bold text-slate-900 dark:text-white text-xs block">
                            {alloc.location_display || alloc.current_location}
                          </span>
                          <span className="text-[10px] text-slate-400 block">
                            {alloc.yard_name} • {alloc.block_name}
                          </span>
                        </div>
                      </td>

                      <td className="p-3.5 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                        Row {alloc.slot_row} • Bay {alloc.slot_bay} • Tier {alloc.slot_tier}
                      </td>

                      <td className="p-3.5">
                        {renderStatusBadge(alloc.yard_allocation_status)}
                      </td>

                      <td className="p-3.5 text-[11px] text-slate-600 dark:text-slate-400">
                        {formatDate(alloc.yard_allocation_allocated_at)}
                      </td>

                      <td className="p-3.5 text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                        {alloc.allocated_by_name || 'Terminal Operator'}
                      </td>

                      <td className="p-3.5 text-[11px]">
                        {alloc.yard_allocation_status === 'RELEASED' ? (
                          <div>
                            <span className="text-slate-500 block">{formatDate(alloc.yard_allocation_released_at)}</span>
                            {alloc.released_by_name && (
                              <span className="text-[10px] text-slate-400 block">By: {alloc.released_by_name}</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Occupying Slot</span>
                        )}
                      </td>

                      <td className="p-3.5 text-right space-x-2">
                        {alloc.yard_allocation_status === 'ACTIVE' && (
                          <button
                            id={`release-allocation-btn-${alloc.yard_allocation_id}`}
                            onClick={() => handleOpenReleaseModal(alloc)}
                            className="px-3 py-1 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 font-bold text-xs transition-colors cursor-pointer inline-flex items-center gap-1 border border-rose-500/20"
                            title="Release Container from Slot"
                          >
                            <Unlock className="w-3 h-3" />
                            <span>Release</span>
                          </button>
                        )}
                        <button
                          onClick={() => setSelectedAllocationDetail(alloc)}
                          className="px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold text-xs transition-colors cursor-pointer"
                          title="View Record Details"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 6. MODAL: AVAILABLE SLOT SELECTION & ALLOCATION */}
      {/* ===================================================================== */}
      <Modal
        isOpen={isAllocateModalOpen}
        onClose={() => setIsAllocateModalOpen(false)}
        title="Allocate Container to Yard Slot"
        subtitle={selectedPendingContainer ? `Container: ${selectedPendingContainer.container_number}` : ''}
        icon={<MapPin className="w-5 h-5 text-[#D49A24]" />}
        maxWidth="3xl"
      >
        <div className="space-y-5">
          {/* Container Information Card */}
          {selectedPendingContainer && (
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Container</span>
                <span className="font-mono font-black text-slate-900 dark:text-white text-sm">
                  {selectedPendingContainer.container_number}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Size / Type</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {selectedPendingContainer.container_type_display || selectedPendingContainer.container_type} ({selectedPendingContainer.teu_equivalent} TEU)
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Gross Weight</span>
                <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                  {selectedPendingContainer.container_gross_weight} MT
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Carrier Vessel</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 truncate block">
                  {selectedPendingContainer.vessel_name}
                </span>
              </div>
            </div>
          )}

          {/* Hierarchy Filter Bar: Yard -> Block */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-xl bg-amber-500/5 dark:bg-amber-950/20 border border-amber-500/20">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                Select Storage Yard *
              </label>
              <select
                id="allocation-yard-select"
                value={selectedYardId}
                onChange={(e) => handleYardChange(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-bold text-xs focus:outline-none focus:border-[#D49A24]"
              >
                <option value="">Select Yard...</option>
                {modalYards.map(y => (
                  <option key={y.yard_id} value={String(y.yard_id)}>
                    {y.yard_name} ({y.yard_code}) — {y.available_capacity} free
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                Select Storage Block *
              </label>
              <select
                id="allocation-block-select"
                value={selectedBlockId}
                disabled={!selectedYardId || modalBlocks.length === 0}
                onChange={(e) => handleBlockChange(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-bold text-xs focus:outline-none focus:border-[#D49A24] disabled:opacity-50"
              >
                <option value="">
                  {modalBlocks.length === 0 ? 'No Active Blocks' : 'Select Block...'}
                </option>
                {modalBlocks.map(b => (
                  <option key={b.yard_block_id} value={String(b.yard_block_id)}>
                    {b.yard_block_name} ({b.yard_block_code}) — {b.available_capacity} slots free
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Available Slots Directory */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                <Warehouse className="w-4 h-4 text-[#D49A24]" />
                Available Operational Slots in Block
              </span>
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                {modalSlots.length} slot(s) available
              </span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 max-h-60 overflow-y-auto">
              <table id="available-slot-table" className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-black uppercase tracking-wider text-[10px]">
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    <th className="p-2.5 w-10 text-center">Select</th>
                    <th className="p-2.5">Slot Code</th>
                    <th className="p-2.5">Row</th>
                    <th className="p-2.5">Bay</th>
                    <th className="p-2.5">Tier</th>
                    <th className="p-2.5">Block</th>
                    <th className="p-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium text-slate-700 dark:text-slate-300">
                  {loadingSlots ? (
                    <tr>
                      <td colSpan={7} className="p-6 text-center text-slate-400">
                        <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-1 text-[#D49A24]" />
                        <span>Searching available slots...</span>
                      </td>
                    </tr>
                  ) : modalSlots.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-400">
                        <AlertCircle className="w-6 h-6 mx-auto mb-1 text-amber-500" />
                        <p className="font-bold text-slate-700 dark:text-slate-300">No Operational Slots Available</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">Please choose a different block or yard with free capacity.</p>
                      </td>
                    </tr>
                  ) : (
                    modalSlots.map((slot) => {
                      const slotKey = slot.yard_slot_id || slot.slot_id;
                      const isSelected = selectedSlot && (selectedSlot.yard_slot_id === slotKey || selectedSlot.slot_id === slotKey);

                      return (
                        <tr
                          key={slotKey}
                          id={`available-slot-row-${slotKey}`}
                          onClick={() => setSelectedSlot(slot)}
                          className={`cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-amber-500/15 dark:bg-amber-500/20 font-bold'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                          }`}
                        >
                          <td className="p-2.5 text-center">
                            <input
                              type="radio"
                              name="slot-select"
                              checked={Boolean(isSelected)}
                              onChange={() => setSelectedSlot(slot)}
                              className="accent-[#D49A24] cursor-pointer"
                            />
                          </td>

                          <td className="p-2.5 font-mono font-bold text-slate-900 dark:text-white">
                            {slot.yard_slot_code || slot.slot_code}
                          </td>

                          <td className="p-2.5 font-mono">Row {slot.yard_slot_row || slot.slot_row}</td>
                          <td className="p-2.5 font-mono">Bay {slot.yard_slot_bay || slot.slot_bay}</td>
                          <td className="p-2.5 font-mono">Tier {slot.yard_slot_tier || slot.slot_tier}</td>

                          <td className="p-2.5 text-slate-600 dark:text-slate-400">
                            {slot.block_code} ({slot.block_name})
                          </td>

                          <td className="p-2.5">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/30">
                              AVAILABLE
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Selected Slot Confirmation Summary */}
          {selectedSlot && (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block">
                Target Allocation Coordinate Confirmed:
              </span>
              <div className="text-base font-mono font-black text-slate-900 dark:text-white flex items-center gap-2">
                <MapPin className="w-4 h-4 text-emerald-600" />
                <span>{selectedSlot.location_display}</span>
              </div>
              <span className="text-xs text-slate-600 dark:text-slate-300 block">
                Yard: {selectedSlot.yard_name} ({selectedSlot.yard_code}) • Block: {selectedSlot.block_name} ({selectedSlot.block_code})
              </span>
            </div>
          )}

          {/* Remarks Field */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
              Operator Allocation Remarks (Optional)
            </label>
            <input
              type="text"
              value={allocationRemarks}
              onChange={(e) => setAllocationRemarks(e.target.value)}
              placeholder="e.g. Allocated to priority stacking bay near gantry 2"
              className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#D49A24]"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2.5">
            <button
              id="cancel-allocation-btn"
              type="button"
              disabled={submittingAllocation}
              onClick={() => setIsAllocateModalOpen(false)}
              className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs hover:bg-slate-300 transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              id="confirm-allocation-btn"
              type="button"
              disabled={!selectedSlot || submittingAllocation}
              onClick={handleConfirmAllocation}
              className="px-4 py-2 rounded-xl bg-[#D49A24] hover:bg-[#b88219] text-white font-bold text-xs transition-colors inline-flex items-center gap-2 shadow-sm cursor-pointer disabled:opacity-50"
            >
              {submittingAllocation ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4" />
              )}
              <span>Confirm Allocation</span>
            </button>
          </div>
        </div>
      </Modal>

      {/* ===================================================================== */}
      {/* 7. MODAL: RELEASE CONTAINER ALLOCATION */}
      {/* ===================================================================== */}
      <Modal
        isOpen={isReleaseModalOpen}
        onClose={() => setIsReleaseModalOpen(false)}
        title="Release Container from Yard Slot"
        subtitle={allocationToRelease ? `Container ${allocationToRelease.container_number}` : ''}
        icon={<Unlock className="w-5 h-5 text-rose-500" />}
        maxWidth="md"
      >
        <div className="space-y-4">
          {allocationToRelease && (
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 space-y-2 text-xs">
              <div>
                <span className="text-slate-400 text-[10px] uppercase font-bold block">Current Location</span>
                <span className="font-mono font-black text-slate-900 dark:text-white text-sm">
                  {allocationToRelease.location_display || allocationToRelease.current_location}
                </span>
              </div>
              <div className="text-slate-600 dark:text-slate-300">
                Releasing this container will restore slot <strong className="font-mono text-slate-900 dark:text-white">{allocationToRelease.slot_code || allocationToRelease.yard_slot_code}</strong> back to <strong>AVAILABLE</strong> status and decrement block occupancy.
              </div>
            </div>
          )}

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
              Release Reason / Notes (Optional)
            </label>
            <input
              type="text"
              value={releaseRemarks}
              onChange={(e) => setReleaseRemarks(e.target.value)}
              placeholder="e.g. Dispatched to gate for delivery pickup"
              className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-rose-500"
            />
          </div>

          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2.5">
            <button
              type="button"
              disabled={submittingRelease}
              onClick={() => setIsReleaseModalOpen(false)}
              className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs hover:bg-slate-300 transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              disabled={submittingRelease}
              onClick={handleConfirmRelease}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition-colors inline-flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
            >
              {submittingRelease ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Unlock className="w-4 h-4" />
              )}
              <span>Confirm Release</span>
            </button>
          </div>
        </div>
      </Modal>

      {/* ===================================================================== */}
      {/* 8. MODAL: DETAILED RECORD VIEW */}
      {/* ===================================================================== */}
      <Modal
        isOpen={!!selectedAllocationDetail}
        onClose={() => setSelectedAllocationDetail(null)}
        title="Yard Allocation Audit Details"
        subtitle={selectedAllocationDetail ? `Record #${selectedAllocationDetail.yard_allocation_id} • ${selectedAllocationDetail.container_number}` : ''}
        icon={<MapPin className="w-5 h-5 text-[#D49A24]" />}
        maxWidth="lg"
      >
        {selectedAllocationDetail && (
          <div className="space-y-4 text-xs">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Container</span>
                <span className="font-mono font-black text-slate-900 dark:text-white text-base">
                  {selectedAllocationDetail.container_number}
                </span>
                <span className="text-slate-400 block text-[11px]">
                  {selectedAllocationDetail.container_type_display || selectedAllocationDetail.container_type}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Status</span>
                {renderStatusBadge(selectedAllocationDetail.yard_allocation_status)}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-amber-500/5 dark:bg-amber-950/20 border border-amber-500/20 space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 block">
                Physical Storage Coordinates
              </span>
              <div className="text-sm font-mono font-black text-slate-900 dark:text-white">
                {selectedAllocationDetail.location_display || selectedAllocationDetail.current_location}
              </div>
              <div className="grid grid-cols-3 gap-2 pt-1">
                <div>
                  <span className="text-slate-400 text-[10px] block">Row</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{selectedAllocationDetail.slot_row}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block">Bay</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{selectedAllocationDetail.slot_bay}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block">Tier</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{selectedAllocationDetail.slot_tier}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 space-y-1">
                <span className="text-slate-400 text-[10px] uppercase font-bold block">Allocated At</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                  {formatDate(selectedAllocationDetail.yard_allocation_allocated_at)}
                </span>
                <span className="text-[10px] text-slate-400 block">
                  By: {selectedAllocationDetail.allocated_by_name || 'Terminal Operator'}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 space-y-1">
                <span className="text-slate-400 text-[10px] uppercase font-bold block">Released At</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                  {formatDate(selectedAllocationDetail.yard_allocation_released_at)}
                </span>
                <span className="text-[10px] text-slate-400 block">
                  By: {selectedAllocationDetail.released_by_name || '—'}
                </span>
              </div>
            </div>

            {selectedAllocationDetail.yard_allocation_remarks && (
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                <span className="text-slate-400 text-[10px] uppercase font-bold block mb-0.5">Remarks / Audit Note</span>
                <p className="text-slate-700 dark:text-slate-300 font-medium">
                  {selectedAllocationDetail.yard_allocation_remarks}
                </p>
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedAllocationDetail(null)}
                className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs hover:bg-slate-300 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
