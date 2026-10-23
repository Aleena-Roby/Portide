import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Ship,
  Anchor,
  Boxes,
  Warehouse,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Clock,
  Search,
  Filter,
  RefreshCw,
  ArrowDownToLine,
  ChevronRight,
  ShieldAlert,
  SlidersHorizontal,
  Info,
  Calendar,
  Layers,
  ArrowRight,
  Check,
  Truck,
  ArrowUpFromLine
} from 'lucide-react';
import { apiFetch } from '../../../services/api';
import { useApp } from '../../../context/AppContext';
import { Modal } from '../../common/Modal';
import { DirectShipToTruckOperations } from './DirectShipToTruckOperations';
import {
  EligibleUnloadingVessel,
  ActiveUnloadingCrane,
  ManifestUnloadingContainer,
  AvailableSlotItem,
  YardItem,
  YardBlockItem,
  UnloadingHistoryItem
} from '../../../types';

interface UnloadingOperationsProps {
  initialTab?: 'discharge' | 'direct_transfer' | 'history';
  onNavigate?: (tab: string) => void;
}

export const UnloadingOperations: React.FC<UnloadingOperationsProps> = ({ 
  initialTab = 'discharge',
  onNavigate
}) => {
  const { addToast } = useApp();

  // Navigation tab: 'discharge' | 'history' (direct_transfer hidden from navigation)
  const [activeTab, setActiveTab] = useState<'discharge' | 'direct_transfer' | 'history'>(
    initialTab === 'direct_transfer' ? 'discharge' : initialTab
  );

  // Operational State
  const [vessels, setVessels] = useState<EligibleUnloadingVessel[]>([]);
  const [selectedVessel, setSelectedVessel] = useState<EligibleUnloadingVessel | null>(null);
  const [loadingVessels, setLoadingVessels] = useState<boolean>(false);

  const [cranes, setCranes] = useState<ActiveUnloadingCrane[]>([]);
  const [selectedCrane, setSelectedCrane] = useState<ActiveUnloadingCrane | null>(null);
  const [loadingCranes, setLoadingCranes] = useState<boolean>(false);

  const [containers, setContainers] = useState<ManifestUnloadingContainer[]>([]);
  const [selectedContainer, setSelectedContainer] = useState<ManifestUnloadingContainer | null>(null);
  const [containerSearch, setContainerSearch] = useState<string>('');
  const [loadingContainers, setLoadingContainers] = useState<boolean>(false);

  // Destination Yard Slot Selection
  const [yards, setYards] = useState<YardItem[]>([]);
  const [selectedYardId, setSelectedYardId] = useState<string>('');
  const [selectedBlockId, setSelectedBlockId] = useState<string>('');
  const [availableSlots, setAvailableSlots] = useState<AvailableSlotItem[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlotItem | null>(null);
  const [loadingSlots, setLoadingSlots] = useState<boolean>(false);

  const [remarks, setRemarks] = useState<string>('');
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState<boolean>(false);
  const [executingDischarge, setExecutingDischarge] = useState<boolean>(false);

  // History State
  const [historyItems, setHistoryItems] = useState<UnloadingHistoryItem[]>([]);
  const [historySearch, setHistorySearch] = useState<string>('');
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);

  // =========================================================================
  // DATA FETCHING & RESPONSE PARSING
  // =========================================================================

  // Helper to parse and validate native fetch Response envelope from apiFetch
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

  // Fetch Berthed Vessels
  const fetchEligibleVessels = useCallback(async () => {
    setLoadingVessels(true);
    try {
      const res = await apiFetch('/api/terminal/unloading/eligible-vessels/');
      const data = await parseApiResponse(res);
      if (data && data.status === 'success' && Array.isArray(data.data)) {
        setVessels(data.data);
        setSelectedVessel((prevSelected) => {
          if (!prevSelected) return null;
          const updated = data.data.find(
            (v: EligibleUnloadingVessel) => v.vessel_schedule_id === prevSelected.vessel_schedule_id
          );
          return updated || prevSelected;
        });
      } else {
        throw new Error('Invalid response envelope from server.');
      }
    } catch (err: any) {
      console.error('Failed to load eligible unloading vessels:', err);
      addToast(
        'error',
        'Vessels Load Error',
        err.message || 'Unable to fetch berthed vessels for unloading.'
      );
    } finally {
      setLoadingVessels(false);
    }
  }, [addToast]);

  // Fetch Cranes when Vessel changes
  const fetchActiveCranes = useCallback(async (vesselScheduleId: number) => {
    setLoadingCranes(true);
    try {
      const res = await apiFetch(`/api/terminal/unloading/active-cranes/?vessel_schedule_id=${vesselScheduleId}`);
      const data = await parseApiResponse(res);
      if (data && data.status === 'success' && Array.isArray(data.data)) {
        setCranes(data.data);
        setSelectedCrane((prevCrane) => {
          if (data.data.length === 1) {
            return data.data[0];
          }
          if (prevCrane) {
            const updated = data.data.find(
              (c: ActiveUnloadingCrane) => c.crane_allocation_id === prevCrane.crane_allocation_id
            );
            return updated || prevCrane;
          }
          return null;
        });
      } else {
        throw new Error('Invalid response envelope from server.');
      }
    } catch (err: any) {
      console.error('Failed to load active cranes:', err);
      addToast(
        'error',
        'Cranes Load Error',
        err.message || 'Unable to fetch active cranes for this vessel.'
      );
    } finally {
      setLoadingCranes(false);
    }
  }, [addToast]);

  // Fetch Manifest Containers when Vessel changes
  const fetchManifestContainers = useCallback(async (vesselScheduleId: number) => {
    setLoadingContainers(true);
    try {
      let url = `/api/terminal/unloading/manifest-containers/?vessel_schedule_id=${vesselScheduleId}`;
      if (containerSearch.trim()) {
        url += `&search=${encodeURIComponent(containerSearch.trim())}`;
      }
      const res = await apiFetch(url);
      const data = await parseApiResponse(res);
      if (data && data.status === 'success' && Array.isArray(data.data)) {
        setContainers(data.data);
        setSelectedContainer((prevContainer) => {
          if (!prevContainer) return null;
          const updated = data.data.find(
            (c: ManifestUnloadingContainer) => c.container_id === prevContainer.container_id
          );
          return updated || prevContainer;
        });
      } else {
        throw new Error('Invalid response envelope from server.');
      }
    } catch (err: any) {
      console.error('Failed to load manifest containers:', err);
      addToast(
        'error',
        'Manifest Load Error',
        err.message || 'Unable to fetch manifest containers for discharge.'
      );
    } finally {
      setLoadingContainers(false);
    }
  }, [containerSearch, addToast]);

  // Fetch Yards for Slot selection
  const fetchYards = useCallback(async () => {
    try {
      const res = await apiFetch('/api/terminal/yards/');
      const data = await parseApiResponse(res);
      if (data && data.status === 'success' && Array.isArray(data.data)) {
        const activeYards = data.data.filter((y: YardItem) => y.yard_status === 'ACTIVE');
        setYards(activeYards);
        setSelectedYardId((prevYardId) => {
          if (prevYardId && activeYards.some((y: YardItem) => String(y.yard_id) === prevYardId)) {
            return prevYardId;
          }
          return activeYards.length > 0 ? String(activeYards[0].yard_id) : '';
        });
      } else {
        throw new Error('Invalid response envelope from server.');
      }
    } catch (err: any) {
      console.error('Failed to load yards:', err);
      addToast('error', 'Yard Load Error', err.message || 'Unable to fetch terminal yards.');
    }
  }, [addToast]);

  // Fetch Available Slots
  const fetchAvailableSlots = useCallback(async () => {
    if (!selectedYardId) {
      setAvailableSlots([]);
      return;
    }
    setLoadingSlots(true);
    try {
      const params = new URLSearchParams();
      params.append('yard_id', selectedYardId);
      if (selectedBlockId) params.append('block_id', selectedBlockId);
      const url = `/api/terminal/yard-allocations/available-slots/?${params.toString()}`;

      const res = await apiFetch(url);
      const data = await parseApiResponse(res);
      if (data && data.status === 'success' && Array.isArray(data.data)) {
        setAvailableSlots(data.data);
        setSelectedSlot((prevSlot) => {
          if (!prevSlot) return null;
          const match = data.data.find((s: AvailableSlotItem) => s.slot_id === prevSlot.slot_id);
          return match || prevSlot;
        });
      } else {
        throw new Error('Invalid response envelope from server.');
      }
    } catch (err: any) {
      console.error('Failed to load available slots:', err);
      addToast('error', 'Slots Load Error', err.message || 'Unable to fetch available yard slots.');
    } finally {
      setLoadingSlots(false);
    }
  }, [selectedYardId, selectedBlockId, addToast]);

  // Fetch Discharge History
  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await apiFetch('/api/terminal/unloading/history/');
      const data = await parseApiResponse(res);
      if (data && data.status === 'success' && Array.isArray(data.data)) {
        setHistoryItems(data.data);
      } else {
        throw new Error('Invalid response envelope from server.');
      }
    } catch (err: any) {
      console.error('Failed to load unloading history:', err);
      addToast('error', 'History Load Error', err.message || 'Unable to fetch unloading history.');
    } finally {
      setLoadingHistory(false);
    }
  }, [addToast]);

  // Initial load
  useEffect(() => {
    fetchEligibleVessels();
    fetchYards();
    fetchHistory();
  }, [fetchEligibleVessels, fetchYards, fetchHistory]);

  // Re-fetch cranes and containers when selected vessel changes
  useEffect(() => {
    if (selectedVessel) {
      fetchActiveCranes(selectedVessel.vessel_schedule_id);
      fetchManifestContainers(selectedVessel.vessel_schedule_id);
    } else {
      setCranes([]);
      setSelectedCrane(null);
      setContainers([]);
      setSelectedContainer(null);
    }
  }, [selectedVessel?.vessel_schedule_id, fetchActiveCranes, fetchManifestContainers]);

  // Re-fetch slots when yard or block changes
  useEffect(() => {
    fetchAvailableSlots();
  }, [selectedYardId, selectedBlockId, fetchAvailableSlots]);

  // Blocks for selected Yard
  const availableBlocks = useMemo(() => {
    if (!selectedYardId) return [];
    const yard = yards.find((y) => String(y.yard_id) === selectedYardId);
    if (!yard || !Array.isArray(yard.blocks)) return [];
    return yard.blocks.filter((b: YardBlockItem) => b.yard_block_status === 'ACTIVE');
  }, [yards, selectedYardId]);

  // Filtered containers
  const filteredContainers = useMemo(() => {
    if (!containerSearch.trim()) return containers;
    const q = containerSearch.trim().toLowerCase();
    return containers.filter((c) =>
      c.container_number.toLowerCase().includes(q) ||
      c.cargo_description.toLowerCase().includes(q)
    );
  }, [containers, containerSearch]);

  // Filtered history
  const filteredHistory = useMemo(() => {
    if (!historySearch.trim()) return historyItems;
    const q = historySearch.trim().toLowerCase();
    return historyItems.filter((h) =>
      h.container_number.toLowerCase().includes(q) ||
      (h.crane_code && h.crane_code.toLowerCase().includes(q)) ||
      h.to_location_display.toLowerCase().includes(q)
    );
  }, [historyItems, historySearch]);

  // =========================================================================
  // DISCHARGE EXECUTION
  // =========================================================================

  const handleExecuteDischarge = async () => {
    if (!selectedVessel || !selectedCrane || !selectedContainer || !selectedSlot) {
      addToast(
        'error',
        'Incomplete Selection',
        'Please select a berthed vessel, an active crane, a manifested container, and a destination yard slot.'
      );
      return;
    }

    setExecutingDischarge(true);
    try {
      const payload = {
        vessel_schedule_id: selectedVessel.vessel_schedule_id,
        crane_allocation_id: selectedCrane.crane_allocation_id,
        container_id: selectedContainer.container_id,
        slot_id: selectedSlot.slot_id,
        remarks: remarks.trim()
      };

      const res = await apiFetch('/api/terminal/unloading/discharge/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await parseApiResponse(res);

      if (data && data.status === 'success') {
        addToast(
          'success',
          'Container Discharged',
          data.message || `Container ${selectedContainer.container_number} successfully placed into slot ${selectedSlot.slot_code}.`
        );
        setIsConfirmModalOpen(false);
        setSelectedContainer(null);
        setSelectedSlot(null);
        setRemarks('');

        // Refresh all affected operational data
        fetchEligibleVessels();
        if (selectedVessel) {
          fetchManifestContainers(selectedVessel.vessel_schedule_id);
        }
        fetchAvailableSlots();
        fetchHistory();
      } else {
        throw new Error(data?.message || 'Failed to discharge container.');
      }
    } catch (err: any) {
      console.error('Discharge execution failed:', err);
      addToast(
        'error',
        'Discharge Failed',
        err.message || 'Backend transaction failed. Operation rolled back.'
      );
    } finally {
      setExecutingDischarge(false);
    }
  };

  return (
    <div className="space-y-6 font-sans selection:bg-[#D49A24] selection:text-white animate-fade-in">
      {/* HEADER SECTION */}
      <div className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold tracking-wide uppercase bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              Quay-to-Yard Coordinated Operations
            </span>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400">
              T4 Crane + T1/T2 Yard Integration
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
            <ArrowDownToLine className="w-8 h-8 text-[#D49A24]" />
            Container Unloading Operations
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-3xl">
            Coordinate physical vessel discharge using verified active quay crane allocations, manifest container validation, and atomic storage slot allocation.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              fetchEligibleVessels();
              if (selectedVessel) {
                fetchActiveCranes(selectedVessel.vessel_schedule_id);
                fetchManifestContainers(selectedVessel.vessel_schedule_id);
              }
              fetchAvailableSlots();
              fetchHistory();
            }}
            disabled={loadingVessels || loadingCranes || loadingContainers}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl transition-all disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingVessels || loadingCranes ? 'animate-spin' : ''}`} />
            Refresh Data
          </button>

          <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setActiveTab('discharge')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                activeTab === 'discharge'
                  ? 'bg-white dark:bg-slate-900 text-[#D49A24] shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Discharge Workflow
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                activeTab === 'history'
                  ? 'bg-white dark:bg-slate-900 text-[#D49A24] shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Discharge History
            </button>
          </div>

          {onNavigate && (
            <button
              onClick={() => onNavigate('loading-operations')}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-xl transition-all cursor-pointer"
              title="Switch to Vessel Loading / Stowage"
            >
              <ArrowUpFromLine className="w-3.5 h-3.5" />
              Loading Operations
            </button>
          )}
        </div>
      </div>

      {activeTab === 'discharge' && (
        <div className="space-y-6">
          {/* STEP 1: SELECT BERTHED VESSEL */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-sm">
                  1
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    Select Carrier Vessel at Berth
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Vessels currently berthed and verified in AT_BERTH schedule status.
                  </p>
                </div>
              </div>
              <span className="text-xs font-semibold text-slate-500">
                {vessels.length} vessel{vessels.length === 1 ? '' : 's'} available
              </span>
            </div>

            {loadingVessels ? (
              <div className="py-8 text-center text-slate-400">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-amber-500" />
                <p className="text-xs">Loading berthed vessels...</p>
              </div>
            ) : vessels.length === 0 ? (
              <div className="p-6 text-center rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-300 dark:border-slate-700">
                <Ship className="w-8 h-8 text-slate-400 mx-auto mb-2 opacity-50" />
                <p className="text-xs font-bold text-slate-600 dark:text-slate-300">No Vessels Currently at Berth</p>
                <p className="text-xs text-slate-400 mt-1">
                  Vessels must reach 'AT_BERTH' schedule status before quay discharge operations can commence.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {vessels.map((v) => {
                  const isSelected = selectedVessel?.vessel_schedule_id === v.vessel_schedule_id;
                  return (
                    <div
                      key={v.vessel_schedule_id}
                      onClick={() => {
                        setSelectedVessel(v);
                        setSelectedCrane(null);
                        setSelectedContainer(null);
                      }}
                      className={`p-4 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'border-amber-500 bg-amber-500/5 dark:bg-amber-500/10 shadow-sm'
                          : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                            <Ship className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                            {v.vessel_name}
                          </h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            IMO: {v.vessel_imo_number} • {v.shipping_company_name}
                          </p>
                        </div>
                        {isSelected && (
                          <span className="p-1 rounded-full bg-amber-500 text-white">
                            <Check className="w-3 h-3" />
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                        <div>
                          <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Berth</span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">{v.berth_name}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Active Cranes</span>
                          <span className={`font-semibold ${v.active_cranes_count > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                            {v.active_cranes_count} Active
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Manifest Load</span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {v.manifested_containers_count} Container{v.manifested_containers_count === 1 ? '' : 's'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Status</span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                            AT BERTH
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* STEP 2: SELECT CRANE & STEP 3: SELECT CONTAINER */}
          {selectedVessel && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* STEP 2: CRANE SELECTION */}
              <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-sm">
                      2
                    </div>
                    <div>
                      <h3 className="text-base font-black text-slate-900 dark:text-white">
                        Select Active Crane Allocation
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Quay cranes currently active and permitted for unloading.
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-slate-500">
                    {cranes.length} crane{cranes.length === 1 ? '' : 's'}
                  </span>
                </div>

                {loadingCranes ? (
                  <div className="py-8 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-amber-500" />
                    <p className="text-xs">Loading crane allocations...</p>
                  </div>
                ) : cranes.length === 0 ? (
                  <div className="p-5 text-center rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 space-y-3">
                    <AlertCircle className="w-6 h-6 text-amber-600 dark:text-amber-400 mx-auto" />
                    <div>
                      <p className="text-xs font-bold text-amber-900 dark:text-amber-200">No Active Unloading Crane</p>
                      <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                        No crane allocation is currently in 'ACTIVE' status for vessel '{selectedVessel.vessel_name}'.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {cranes.map((c) => {
                      const isSelected = selectedCrane?.crane_allocation_id === c.crane_allocation_id;
                      return (
                        <div
                          key={c.crane_allocation_id}
                          onClick={() => setSelectedCrane(c)}
                          className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                            isSelected
                              ? 'border-amber-500 bg-amber-500/5 dark:bg-amber-500/10 shadow-sm'
                              : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:border-slate-300 dark:hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
                                🏗️
                              </div>
                              <div>
                                <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                                  {c.crane_code} — {c.crane_name}
                                </h4>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                  {c.crane_type_display} • Max Lift: {c.crane_max_lifting_capacity_mt} MT
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                {c.operation_type_display}
                              </span>
                              {isSelected && (
                                <span className="p-1 rounded-full bg-amber-500 text-white">
                                  <Check className="w-3 h-3" />
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* STEP 3: CONTAINER SELECTION */}
              <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-sm">
                      3
                    </div>
                    <div>
                      <h3 className="text-base font-black text-slate-900 dark:text-white">
                        Select Manifested Container
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Inbound container aboard '{selectedVessel.vessel_name}' awaiting discharge.
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-slate-500">
                    {filteredContainers.length} container{filteredContainers.length === 1 ? '' : 's'}
                  </span>
                </div>

                {/* Search */}
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    value={containerSearch}
                    onChange={(e) => setContainerSearch(e.target.value)}
                    placeholder="Search by container number or cargo..."
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                {loadingContainers ? (
                  <div className="py-8 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-amber-500" />
                    <p className="text-xs">Loading manifested containers...</p>
                  </div>
                ) : filteredContainers.length === 0 ? (
                  <div className="p-5 text-center rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-300 dark:border-slate-700">
                    <Boxes className="w-6 h-6 text-slate-400 mx-auto mb-2 opacity-50" />
                    <p className="text-xs font-bold text-slate-600 dark:text-slate-300">No Containers Awaiting Discharge</p>
                    <p className="text-xs text-slate-400 mt-1">
                      All manifested containers for this voyage have already been discharged or allocated.
                    </p>
                  </div>
                ) : (
                  <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                    {filteredContainers.map((c) => {
                      const isSelected = selectedContainer?.container_id === c.container_id;
                      return (
                        <div
                          key={c.container_id}
                          onClick={() => setSelectedContainer(c)}
                          className={`p-3 rounded-xl border transition-all cursor-pointer ${
                            isSelected
                              ? 'border-amber-500 bg-amber-500/5 dark:bg-amber-500/10 shadow-sm'
                              : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:border-slate-300 dark:hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-black text-xs font-mono text-slate-900 dark:text-white tracking-wide">
                                  {c.container_number}
                                </span>
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                                  {c.container_type} ({c.teu_equivalent} TEU)
                                </span>
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 flex items-center gap-1">
                                  <span>📥</span> IMPORT
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                Weight: {c.container_gross_weight} MT • {c.cargo_description || 'General Cargo'}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400">
                                {c.customs_status_display}
                              </span>
                              {isSelected && (
                                <span className="p-1 rounded-full bg-amber-500 text-white">
                                  <Check className="w-3 h-3" />
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 4: DESTINATION YARD SLOT SELECTION */}
          {selectedVessel && selectedCrane && selectedContainer && (
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-sm">
                    4
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900 dark:text-white">
                      Select Destination Yard Storage Slot
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Target coordinate slot for container placement ({selectedContainer.container_type}, {selectedContainer.teu_equivalent} TEU).
                    </p>
                  </div>
                </div>
                <span className="text-xs font-semibold text-slate-500">
                  {availableSlots.length} slot{availableSlots.length === 1 ? '' : 's'} available
                </span>
              </div>

              {/* Filters for Yard and Block */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                    Terminal Yard
                  </label>
                  <select
                    value={selectedYardId}
                    onChange={(e) => {
                      setSelectedYardId(e.target.value);
                      setSelectedBlockId('');
                      setSelectedSlot(null);
                    }}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-1 focus:ring-amber-500"
                  >
                    {yards.map((y) => (
                      <option key={y.yard_id} value={String(y.yard_id)}>
                        {y.yard_name} ({y.yard_code}) — {y.yard_occupied}/{y.yard_capacity} TEU
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                    Yard Block
                  </label>
                  <select
                    value={selectedBlockId}
                    onChange={(e) => {
                      setSelectedBlockId(e.target.value);
                      setSelectedSlot(null);
                    }}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-1 focus:ring-amber-500"
                  >
                    <option value="">All Operational Blocks</option>
                    {availableBlocks.map((b) => (
                      <option key={b.yard_block_id} value={String(b.yard_block_id)}>
                        {b.yard_block_name} ({b.yard_block_code}) — {b.yard_block_type}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Slot Cards Grid */}
              {loadingSlots ? (
                <div className="py-8 text-center text-slate-400">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-amber-500" />
                  <p className="text-xs">Loading available slots...</p>
                </div>
              ) : availableSlots.length === 0 ? (
                <div className="p-5 text-center rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40">
                  <AlertCircle className="w-6 h-6 text-amber-600 dark:text-amber-400 mx-auto mb-2" />
                  <p className="text-xs font-bold text-amber-900 dark:text-amber-200">No Operational Slots Available</p>
                  <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                    Selected yard/block has reached capacity or has no available operational slots.
                  </p>
                </div>
              ) : (
                <div className="max-h-60 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5 p-1">
                  {availableSlots.map((s) => {
                    const isSelected = selectedSlot?.slot_id === s.slot_id;
                    return (
                      <div
                        key={s.slot_id}
                        onClick={() => setSelectedSlot(s)}
                        className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                          isSelected
                            ? 'border-amber-500 bg-amber-500/10 dark:bg-amber-500/20 shadow-sm'
                            : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                      >
                        <div className="font-mono font-bold text-xs text-slate-900 dark:text-white mb-0.5">
                          {s.slot_code}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          R{s.slot_row} • B{s.slot_bay} • T{s.slot_tier}
                        </div>
                        <div className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold mt-1">
                          {s.block_code}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* STEP 5: REVIEW & DISCHARGE ACTION */}
          {selectedVessel && selectedCrane && selectedContainer && selectedSlot && (
            <div className="p-6 sm:p-7 rounded-2xl bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border-2 border-amber-500/40 dark:border-amber-500/30 shadow-md space-y-5 animate-fade-in">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-amber-500" />
                    Review Coordinated Discharge Plan
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Verify complete operational parameters prior to atomic database commit.
                  </p>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500 text-white shadow-xs">
                  Ready to Discharge
                </span>
              </div>

              {/* Review Summary Grid */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 backdrop-blur-xs text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider mb-1">
                    Carrier Vessel & Berth
                  </span>
                  <div className="font-bold text-slate-900 dark:text-white text-sm">
                    {selectedVessel.vessel_name}
                  </div>
                  <div className="text-slate-500 text-[11px]">
                    Berth: {selectedVessel.berth_name}
                  </div>
                </div>

                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider mb-1">
                    Quay Crane Equipment
                  </span>
                  <div className="font-bold text-slate-900 dark:text-white text-sm">
                    {selectedCrane.crane_code}
                  </div>
                  <div className="text-slate-500 text-[11px]">
                    {selectedCrane.crane_type_display} ({selectedCrane.crane_max_lifting_capacity_mt} MT)
                  </div>
                </div>

                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider mb-1">
                    Container To Discharge
                  </span>
                  <div className="font-mono font-black text-slate-900 dark:text-white text-sm">
                    {selectedContainer.container_number}
                  </div>
                  <div className="text-slate-500 text-[11px] flex items-center gap-1.5 mt-0.5">
                    <span>{selectedContainer.container_type} • {selectedContainer.container_gross_weight} MT</span>
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                      📥 IMPORT
                    </span>
                  </div>
                </div>

                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider mb-1">
                    Destination Yard Coordinate
                  </span>
                  <div className="font-mono font-bold text-amber-600 dark:text-amber-400 text-sm">
                    {selectedSlot.location_display}
                  </div>
                  <div className="text-slate-500 text-[11px]">
                    Slot #{selectedSlot.slot_id} (R{selectedSlot.slot_row}/B{selectedSlot.slot_bay}/T{selectedSlot.slot_tier})
                  </div>
                </div>
              </div>

              {/* Optional Remarks */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Operational Remarks (Optional)
                </label>
                <input
                  type="text"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="e.g., Routine quay crane discharge under morning shift..."
                  className="w-full px-3.5 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              {/* Action Button */}
              <div className="flex justify-end">
                <button
                  onClick={() => setIsConfirmModalOpen(true)}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[#D49A24] hover:bg-[#b8821a] text-white font-bold text-sm shadow-md transition-all cursor-pointer hover:shadow-lg"
                >
                  <ArrowDownToLine className="w-4 h-4" />
                  Execute Vessel Discharge
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* DIRECT SHIP-TO-TRUCK WORKFLOW TAB */}
      {activeTab === 'direct_transfer' && (
        <DirectShipToTruckOperations />
      )}

      {/* DISCHARGE HISTORY TAB */}
      {activeTab === 'history' && (
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                Vessel Discharge Operations History
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Verified audit trail of containers discharged from vessel to terminal yard slots.
              </p>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder="Search history by container or slot..."
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
          </div>

          {loadingHistory ? (
            <div className="py-12 text-center text-slate-400">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-amber-500" />
              <p className="text-xs">Loading discharge history...</p>
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="py-12 text-center rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-300 dark:border-slate-700">
              <Boxes className="w-8 h-8 text-slate-400 mx-auto mb-2 opacity-50" />
              <p className="text-xs font-bold text-slate-600 dark:text-slate-300">No Vessel Discharges Recorded</p>
              <p className="text-xs text-slate-400 mt-1">
                Completed vessel discharges will appear here with equipment and timestamp traceability.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase text-[10px] font-bold tracking-wider">
                    <th className="py-3 px-3">Timestamp</th>
                    <th className="py-3 px-3">Container Number</th>
                    <th className="py-3 px-3">ISO Type</th>
                    <th className="py-3 px-3">Operation</th>
                    <th className="py-3 px-3">Crane</th>
                    <th className="py-3 px-3">Yard Destination</th>
                    <th className="py-3 px-3">Operator</th>
                    <th className="py-3 px-3">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {filteredHistory.map((item) => (
                    <tr key={item.yard_movement_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-3 text-slate-500 whitespace-nowrap">
                        {new Date(item.movement_timestamp).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-slate-900 dark:text-white">
                        {item.container_number}
                      </td>
                      <td className="py-3 px-3 text-slate-600 dark:text-slate-300">
                        {item.container_type_display}
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                          DISCHARGE
                        </span>
                      </td>
                      <td className="py-3 px-3 font-semibold text-slate-800 dark:text-slate-200">
                        {item.crane_code ? `${item.crane_code}` : 'N/A'}
                      </td>
                      <td className="py-3 px-3 font-mono font-medium text-amber-600 dark:text-amber-400">
                        {item.to_location_display}
                      </td>
                      <td className="py-3 px-3 text-slate-600 dark:text-slate-400">
                        {item.moved_by_name}
                      </td>
                      <td className="py-3 px-3 text-slate-500 max-w-xs truncate" title={item.remarks}>
                        {item.remarks || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* CONFIRMATION MODAL */}
      <Modal
        isOpen={isConfirmModalOpen}
        onClose={() => {
          if (!executingDischarge) setIsConfirmModalOpen(false);
        }}
        title="Confirm Vessel Container Discharge"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            You are about to commit an atomic vessel container discharge. Please confirm the operational parameters below:
          </p>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400 font-semibold">Carrier Vessel:</span>
              <span className="font-bold text-slate-900 dark:text-white">{selectedVessel?.vessel_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400 font-semibold">Quay Crane:</span>
              <span className="font-bold text-slate-900 dark:text-white">{selectedCrane?.crane_code}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400 font-semibold">Container:</span>
              <span className="font-mono font-black text-slate-900 dark:text-white">{selectedContainer?.container_number}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400 font-semibold">Destination Slot:</span>
              <span className="font-mono font-bold text-amber-600 dark:text-amber-400">{selectedSlot?.location_display}</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300">
            <strong>Atomic Transaction Details:</strong>
            <ul className="list-disc list-inside mt-1 space-y-0.5 text-[11px]">
              <li>Container lifecycle transitions strictly to <span className="font-bold">AT_TERMINAL</span>.</li>
              <li>Yard slot is marked <span className="font-bold">OCCUPIED</span> and block capacity is updated.</li>
              <li>Append-only <span className="font-bold">DISCHARGE</span> movement history record is created.</li>
              <li>Customs inspection workflow remains fully intact and unbypassed.</li>
            </ul>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setIsConfirmModalOpen(false)}
              disabled={executingDischarge}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleExecuteDischarge}
              disabled={executingDischarge}
              className="flex items-center gap-2 px-5 py-2 text-xs font-bold bg-[#D49A24] hover:bg-[#b8821a] text-white rounded-xl transition-all disabled:opacity-50 cursor-pointer"
            >
              {executingDischarge ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Executing Discharge...
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  Confirm & Discharge
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
