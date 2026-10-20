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
  MoveHorizontal,
  ArrowUpDown,
  History,
  Activity,
  BarChart3,
  Check,
  AlertTriangle,
  X
} from 'lucide-react';
import { apiFetch } from '../../../services/api';
import { useApp } from '../../../context/AppContext';
import { Modal } from '../../common/Modal';
import {
  YardOperationContainerItem,
  YardMovementHistoryItem,
  YardUtilizationSummary,
  YardUtilizationYard,
  YardItem,
  YardBlockItem,
  AvailableSlotItem,
  ContainerRelocationPayload,
  CraneItem
} from '../../../types';

export const YardOperations: React.FC = () => {
  const { addToast } = useApp();

  // Navigation Sub-tab
  const [activeSubTab, setActiveSubTab] = useState<'inventory' | 'history' | 'utilization'>('inventory');

  // Master & Operations State
  const [containers, setContainers] = useState<YardOperationContainerItem[]>([]);
  const [movements, setMovements] = useState<YardMovementHistoryItem[]>([]);
  const [utilization, setUtilization] = useState<YardUtilizationSummary | null>(null);
  const [yards, setYards] = useState<YardItem[]>([]);

  // Loading States
  const [loadingContainers, setLoadingContainers] = useState<boolean>(true);
  const [loadingMovements, setLoadingMovements] = useState<boolean>(false);
  const [loadingUtilization, setLoadingUtilization] = useState<boolean>(false);

  // Filters for Containers Inventory
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedYardFilter, setSelectedYardFilter] = useState<string>('ALL');
  const [selectedBlockFilter, setSelectedBlockFilter] = useState<string>('ALL');
  const [selectedStorageStatusFilter, setSelectedStorageStatusFilter] = useState<string>('ALL');

  // Filters for Movement History
  const [historySearchQuery, setHistorySearchQuery] = useState<string>('');

  // Relocation Modal State
  const [isRelocateModalOpen, setIsRelocateModalOpen] = useState<boolean>(false);
  const [containerToRelocate, setContainerToRelocate] = useState<YardOperationContainerItem | null>(null);
  const [modalYards, setModalYards] = useState<YardItem[]>([]);
  const [modalBlocks, setModalBlocks] = useState<YardBlockItem[]>([]);
  const [modalAvailableSlots, setModalAvailableSlots] = useState<AvailableSlotItem[]>([]);
  const [selectedDestYardId, setSelectedDestYardId] = useState<string>('');
  const [selectedDestBlockId, setSelectedDestBlockId] = useState<string>('');
  const [selectedDestSlotId, setSelectedDestSlotId] = useState<string>('');
  const [relocationRemarks, setRelocationRemarks] = useState<string>('');
  const [selectedCraneId, setSelectedCraneId] = useState<string>('');
  const [equipmentList, setEquipmentList] = useState<CraneItem[]>([]);
  const [loadingEquipment, setLoadingEquipment] = useState<boolean>(false);
  const [loadingBlocks, setLoadingBlocks] = useState<boolean>(false);
  const [blockLoadError, setBlockLoadError] = useState<string | null>(null);
  const [loadingAvailableSlots, setLoadingAvailableSlots] = useState<boolean>(false);
  const [submittingRelocation, setSubmittingRelocation] = useState<boolean>(false);

  // Container Detail Modal State
  const [selectedContainerDetail, setSelectedContainerDetail] = useState<YardOperationContainerItem | null>(null);

  // Movement Detail Modal State
  const [selectedMovementDetail, setSelectedMovementDetail] = useState<YardMovementHistoryItem | null>(null);

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

  const fetchContainers = useCallback(async () => {
    setLoadingContainers(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.append('search', searchQuery.trim());
      if (selectedYardFilter !== 'ALL') params.append('yard_id', selectedYardFilter);
      if (selectedBlockFilter !== 'ALL') params.append('block_id', selectedBlockFilter);
      if (selectedStorageStatusFilter !== 'ALL') params.append('storage_status', selectedStorageStatusFilter);

      const url = `/api/terminal/yard-operations/containers/${params.toString() ? `?${params.toString()}` : ''}`;
      const res = await apiFetch(url);
      const data = await parseApiResponse(res);
      if (data && data.status === 'success' && Array.isArray(data.data)) {
        setContainers(data.data);
      } else {
        setContainers([]);
      }
    } catch (err: any) {
      console.error('Failed to fetch yard containers:', err);
      addToast('error', 'Inventory Load Error', err.message || 'Failed to fetch containers inventory.');
      setContainers([]);
    } finally {
      setLoadingContainers(false);
    }
  }, [searchQuery, selectedYardFilter, selectedBlockFilter, selectedStorageStatusFilter, addToast]);

  const fetchMovements = useCallback(async () => {
    setLoadingMovements(true);
    try {
      const params = new URLSearchParams();
      if (historySearchQuery.trim()) params.append('search', historySearchQuery.trim());

      const url = `/api/terminal/yard-operations/movements/${params.toString() ? `?${params.toString()}` : ''}`;
      const res = await apiFetch(url);
      const data = await parseApiResponse(res);
      if (data && data.status === 'success' && Array.isArray(data.data)) {
        setMovements(data.data);
      } else {
        setMovements([]);
      }
    } catch (err: any) {
      console.error('Failed to fetch movement history:', err);
      addToast('error', 'History Load Error', err.message || 'Failed to fetch movement history.');
      setMovements([]);
    } finally {
      setLoadingMovements(false);
    }
  }, [historySearchQuery, addToast]);

  const fetchUtilization = useCallback(async () => {
    setLoadingUtilization(true);
    try {
      const res = await apiFetch('/api/terminal/yard-operations/utilization/');
      const data = await parseApiResponse(res);
      if (data && data.status === 'success') {
        setUtilization(data.data || null);
      }
    } catch (err: any) {
      console.error('Failed to fetch yard utilization:', err);
      addToast('error', 'Utilization Load Error', err.message || 'Failed to fetch yard utilization.');
    } finally {
      setLoadingUtilization(false);
    }
  }, [addToast]);

  const fetchYardsList = useCallback(async () => {
    try {
      const res = await apiFetch('/api/terminal/yards/?status=ACTIVE');
      const data = await parseApiResponse(res);
      if (data && data.status === 'success' && Array.isArray(data.data)) {
        setYards(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch yards:', err);
    }
  }, []);

  const fetchEquipment = useCallback(async () => {
    setLoadingEquipment(true);
    try {
      const res = await apiFetch('/api/terminal/cranes/?is_active=true');
      const data = await parseApiResponse(res);
      if (data && data.status === 'success' && Array.isArray(data.data)) {
        setEquipmentList(data.data);
      } else {
        setEquipmentList([]);
      }
    } catch (err) {
      console.error('Failed to fetch cranes for yard operations:', err);
      setEquipmentList([]);
    } finally {
      setLoadingEquipment(false);
    }
  }, []);

  useEffect(() => {
    fetchYardsList();
    fetchEquipment();
  }, [fetchYardsList, fetchEquipment]);

  useEffect(() => {
    if (activeSubTab === 'inventory') {
      fetchContainers();
    } else if (activeSubTab === 'history') {
      fetchMovements();
    } else if (activeSubTab === 'utilization') {
      fetchUtilization();
    }
  }, [activeSubTab, fetchContainers, fetchMovements, fetchUtilization]);

  // Available blocks for inventory filter based on selected yard
  const filterBlocks = useMemo(() => {
    if (selectedYardFilter === 'ALL') return [];
    const foundYard = yards.find(y => String(y.yard_id) === String(selectedYardFilter));
    return foundYard?.blocks || [];
  }, [selectedYardFilter, yards]);

  // Compatible Yard Handling Equipment (RTG, RMG, MHC)
  const compatibleYardEquipment = useMemo(() => {
    return equipmentList.filter(
      (c) =>
        ['RTG', 'RMG', 'MHC'].includes(c.crane_type) &&
        c.is_operational &&
        c.crane_status !== 'MAINTENANCE' &&
        c.crane_status !== 'INACTIVE' &&
        c.crane_status !== 'IN_USE' &&
        (!c.active_allocations_count || c.active_allocations_count === 0)
    );
  }, [equipmentList]);

  // =========================================================================
  // RELOCATION MODAL LOGIC
  // =========================================================================

  const fetchBlocksForYard = async (yardId: string) => {
    if (!yardId) {
      setModalBlocks([]);
      setSelectedDestBlockId('');
      setSelectedDestSlotId('');
      setModalAvailableSlots([]);
      setBlockLoadError(null);
      setLoadingBlocks(false);
      return;
    }

    setLoadingBlocks(true);
    setBlockLoadError(null);
    setSelectedDestBlockId('');
    setSelectedDestSlotId('');
    setModalAvailableSlots([]);

    try {
      const res = await apiFetch(`/api/terminal/yards/${yardId}/blocks/?status=ACTIVE`);
      const data = await parseApiResponse(res);
      if (data && data.status === 'success' && Array.isArray(data.data)) {
        const activeBlocks: YardBlockItem[] = data.data.filter(
          (b: YardBlockItem) => b.yard_block_status === 'ACTIVE'
        );
        setModalBlocks(activeBlocks);
      } else {
        setModalBlocks([]);
      }
    } catch (err: any) {
      console.error('Failed to load blocks for yard:', err);
      const errMsg = err.message || 'Failed to load constituent blocks for the selected yard.';
      setBlockLoadError(errMsg);
      setModalBlocks([]);
      addToast('error', 'Block Load Error', errMsg);
    } finally {
      setLoadingBlocks(false);
    }
  };

  const openRelocateModal = async (container: YardOperationContainerItem) => {
    setContainerToRelocate(container);
    setSelectedDestYardId('');
    setSelectedDestBlockId('');
    setSelectedDestSlotId('');
    setSelectedCraneId('');
    setRelocationRemarks('');
    setModalBlocks([]);
    setModalAvailableSlots([]);
    setBlockLoadError(null);
    setIsRelocateModalOpen(true);
    fetchEquipment();

    try {
      const res = await apiFetch('/api/terminal/yards/?status=ACTIVE');
      const data = await parseApiResponse(res);
      if (data && data.status === 'success') {
        const activeYards = (data.data || []).filter((y: YardItem) => y.yard_status === 'ACTIVE');
        setModalYards(activeYards);
        // Default to current yard if available
        if (container.current_location?.yard_id) {
          const currentYId = String(container.current_location.yard_id);
          const yardMatch = activeYards.find((y: YardItem) => String(y.yard_id) === currentYId);
          if (yardMatch) {
            setSelectedDestYardId(currentYId);
            await fetchBlocksForYard(currentYId);
          }
        }
      }
    } catch (err: any) {
      console.error('Failed to load yards for relocation:', err);
      addToast('error', 'Yard Load Error', err.message || 'Failed to load yards for relocation.');
    }
  };

  const handleDestYardChange = async (yardId: string) => {
    setSelectedDestYardId(yardId);
    await fetchBlocksForYard(yardId);
  };

  const handleDestBlockChange = async (blockId: string) => {
    setSelectedDestBlockId(blockId);
    setSelectedDestSlotId('');
    setModalAvailableSlots([]);

    if (!blockId) return;

    setLoadingAvailableSlots(true);
    try {
      const res = await apiFetch(`/api/terminal/yard-allocations/available-slots/?block_id=${blockId}`);
      const data = await parseApiResponse(res);
      if (data && data.status === 'success') {
        // Exclude current slot if in same block
        const slots: AvailableSlotItem[] = data.data || [];
        const currentSlotId = containerToRelocate?.current_location?.slot_id;
        const filtered = slots.filter(s => s.yard_slot_id !== currentSlotId);
        setModalAvailableSlots(filtered);
      }
    } catch (err: any) {
      console.error('Failed to load available slots:', err);
      addToast('error', 'Slots Load Error', 'Failed to load available slots for selected block.');
    } finally {
      setLoadingAvailableSlots(false);
    }
  };

  const handleConfirmRelocation = async () => {
    if (!containerToRelocate) return;
    if (!selectedDestSlotId) {
      addToast('warning', 'Missing Slot', 'Please select a destination yard slot.');
      return;
    }

    const payload: ContainerRelocationPayload = {
      container_id: containerToRelocate.container_id,
      destination_slot_id: parseInt(selectedDestSlotId, 10),
      crane_id: selectedCraneId ? parseInt(selectedCraneId, 10) : null,
      remarks: relocationRemarks.trim() || undefined
    };

    setSubmittingRelocation(true);
    try {
      const res = await apiFetch('/api/terminal/yard-operations/relocate/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await parseApiResponse(res);

      if (data && data.status === 'success') {
        addToast(
          'success',
          'Container Relocated',
          data.message || `Container ${containerToRelocate.container_number} relocated successfully!`
        );
        setIsRelocateModalOpen(false);
        // Refresh active views
        fetchContainers();
        fetchUtilization();
        fetchMovements();
      } else {
        addToast('error', 'Relocation Failed', data?.message || 'Relocation failed. Please check conditions.');
      }
    } catch (err: any) {
      console.error('Relocation error:', err);
      addToast('error', 'Relocation Error', err.message || 'An error occurred while relocating container.');
    } finally {
      setSubmittingRelocation(false);
    }
  };

  // Helper to format storage status badges
  const renderStorageStatusBadge = (status: string, display?: string) => {
    switch (status) {
      case 'STORED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            {display || 'Currently Stored'}
          </span>
        );
      case 'RELEASED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            {display || 'Released from Yard'}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
            {display || 'Not allocated'}
          </span>
        );
    }
  };

  const getOccupancyColor = (percentage: number) => {
    if (percentage >= 90) return 'text-rose-600 dark:text-rose-400 bg-rose-500';
    if (percentage >= 75) return 'text-amber-600 dark:text-amber-400 bg-amber-500';
    return 'text-emerald-600 dark:text-emerald-400 bg-emerald-500';
  };

  return (
    <div id="yard-operations-page" className="space-y-6 font-sans selection:bg-[#D49A24] selection:text-white animate-fade-in">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 sm:p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-sm">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-[#D49A24] flex items-center justify-center font-bold">
              <MoveHorizontal className="w-5 h-5 text-[#D49A24]" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                Yard Operations Management
              </h1>
              <span className="text-[11px] font-semibold tracking-wider uppercase text-[#D49A24] bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 rounded-md border border-amber-200/60 dark:border-amber-900/40">
                Phase T3 • Container Relocation & Storage Intelligence
              </span>
            </div>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-3xl pt-1">
            Track current container coordinates, execute atomic slot relocations, preserve verified movement history, and monitor real-time block and yard capacity utilization.
          </p>
        </div>

        {/* REFRESH & QUICK ACTIONS */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (activeSubTab === 'inventory') fetchContainers();
              else if (activeSubTab === 'history') fetchMovements();
              else if (activeSubTab === 'utilization') fetchUtilization();
            }}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors shadow-xs"
            title="Refresh active view"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* NAVIGATION SUB-TABS */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 space-x-1 sm:space-x-3">
        <button
          onClick={() => setActiveSubTab('inventory')}
          className={`flex items-center gap-2 pb-3.5 px-3 sm:px-4 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer ${
            activeSubTab === 'inventory'
              ? 'border-[#D49A24] text-[#D49A24]'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <MapPin className="w-4 h-4" />
          <span>Container Locations & Search</span>
          <span className="ml-1.5 px-2 py-0.5 text-[10px] font-extrabold rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
            {containers.length}
          </span>
        </button>

        <button
          onClick={() => setActiveSubTab('history')}
          className={`flex items-center gap-2 pb-3.5 px-3 sm:px-4 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer ${
            activeSubTab === 'history'
              ? 'border-[#D49A24] text-[#D49A24]'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Movement History</span>
          <span className="ml-1.5 px-2 py-0.5 text-[10px] font-extrabold rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
            {movements.length}
          </span>
        </button>

        <button
          onClick={() => setActiveSubTab('utilization')}
          className={`flex items-center gap-2 pb-3.5 px-3 sm:px-4 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer ${
            activeSubTab === 'utilization'
              ? 'border-[#D49A24] text-[#D49A24]'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Yard & Block Utilization</span>
        </button>
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: CONTAINER LOCATIONS & INVENTORY                                  */}
      {/* ===================================================================== */}
      {activeSubTab === 'inventory' && (
        <div className="space-y-4">
          
          {/* SEARCH & FILTERS BAR */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 items-center">
              
              {/* Search input with stable ID */}
              <div className="md:col-span-5 relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="container-location-search"
                  type="text"
                  placeholder="Search by container number (e.g. MSKU8888888), vessel, cargo..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-9 py-2.5 text-xs sm:text-sm rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-[#D49A24] transition-colors"
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

              {/* Yard filter */}
              <div className="md:col-span-3">
                <select
                  value={selectedYardFilter}
                  onChange={(e) => {
                    setSelectedYardFilter(e.target.value);
                    setSelectedBlockFilter('ALL');
                  }}
                  className="w-full px-3 py-2.5 text-xs sm:text-sm rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-[#D49A24]"
                >
                  <option value="ALL">All Yards</option>
                  {yards.map(y => (
                    <option key={y.yard_id} value={y.yard_id}>
                      {y.yard_code} — {y.yard_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Block filter */}
              <div className="md:col-span-2">
                <select
                  value={selectedBlockFilter}
                  onChange={(e) => setSelectedBlockFilter(e.target.value)}
                  disabled={selectedYardFilter === 'ALL'}
                  className="w-full px-3 py-2.5 text-xs sm:text-sm rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-[#D49A24] disabled:opacity-50"
                >
                  <option value="ALL">All Blocks</option>
                  {filterBlocks.map(b => (
                    <option key={b.yard_block_id} value={b.yard_block_id}>
                      Block {b.yard_block_code}
                    </option>
                  ))}
                </select>
              </div>

              {/* Storage Status filter */}
              <div className="md:col-span-2">
                <select
                  value={selectedStorageStatusFilter}
                  onChange={(e) => setSelectedStorageStatusFilter(e.target.value)}
                  className="w-full px-3 py-2.5 text-xs sm:text-sm rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-[#D49A24]"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="STORED">Currently Stored</option>
                  <option value="NOT_ALLOCATED">Not Allocated</option>
                  <option value="RELEASED">Released</option>
                </select>
              </div>
            </div>
          </div>

          {/* CONTAINERS TABLE / LIST */}
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Boxes className="w-4 h-4 text-[#D49A24]" />
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  Yard Container Registry
                </h3>
                <span className="text-xs text-slate-500">
                  ({containers.length} container{containers.length === 1 ? '' : 's'})
                </span>
              </div>
            </div>

            {loadingContainers ? (
              <div className="p-12 text-center space-y-3">
                <div className="w-8 h-8 mx-auto border-3 border-[#D49A24] border-t-transparent rounded-full animate-spin" />
                <p className="text-xs text-slate-500 font-medium">Loading container locations...</p>
              </div>
            ) : containers.length === 0 ? (
              <div className="p-12 text-center space-y-2">
                <MapPin className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
                <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">No Containers Found</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  No container matching current filters was found in the inventory registry.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
                  <thead className="bg-slate-50/80 dark:bg-slate-800/50 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Container</th>
                      <th className="py-3 px-4">Storage Status</th>
                      <th className="py-3 px-4">Current Yard Location</th>
                      <th className="py-3 px-4">Coordinates (R/B/T)</th>
                      <th className="py-3 px-4">Vessel / Cargo</th>
                      <th className="py-3 px-4 text-center">Relocations</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-normal">
                    {containers.map((c) => {
                      const hasActiveAlloc = c.storage_status === 'STORED' && !!c.current_location;
                      return (
                        <tr
                          key={c.container_id}
                          id={`container-location-result-${c.container_id}`}
                          className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          {/* Container Number & Type */}
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                              <span>{c.container_number}</span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold">
                                {c.container_type}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                              {c.container_gross_weight} MT • {c.container_status}
                            </div>
                          </td>

                          {/* Storage Status */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            {renderStorageStatusBadge(c.storage_status, c.storage_status_display)}
                          </td>

                          {/* Current Yard Location */}
                          <td className="py-3.5 px-4">
                            {hasActiveAlloc && c.current_location ? (
                              <div className="space-y-0.5">
                                <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                                  <Warehouse className="w-3.5 h-3.5 text-[#D49A24]" />
                                  <span>{c.current_location.yard_code}</span>
                                  <span className="text-slate-300 dark:text-slate-600">/</span>
                                  <span className="text-slate-700 dark:text-slate-200">Block {c.current_location.block_code}</span>
                                </div>
                                <div className="text-[11px] text-[#D49A24] font-mono font-semibold">
                                  Slot: {c.current_location.slot_code}
                                </div>
                              </div>
                            ) : (
                              <span className="italic text-slate-400">Not allocated</span>
                            )}
                          </td>

                          {/* Coordinates: Row, Bay, Tier */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            {hasActiveAlloc && c.current_location ? (
                              <div className="flex items-center gap-2 text-xs font-mono">
                                <span className="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                  R:{c.current_location.slot_row}
                                </span>
                                <span className="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                  B:{c.current_location.slot_bay}
                                </span>
                                <span className="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                  T:{c.current_location.slot_tier}
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>

                          {/* Vessel / Cargo */}
                          <td className="py-3.5 px-4">
                            <div className="font-medium text-slate-800 dark:text-slate-200 truncate max-w-[180px]">
                              {c.vessel_name}
                            </div>
                            <div className="text-[11px] text-slate-400 truncate max-w-[180px]">
                              {c.cargo_description || 'General Cargo'}
                            </div>
                          </td>

                          {/* Movement count */}
                          <td className="py-3.5 px-4 text-center">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                              {c.movement_count} move{c.movement_count === 1 ? '' : 's'}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-2">
                              {/* Details button */}
                              <button
                                onClick={() => setSelectedContainerDetail(c)}
                                className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
                              >
                                View
                              </button>

                              {/* Relocate Button with stable Selenium ID */}
                              {hasActiveAlloc && (
                                <button
                                  id={`relocate-container-btn-${c.container_id}`}
                                  onClick={() => openRelocateModal(c)}
                                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-[#D49A24] hover:bg-amber-600 text-white transition-colors shadow-xs"
                                >
                                  <ArrowUpDown className="w-3 h-3" />
                                  <span>Relocate</span>
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
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: MOVEMENT HISTORY                                                */}
      {/* ===================================================================== */}
      {activeSubTab === 'history' && (
        <div className="space-y-4">
          
          {/* History Search Bar */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
            <div className="relative max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search history by container number, slot code, or remarks..."
                value={historySearchQuery}
                onChange={(e) => setHistorySearchQuery(e.target.value)}
                className="w-full pl-10 pr-9 py-2.5 text-xs sm:text-sm rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-[#D49A24]"
              />
              {historySearchQuery && (
                <button
                  onClick={() => setHistorySearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Movement History Table with stable Selenium ID */}
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-[#D49A24]" />
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  Yard Movement Audit Log
                </h3>
                <span className="text-xs text-slate-500">
                  (Append-only permanent trail • {movements.length} total event{movements.length === 1 ? '' : 's'})
                </span>
              </div>
            </div>

            {loadingMovements ? (
              <div className="p-12 text-center space-y-3">
                <div className="w-8 h-8 mx-auto border-3 border-[#D49A24] border-t-transparent rounded-full animate-spin" />
                <p className="text-xs text-slate-500 font-medium">Loading movement history...</p>
              </div>
            ) : movements.length === 0 ? (
              <div className="p-12 text-center space-y-2">
                <History className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
                <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">No Relocation Events Recorded</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  No container movements have been performed yet. Movements will be logged here automatically when containers are relocated.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table id="movement-history-table" className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
                  <thead className="bg-slate-50/80 dark:bg-slate-800/50 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Timestamp</th>
                      <th className="py-3 px-4">Container</th>
                      <th className="py-3 px-4">Previous Location (Origin)</th>
                      <th className="py-3 px-4 text-center">Movement</th>
                      <th className="py-3 px-4">New Location (Destination)</th>
                      <th className="py-3 px-4">Crane / Equipment</th>
                      <th className="py-3 px-4">Operator</th>
                      <th className="py-3 px-4">Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-normal">
                    {movements.map((m) => {
                      const isCrossYard = m.from_yard_id !== m.to_yard_id;
                      return (
                        <tr
                          key={m.yard_movement_id}
                          id={`movement-history-row-${m.yard_movement_id}`}
                          className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          {/* Timestamp */}
                          <td className="py-3.5 px-4 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                            {new Date(m.movement_timestamp).toLocaleString()}
                          </td>

                          {/* Container Number */}
                          <td className="py-3.5 px-4">
                            <span className="font-bold text-slate-900 dark:text-white">
                              {m.container_number}
                            </span>
                            <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 font-semibold">
                              {m.container_type}
                            </span>
                          </td>

                          {/* Origin Location */}
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-slate-800 dark:text-slate-200">
                              {m.from_location_display}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              R:{m.from_slot_row} B:{m.from_slot_bay} T:{m.from_slot_tier}
                            </div>
                          </td>

                          {/* Movement Arrow & Type Badge */}
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            <div className="inline-flex flex-col items-center">
                              <ArrowRight className="w-4 h-4 text-[#D49A24]" />
                              <span className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded uppercase ${
                                m.movement_type === 'DISCHARGE'
                                  ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
                                  : isCrossYard
                                    ? 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300'
                                    : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                              }`}>
                                {m.movement_type_display || (m.movement_type === 'DISCHARGE' ? 'Vessel Discharge' : isCrossYard ? 'Cross-Yard' : 'Intra-Yard')}
                              </span>
                            </div>
                          </td>

                          {/* Destination Location */}
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-slate-800 dark:text-slate-200">
                              {m.to_location_display}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              R:{m.to_slot_row} B:{m.to_slot_bay} T:{m.to_slot_tier}
                            </div>
                          </td>

                          {/* Crane / Equipment */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            {m.crane_code ? (
                              <div className="flex flex-col">
                                <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#D49A24]" />
                                  {m.crane_code}
                                </span>
                                <span className="text-[10px] text-slate-400">
                                  {m.crane_name} ({m.crane_type_display || m.crane_type})
                                </span>
                              </div>
                            ) : (
                              <span className="italic text-slate-400">Not recorded</span>
                            )}
                          </td>

                          {/* Operator */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span className="font-medium text-slate-700 dark:text-slate-300">
                              {m.moved_by_name}
                            </span>
                          </td>

                          {/* Remarks */}
                          <td className="py-3.5 px-4 text-slate-500 max-w-xs truncate" title={m.remarks}>
                            {m.remarks || <span className="italic text-slate-400">None</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 3: YARD & BLOCK UTILIZATION                                        */}
      {/* ===================================================================== */}
      {activeSubTab === 'utilization' && (
        <div className="space-y-6">
          
          {loadingUtilization ? (
            <div className="p-12 text-center space-y-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <div className="w-8 h-8 mx-auto border-3 border-[#D49A24] border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-slate-500 font-medium">Calculating yard utilization metrics...</p>
            </div>
          ) : !utilization ? (
            <div className="p-12 text-center space-y-2 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <AlertCircle className="w-10 h-10 text-amber-500 mx-auto" />
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">Utilization Data Unavailable</h4>
              <p className="text-xs text-slate-500">Failed to load current utilization metrics.</p>
            </div>
          ) : (
            <>
              {/* TOP METRIC CARDS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                
                {/* Total Capacity */}
                <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
                  <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                    <span>Total Yard Capacity</span>
                    <Warehouse className="w-4 h-4 text-[#D49A24]" />
                  </div>
                  <div className="text-2xl font-black text-slate-900 dark:text-white">
                    {utilization.overall.total_capacity} <span className="text-xs font-semibold text-slate-400">Slots</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Across {utilization.overall.total_yards} active terminal storage yards
                  </p>
                </div>

                {/* Total Occupied */}
                <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
                  <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                    <span>Occupied Slots</span>
                    <Boxes className="w-4 h-4 text-blue-500" />
                  </div>
                  <div className="text-2xl font-black text-slate-900 dark:text-white">
                    {utilization.overall.total_occupied} <span className="text-xs font-semibold text-slate-400">Containers</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Currently positioned in storage coordinates
                  </p>
                </div>

                {/* Total Available */}
                <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
                  <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                    <span>Available Capacity</span>
                    <CheckCircle className="w-4 h-4 text-emerald-500" />
                  </div>
                  <div className="text-2xl font-black text-slate-900 dark:text-white">
                    {utilization.overall.total_available} <span className="text-xs font-semibold text-slate-400">Free Slots</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Ready for incoming container receiving
                  </p>
                </div>

                {/* Overall Occupancy % */}
                <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
                  <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                    <span>Terminal Occupancy</span>
                    <Activity className="w-4 h-4 text-[#D49A24]" />
                  </div>
                  <div className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <span>{utilization.overall.occupancy_percentage}%</span>
                    <span className={`text-xs px-2 py-0.5 rounded-md font-bold ${
                      utilization.overall.occupancy_percentage >= 90
                        ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400'
                        : utilization.overall.occupancy_percentage >= 75
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400'
                        : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400'
                    }`}>
                      {utilization.overall.occupancy_percentage >= 90 ? 'Critical' : utilization.overall.occupancy_percentage >= 75 ? 'Moderate' : 'Optimal'}
                    </span>
                  </div>
                  {/* Progress bar */}
                  <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 mt-2 overflow-hidden">
                    <div
                      className={`h-2 rounded-full transition-all duration-500 ${
                        utilization.overall.occupancy_percentage >= 90 ? 'bg-rose-500' : utilization.overall.occupancy_percentage >= 75 ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min(100, utilization.overall.occupancy_percentage)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* DETAILED YARD & BLOCK BREAKDOWN */}
              <div className="space-y-4">
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Warehouse className="w-4 h-4 text-[#D49A24]" />
                  <span>Individual Yard & Block Capacities</span>
                </h3>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {utilization.yards.map((yard) => (
                    <div
                      key={yard.yard_id}
                      className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4"
                    >
                      {/* Yard Header */}
                      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-black text-[#D49A24] bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 rounded border border-amber-200/50 dark:border-amber-900/40">
                              {yard.yard_code}
                            </span>
                            <h4 className="font-bold text-base text-slate-900 dark:text-white">
                              {yard.yard_name}
                            </h4>
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {yard.yard_type_display} • Status: {yard.yard_status}
                          </p>
                        </div>

                        <div className="text-right">
                          <div className="text-sm font-black text-slate-900 dark:text-white">
                            {yard.yard_occupied} / {yard.yard_capacity}
                          </div>
                          <div className="text-[11px] text-slate-400 font-semibold">
                            {yard.occupancy_percentage}% Occupied
                          </div>
                        </div>
                      </div>

                      {/* Yard Progress Gauge */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs text-slate-500 font-medium">
                          <span>Capacity Utilization</span>
                          <span>{yard.available_capacity} Slots Available</span>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden">
                          <div
                            className={`h-2.5 rounded-full transition-all duration-500 ${
                              yard.occupancy_percentage >= 90 ? 'bg-rose-500' : yard.occupancy_percentage >= 75 ? 'bg-amber-500' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${Math.min(100, yard.occupancy_percentage)}%` }}
                          />
                        </div>
                      </div>

                      {/* Blocks Sub-list */}
                      <div className="space-y-2 pt-2">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                          Constituent Blocks ({yard.blocks.length})
                        </div>

                        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                          {yard.blocks.map((block) => (
                            <div
                              key={block.block_id}
                              className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/50 space-y-2"
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                                    <span className="font-mono text-[#D49A24]">Block {block.block_code}</span>
                                    <span className="text-[10px] text-slate-400 font-normal">({block.block_type_display})</span>
                                  </div>
                                </div>
                                <div className="text-right font-mono text-xs">
                                  <span className="font-bold text-slate-900 dark:text-white">{block.block_occupied}</span>
                                  <span className="text-slate-400">/{block.block_capacity}</span>
                                  <span className="ml-2 text-[11px] font-semibold text-slate-500">({block.occupancy_percentage}%)</span>
                                </div>
                              </div>

                              <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
                                <div
                                  className={`h-1.5 rounded-full transition-all duration-500 ${
                                    block.occupancy_percentage >= 90 ? 'bg-rose-500' : block.occupancy_percentage >= 75 ? 'bg-amber-500' : 'bg-emerald-500'
                                  }`}
                                  style={{ width: `${Math.min(100, block.occupancy_percentage)}%` }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL: RELOCATE CONTAINER                                             */}
      {/* ===================================================================== */}
      <Modal
        isOpen={isRelocateModalOpen}
        onClose={() => setIsRelocateModalOpen(false)}
        title={
          <div className="flex items-center gap-2">
            <ArrowUpDown className="w-5 h-5 text-[#D49A24]" />
            <span>Relocate Container</span>
          </div>
        }
        subtitle={
          containerToRelocate
            ? `Move ${containerToRelocate.container_number} (${containerToRelocate.container_type}) to an available destination slot`
            : undefined
        }
        maxWidth="2xl"
        footer={
          <div className="flex items-center justify-end gap-3 w-full">
            <button
              id="cancel-relocation-btn"
              onClick={() => setIsRelocateModalOpen(false)}
              disabled={submittingRelocation}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
            >
              Cancel
            </button>
            <button
              id="confirm-relocation-btn"
              onClick={handleConfirmRelocation}
              disabled={submittingRelocation || !selectedDestSlotId}
              className="flex items-center gap-2 px-5 py-2 text-xs font-bold rounded-xl bg-[#D49A24] hover:bg-amber-600 disabled:opacity-50 text-white transition-colors shadow-xs"
            >
              {submittingRelocation && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              <span>Confirm Relocation</span>
            </button>
          </div>
        }
      >
        {containerToRelocate && (
          <div className="space-y-5 py-2">
            
            {/* CURRENT LOCATION SUMMARY BANNER */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 space-y-2">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Current Origin Location
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                    <Warehouse className="w-4 h-4 text-[#D49A24]" />
                    <span>{containerToRelocate.current_location?.location_display}</span>
                  </div>
                  <div className="text-xs text-slate-500 font-mono mt-0.5">
                    Row: {containerToRelocate.current_location?.slot_row} • Bay: {containerToRelocate.current_location?.slot_bay} • Tier: {containerToRelocate.current_location?.slot_tier}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                    Occupied Slot
                  </span>
                </div>
              </div>
            </div>

            {/* DESTINATION SELECTION GRID */}
            <div className="space-y-3.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Select Destination Coordinates
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                
                {/* Destination Yard Selector */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                    Destination Yard *
                  </label>
                  <select
                    id="relocation-destination-yard"
                    value={selectedDestYardId}
                    onChange={(e) => handleDestYardChange(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-[#D49A24]"
                  >
                    <option value="">Select Yard...</option>
                    {modalYards.map(y => (
                      <option key={y.yard_id} value={y.yard_id}>
                        {y.yard_code} — {y.yard_name} ({y.available_capacity} free)
                      </option>
                    ))}
                  </select>
                </div>

                {/* Destination Block Selector */}
                <div>
                  <label htmlFor="relocation-destination-block" className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                    Destination Block *
                  </label>
                  {loadingBlocks ? (
                    <div className="p-2.5 flex items-center justify-center gap-2 text-xs text-slate-400 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl">
                      <div className="w-3.5 h-3.5 border-2 border-[#D49A24] border-t-transparent rounded-full animate-spin" />
                      <span>Loading constituent yard blocks...</span>
                    </div>
                  ) : blockLoadError ? (
                    <div className="p-2.5 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-xl flex items-center justify-between text-xs text-rose-600 dark:text-rose-400">
                      <span className="truncate">{blockLoadError}</span>
                      <button
                        type="button"
                        onClick={() => selectedDestYardId && fetchBlocksForYard(selectedDestYardId)}
                        className="ml-2 font-bold underline hover:text-rose-700 whitespace-nowrap"
                      >
                        Retry
                      </button>
                    </div>
                  ) : (
                    <select
                      id="relocation-destination-block"
                      value={selectedDestBlockId}
                      onChange={(e) => handleDestBlockChange(e.target.value)}
                      disabled={!selectedDestYardId || modalBlocks.length === 0}
                      className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-[#D49A24] disabled:opacity-50"
                    >
                      <option value="">
                        {!selectedDestYardId
                          ? 'Select yard first...'
                          : modalBlocks.length === 0
                          ? 'No active blocks in this yard'
                          : 'Select Block...'}
                      </option>
                      {modalBlocks.map(b => (
                        <option key={b.yard_block_id} value={b.yard_block_id}>
                          Block {b.yard_block_code} — {b.yard_block_name} ({b.available_capacity} free)
                        </option>
                      ))}
                    </select>
                  )}
                  {selectedDestYardId && !loadingBlocks && !blockLoadError && modalBlocks.length === 0 && (
                    <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">
                      This yard currently has no active operational blocks configured. Please select another yard.
                    </p>
                  )}
                </div>
              </div>

              {/* Destination Slot Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                  Destination Coordinate Slot *
                </label>
                {loadingAvailableSlots ? (
                  <div className="p-3 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-800 rounded-xl">
                    Loading available storage slots...
                  </div>
                ) : (
                  <select
                    id="relocation-destination-slot"
                    value={selectedDestSlotId}
                    onChange={(e) => setSelectedDestSlotId(e.target.value)}
                    disabled={!selectedDestBlockId || modalAvailableSlots.length === 0}
                    className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-[#D49A24] disabled:opacity-50"
                  >
                    <option value="">
                      {!selectedDestBlockId
                        ? 'Select block first...'
                        : modalAvailableSlots.length === 0
                        ? 'No available slots in this block'
                        : 'Select Available Slot (Row, Bay, Tier)...'}
                    </option>
                    {modalAvailableSlots.map(s => (
                      <option key={s.yard_slot_id} value={s.yard_slot_id}>
                        Slot {s.yard_slot_code} • Row {s.yard_slot_row}, Bay {s.yard_slot_bay}, Tier {s.yard_slot_tier} [AVAILABLE]
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {/* HANDLING EQUIPMENT SELECTOR */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="relocation-equipment-selector" className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Handling Equipment (Optional)
                </label>
                <span className="text-[10px] text-slate-400 font-normal">Compatible Yard Cranes (RTG / RMG / MHC)</span>
              </div>
              <select
                id="relocation-equipment-selector"
                value={selectedCraneId}
                onChange={(e) => setSelectedCraneId(e.target.value)}
                disabled={loadingEquipment}
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-[#D49A24]"
              >
                <option value="">-- No equipment selected (Manual / External) --</option>
                {compatibleYardEquipment.map((eq) => (
                  <option key={eq.crane_id} value={eq.crane_id}>
                    {eq.crane_code} — {eq.crane_name} ({eq.crane_type_display || eq.crane_type}) • Capacity: {eq.crane_max_lifting_capacity_mt} {eq.crane_capacity_unit || 'MT'} [{eq.crane_status}]
                  </option>
                ))}
              </select>
              {compatibleYardEquipment.length === 0 && !loadingEquipment && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">
                  No operational RTG, RMG, or MHC yard equipment currently available. You may proceed without equipment assignment if permitted.
                </p>
              )}
            </div>

            {/* REMARKS INPUT */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                Movement Reason / Remarks (Optional)
              </label>
              <textarea
                rows={2}
                placeholder="e.g., Stacking re-optimization, customs transfer, block maintenance..."
                value={relocationRemarks}
                onChange={(e) => setRelocationRemarks(e.target.value)}
                className="w-full px-3.5 py-2 text-xs sm:text-sm rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-[#D49A24]"
              />
            </div>

            {/* COMPLIANCE & SAFETY NOTICE */}
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-300">
              <Info className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
              <span>
                Relocating will release current slot <strong>{containerToRelocate.current_location?.slot_code}</strong> back to AVAILABLE status, occupy the destination slot, atomically update block occupancies, and record an immutable movement audit trail.
              </span>
            </div>
          </div>
        )}
      </Modal>

      {/* ===================================================================== */}
      {/* MODAL: CONTAINER LOCATION DETAILS                                     */}
      {/* ===================================================================== */}
      <Modal
        isOpen={!!selectedContainerDetail}
        onClose={() => setSelectedContainerDetail(null)}
        title={
          <div className="flex items-center gap-2">
            <Boxes className="w-5 h-5 text-[#D49A24]" />
            <span>Container Location Dossier</span>
          </div>
        }
        subtitle={selectedContainerDetail?.container_number}
        maxWidth="lg"
      >
        {selectedContainerDetail && (
          <div className="space-y-4 py-2 text-xs text-slate-600 dark:text-slate-300">
            <div className="grid grid-cols-2 gap-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60">
              <div>
                <span className="text-slate-400">Container Type:</span>
                <p className="font-bold text-slate-800 dark:text-white">{selectedContainerDetail.container_type}</p>
              </div>
              <div>
                <span className="text-slate-400">Gross Weight:</span>
                <p className="font-bold text-slate-800 dark:text-white">{selectedContainerDetail.container_gross_weight} MT</p>
              </div>
              <div>
                <span className="text-slate-400">Core Status:</span>
                <p className="font-bold text-slate-800 dark:text-white">{selectedContainerDetail.container_status}</p>
              </div>
              <div>
                <span className="text-slate-400">Storage Status:</span>
                <div className="mt-1">{renderStorageStatusBadge(selectedContainerDetail.storage_status, selectedContainerDetail.storage_status_display)}</div>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
              <h5 className="font-bold text-slate-900 dark:text-white">Active Yard Placement</h5>
              {selectedContainerDetail.current_location ? (
                <div className="space-y-1.5 font-mono">
                  <p><strong>Yard:</strong> {selectedContainerDetail.current_location.yard_name} ({selectedContainerDetail.current_location.yard_code})</p>
                  <p><strong>Block:</strong> {selectedContainerDetail.current_location.block_name} ({selectedContainerDetail.current_location.block_code})</p>
                  <p><strong>Slot Code:</strong> {selectedContainerDetail.current_location.slot_code}</p>
                  <p><strong>Coordinates:</strong> Row {selectedContainerDetail.current_location.slot_row}, Bay {selectedContainerDetail.current_location.slot_bay}, Tier {selectedContainerDetail.current_location.slot_tier}</p>
                  <p><strong>Allocated At:</strong> {selectedContainerDetail.current_location.allocated_at ? new Date(selectedContainerDetail.current_location.allocated_at).toLocaleString() : 'N/A'}</p>
                  <p><strong>Operator:</strong> {selectedContainerDetail.current_location.allocated_by_name || 'Terminal Operator'}</p>
                </div>
              ) : (
                <p className="italic text-slate-400">Container currently has no active storage slot allocated.</p>
              )}
            </div>
          </div>
        )}
      </Modal>

    </div>
  );
};
