
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Ship,
  Anchor,
  Truck,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Search,
  ShieldAlert,
  Info,
  Check,
  Building,
  FileCheck,
  User,
  QrCode,
  AlertTriangle,
  Scale,
  Calendar,
  Layers,
  MapPin,
  ExternalLink,
  ShieldCheck,
  Clock
} from 'lucide-react';
import { apiFetch } from '../../../services/api';
import { useApp } from '../../../context/AppContext';
import { Modal } from '../../common/Modal';
import {
  EligibleUnloadingVessel,
  ActiveUnloadingCrane,
  EligibleDirectTransferContainer,
  DirectShipToTruckTransferItem
} from '../../../types';

interface TruckItem {
  truck_id: number;
  truck_number: string;
  truck_company_name: string;
  truck_status: string;
}

interface DriverItem {
  driver_id: number;
  driver_name: string;
  driver_license_number: string;
  driver_phone: string;
  driver_status: string;
}

interface GateItem {
  gate_id: number;
  gate_name: string;
  gate_code: string;
  gate_type: string;
  gate_status: string;
}

export const DirectShipToTruckOperations: React.FC = () => {
  const { addToast } = useApp();

  // Workflow Subtab: 'workflow' | 'transfers_list'
  const [subTab, setSubTab] = useState<'workflow' | 'transfers_list'>('workflow');

  // Step 1: Vessel Selection
  const [vessels, setVessels] = useState<EligibleUnloadingVessel[]>([]);
  const [selectedVessel, setSelectedVessel] = useState<EligibleUnloadingVessel | null>(null);
  const [loadingVessels, setLoadingVessels] = useState<boolean>(false);

  // Step 2: Eligible Containers
  const [containers, setContainers] = useState<EligibleDirectTransferContainer[]>([]);
  const [selectedContainer, setSelectedContainer] = useState<EligibleDirectTransferContainer | null>(null);
  const [containerSearch, setContainerSearch] = useState<string>('');
  const [loadingContainers, setLoadingContainers] = useState<boolean>(false);

  // Step 3: Quayside Cranes (STS / MHC quayside cranes only)
  const [cranes, setCranes] = useState<ActiveUnloadingCrane[]>([]);
  const [selectedCrane, setSelectedCrane] = useState<ActiveUnloadingCrane | null>(null);
  const [loadingCranes, setLoadingCranes] = useState<boolean>(false);

  // Step 4: Truck, Driver & Exit Gate Selection
  const [trucks, setTrucks] = useState<TruckItem[]>([]);
  const [selectedTruck, setSelectedTruck] = useState<TruckItem | null>(null);
  const [loadingTrucks, setLoadingTrucks] = useState<boolean>(false);

  const [drivers, setDrivers] = useState<DriverItem[]>([]);
  const [selectedDriver, setSelectedDriver] = useState<DriverItem | null>(null);
  const [loadingDrivers, setLoadingDrivers] = useState<boolean>(false);

  const [gates, setGates] = useState<GateItem[]>([]);
  const [selectedGate, setSelectedGate] = useState<GateItem | null>(null);
  const [loadingGates, setLoadingGates] = useState<boolean>(false);

  const [remarks, setRemarks] = useState<string>('');

  // Confirmation & Execution Modal
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState<boolean>(false);
  const [executingTransfer, setExecutingTransfer] = useState<boolean>(false);
  const [lastExecutedTransfer, setLastExecutedTransfer] = useState<DirectShipToTruckTransferItem | null>(null);

  // Transfers Tracking List
  const [transfers, setTransfers] = useState<DirectShipToTruckTransferItem[]>([]);
  const [loadingTransfers, setLoadingTransfers] = useState<boolean>(false);
  const [transferSearch, setTransferSearch] = useState<string>('');

  // Helper to parse native fetch response
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
      const list: EligibleUnloadingVessel[] = Array.isArray(data?.data) ? data.data : [];
      setVessels(list);
    } catch (err: any) {
      addToast(err?.message || 'Failed to load berthed vessels.', 'error');
    } finally {
      setLoadingVessels(false);
    }
  }, [addToast]);

  // Fetch Eligible Containers for selected vessel
  const fetchEligibleContainers = useCallback(async (scheduleId: number) => {
    setLoadingContainers(true);
    try {
      const res = await apiFetch(`/api/terminal/direct-transfer/eligible-containers/?vessel_schedule_id=${scheduleId}`);
      const data = await parseApiResponse(res);
      const list: EligibleDirectTransferContainer[] = Array.isArray(data?.data) ? data.data : [];
      setContainers(list);
    } catch (err: any) {
      addToast(err?.message || 'Failed to load manifest containers.', 'error');
    } finally {
      setLoadingContainers(false);
    }
  }, [addToast]);

  // Fetch Active Cranes for selected vessel
  const fetchActiveCranes = useCallback(async (scheduleId: number) => {
    setLoadingCranes(true);
    try {
      const res = await apiFetch(`/api/terminal/unloading/active-cranes/?vessel_schedule_id=${scheduleId}`);
      const data = await parseApiResponse(res);
      const list: ActiveUnloadingCrane[] = Array.isArray(data?.data) ? data.data : [];
      // Filter for quayside cranes: STS or MHC only (reject RTG/RMG)
      const quaysideOnly = list.filter(
        c => (c.crane_type === 'STS' || c.crane_type === 'MHC') &&
             (c.operation_type === 'UNLOADING' || c.operation_type === 'BOTH') &&
             c.allocation_status === 'ACTIVE'
      );
      setCranes(quaysideOnly);
    } catch (err: any) {
      addToast(err?.message || 'Failed to load active quayside cranes.', 'error');
    } finally {
      setLoadingCranes(false);
    }
  }, [addToast]);

  // Fetch Trucks, Drivers, and Gates
  const fetchTrucksDriversGates = useCallback(async () => {
    setLoadingTrucks(true);
    setLoadingDrivers(true);
    setLoadingGates(true);
    try {
      const [trucksRes, driversRes, gatesRes] = await Promise.all([
        apiFetch('/api/gate/trucks/'),
        apiFetch('/api/gate/drivers/'),
        apiFetch('/api/gate/gates/')
      ]);

      if (trucksRes.ok) {
        const tData = await trucksRes.json();
        const tList = Array.isArray(tData?.data) ? tData.data : Array.isArray(tData) ? tData : [];
        setTrucks(tList);
        if (tList.length > 0 && !selectedTruck) setSelectedTruck(tList[0]);
      }
      if (driversRes.ok) {
        const dData = await driversRes.json();
        const dList = Array.isArray(dData?.data) ? dData.data : Array.isArray(dData) ? dData : [];
        setDrivers(dList);
        if (dList.length > 0 && !selectedDriver) setSelectedDriver(dList[0]);
      }
      if (gatesRes.ok) {
        const gData = await gatesRes.json();
        const gList = Array.isArray(gData?.data) ? gData.data : Array.isArray(gData) ? gData : [];
        setGates(gList);
        if (gList.length > 0 && !selectedGate) setSelectedGate(gList[0]);
      }
    } catch (err: any) {
      console.error('Error fetching trucks/drivers/gates:', err);
    } finally {
      setLoadingTrucks(false);
      setLoadingDrivers(false);
      setLoadingGates(false);
    }
  }, [selectedTruck, selectedDriver, selectedGate]);

  // Fetch Transfers List
  const fetchTransfers = useCallback(async () => {
    setLoadingTransfers(true);
    try {
      const res = await apiFetch('/api/terminal/direct-transfer/');
      const data = await parseApiResponse(res);
      const list: DirectShipToTruckTransferItem[] = Array.isArray(data?.data) ? data.data : [];
      setTransfers(list);
    } catch (err: any) {
      console.error('Failed to load direct transfers:', err);
    } finally {
      setLoadingTransfers(false);
    }
  }, []);

  // Initial Load
  useEffect(() => {
    fetchEligibleVessels();
    fetchTrucksDriversGates();
    fetchTransfers();
  }, [fetchEligibleVessels, fetchTrucksDriversGates, fetchTransfers]);

  // When vessel changes, update containers and cranes
  useEffect(() => {
    if (selectedVessel) {
      fetchEligibleContainers(selectedVessel.vessel_schedule_id);
      fetchActiveCranes(selectedVessel.vessel_schedule_id);
      setSelectedContainer(null);
      setSelectedCrane(null);
    } else {
      setContainers([]);
      setCranes([]);
      setSelectedContainer(null);
      setSelectedCrane(null);
    }
  }, [selectedVessel, fetchEligibleContainers, fetchActiveCranes]);

  // Filtered Containers
  const filteredContainers = useMemo(() => {
    if (!containerSearch.trim()) return containers;
    const q = containerSearch.toLowerCase().trim();
    return containers.filter(
      c => c.container_number.toLowerCase().includes(q) ||
           c.cargo_description.toLowerCase().includes(q) ||
           (c.delivery_order_number && c.delivery_order_number.toLowerCase().includes(q))
    );
  }, [containers, containerSearch]);

  // Filtered Transfers
  const filteredTransfers = useMemo(() => {
    if (!transferSearch.trim()) return transfers;
    const q = transferSearch.toLowerCase().trim();
    return transfers.filter(
      t => (t.transfer_reference && t.transfer_reference.toLowerCase().includes(q)) ||
           (t.container_number && t.container_number.toLowerCase().includes(q)) ||
           (t.truck_number && t.truck_number.toLowerCase().includes(q)) ||
           (t.vessel_name && t.vessel_name.toLowerCase().includes(q)) ||
           (t.gate_pass_number && t.gate_pass_number.toLowerCase().includes(q))
    );
  }, [transfers, transferSearch]);

  // Execute Direct Transfer Handler
  const handleExecuteTransfer = async () => {
    if (!selectedVessel || !selectedContainer || !selectedCrane || !selectedTruck || !selectedDriver) {
      addToast('Please complete all required selections before executing.', 'warning');
      return;
    }

    if (!selectedContainer.is_eligible_for_direct_transfer) {
      addToast('Selected container is not eligible for Direct Ship-to-Truck transfer.', 'error');
      return;
    }

    setExecutingTransfer(true);
    try {
      const payload = {
        container_id: selectedContainer.container_id,
        vessel_schedule_id: selectedVessel.vessel_schedule_id,
        crane_allocation_id: selectedCrane.crane_allocation_id,
        truck_id: selectedTruck.truck_id,
        driver_id: selectedDriver.driver_id,
        gate_id: selectedGate?.gate_id,
        remarks: remarks.trim()
      };

      const res = await apiFetch('/api/terminal/direct-transfer/execute/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await parseApiResponse(res);
      const transferRecord: DirectShipToTruckTransferItem = data?.data;

      setLastExecutedTransfer(transferRecord);
      setIsConfirmModalOpen(false);
      addToast(data?.message || 'Direct Ship-to-Truck transfer executed successfully!', 'success');

      // Refresh data
      if (selectedVessel) {
        fetchEligibleContainers(selectedVessel.vessel_schedule_id);
      }
      fetchTransfers();
      setSelectedContainer(null);
      setRemarks('');
    } catch (err: any) {
      addToast(err?.message || 'Direct transfer execution failed.', 'error');
    } finally {
      setExecutingTransfer(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* DIRECT TRANSFER TOP BAR & SUB-TABS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/20 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500 text-white shadow-xs">
              Direct Discharge
            </span>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Quayside Vessel-to-Truck Transfer Workflow
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2.5">
            <Truck className="w-6 h-6 text-[#D49A24]" />
            Direct Ship-to-Truck Transfer Operations
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400 max-w-3xl leading-relaxed">
            Eligible containers with advance pre-arrival customs clearance and valid delivery authorization transfer directly from the berthed vessel quayside onto waiting authorized trucks without occupying terminal yard storage slots.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setSubTab('workflow')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                subTab === 'workflow'
                  ? 'bg-white dark:bg-slate-900 text-[#D49A24] shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Transfer Workflow
            </button>
            <button
              onClick={() => {
                setSubTab('transfers_list');
                fetchTransfers();
              }}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                subTab === 'transfers_list'
                  ? 'bg-white dark:bg-slate-900 text-[#D49A24] shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span>Transfer Operations</span>
              {transfers.length > 0 && (
                <span className="w-5 h-5 rounded-full bg-amber-500 text-white text-[10px] flex items-center justify-center font-bold">
                  {transfers.length}
                </span>
              )}
            </button>
          </div>

          <button
            onClick={() => {
              fetchEligibleVessels();
              if (selectedVessel) {
                fetchEligibleContainers(selectedVessel.vessel_schedule_id);
                fetchActiveCranes(selectedVessel.vessel_schedule_id);
              }
              fetchTransfers();
            }}
            disabled={loadingVessels || loadingContainers || loadingCranes}
            className="p-2 text-slate-600 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl transition-all disabled:opacity-50 cursor-pointer"
            title="Refresh Direct Transfer Data"
          >
            <RefreshCw className={`w-4 h-4 ${loadingVessels || loadingContainers ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* RECENT EXECUTION BANNER */}
      {lastExecutedTransfer && (
        <div className="p-5 rounded-2xl bg-emerald-500/10 border-2 border-emerald-500/40 text-emerald-950 dark:text-emerald-100 space-y-3 animate-fade-in shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center font-bold shadow-sm">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 block">
                  Direct Quayside Transfer Executed Successfully
                </span>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                  Transfer Ref: {lastExecutedTransfer.transfer_reference}
                </h3>
              </div>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-black bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30">
              STATUS: {lastExecutedTransfer.transfer_status_display}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-1">
            <div className="p-2.5 rounded-lg bg-white/70 dark:bg-slate-900/70 border border-emerald-500/20">
              <span className="text-[10px] text-slate-500 uppercase block font-semibold">Container:</span>
              <span className="font-mono font-bold text-slate-900 dark:text-white">{lastExecutedTransfer.container_number}</span>
            </div>
            <div className="p-2.5 rounded-lg bg-white/70 dark:bg-slate-900/70 border border-emerald-500/20">
              <span className="text-[10px] text-slate-500 uppercase block font-semibold">Waiting Truck:</span>
              <span className="font-mono font-bold text-slate-900 dark:text-white">{lastExecutedTransfer.truck_number}</span>
            </div>
            <div className="p-2.5 rounded-lg bg-white/70 dark:bg-slate-900/70 border border-emerald-500/20">
              <span className="text-[10px] text-slate-500 uppercase block font-semibold">Digital Gate Pass:</span>
              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{lastExecutedTransfer.gate_pass_number || 'Generated'}</span>
            </div>
            <div className="p-2.5 rounded-lg bg-white/70 dark:bg-slate-900/70 border border-emerald-500/20">
              <span className="text-[10px] text-slate-500 uppercase block font-semibold">Yard Status:</span>
              <span className="font-bold text-slate-700 dark:text-slate-300">Bypassed (0 Slot Allocated)</span>
            </div>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 pt-1 border-t border-emerald-500/20">
            ✓ Container is now loaded onto truck and dispatched for gate exit. Gate officers can verify Pass <strong>{lastExecutedTransfer.gate_pass_number}</strong> at the Gate Verification Desk to authorize final exit.
          </p>
        </div>
      )}

      {/* VIEW: WORKFLOW */}
      {subTab === 'workflow' && (
        <div className="space-y-6">
          {/* STEP 1: SELECT BERTHED CARRIER VESSEL */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-sm">
                  1
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    Select Berthed Carrier Vessel
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Vessels currently confirmed at quay berth in verified AT_BERTH schedule status.
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
                  Vessel must reach verified 'AT_BERTH' schedule status before direct quayside transfer can be authorized.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {vessels.map((v) => {
                  const isSelected = selectedVessel?.vessel_schedule_id === v.vessel_schedule_id;
                  return (
                    <div
                      key={v.vessel_schedule_id}
                      onClick={() => setSelectedVessel(v)}
                      className={`p-4 rounded-xl border transition-all cursor-pointer relative ${
                        isSelected
                          ? 'border-[#D49A24] bg-amber-500/5 ring-2 ring-[#D49A24]/30'
                          : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 hover:border-amber-500/40'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <Ship className="w-4 h-4 text-[#D49A24]" />
                            <h4 className="font-black text-sm text-slate-900 dark:text-white">
                              {v.vessel_name}
                            </h4>
                          </div>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                            IMO: {v.vessel_imo_number} • {v.shipping_company_name}
                          </span>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                          AT BERTH
                        </span>
                      </div>

                      <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700/60 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                          <Anchor className="w-3.5 h-3.5 text-amber-500" />
                          <span className="font-semibold">{v.berth_name}</span>
                        </div>
                        <span className="text-[11px] font-semibold text-slate-500">
                          {v.manifested_containers_count} manifested containers
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* STEP 2: SELECT ELIGIBLE MANIFEST CONTAINER */}
          {selectedVessel && (
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-sm space-y-4 animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-sm">
                    2
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900 dark:text-white">
                      Select Manifested Container for Direct Transfer
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Evaluates pre-arrival customs clearance, delivery authorization, and yard status.
                    </p>
                  </div>
                </div>

                <div className="relative w-full sm:w-64">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search container, cargo, DO#..."
                    value={containerSearch}
                    onChange={(e) => setContainerSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-[#D49A24]"
                  />
                </div>
              </div>

              {loadingContainers ? (
                <div className="py-8 text-center text-slate-400">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-amber-500" />
                  <p className="text-xs">Evaluating container eligibility criteria...</p>
                </div>
              ) : filteredContainers.length === 0 ? (
                <div className="p-6 text-center rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-300 dark:border-slate-700">
                  <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                    No Manifested Containers Found for this Vessel
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {filteredContainers.map((c) => {
                    const isSelected = selectedContainer?.container_id === c.container_id;
                    const isEligible = c.is_eligible_for_direct_transfer;

                    return (
                      <div
                        key={c.container_id}
                        onClick={() => {
                          if (isEligible) {
                            setSelectedContainer(c);
                          } else {
                            addToast(
                              `Container ${c.container_number} is ineligible: ${c.ineligibility_reasons.join('; ')}`,
                              'warning'
                            );
                          }
                        }}
                        className={`p-4 rounded-xl border transition-all cursor-pointer relative ${
                          isSelected
                            ? 'border-[#D49A24] bg-amber-500/5 ring-2 ring-[#D49A24]/30'
                            : isEligible
                            ? 'border-emerald-500/40 bg-emerald-500/5 hover:border-emerald-500'
                            : 'border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30 opacity-75'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-black text-sm text-slate-900 dark:text-white">
                                {c.container_number}
                              </span>
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                                {c.container_type_display}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate max-w-xs">
                              {c.cargo_description}
                            </p>
                          </div>

                          <div>
                            {isEligible ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                Eligible
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" />
                                Ineligible
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Status Pills */}
                        <div className="flex flex-wrap items-center gap-1.5 mt-2.5 pt-2 border-t border-slate-200 dark:border-slate-700/60 text-[11px]">
                          {/* Customs Status */}
                          <span
                            className={`px-2 py-0.5 rounded font-semibold ${
                              c.is_customs_cleared
                                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20'
                                : 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20'
                            }`}
                          >
                            Customs: {c.container_customs_status_display}
                          </span>

                          {/* Delivery Order Status */}
                          <span
                            className={`px-2 py-0.5 rounded font-semibold ${
                              c.has_delivery_order
                                ? 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20'
                                : 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20'
                            }`}
                          >
                            DO: {c.has_delivery_order ? (c.delivery_order_number || 'Issued') : 'Not Issued'}
                          </span>

                          {/* Yard Status */}
                          <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold border border-slate-200 dark:border-slate-700">
                            Yard: {c.has_yard_allocation ? 'Allocated' : 'Unallocated'}
                          </span>
                        </div>

                        {/* Ineligibility Reasons Alert */}
                        {!isEligible && c.ineligibility_reasons.length > 0 && (
                          <div className="mt-2.5 p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-[11px] text-rose-700 dark:text-rose-300 space-y-0.5">
                            <span className="font-bold block">Ineligibility reasons:</span>
                            {c.ineligibility_reasons.map((r, i) => (
                              <div key={i} className="flex items-start gap-1">
                                <span className="text-rose-500">•</span>
                                <span>{r}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* STEP 3: SELECT COMPATIBLE QUAYSIDE CRANE */}
          {selectedContainer && (
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-sm space-y-4 animate-fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-sm">
                    3
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900 dark:text-white">
                      Select Compatible Active Quayside Crane
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Direct vessel discharge strictly requires an ACTIVE Ship-to-Shore (STS) or Mobile Harbour Crane (MHC) quayside allocation.
                    </p>
                  </div>
                </div>
              </div>

              {loadingCranes ? (
                <div className="py-6 text-center text-slate-400">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-amber-500" />
                  <p className="text-xs">Checking active quayside crane allocations...</p>
                </div>
              ) : cranes.length === 0 ? (
                <div className="p-5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-200 text-xs space-y-2">
                  <div className="flex items-center gap-2 font-bold">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>No Compatible Active Quayside Crane Allocation Found</span>
                  </div>
                  <p className="leading-relaxed">
                    Direct ship-to-truck discharge requires an ACTIVE STS or MHC quayside crane allocation dedicated to vessel schedule #{selectedVessel?.vessel_schedule_id} at {selectedVessel?.berth_name}. Yard cranes (RTG / RMG) cannot perform quayside vessel discharge.
                  </p>
                  <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                    → Please navigate to <strong>Crane Management</strong> to allocate and activate an STS/MHC crane first.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {cranes.map((crane) => {
                    const isSelected = selectedCrane?.crane_allocation_id === crane.crane_allocation_id;
                    return (
                      <div
                        key={crane.crane_allocation_id}
                        onClick={() => setSelectedCrane(crane)}
                        className={`p-4 rounded-xl border transition-all cursor-pointer ${
                          isSelected
                            ? 'border-[#D49A24] bg-amber-500/5 ring-2 ring-[#D49A24]/30'
                            : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 hover:border-amber-500/40'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-black text-sm text-slate-900 dark:text-white">
                            {crane.crane_code}
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/10 text-purple-600 border border-purple-500/20">
                            {crane.crane_type} Quayside
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          {crane.crane_name}
                        </p>
                        <div className="mt-2.5 pt-2 border-t border-slate-200 dark:border-slate-700 text-xs flex justify-between text-slate-500">
                          <span>Capacity: {crane.crane_max_lifting_capacity_mt} MT</span>
                          <span className="font-bold text-emerald-600">ACTIVE</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* STEP 4: SELECT TRUCK, DRIVER & EXIT GATE */}
          {selectedCrane && (
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-sm space-y-4 animate-fade-in">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-sm">
                  4
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    Select Authorized Truck, Driver & Exit Gate
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    The container will be loaded directly onto the designated vehicle at berth and issued a Digital Gate Pass for exit.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Truck Selection */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5 text-amber-500" />
                    Authorized Truck Plate
                  </label>
                  <select
                    value={selectedTruck?.truck_id || ''}
                    onChange={(e) => {
                      const t = trucks.find(x => x.truck_id === Number(e.target.value));
                      if (t) setSelectedTruck(t);
                    }}
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-[#D49A24]"
                  >
                    {trucks.map(t => (
                      <option key={t.truck_id} value={t.truck_id}>
                        {t.truck_number} — {t.truck_company_name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Driver Selection */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-amber-500" />
                    Authorized Driver
                  </label>
                  <select
                    value={selectedDriver?.driver_id || ''}
                    onChange={(e) => {
                      const d = drivers.find(x => x.driver_id === Number(e.target.value));
                      if (d) setSelectedDriver(d);
                    }}
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-[#D49A24]"
                  >
                    {drivers.map(d => (
                      <option key={d.driver_id} value={d.driver_id}>
                        {d.driver_name} ({d.driver_license_number})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Designated Exit Gate */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-amber-500" />
                    Designated Exit Gate
                  </label>
                  <select
                    value={selectedGate?.gate_id || ''}
                    onChange={(e) => {
                      const g = gates.find(x => x.gate_id === Number(e.target.value));
                      if (g) setSelectedGate(g);
                    }}
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-[#D49A24]"
                  >
                    {gates.map(g => (
                      <option key={g.gate_id} value={g.gate_id}>
                        {g.gate_name} ({g.gate_code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Remarks */}
              <div className="space-y-1.5 pt-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Operational Remarks (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Verified express delivery priority; direct quayside discharge onto trailer..."
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#D49A24]"
                />
              </div>

              {/* Action Button */}
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end">
                <button
                  onClick={() => setIsConfirmModalOpen(true)}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#D49A24] hover:bg-[#b8821a] text-white font-bold text-xs transition-all shadow-md cursor-pointer"
                >
                  <ArrowRight className="w-4 h-4" />
                  Review &amp; Confirm Direct Transfer
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* VIEW: TRANSFERS LIST & AUDIT LOG */}
      {subTab === 'transfers_list' && (
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                Direct Ship-to-Truck Transfer Operations Log
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Authoritative record of all containers transferred directly from vessel to truck at berth.
              </p>
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search ref, container, truck, pass#..."
                value={transferSearch}
                onChange={(e) => setTransferSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-[#D49A24]"
              />
            </div>
          </div>

          {loadingTransfers ? (
            <div className="py-8 text-center text-slate-400">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-amber-500" />
              <p className="text-xs">Loading direct transfer records...</p>
            </div>
          ) : filteredTransfers.length === 0 ? (
            <div className="p-8 text-center rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-300 dark:border-slate-700">
              <Truck className="w-8 h-8 text-slate-400 mx-auto mb-2 opacity-50" />
              <p className="text-xs font-bold text-slate-600 dark:text-slate-300">No Direct Transfer Operations Found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-black uppercase text-slate-500 tracking-wider">
                    <th className="py-3 px-3">Reference</th>
                    <th className="py-3 px-3">Container</th>
                    <th className="py-3 px-3">Vessel & Berth</th>
                    <th className="py-3 px-3">Quay Crane</th>
                    <th className="py-3 px-3">Truck & Driver</th>
                    <th className="py-3 px-3">Digital Gate Pass</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">Initiated At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredTransfers.map((t) => (
                    <tr key={t.transfer_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-3 font-mono font-bold text-slate-900 dark:text-white">
                        {t.transfer_reference}
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-mono font-black text-slate-900 dark:text-white">
                          {t.container_number}
                        </span>
                        <span className="block text-[10px] text-slate-400">
                          {t.container_type_display}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {t.vessel_name}
                        </span>
                        <span className="block text-[10px] text-slate-400">
                          {t.berth_name}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-slate-700 dark:text-slate-300">
                        {t.crane_code}
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                          {t.truck_number}
                        </span>
                        <span className="block text-[10px] text-slate-400">
                          {t.driver_name}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        {t.gate_pass_number ? (
                          <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            {t.gate_pass_number}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">None</span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            t.transfer_status === 'COMPLETED'
                              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                              : t.transfer_status === 'AWAITING_GATE_EXIT'
                              ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                              : 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30'
                          }`}
                        >
                          {t.transfer_status_display}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-500 text-[11px]">
                        {new Date(t.transfer_initiated_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* CONFIRMATION SUMMARY MODAL */}
      <Modal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        title="Confirm Direct Ship-to-Truck Physical Transfer"
        maxWidth="xl"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Please verify all quayside transfer parameters. Once confirmed, the container will be discharged directly onto the designated truck at berth and a Digital Gate Pass will be prepared for gate exit.
          </p>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2.5 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400 font-semibold">Carrier Vessel:</span>
              <span className="font-bold text-slate-900 dark:text-white">{selectedVessel?.vessel_name} ({selectedVessel?.berth_name})</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400 font-semibold">Manifest Container:</span>
              <span className="font-mono font-black text-slate-900 dark:text-white">{selectedContainer?.container_number} ({selectedContainer?.container_type_display})</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400 font-semibold">Quayside Crane:</span>
              <span className="font-bold text-slate-900 dark:text-white">{selectedCrane?.crane_code} ({selectedCrane?.crane_name})</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400 font-semibold">Authorized Truck:</span>
              <span className="font-mono font-bold text-slate-900 dark:text-white">{selectedTruck?.truck_number} ({selectedTruck?.truck_company_name})</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400 font-semibold">Authorized Driver:</span>
              <span className="font-bold text-slate-900 dark:text-white">{selectedDriver?.driver_name} ({selectedDriver?.driver_phone})</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400 font-semibold">Exit Gate:</span>
              <span className="font-bold text-amber-600 dark:text-amber-400">{selectedGate?.gate_name}</span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300 space-y-1">
            <span className="font-bold block flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-amber-600" />
              Verified Direct Quayside Operation Guarantees:
            </span>
            <ul className="list-disc list-inside text-[11px] space-y-0.5">
              <li>NO YardAllocation record will be created.</li>
              <li>NO yard slot will be marked OCCUPIED or reserved.</li>
              <li>Yard occupancy numbers remain completely unaffected.</li>
              <li>Advance customs clearance CLEARED status remains fully protected.</li>
              <li>A Digital Gate Pass with QR verification code is generated for exit release.</li>
            </ul>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setIsConfirmModalOpen(false)}
              disabled={executingTransfer}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleExecuteTransfer}
              disabled={executingTransfer}
              className="flex items-center gap-2 px-5 py-2 text-xs font-bold bg-[#D49A24] hover:bg-[#b8821a] text-white rounded-xl transition-all disabled:opacity-50 cursor-pointer shadow-md"
            >
              {executingTransfer ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Executing Direct Transfer...
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  Confirm &amp; Execute Transfer
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
