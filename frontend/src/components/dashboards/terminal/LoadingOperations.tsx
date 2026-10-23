import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Ship,
  Boxes,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Clock,
  Search,
  RefreshCw,
  ArrowUpFromLine,
  Check,
  ArrowDownToLine,
  Anchor,
  SlidersHorizontal
} from 'lucide-react';
import { apiFetch } from '../../../services/api';
import { useApp } from '../../../context/AppContext';
import { Modal } from '../../common/Modal';
import {
  EligibleLoadingVessel,
  YardLoadingContainer,
  LoadingHistoryItem
} from '../../../types';

interface LoadingOperationsProps {
  initialTab?: 'loading' | 'history';
  onNavigate?: (tab: string) => void;
}

export const LoadingOperations: React.FC<LoadingOperationsProps> = ({
  initialTab = 'loading',
  onNavigate
}) => {
  const { addToast } = useApp();

  const [activeTab, setActiveTab] = useState<'loading' | 'history'>(initialTab);

  // Operational State
  const [vessels, setVessels] = useState<EligibleLoadingVessel[]>([]);
  const [selectedVessel, setSelectedVessel] = useState<EligibleLoadingVessel | null>(null);
  const [loadingVessels, setLoadingVessels] = useState<boolean>(false);

  const [containers, setContainers] = useState<YardLoadingContainer[]>([]);
  const [selectedContainer, setSelectedContainer] = useState<YardLoadingContainer | null>(null);
  const [containerSearch, setContainerSearch] = useState<string>('');
  const [loadingContainers, setLoadingContainers] = useState<boolean>(false);

  const [remarks, setRemarks] = useState<string>('');
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState<boolean>(false);
  const [executingLoading, setExecutingLoading] = useState<boolean>(false);

  // History State
  const [historyItems, setHistoryItems] = useState<LoadingHistoryItem[]>([]);
  const [historySearch, setHistorySearch] = useState<string>('');
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);

  // =========================================================================
  // API HELPER
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

  // =========================================================================
  // DATA FETCHING
  // =========================================================================

  // 1. Fetch Berthed Vessels
  const fetchEligibleVessels = useCallback(async () => {
    setLoadingVessels(true);
    try {
      const res = await apiFetch('/api/terminal/loading/eligible-vessels/');
      const data = await parseApiResponse(res);
      if (data && data.status === 'success' && Array.isArray(data.data)) {
        setVessels(data.data);
        setSelectedVessel((prevSelected) => {
          if (!prevSelected) return null;
          const match = data.data.find(
            (v: EligibleLoadingVessel) => v.vessel_schedule_id === prevSelected.vessel_schedule_id
          );
          return match || prevSelected;
        });
      }
    } catch (err: any) {
      console.error('Failed to load eligible vessels for loading:', err);
      addToast('error', 'Vessels Load Error', err.message || 'Unable to fetch berthed vessels.');
    } finally {
      setLoadingVessels(false);
    }
  }, [addToast]);

  // 2. Fetch Yard Containers
  const fetchYardContainers = useCallback(async (vesselScheduleId?: number) => {
    setLoadingContainers(true);
    try {
      let url = '/api/terminal/loading/yard-containers/';
      const params = new URLSearchParams();
      if (vesselScheduleId) params.append('vessel_schedule_id', String(vesselScheduleId));
      if (containerSearch.trim()) params.append('search', containerSearch.trim());
      if (params.toString()) url += `?${params.toString()}`;

      const res = await apiFetch(url);
      const data = await parseApiResponse(res);
      if (data && data.status === 'success' && Array.isArray(data.data)) {
        setContainers(data.data);
        setSelectedContainer((prev) => {
          if (!prev) return null;
          const match = data.data.find((c: YardLoadingContainer) => c.container_id === prev.container_id);
          return match || prev;
        });
      }
    } catch (err: any) {
      console.error('Failed to load yard containers for loading:', err);
      addToast('error', 'Yard Containers Error', err.message || 'Unable to fetch yard containers.');
    } finally {
      setLoadingContainers(false);
    }
  }, [containerSearch, addToast]);

  // 3. Fetch Loading History
  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await apiFetch('/api/terminal/loading/history/');
      const data = await parseApiResponse(res);
      if (data && data.status === 'success' && Array.isArray(data.data)) {
        setHistoryItems(data.data);
      }
    } catch (err: any) {
      console.error('Failed to load loading history:', err);
      addToast('error', 'History Error', err.message || 'Unable to fetch loading history.');
    } finally {
      setLoadingHistory(false);
    }
  }, [addToast]);

  // Initial load
  useEffect(() => {
    fetchEligibleVessels();
    fetchHistory();
  }, [fetchEligibleVessels, fetchHistory]);

  // Re-fetch yard containers when selected vessel changes
  useEffect(() => {
    if (selectedVessel) {
      fetchYardContainers(selectedVessel.vessel_schedule_id);
    } else {
      setContainers([]);
      setSelectedContainer(null);
    }
  }, [selectedVessel?.vessel_schedule_id, fetchYardContainers]);

  // Filtered containers
  const filteredContainers = useMemo(() => {
    if (!containerSearch.trim()) return containers;
    const q = containerSearch.trim().toLowerCase();
    return containers.filter(
      (c) =>
        c.container_number.toLowerCase().includes(q) ||
        c.cargo_description.toLowerCase().includes(q) ||
        c.location_display.toLowerCase().includes(q)
    );
  }, [containers, containerSearch]);

  // Filtered history
  const filteredHistory = useMemo(() => {
    if (!historySearch.trim()) return historyItems;
    const q = historySearch.trim().toLowerCase();
    return historyItems.filter(
      (h) =>
        h.container_number.toLowerCase().includes(q) ||
        (h.crane_code && h.crane_code.toLowerCase().includes(q)) ||
        h.from_location_display.toLowerCase().includes(q)
    );
  }, [historyItems, historySearch]);

  // =========================================================================
  // EXECUTE LOADING ACTION
  // =========================================================================
  const handleExecuteLoading = async () => {
    if (!selectedVessel || !selectedContainer) {
      addToast(
        'error',
        'Incomplete Selection',
        'Please select a berthed carrier vessel and a yard container to load.'
      );
      return;
    }

    setExecutingLoading(true);
    try {
      const payload = {
        vessel_schedule_id: selectedVessel.vessel_schedule_id,
        container_id: selectedContainer.container_id,
        slot_id: selectedContainer.slot_id,
        remarks: remarks.trim()
      };

      const res = await apiFetch('/api/terminal/loading/load/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await parseApiResponse(res);

      if (data && data.status === 'success') {
        addToast(
          'success',
          'Container Loaded onto Vessel',
          data.message || `Container ${selectedContainer.container_number} successfully stowed aboard ${selectedVessel.vessel_name}.`
        );
        setIsConfirmModalOpen(false);
        setSelectedContainer(null);
        setRemarks('');

        // Refresh all operational data
        fetchEligibleVessels();
        fetchYardContainers(selectedVessel?.vessel_schedule_id);
        fetchHistory();
      } else {
        throw new Error(data?.message || 'Failed to load container onto vessel.');
      }
    } catch (err: any) {
      console.error('Loading execution failed:', err);
      addToast('error', 'Loading Failed', err.message || 'Operation rolled back.');
    } finally {
      setExecutingLoading(false);
    }
  };

  return (
    <div className="space-y-6 font-sans selection:bg-[#D49A24] selection:text-white animate-fade-in">
      {/* HEADER SECTION */}
      <div className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold tracking-wide uppercase bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              Quay-to-Vessel Coordinated Operations
            </span>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              Vessel Stowage & Export Loading
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
            <ArrowUpFromLine className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
            Container Loading Operations
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-3xl">
            Coordinate physical vessel loading. Select yard-stored export containers, stow aboard the carrier vessel, and automatically release yard coordinates.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              fetchEligibleVessels();
              fetchYardContainers(selectedVessel?.vessel_schedule_id);
              fetchHistory();
            }}
            disabled={loadingVessels || loadingContainers}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl transition-all disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingVessels ? 'animate-spin' : ''}`} />
            Refresh Data
          </button>

          {/* Tab Switcher */}
          <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setActiveTab('loading')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                activeTab === 'loading'
                  ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Loading Workflow
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                activeTab === 'history'
                  ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Loading History
            </button>
          </div>

          {/* Quick link to Unloading */}
          <button
            onClick={() => onNavigate?.('unloading-operations')}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-[#D49A24] bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-xl transition-all cursor-pointer"
            title="Switch to Vessel Discharge"
          >
            <ArrowDownToLine className="w-3.5 h-3.5" />
            Unloading
          </button>
        </div>
      </div>

      {activeTab === 'loading' && (
        <div className="space-y-6">
          {/* STEP 1: SELECT CARRIER VESSEL AT BERTH */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-sm">
                  1
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    Select Target Carrier Vessel at Berth
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Outbound/carrier vessels berthed and verified in AT_BERTH schedule status ready for container stowage.
                  </p>
                </div>
              </div>
              <span className="text-xs font-semibold text-slate-500">
                {vessels.length} vessel{vessels.length === 1 ? '' : 's'} at berth
              </span>
            </div>

            {loadingVessels ? (
              <div className="py-8 text-center text-slate-400">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-500" />
                <p className="text-xs">Loading berthed vessels...</p>
              </div>
            ) : vessels.length === 0 ? (
              <div className="p-6 text-center rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-300 dark:border-slate-700">
                <Ship className="w-8 h-8 text-slate-400 mx-auto mb-2 opacity-50" />
                <p className="text-xs font-bold text-slate-600 dark:text-slate-300">No Vessels Currently at Berth</p>
                <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                  Carrier vessels must reach 'AT_BERTH' schedule status before quay container loading operations can proceed. Check Berth & Scheduling in Port Operations Officer portal.
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
                        setSelectedContainer(null);
                      }}
                      className={`p-4 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'border-emerald-500 bg-emerald-500/5 dark:bg-emerald-500/10 shadow-sm'
                          : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                            <Ship className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                            {v.vessel_name}
                          </h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            IMO: {v.vessel_imo_number} • {v.shipping_company_name}
                          </p>
                        </div>
                        {isSelected && (
                          <span className="p-1 rounded-full bg-emerald-500 text-white">
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
                          <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Yard Stored</span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {v.yard_containers_count} Available
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Call Sign</span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200 font-mono">
                            {v.call_sign || 'N/A'}
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

          {/* STEP 2: SELECT CONTAINER FROM YARD */}
          {selectedVessel && (
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-sm">
                    2
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900 dark:text-white">
                      Select Export Container to Load
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Outbound export containers assigned to '{selectedVessel.vessel_name}' currently in yard slots.
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
                  placeholder="Search by container number, cargo, or slot..."
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              {loadingContainers ? (
                <div className="py-8 text-center text-slate-400">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-emerald-500" />
                  <p className="text-xs">Loading yard containers...</p>
                </div>
              ) : filteredContainers.length === 0 ? (
                <div className="p-5 text-center rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-300 dark:border-slate-700">
                  <Boxes className="w-6 h-6 text-slate-400 mx-auto mb-2 opacity-50" />
                  <p className="text-xs font-bold text-slate-600 dark:text-slate-300">No Export Containers in Yard for {selectedVessel.vessel_name}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Only outbound export containers assigned to this vessel's cargo manifest and positioned in yard slots are eligible for loading. Discharged import containers are strictly excluded.
                  </p>
                </div>
              ) : (
                <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
                  {filteredContainers.map((c) => {
                    const isSelected = selectedContainer?.container_id === c.container_id;
                    return (
                      <div
                        key={c.container_id}
                        onClick={() => setSelectedContainer(c)}
                        className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                          isSelected
                            ? 'border-emerald-500 bg-emerald-500/5 dark:bg-emerald-500/10 shadow-sm'
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
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                                <span>📤</span> EXPORT
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                              <span>Weight: {c.container_gross_weight} MT</span>
                              <span>•</span>
                              <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                                📍 {c.location_display}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400">
                              {c.customs_status_display}
                            </span>
                            {isSelected && (
                              <span className="p-1 rounded-full bg-emerald-500 text-white">
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
          )}

          {/* STEP 3: REVIEW & CONFIRM LOADING ACTION */}
          {selectedVessel && selectedContainer && (
            <div className="p-6 sm:p-7 rounded-2xl bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent border-2 border-emerald-500/40 dark:border-emerald-500/30 shadow-md space-y-5 animate-fade-in">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    Review Coordinated Loading Plan
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Verify complete vessel stowage parameters. Executing will stow container aboard vessel and release origin yard slot coordinates.
                  </p>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-600 text-white shadow-xs">
                  Ready to Load
                </span>
              </div>

              {/* Review Summary Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 backdrop-blur-xs text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider mb-1">
                    Destination Vessel & Berth
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
                    Container To Stow
                  </span>
                  <div className="font-bold text-slate-900 dark:text-white text-sm font-mono">
                    {selectedContainer.container_number}
                  </div>
                  <div className="text-slate-500 text-[11px] flex items-center gap-1.5 mt-0.5">
                    <span>{selectedContainer.container_type} • {selectedContainer.container_gross_weight} MT</span>
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                      📤 EXPORT
                    </span>
                  </div>
                </div>

                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider mb-1">
                    Origin Slot To Vacate
                  </span>
                  <div className="font-bold text-emerald-600 dark:text-emerald-400 text-sm font-mono">
                    {selectedContainer.location_display}
                  </div>
                  <div className="text-slate-500 text-[11px]">
                    Slot {selectedContainer.slot_code} &rarr; Will be Marked AVAILABLE
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setIsConfirmModalOpen(true)}
                  className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md transition-all flex items-center gap-2 cursor-pointer"
                >
                  <ArrowUpFromLine className="w-4 h-4" />
                  Execute Vessel Loading
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: LOADING HISTORY */}
      {activeTab === 'history' && (
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                Vessel Loading History Log
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Immutable audit record of all export and transshipment container stowage operations.
              </p>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder="Search history by container or crane..."
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>

          {loadingHistory ? (
            <div className="py-12 text-center text-slate-400">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-500" />
              <p className="text-xs">Loading stowage history...</p>
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="py-12 text-center rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-300 dark:border-slate-700">
              <Clock className="w-8 h-8 text-slate-400 mx-auto mb-2 opacity-50" />
              <p className="text-xs font-bold text-slate-600 dark:text-slate-300">No Vessel Loading Records Found</p>
              <p className="text-xs text-slate-400 mt-1">
                Completed vessel loading movements will be recorded here automatically.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 text-[10px] uppercase tracking-wider">
                    <th className="py-3 px-3">Timestamp</th>
                    <th className="py-3 px-3">Container Number</th>
                    <th className="py-3 px-3">Type</th>
                    <th className="py-3 px-3">Origin Yard Slot</th>
                    <th className="py-3 px-3">Destination</th>
                    <th className="py-3 px-3">Quay Crane</th>
                    <th className="py-3 px-3">Operator</th>
                    <th className="py-3 px-3">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {filteredHistory.map((item) => (
                    <tr key={item.yard_movement_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="py-3 px-3 text-slate-500 dark:text-slate-400 font-mono">
                        {new Date(item.movement_timestamp).toLocaleString()}
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-slate-900 dark:text-white">
                        {item.container_number}
                      </td>
                      <td className="py-3 px-3 text-slate-600 dark:text-slate-300">
                        {item.container_type_display}
                      </td>
                      <td className="py-3 px-3 font-mono text-amber-600 dark:text-amber-400">
                        {item.from_location_display}
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                          {item.to_location_display}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-700 dark:text-slate-300 font-medium">
                        {item.crane_code || 'N/A'}
                      </td>
                      <td className="py-3 px-3 text-slate-600 dark:text-slate-400">
                        {item.moved_by_name}
                      </td>
                      <td className="py-3 px-3 text-slate-400 italic max-w-xs truncate">
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
        onClose={() => setIsConfirmModalOpen(false)}
        title="Confirm Quay-to-Vessel Stowage"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            Are you sure you want to execute physical container loading for{' '}
            <strong className="text-slate-900 dark:text-white font-mono">
              {selectedContainer?.container_number}
            </strong>{' '}
            onto vessel{' '}
            <strong className="text-slate-900 dark:text-white">
              {selectedVessel?.vessel_name}
            </strong>?
          </p>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">Vessel / Berth:</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {selectedVessel?.vessel_name} ({selectedVessel?.berth_name})
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Origin Slot:</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400 font-mono">
                {selectedContainer?.location_display}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Slot Post-Action:</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                Marked AVAILABLE (Capacity Freed)
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Operation Remarks (Optional)
            </label>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="e.g. Outbound voyage stowage bay 04, hatch 2..."
              rows={2}
              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setIsConfirmModalOpen(false)}
              disabled={executingLoading}
              className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleExecuteLoading}
              disabled={executingLoading}
              className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {executingLoading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Stowing Container...
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  Confirm Stowage
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
