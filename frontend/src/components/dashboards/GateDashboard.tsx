import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { apiFetch } from '../../services/api';
import { BackendContainer, ContainerStatus, BackendGatePass } from '../../types';
import { Modal } from '../common/Modal';
import { DigitalGatePassModal } from '../common/DigitalGatePassModal';
import { GenerateGatePassModal } from './gate/GenerateGatePassModal';
import { GatePassDirectory } from './gate/GatePassDirectory';
import { GatePassVerificationDesk } from './gate/GatePassVerificationDesk';
import { ExportGateInDesk } from './gate/ExportGateInDesk';
import {
  Truck,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  Search,
  RefreshCw,
  Eye,
  Ship,
  Boxes,
  ShieldCheck,
  Lock,
  ArrowRight,
  Info,
  UserCheck,
  FileCheck,
  MapPin,
  Calendar,
  AlertOctagon,
  QrCode,
  CheckSquare,
  Square,
  Plus,
  ArrowDownRight
} from 'lucide-react';

interface LifecycleStep {
  key: string;
  label: string;
  stepNumber: number;
}

const LIFECYCLE_STEPS: LifecycleStep[] = [
  { key: 'REGISTERED', label: 'Registered', stepNumber: 1 },
  { key: 'ARRIVED', label: 'Arrived', stepNumber: 2 },
  { key: 'AT_TERMINAL', label: 'At Terminal', stepNumber: 3 },
  { key: 'UNDER_INSPECTION', label: 'Under Inspection', stepNumber: 4 },
  { key: 'CLEARED', label: 'Cleared', stepNumber: 5 },
  { key: 'RELEASED', label: 'Gate Exit Completed', stepNumber: 6 },
];

const PREDEFINED_GATES = [
  'Main Freight Gate 1 (North Terminal)',
  'Commercial Exit Gate 2 (East Terminal)',
  'Heavy Haul Gate 3 (South Terminal)',
  'Express Container Gate 4 (West Gate)',
  'Central Logistics Exit Gate'
];

type GateOperationsSubView = 'manifest' | 'directory' | 'verify' | 'export-gate-in';

interface GateDashboardProps {
  activeTab?: string;
  onNavigate?: (tab: string) => void;
}

export const GateDashboard: React.FC<GateDashboardProps> = ({
  activeTab: routeTab = 'overview',
  onNavigate
}) => {
  const navigate = useNavigate();
  const { currentUser, addToast, addNotification } = useApp();

  const getSubViewFromTab = (tab: string): GateOperationsSubView => {
    if (tab === 'gate-passes' || tab === 'directory' || tab === 'passes') return 'directory';
    if (tab === 'release-desk' || tab === 'verify' || tab === 'verification') return 'verify';
    if (tab === 'export-gate-in' || tab === 'gate-in' || tab === 'export') return 'export-gate-in';
    return 'manifest';
  };

  // Determine if we should show the full dedicated Gate Operations page vs the Overview Dashboard
  const isGateOperationsPage = 
    routeTab === 'gate-operations' || 
    routeTab === 'trucks' || 
    routeTab === 'gate-passes' || 
    routeTab === 'directory' || 
    routeTab === 'release-desk' || 
    routeTab === 'verify' || 
    routeTab === 'verification' || 
    routeTab === 'worklist' ||
    routeTab === 'manifest' ||
    routeTab === 'export-gate-in' ||
    routeTab === 'gate-in' ||
    routeTab === 'export';

  // Sub-view within Gate Operations: 'manifest' | 'directory' | 'verify' | 'export-gate-in'
  const [operationsView, setOperationsView] = useState<GateOperationsSubView>(() => getSubViewFromTab(routeTab));

  useEffect(() => {
    if (isGateOperationsPage) {
      setOperationsView(getSubViewFromTab(routeTab));
    }
  }, [routeTab, isGateOperationsPage]);

  // Support direct QR scan link auto-routing to verification desk
  useEffect(() => {
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const verifyParam = searchParams.get('verify') || searchParams.get('pass') || searchParams.get('code') || searchParams.get('qr');
      if (verifyParam) {
        setVerifyPrefillCode(verifyParam);
        setOperationsView('verify');
      }
    } catch {
      // Ignore URL parsing errors
    }
  }, []);

  // Navigation helper to switch to Gate Operations page & sub-views
  const navigateToGateOperations = (subView: GateOperationsSubView = 'manifest') => {
    setOperationsView(subView);
    const targetTab = subView === 'directory' 
      ? 'gate-passes' 
      : subView === 'verify' 
        ? 'release-desk' 
        : subView === 'export-gate-in'
          ? 'export-gate-in'
          : 'gate-operations';
    const targetPath = subView === 'directory' 
      ? '/gate/gate-passes' 
      : subView === 'verify' 
        ? '/gate/release-desk' 
        : subView === 'export-gate-in'
          ? '/gate/export-gate-in'
          : '/gate/gate-operations';

    if (onNavigate) {
      onNavigate(targetTab);
    }
    navigate(targetPath);
  };

  const [containers, setContainers] = useState<BackendContainer[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  // Default to 'CLEARED' so the release worklist contains ONLY eligible containers
  const [statusFilter, setStatusFilter] = useState<string>('CLEARED');

  // Multi-container selection for Digital Gate Pass generation
  const [selectedContainerIds, setSelectedContainerIds] = useState<number[]>([]);
  const [showGeneratePassModal, setShowGeneratePassModal] = useState<boolean>(false);
  const [containersForPassModal, setContainersForPassModal] = useState<BackendContainer[]>([]);

  // Gate pass viewing modal & verification prefill
  const [viewingGatePass, setViewingGatePass] = useState<BackendGatePass | null>(null);
  const [verifyPrefillCode, setVerifyPrefillCode] = useState<string>('');

  // Modal states for Container Details and Direct Release
  const [selectedContainer, setSelectedContainer] = useState<BackendContainer | null>(null);
  const [releasingContainer, setReleasingContainer] = useState<BackendContainer | null>(null);

  // Form states for Direct Gate Release
  const [truckNumber, setTruckNumber] = useState<string>('');
  const [driverName, setDriverName] = useState<string>('');
  const [driverLicense, setDriverLicense] = useState<string>('');
  const [exitPoint, setExitPoint] = useState<string>(PREDEFINED_GATES[0]);
  const [remarks, setRemarks] = useState<string>('');
  const [releaseLoading, setReleaseLoading] = useState<boolean>(false);
  const [formError, setFormError] = useState<string>('');

  // Fetch containers from backend
  const fetchContainers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch('/api/gate/containers/?status=all');
      const json = await res.json();
      if (res.ok && json.status === 'success') {
        setContainers(json.data || []);
      } else {
        const fallbackRes = await apiFetch('/api/containers/');
        const fallbackJson = await fallbackRes.json();
        if (fallbackRes.ok && fallbackJson.status === 'success') {
          setContainers(fallbackJson.data || []);
        } else {
          setError(json.message || fallbackJson.message || 'Failed to load container release pipeline.');
        }
      }
    } catch {
      setError('Network communication error while connecting to container manifest.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchContainers();
  }, [fetchContainers]);

  // Summary counts
  const counts = useMemo(() => {
    const clearedForRelease = containers.filter(c => c.container_status === 'CLEARED').length;
    const pendingGateVerification = containers.filter(
      c => c.container_status === 'AWAITING_CUSTOMS' || c.container_status === 'UNDER_INSPECTION'
    ).length;
    const released = containers.filter(c => c.container_status === 'RELEASED').length;
    const onHold = containers.filter(c => c.container_status === 'CUSTOMS_HOLD').length;
    return {
      clearedForRelease,
      pendingGateVerification,
      released,
      onHold,
      total: containers.length
    };
  }, [containers]);

  // All cleared containers available in memory
  const allClearedContainers = useMemo(() => {
    return containers.filter(c => c.container_status === 'CLEARED');
  }, [containers]);

  // Filtered containers
  const filteredContainers = useMemo(() => {
    return containers.filter(c => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        q === '' ||
        c.container_number.toLowerCase().includes(q) ||
        (c.cargo_context?.cargo_description || '').toLowerCase().includes(q) ||
        (c.cargo_context?.vessel_name || '').toLowerCase().includes(q) ||
        (c.cargo_context?.vessel_imo_number || '').toLowerCase().includes(q) ||
        (c.gate_release?.truck_number || '').toLowerCase().includes(q) ||
        (c.gate_release?.driver_name || '').toLowerCase().includes(q) ||
        String(c.gate_pass?.pass_number || c.gate_pass?.gate_pass_id || '').toLowerCase().includes(q) ||
        (c.gate_pass?.truck_number || '').toLowerCase().includes(q) ||
        (c.gate_pass?.driver_name || '').toLowerCase().includes(q);

      const matchStatus =
        statusFilter === 'all' ||
        (statusFilter === 'CLEARED' && c.container_status === 'CLEARED') ||
        (statusFilter === 'PENDING' && (c.container_status === 'AWAITING_CUSTOMS' || c.container_status === 'UNDER_INSPECTION')) ||
        (statusFilter === 'HOLD' && c.container_status === 'CUSTOMS_HOLD') ||
        (statusFilter === 'RELEASED' && c.container_status === 'RELEASED');

      return matchSearch && matchStatus;
    });
  }, [containers, searchQuery, statusFilter]);

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

  const getLifecycleStageInfo = (status: ContainerStatus) => {
    switch (status) {
      case 'REGISTERED':
        return { stepIndex: 0, label: 'Registered Manifest', stepNumber: 1, stepStatus: 'registered' };
      case 'ARRIVED':
        return { stepIndex: 1, label: 'Arrived at Berth', stepNumber: 2, stepStatus: 'arrived' };
      case 'AT_TERMINAL':
        return { stepIndex: 2, label: 'At Terminal Yard', stepNumber: 3, stepStatus: 'terminal' };
      case 'AWAITING_CUSTOMS':
        return { stepIndex: 3, label: 'Awaiting Customs Inspection', stepNumber: 4, stepStatus: 'awaiting_customs' };
      case 'UNDER_INSPECTION':
        return { stepIndex: 3, label: 'Under Customs Inspection', stepNumber: 4, stepStatus: 'under_inspection' };
      case 'CUSTOMS_HOLD':
        return { stepIndex: 3, label: 'Customs Hold (Release Blocked)', stepNumber: 4, stepStatus: 'customs_hold' };
      case 'CLEARED':
        return { stepIndex: 4, label: 'Customs Cleared', stepNumber: 5, stepStatus: 'cleared' };
      case 'RELEASED':
        return { stepIndex: 5, label: 'Gate Exit Completed', stepNumber: 6, stepStatus: 'released' };
      default:
        return { stepIndex: 0, label: status, stepNumber: 1, stepStatus: 'default' };
    }
  };

  // Toggle selection of cleared containers for gate pass batch
  const handleToggleSelectContainer = (containerId: number) => {
    setSelectedContainerIds(prev => 
      prev.includes(containerId)
        ? prev.filter(id => id !== containerId)
        : [...prev, containerId]
    );
  };

  const handleSelectAllCleared = () => {
    const eligibleIds = filteredContainers
      .filter(c => c.container_status === 'CLEARED' && (!c.gate_pass || c.gate_pass.gate_pass_status !== 'ACTIVE'))
      .map(c => c.container_id);

    if (selectedContainerIds.length === eligibleIds.length && eligibleIds.length > 0) {
      setSelectedContainerIds([]);
    } else {
      setSelectedContainerIds(eligibleIds);
    }
  };

  // Open Generate Gate Pass Modal for selected containers
  const handleOpenGenerateGatePass = (presetContainer?: BackendContainer) => {
    let targets: BackendContainer[] = [];
    if (presetContainer) {
      targets = [presetContainer];
      setSelectedContainerIds([presetContainer.container_id]);
    } else {
      targets = containers.filter(c => selectedContainerIds.includes(c.container_id));
    }

    if (targets.length === 0) {
      addToast('Please select at least one customs-cleared container to generate a gate pass.', 'warning');
      return;
    }

    // Verify all targets are CLEARED
    const uncleared = targets.filter(c => c.container_status !== 'CLEARED');
    if (uncleared.length > 0) {
      addToast(`Container ${uncleared[0].container_number} is not CLEARED and cannot receive a gate pass.`, 'error');
      return;
    }

    setContainersForPassModal(targets);
    setShowGeneratePassModal(true);
  };

  // Fetch and view a gate pass by ID
  const handleViewPassById = async (passPk: number) => {
    try {
      const res = await apiFetch(`/api/gate/passes/${passPk}/`);
      const json = await res.json();
      if (res.ok && json.status === 'success') {
        setViewingGatePass(json.data);
      } else {
        addToast(json.message || 'Unable to load digital gate pass details.', 'error');
      }
    } catch {
      addToast('Network error loading gate pass details.', 'error');
    }
  };

  // Handle successful generation of a Gate Pass
  const handleGatePassGenerated = (newPass: BackendGatePass) => {
    setShowGeneratePassModal(false);
    setSelectedContainerIds([]);
    setViewingGatePass(newPass);

    const passCode = newPass.gate_pass_pass_number || String(newPass.gate_pass_id);
    const truckNum = newPass.truck?.truck_number || (newPass as any).truck_details?.truck_number || 'Truck';
    const driverName = newPass.driver?.driver_name || (newPass as any).driver_details?.driver_name || 'Driver';
    const driverEmail = newPass.driver?.driver_email || (newPass as any).driver_details?.driver_email || 'Driver email';

    addToast('success', 'Digital Gate Pass Generated', `Digital Gate Pass ${passCode} generated and emailed to driver.`);
    addNotification(
      'Digital Gate Pass Dispatched',
      `Gate pass ${passCode} generated for truck ${truckNum} (${driverName}). Notification sent to ${driverEmail}.`,
      'success'
    );

    fetchContainers();
  };

  // Direct manual release modal handler (legacy flow preserved)
  const handleOpenReleaseModal = (container: BackendContainer) => {
    if (container.container_status !== 'CLEARED') {
      addToast(`Container ${container.container_number} is not CLEARED and cannot be released.`, 'error');
      return;
    }
    setReleasingContainer(container);
    setTruckNumber(container.gate_pass?.truck_number || '');
    setDriverName(container.gate_pass?.driver_name || '');
    setDriverLicense('');
    setExitPoint(PREDEFINED_GATES[0]);
    setRemarks('');
    setFormError('');
  };

  const handleSubmitRelease = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!releasingContainer) return;

    const cleanTruck = truckNumber.trim().toUpperCase();
    const cleanDriver = driverName.trim();
    const cleanLicense = driverLicense.trim().toUpperCase();
    const cleanExit = exitPoint.trim();

    if (!cleanTruck) {
      setFormError('Truck / Registration number is required.');
      return;
    }
    if (!cleanDriver) {
      setFormError('Driver name is required.');
      return;
    }
    if (!cleanLicense) {
      setFormError('Driver identification / license reference is required.');
      return;
    }
    if (!cleanExit) {
      setFormError('Gate / Exit point is required.');
      return;
    }

    setReleaseLoading(true);
    setFormError('');

    try {
      const payload = {
        truck_number: cleanTruck,
        driver_name: cleanDriver,
        driver_license: cleanLicense,
        exit_point: cleanExit,
        remarks: remarks.trim()
      };

      const res = await apiFetch(`/api/containers/${releasingContainer.container_id}/release/`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      const json = await res.json();

      if (res.ok && json.status === 'success') {
        const updatedContainer: BackendContainer = json.data;

        setContainers(prev =>
          prev.map(c => (c.container_id === updatedContainer.container_id ? updatedContainer : c))
        );

        if (selectedContainer?.container_id === updatedContainer.container_id) {
          setSelectedContainer(updatedContainer);
        }

        setReleasingContainer(null);

        addToast(
          `Container ${updatedContainer.container_number} successfully verified and released through gate.`,
          'success'
        );

        addNotification(
          'Container Gate Release Completed',
          `Container ${updatedContainer.container_number} has been released via ${cleanExit} (Truck: ${cleanTruck}, Driver: ${cleanDriver}).`,
          'success'
        );

        fetchContainers();
      } else {
        const errorMsg =
          json.message ||
          (json.errors && Object.values(json.errors).flat().join(' ')) ||
          'Failed to release container.';
        setFormError(errorMsg);
      }
    } catch {
      setFormError('Communication error occurred while submitting gate release verification.');
    } finally {
      setReleaseLoading(false);
    }
  };

  // =========================================================================
  // VIEW A: GATE & TRUCK OPERATIONS OFFICER DASHBOARD / HOME PAGE
  // =========================================================================
  if (!isGateOperationsPage) {
    return (
      <div className="space-y-6 font-sans selection:bg-[#D49A24] selection:text-white animate-fade-in">
        {/* WELCOME BANNER */}
        <div className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 space-y-2 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/30 inline-flex items-center gap-1">
                <Truck className="w-3 h-3 text-teal-500" />
                <span>Gate & Truck Operations Control</span>
              </span>
              <span className="text-xs text-slate-400 font-mono">
                Officer: {currentUser?.name || currentUser?.email || 'Gate Officer'}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              Welcome, Gate & Truck Operations Officer
            </h1>
            <p className="text-sm font-bold text-slate-900 dark:text-slate-200">
              PORTIDE — Intelligent Maritime Port Operations Management Platform
            </p>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-normal max-w-4xl">
              Supervise terminal gate barrier releases, manage commercial haulage vehicle dispatches, assign authorized drivers to gate movements, generate Digital Gate Passes, and verify physical cargo clearances.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={fetchContainers}
              disabled={loading}
              className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors cursor-pointer border border-slate-200 dark:border-slate-700 flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Sync Status</span>
            </button>
          </div>
        </div>

        {/* SUMMARY STAT CARDS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Cleared for Release */}
          <div
            onClick={() => {
              setStatusFilter('CLEARED');
              navigateToGateOperations('manifest');
            }}
            className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 hover:border-emerald-500/60 transition-all cursor-pointer shadow-sm group"
          >
            <div className="flex items-center justify-between pb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                Cleared for Release
              </span>
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-black text-slate-900 dark:text-white font-mono">
              {counts.clearedForRelease}
            </div>
            <span className="text-[10px] text-slate-400 font-medium block mt-1">
              Customs Cleared • Ready for Gate Pass →
            </span>
          </div>

          {/* Pending Gate Verification */}
          <div
            onClick={() => {
              setStatusFilter('PENDING');
              navigateToGateOperations('manifest');
            }}
            className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 hover:border-purple-500/60 transition-all cursor-pointer shadow-sm group"
          >
            <div className="flex items-center justify-between pb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                Customs Pending
              </span>
              <div className="w-8 h-8 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-600 group-hover:scale-110 transition-transform">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-black text-slate-900 dark:text-white font-mono">
              {counts.pendingGateVerification}
            </div>
            <span className="text-[10px] text-slate-400 font-medium block mt-1">
              In Inspection Pipeline • Locked →
            </span>
          </div>

          {/* Released */}
          <div
            onClick={() => {
              setStatusFilter('RELEASED');
              navigateToGateOperations('manifest');
            }}
            className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 hover:border-teal-500/60 transition-all cursor-pointer shadow-sm group"
          >
            <div className="flex items-center justify-between pb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">
                Released & Exited
              </span>
              <div className="w-8 h-8 rounded-xl bg-teal-500/10 flex items-center justify-center text-teal-600 group-hover:scale-110 transition-transform">
                <Truck className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-black text-slate-900 dark:text-white font-mono">
              {counts.released}
            </div>
            <span className="text-[10px] text-slate-400 font-medium block mt-1">
              Exited Through Port Gates →
            </span>
          </div>

          {/* On Hold */}
          <div
            onClick={() => {
              setStatusFilter('HOLD');
              navigateToGateOperations('manifest');
            }}
            className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 hover:border-rose-500/60 transition-all cursor-pointer shadow-sm group"
          >
            <div className="flex items-center justify-between pb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                Customs Hold
              </span>
              <div className="w-8 h-8 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-600 group-hover:scale-110 transition-transform">
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-black text-slate-900 dark:text-white font-mono">
              {counts.onHold}
            </div>
            <span className="text-[10px] text-slate-400 font-medium block mt-1">
              Strictly Blocked from Release →
            </span>
          </div>
        </div>

        {/* QUICK ACCESS OPERATIONAL MODULE CARDS */}
        <div className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">
            OPERATIONAL MODULES & DISPATCH DESKS
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* Card 1: Gate Operations & Worklist */}
            <div
              onClick={() => navigateToGateOperations('manifest')}
              className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 flex flex-col justify-between hover:border-teal-500/60 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 shadow-xs cursor-pointer h-full group"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold">
                    <Boxes className="w-5 h-5 group-hover:scale-105 transition-transform" />
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400 dark:text-slate-500 group-hover:text-teal-600 group-hover:translate-x-1 transition-all" />
                </div>
                <h3 className="text-base font-black text-slate-900 dark:text-white group-hover:text-teal-600 transition-colors mb-1">
                  Gate Operations & Pass Generation
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-normal">
                  Review customs-cleared container pipeline, assign transport trucks & registered commercial drivers, and generate authoritative Digital Gate Passes.
                </p>
              </div>
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 text-xs font-bold text-teal-600 dark:text-teal-400 flex items-center gap-1 mt-4">
                <span>Launch Gate Operations</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Card 2: Digital Gate Passes */}
            <div
              onClick={() => navigateToGateOperations('directory')}
              className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 flex flex-col justify-between hover:border-teal-500/60 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 shadow-xs cursor-pointer h-full group"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center font-bold">
                    <QrCode className="w-5 h-5 group-hover:scale-105 transition-transform" />
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400 dark:text-slate-500 group-hover:text-sky-600 group-hover:translate-x-1 transition-all" />
                </div>
                <h3 className="text-base font-black text-slate-900 dark:text-white group-hover:text-sky-600 transition-colors mb-1">
                  Digital Gate Passes
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-normal">
                  Track and audit all generated digital gate passes, monitor email delivery statuses to assigned drivers, and preview, print, or download passes.
                </p>
              </div>
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 text-xs font-bold text-sky-600 dark:text-sky-400 flex items-center gap-1 mt-4">
                <span>View Digital Gate Passes</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Card 3: QR Verification & Release Desk */}
            <div
              onClick={() => navigateToGateOperations('verify')}
              className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 flex flex-col justify-between hover:border-emerald-500/60 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 shadow-xs cursor-pointer h-full group"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                    <ShieldCheck className="w-5 h-5 group-hover:scale-105 transition-transform" />
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400 dark:text-slate-500 group-hover:text-emerald-600 group-hover:translate-x-1 transition-all" />
                </div>
                <h3 className="text-base font-black text-slate-900 dark:text-white group-hover:text-emerald-600 transition-colors mb-1">
                  QR Scanner & Release Desk
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-normal">
                  Perform real-time barcode/QR scans, execute authoritative backend validations, complete physical 4-point verification, and authorize barrier exit.
                </p>
              </div>
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mt-4">
                <span>Open Verification Desk</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Card 4: Export Truck Gate-In */}
            <div
              onClick={() => navigateToGateOperations('export-gate-in')}
              className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 flex flex-col justify-between hover:border-amber-500/60 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 shadow-xs cursor-pointer h-full group"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
                    <ArrowDownRight className="w-5 h-5 group-hover:scale-105 transition-transform" />
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400 dark:text-slate-500 group-hover:text-amber-600 group-hover:translate-x-1 transition-all" />
                </div>
                <h3 className="text-base font-black text-slate-900 dark:text-white group-hover:text-amber-600 transition-colors mb-1">
                  Export Truck Gate-In
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-normal">
                  Record actual physical arrival of drayage trucks delivering outbound export containers before yard staging and vessel loading.
                </p>
              </div>
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1 mt-4">
                <span>Open Gate-In Desk</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>
        </div>

        {/* PRIORITY CLEARED WORKLIST QUICK PREVIEW */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Customs-Cleared Containers Awaiting Gate Pass ({counts.clearedForRelease})</span>
              </h3>
              <span className="text-xs text-slate-400 block mt-0.5">
                Eligible consignments ready for truck assignment and gate movement authorization.
              </span>
            </div>

            <button
              onClick={() => navigateToGateOperations('manifest')}
              className="px-3.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-xs"
            >
              <span>Go to Full Gate Operations</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {allClearedContainers.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-800">
              No containers currently cleared and awaiting gate pass.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-black uppercase tracking-wider text-[10px]">
                    <th className="p-2.5">Container</th>
                    <th className="p-2.5">Vessel</th>
                    <th className="p-2.5">Gross Weight</th>
                    <th className="p-2.5">Customs Status</th>
                    <th className="p-2.5">Pass Status</th>
                    <th className="p-2.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                  {allClearedContainers.slice(0, 5).map(c => (
                    <tr key={c.container_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="p-2.5 font-mono font-bold text-slate-900 dark:text-white">
                        {c.container_number}
                      </td>
                      <td className="p-2.5 text-slate-700 dark:text-slate-300">
                        {c.cargo_context?.vessel_name || 'Carrier Vessel'}
                      </td>
                      <td className="p-2.5 font-mono text-emerald-600 font-bold">
                        {c.container_gross_weight} MT
                      </td>
                      <td className="p-2.5">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/30">
                          CLEARED
                        </span>
                      </td>
                      <td className="p-2.5">
                        {c.gate_pass ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-teal-500/10 text-teal-600 border border-teal-500/30">
                            {c.gate_pass.gate_pass_id}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400">Ready for Pass</span>
                        )}
                      </td>
                      <td className="p-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            handleOpenGenerateGatePass(c);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold text-[11px] cursor-pointer"
                        >
                          Assign Driver & Pass
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* MODALS AVAILABLE ON DASHBOARD */}
        <GenerateGatePassModal
          isOpen={showGeneratePassModal}
          onClose={() => setShowGeneratePassModal(false)}
          selectedContainers={containersForPassModal}
          allClearedContainers={allClearedContainers}
          onSuccess={handleGatePassGenerated}
        />

        {viewingGatePass && (
          <DigitalGatePassModal
            isOpen={!!viewingGatePass}
            onClose={() => setViewingGatePass(null)}
            gatePass={viewingGatePass}
            onResendSuccess={(updated) => setViewingGatePass(updated)}
          />
        )}
      </div>
    );
  }

  // =========================================================================
  // VIEW B: DEDICATED GATE OPERATIONS MANAGEMENT PAGE (/gate/gate-operations)
  // =========================================================================
  return (
    <div className="space-y-6 font-sans selection:bg-[#D49A24] selection:text-white animate-fade-in">
      {/* OPERATIONS HEADER & SUB-VIEW TABS */}
      <div className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 space-y-4 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/30 inline-flex items-center gap-1">
                <Truck className="w-3 h-3 text-teal-500" />
                <span>Gate & Truck Operations</span>
              </span>
              <span className="text-xs text-slate-400 font-mono">
                Officer: {currentUser?.name || currentUser?.email || 'Gate Officer'}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              Gate Release & Digital Gate Pass Management
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-normal max-w-4xl">
              Assign drivers and transport trucks to gate movements, generate authoritative Digital Gate Passes with secure QR codes, automatically dispatch manifests to drivers, and verify physical clearances at terminal exit gates.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={fetchContainers}
              disabled={loading}
              className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors cursor-pointer border border-slate-200 dark:border-slate-700 flex items-center gap-1.5"
              title="Refresh Release Manifest"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
          <button
            onClick={() => navigateToGateOperations('manifest')}
            className={`px-4 py-2 rounded-xl font-bold transition-all cursor-pointer flex items-center gap-2 shadow-2xs ${
              operationsView === 'manifest'
                ? 'bg-teal-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <Boxes className="w-4 h-4" />
            <span>Container Release Worklist</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
              operationsView === 'manifest' ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
            }`}>
              {counts.clearedForRelease}
            </span>
          </button>

          <button
            onClick={() => navigateToGateOperations('directory')}
            className={`px-4 py-2 rounded-xl font-bold transition-all cursor-pointer flex items-center gap-2 shadow-2xs ${
              operationsView === 'directory'
                ? 'bg-teal-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <QrCode className="w-4 h-4" />
            <span>Digital Gate Passes</span>
          </button>

          <button
            onClick={() => navigateToGateOperations('verify')}
            className={`px-4 py-2 rounded-xl font-bold transition-all cursor-pointer flex items-center gap-2 shadow-2xs ${
              operationsView === 'verify'
                ? 'bg-teal-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>QR Verification & Release Desk</span>
          </button>

          <button
            onClick={() => navigateToGateOperations('export-gate-in')}
            className={`px-4 py-2 rounded-xl font-bold transition-all cursor-pointer flex items-center gap-2 shadow-2xs ${
              operationsView === 'export-gate-in'
                ? 'bg-teal-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <ArrowDownRight className="w-4 h-4" />
            <span>Export Truck Gate-In</span>
          </button>
        </div>
      </div>

      {/* SUB-VIEW 1: DIGITAL GATE PASSES */}
      {operationsView === 'directory' && (
        <GatePassDirectory
          onSelectPass={(pass) => setViewingGatePass(pass)}
          onNavigateToVerify={(code) => {
            setVerifyPrefillCode(String(code));
            navigateToGateOperations('verify');
          }}
        />
      )}

      {/* SUB-VIEW 2: QR VERIFICATION & RELEASE DESK */}
      {operationsView === 'verify' && (
        <GatePassVerificationDesk
          initialCode={verifyPrefillCode}
          onReleaseSuccess={() => {
            fetchContainers();
            addToast('success', 'Gate Movement Authorized', 'Gate release authorized and container(s) released successfully.');
          }}
        />
      )}

      {/* SUB-VIEW 4: EXPORT TRUCK GATE-IN */}
      {operationsView === 'export-gate-in' && (
        <ExportGateInDesk
          onGateInSuccess={() => {
            fetchContainers();
            addToast('success', 'Gate-In Recorded', 'Export container recorded as ARRIVED at terminal gate.');
          }}
        />
      )}

      {/* SUB-VIEW 3: CONTAINER RELEASE WORKLIST */}
      {operationsView === 'manifest' && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div
              onClick={() => setStatusFilter(statusFilter === 'CLEARED' ? 'all' : 'CLEARED')}
              className={`p-5 rounded-2xl bg-white dark:bg-slate-900 border transition-all cursor-pointer shadow-sm ${
                statusFilter === 'CLEARED'
                  ? 'border-emerald-500 ring-2 ring-emerald-500/20'
                  : 'border-slate-200/90 dark:border-slate-800 hover:border-emerald-500/40'
              }`}
            >
              <div className="flex items-center justify-between pb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  Cleared for Release
                </span>
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>
              <div className="text-3xl font-black text-slate-900 dark:text-white font-mono">
                {counts.clearedForRelease}
              </div>
              <span className="text-[10px] text-slate-400 font-medium block mt-1">
                Customs Cleared • Eligible for Gate Exit
              </span>
            </div>

            <div
              onClick={() => setStatusFilter(statusFilter === 'PENDING' ? 'all' : 'PENDING')}
              className={`p-5 rounded-2xl bg-white dark:bg-slate-900 border transition-all cursor-pointer shadow-sm ${
                statusFilter === 'PENDING'
                  ? 'border-purple-500 ring-2 ring-purple-500/20'
                  : 'border-slate-200/90 dark:border-slate-800 hover:border-purple-500/40'
              }`}
            >
              <div className="flex items-center justify-between pb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                  Pending Gate Verification
                </span>
                <div className="w-8 h-8 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-600">
                  <Clock className="w-4 h-4" />
                </div>
              </div>
              <div className="text-3xl font-black text-slate-900 dark:text-white font-mono">
                {counts.pendingGateVerification}
              </div>
              <span className="text-[10px] text-slate-400 font-medium block mt-1">
                In Customs Pipeline • Release Locked
              </span>
            </div>

            <div
              onClick={() => setStatusFilter(statusFilter === 'RELEASED' ? 'all' : 'RELEASED')}
              className={`p-5 rounded-2xl bg-white dark:bg-slate-900 border transition-all cursor-pointer shadow-sm ${
                statusFilter === 'RELEASED'
                  ? 'border-teal-500 ring-2 ring-teal-500/20'
                  : 'border-slate-200/90 dark:border-slate-800 hover:border-teal-500/40'
              }`}
            >
              <div className="flex items-center justify-between pb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">
                  Released
                </span>
                <div className="w-8 h-8 rounded-xl bg-teal-500/10 flex items-center justify-center text-teal-600">
                  <Truck className="w-4 h-4" />
                </div>
              </div>
              <div className="text-3xl font-black text-slate-900 dark:text-white font-mono">
                {counts.released}
              </div>
              <span className="text-[10px] text-slate-400 font-medium block mt-1">
                Completed Gate Verification & Departed
              </span>
            </div>

            <div
              onClick={() => setStatusFilter(statusFilter === 'HOLD' ? 'all' : 'HOLD')}
              className={`p-5 rounded-2xl bg-white dark:bg-slate-900 border transition-all cursor-pointer shadow-sm ${
                statusFilter === 'HOLD'
                  ? 'border-rose-500 ring-2 ring-rose-500/20'
                  : 'border-slate-200/90 dark:border-slate-800 hover:border-rose-500/40'
              }`}
            >
              <div className="flex items-center justify-between pb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                  On Hold
                </span>
                <div className="w-8 h-8 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-600">
                  <AlertTriangle className="w-4 h-4" />
                </div>
              </div>
              <div className="text-3xl font-black text-slate-900 dark:text-white font-mono">
                {counts.onHold}
              </div>
              <span className="text-[10px] text-slate-400 font-medium block mt-1">
                Customs Issue Found • Release Strictly Blocked
              </span>
            </div>
          </div>

          {/* Multi-selection Action Banner */}
          {selectedContainerIds.length > 0 && (
            <div className="p-4 rounded-2xl bg-emerald-600 text-white shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                  <Boxes className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-black text-sm">
                    {selectedContainerIds.length} Customs-Cleared Container{selectedContainerIds.length !== 1 ? 's' : ''} Selected
                  </h3>
                  <span className="text-xs text-emerald-100">
                    A single truck movement may haul multiple authorized containers.
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedContainerIds([])}
                  className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition-colors cursor-pointer"
                >
                  Clear Selection
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenGenerateGatePass()}
                  className="px-4 py-1.5 rounded-xl bg-white text-emerald-800 hover:bg-emerald-50 font-black text-xs transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-sm"
                >
                  <QrCode className="w-3.5 h-3.5" />
                  <span>Assign Driver & Generate Digital Gate Pass</span>
                </button>
              </div>
            </div>
          )}

          {/* Release Worklist Toolbar */}
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                placeholder="Search by container, vessel, IMO, cargo, truck, driver, or Pass ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#D49A24]"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 text-xs">
              <button
                onClick={() => setStatusFilter('CLEARED')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-colors cursor-pointer shrink-0 flex items-center gap-1.5 ${
                  statusFilter === 'CLEARED'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Eligible for Release ({counts.clearedForRelease})</span>
              </button>

              <button
                onClick={() => setStatusFilter('RELEASED')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-colors cursor-pointer shrink-0 flex items-center gap-1.5 ${
                  statusFilter === 'RELEASED'
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'bg-teal-500/10 text-teal-700 dark:text-teal-400 hover:bg-teal-500/20'
                }`}
              >
                <Truck className="w-3.5 h-3.5" />
                <span>Released ({counts.released})</span>
              </button>

              <button
                onClick={() => setStatusFilter('HOLD')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-colors cursor-pointer shrink-0 flex items-center gap-1.5 ${
                  statusFilter === 'HOLD'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'bg-rose-500/10 text-rose-700 dark:text-rose-400 hover:bg-rose-500/20'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>On Hold ({counts.onHold})</span>
              </button>

              <button
                onClick={() => setStatusFilter('PENDING')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-colors cursor-pointer shrink-0 flex items-center gap-1.5 ${
                  statusFilter === 'PENDING'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'bg-purple-500/10 text-purple-700 dark:text-purple-400 hover:bg-purple-500/20'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Customs Pending ({counts.pendingGateVerification})</span>
              </button>

              <button
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-colors cursor-pointer shrink-0 ${
                  statusFilter === 'all'
                    ? 'bg-slate-700 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                }`}
              >
                All Manifest ({counts.total})
              </button>
            </div>
          </div>

          {/* Protocol notice */}
          <div className="p-3.5 rounded-xl bg-teal-500/10 border border-teal-500/30 text-teal-900 dark:text-teal-200 text-xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 shrink-0 text-teal-600 dark:text-teal-400" />
              <span>
                <strong>Gate Operations Enforcement Protocol:</strong> Only containers with status <strong>CLEARED</strong> and Customs Inspection result <strong>CLEARED</strong> are eligible for digital gate pass generation and release. Containers in Registered, Arrived, At Terminal, Awaiting Customs, Under Inspection, or Customs Hold are strictly locked against terminal exit.
              </span>
            </div>
          </div>

          {/* Error alert */}
          {error && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-400 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Worklist Table */}
          {loading ? (
            <div className="p-12 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 text-xs text-slate-400 space-y-2">
              <RefreshCw className="w-6 h-6 mx-auto animate-spin text-[#D49A24]" />
              <span>Loading container release worklist...</span>
            </div>
          ) : filteredContainers.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 text-slate-400 space-y-3">
              <Boxes className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600" />
              <p className="font-bold text-sm text-slate-700 dark:text-slate-300">
                {statusFilter === 'CLEARED'
                  ? 'No containers currently cleared for gate release'
                  : 'No containers matching the selected filter'}
              </p>
              <span className="text-xs text-slate-400 block max-w-sm mx-auto">
                {statusFilter === 'CLEARED'
                  ? 'Containers will appear in this worklist automatically once granted clearance by the Customs Officer.'
                  : 'Try clearing the search query or changing your status view filter.'}
              </span>
            </div>
          ) : (
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-black uppercase tracking-wider text-[10px]">
                      <th className="p-3.5 w-10 text-center">
                        <button
                          type="button"
                          onClick={handleSelectAllCleared}
                          className="text-slate-400 hover:text-emerald-600 transition-colors cursor-pointer"
                          title="Select / Deselect all cleared containers"
                        >
                          <CheckSquare className="w-4 h-4" />
                        </button>
                      </th>
                      <th className="p-3.5">Container Number</th>
                      <th className="p-3.5">Carrier Vessel</th>
                      <th className="p-3.5">Cargo Consignment</th>
                      <th className="p-3.5">Gross Weight</th>
                      <th className="p-3.5">Customs Status</th>
                      <th className="p-3.5">Gate / Pass Status</th>
                      <th className="p-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium text-slate-700 dark:text-slate-300">
                    {filteredContainers.map((container) => {
                      const cargo = container.cargo_context;
                      const isCleared = container.container_status === 'CLEARED';
                      const isReleased = container.container_status === 'RELEASED';
                      const isHold = container.container_status === 'CUSTOMS_HOLD';
                      const hasActivePass = Boolean(container.gate_pass && container.gate_pass.gate_pass_status === 'ACTIVE');
                      const isSelected = selectedContainerIds.includes(container.container_id);

                      return (
                        <tr
                          key={container.container_id}
                          onClick={() => setSelectedContainer(container)}
                          className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors cursor-pointer group ${
                            isSelected ? 'bg-emerald-500/5 dark:bg-emerald-950/20' : ''
                          }`}
                        >
                          <td className="p-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                            {isCleared && !hasActivePass ? (
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleToggleSelectContainer(container.container_id)}
                                className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                              />
                            ) : (
                              <span className="text-slate-300 dark:text-slate-700 text-xs">—</span>
                            )}
                          </td>

                          <td className="p-3.5 font-mono font-bold text-slate-900 dark:text-white group-hover:text-[#D49A24] transition-colors whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <Boxes className="w-3.5 h-3.5 text-[#D49A24]" />
                              <span>{container.container_number}</span>
                            </div>
                            <span className="block text-[9px] text-slate-400 font-normal font-sans mt-0.5">
                              {container.container_type_display || container.container_type} • {container.teu_equivalent} TEU
                            </span>
                          </td>

                          <td className="p-3.5 whitespace-nowrap">
                            <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white">
                              <Ship className="w-3.5 h-3.5 text-[#D49A24] shrink-0" />
                              <span>{cargo?.vessel_name || 'Carrier Vessel'}</span>
                            </div>
                            <span className="text-[10px] font-mono text-slate-400 block mt-0.5">
                              IMO: {cargo?.vessel_imo_number || '—'} • AR-00{cargo?.arrival_request_id || '—'}
                            </span>
                          </td>

                          <td className="p-3.5 max-w-xs">
                            <div className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                              {cargo?.cargo_description || '—'}
                            </div>
                            <span className="text-[10px] font-mono text-[#D49A24] block mt-0.5">
                              #CRG-00{cargo?.cargo_id || container.container_cargo_id} • {cargo?.cargo_quantity} {cargo?.cargo_unit}
                            </span>
                          </td>

                          <td className="p-3.5 font-mono font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                            {container.container_gross_weight} MT
                          </td>

                          <td className="p-3.5 whitespace-nowrap">
                            {isCleared && (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 inline-flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                                <span>Customs Cleared</span>
                              </span>
                            )}
                            {isHold && (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30 inline-flex items-center gap-1">
                                <XCircle className="w-3 h-3 text-rose-500" />
                                <span>Customs Hold</span>
                              </span>
                            )}
                            {isReleased && (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/30 inline-flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3 text-teal-500" />
                                <span>Cleared & Exited</span>
                              </span>
                            )}
                            {container.container_status === 'UNDER_INSPECTION' && (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/30 inline-flex items-center gap-1">
                                <ShieldCheck className="w-3 h-3 text-purple-500" />
                                <span>Under Inspection</span>
                              </span>
                            )}
                            {container.container_status === 'AWAITING_CUSTOMS' && (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 inline-flex items-center gap-1">
                                <Clock className="w-3 h-3 text-amber-500" />
                                <span>Awaiting Customs</span>
                              </span>
                            )}
                            {container.container_status === 'AT_TERMINAL' && (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 inline-flex items-center gap-1">
                                <Boxes className="w-3 h-3 text-amber-500" />
                                <span>At Terminal</span>
                              </span>
                            )}
                            {container.container_status === 'ARRIVED' && (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30 inline-flex items-center gap-1">
                                <Ship className="w-3 h-3 text-indigo-500" />
                                <span>Arrived</span>
                              </span>
                            )}
                            {container.container_status === 'REGISTERED' && (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/30 inline-flex items-center gap-1">
                                <Clock className="w-3 h-3 text-sky-500" />
                                <span>Registered</span>
                              </span>
                            )}
                          </td>

                          <td className="p-3.5 whitespace-nowrap">
                            {hasActivePass ? (
                              <div 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (container.gate_pass?.id) handleViewPassById(container.gate_pass.id);
                                }}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/20 transition-colors cursor-pointer"
                                title="Click to view full Digital Gate Pass & QR"
                              >
                                <QrCode className="w-3.5 h-3.5 text-emerald-600" />
                                <div>
                                  <span className="font-mono font-black text-[11px] block">
                                    {container.gate_pass?.gate_pass_id}
                                  </span>
                                  <span className="text-[9px] text-emerald-600 block">
                                    ACTIVE • Truck: {container.gate_pass?.truck_number}
                                  </span>
                                </div>
                              </div>
                            ) : isCleared ? (
                              <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 font-bold text-[11px] inline-flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                <span>Eligible for Gate Pass</span>
                              </span>
                            ) : isReleased ? (
                              <div className="space-y-0.5">
                                <span className="text-[11px] text-teal-600 dark:text-teal-400 font-bold flex items-center gap-1">
                                  <Truck className="w-3.5 h-3.5" />
                                  <span>Released: {container.gate_release?.truck_number || container.gate_pass?.truck_number || 'Truck Exited'}</span>
                                </span>
                                <span className="text-[10px] font-mono text-slate-400 block">
                                  {formatDate(container.gate_release?.release_time || container.gate_pass?.gate_pass_used_at)}
                                </span>
                              </div>
                            ) : isHold ? (
                              <span className="px-2.5 py-1 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30 font-bold text-[11px] inline-flex items-center gap-1">
                                <Lock className="w-3.5 h-3.5 text-rose-500" />
                                <span>Release Strictly Blocked (Hold)</span>
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 font-bold text-[11px] inline-flex items-center gap-1">
                                <Lock className="w-3.5 h-3.5 text-slate-400" />
                                <span>Release Locked (Uncleared)</span>
                              </span>
                            )}
                          </td>

                          <td className="p-3.5 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedContainer(container);
                                }}
                                className="p-1.5 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-600 dark:text-sky-400 transition-colors cursor-pointer"
                                title="View Detailed Container Manifest"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>

                              {isCleared && !hasActivePass && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenGenerateGatePass(container);
                                  }}
                                  className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-xs"
                                  title="Assign Driver & Generate Digital Gate Pass"
                                >
                                  <QrCode className="w-3.5 h-3.5" />
                                  <span>Assign Driver & Pass</span>
                                </button>
                              )}

                              {hasActivePass && (
                                <>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (container.gate_pass?.id) handleViewPassById(container.gate_pass.id);
                                    }}
                                    className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 transition-colors cursor-pointer"
                                    title="View Digital Gate Pass & QR"
                                  >
                                    <QrCode className="w-3.5 h-3.5" />
                                  </button>

                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const targetCode = container.gate_pass?.pass_number || (container.gate_pass?.gate_pass_id ? String(container.gate_pass.gate_pass_id) : '');
                                      setVerifyPrefillCode(targetCode);
                                      setOperationsView('verify');
                                    }}
                                    className="px-2.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs transition-colors cursor-pointer inline-flex items-center gap-1 shadow-2xs"
                                    title="Verify at Gate"
                                  >
                                    <ShieldCheck className="w-3.5 h-3.5" />
                                    <span>Verify at Gate</span>
                                  </button>
                                </>
                              )}

                              {isReleased && (
                                <span className="px-2.5 py-1 rounded-lg bg-teal-500/10 text-teal-700 dark:text-teal-400 font-bold text-[11px] inline-flex items-center gap-1 border border-teal-500/30">
                                  <CheckCircle2 className="w-3 h-3 text-teal-500" />
                                  <span>Released</span>
                                </span>
                              )}

                              {!isCleared && !isReleased && (
                                <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-700 font-bold text-[11px] inline-flex items-center gap-1 opacity-60">
                                  <Lock className="w-3 h-3 text-slate-400" />
                                  <span>Release Locked</span>
                                </span>
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
        </>
      )}

      {/* MODALS AVAILABLE ON GATE OPERATIONS PAGE */}
      <GenerateGatePassModal
        isOpen={showGeneratePassModal}
        onClose={() => setShowGeneratePassModal(false)}
        selectedContainers={containersForPassModal}
        allClearedContainers={allClearedContainers}
        onSuccess={handleGatePassGenerated}
      />

      {viewingGatePass && (
        <DigitalGatePassModal
          isOpen={!!viewingGatePass}
          onClose={() => setViewingGatePass(null)}
          gatePass={viewingGatePass}
          onResendSuccess={(updated) => setViewingGatePass(updated)}
        />
      )}

      {/* CONTAINER DETAILS MODAL */}
      <Modal
        isOpen={!!selectedContainer}
        onClose={() => setSelectedContainer(null)}
        title="Container Manifest & Gate Verification Audit"
        subtitle={`Container #${selectedContainer?.container_number} • Consignment Release Audit`}
        icon={<Truck className="w-5 h-5 text-teal-600" />}
        maxWidth="3xl"
      >
        {selectedContainer && (
          <div className="space-y-5">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Container Number
                </span>
                <h3 className="text-2xl font-black font-mono text-slate-900 dark:text-white mt-0.5">
                  {selectedContainer.container_number}
                </h3>
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  {selectedContainer.container_type_display || selectedContainer.container_type} • {selectedContainer.teu_equivalent} TEU Capacity
                </span>
              </div>
              <div className="text-left sm:text-right">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Current Status
                </span>
                {selectedContainer.container_status === 'CLEARED' ? (
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/30 inline-flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Cleared for Release</span>
                  </span>
                ) : selectedContainer.container_status === 'RELEASED' ? (
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-teal-500/10 text-teal-600 border border-teal-500/30 inline-flex items-center gap-1">
                    <Truck className="w-3.5 h-3.5 text-teal-500" />
                    <span>Released</span>
                  </span>
                ) : selectedContainer.container_status === 'CUSTOMS_HOLD' ? (
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-600 border border-rose-500/30 inline-flex items-center gap-1">
                    <XCircle className="w-3.5 h-3.5 text-rose-500" />
                    <span>Customs Hold</span>
                  </span>
                ) : (
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-700 inline-flex items-center gap-1">
                    <Lock className="w-3.5 h-3.5 text-slate-400" />
                    <span>{selectedContainer.container_status_display || selectedContainer.container_status}</span>
                  </span>
                )}
              </div>
            </div>

            {/* Stepper Visual Tracker */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400 block">
                Container Lifecycle Pipeline (Step 1-6)
              </span>
              {(() => {
                const stageInfo = getLifecycleStageInfo(selectedContainer.container_status);
                const isAllCompleted = selectedContainer.container_status === 'RELEASED';

                return (
                  <div>
                    <div className="flex items-center gap-1 pt-1">
                      {LIFECYCLE_STEPS.map((step, idx) => {
                        const isCompleted = isAllCompleted || idx < stageInfo.stepIndex;
                        const isCurrent = !isAllCompleted && idx === stageInfo.stepIndex;

                        let dotBg = 'bg-slate-200 dark:bg-slate-700 text-slate-400';
                        if (isCompleted) {
                          dotBg = 'bg-emerald-500 text-white';
                        } else if (isCurrent) {
                          if (stageInfo.stepStatus === 'awaiting_customs') {
                            dotBg = 'bg-amber-500 text-white ring-2 ring-amber-500/40 shadow-sm animate-pulse';
                          } else if (stageInfo.stepStatus === 'under_inspection') {
                            dotBg = 'bg-purple-600 text-white ring-2 ring-purple-600/40 shadow-sm';
                          } else if (stageInfo.stepStatus === 'customs_hold') {
                            dotBg = 'bg-rose-600 text-white ring-2 ring-rose-600/40 shadow-sm';
                          } else {
                            dotBg = 'bg-teal-600 text-white ring-2 ring-teal-600/40 shadow-sm';
                          }
                        }

                        return (
                          <React.Fragment key={step.key}>
                            <div className="flex-1 text-center">
                              <div
                                className={`w-6 h-6 mx-auto rounded-full flex items-center justify-center text-[10px] font-black transition-colors ${dotBg}`}
                              >
                                {isCompleted ? '✓' : step.stepNumber}
                              </div>
                              <span
                                className={`text-[9px] font-bold mt-1 block truncate ${
                                  isCurrent
                                    ? 'text-teal-600 dark:text-teal-400'
                                    : isCompleted
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : 'text-slate-400'
                                }`}
                              >
                                {step.label}
                              </span>
                            </div>
                            {idx < LIFECYCLE_STEPS.length - 1 && (
                              <div
                                className={`h-0.5 w-3 sm:w-6 mb-4 transition-colors ${
                                  isCompleted ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700'
                                }`}
                              />
                            )}
                          </React.Fragment>
                        );
                      })}
                    </div>
                    <div className="pt-2 text-center text-xs font-bold text-slate-700 dark:text-slate-300">
                      {isAllCompleted ? (
                        <span className="text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Current Operational Milestone: {stageInfo.label} (Step {stageInfo.stepNumber}/6)</span>
                        </span>
                      ) : (
                        <span>
                          Current Milestone: <span className="text-[#D49A24]">{stageInfo.label}</span> (Step {stageInfo.stepNumber}/6)
                        </span>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Section 1: Container Technical Specs */}
            <div className="space-y-2">
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-[#D49A24] border-b border-slate-200 dark:border-slate-800 pb-1">
                1. Container Technical & Sizing Specifications
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                  <span className="text-slate-400 text-[10px] font-medium block">Container Number</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white mt-0.5 block">
                    {selectedContainer.container_number}
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                  <span className="text-slate-400 text-[10px] font-medium block">Container Type</span>
                  <span className="font-bold text-slate-900 dark:text-white mt-0.5 block">
                    {selectedContainer.container_type_display || selectedContainer.container_type}
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                  <span className="text-slate-400 text-[10px] font-medium block">Container Capacity</span>
                  <span className="font-mono font-bold text-sky-600 dark:text-sky-400 mt-0.5 block">
                    {selectedContainer.teu_equivalent} TEU
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                  <span className="text-slate-400 text-[10px] font-medium block">Gross Weight</span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 block">
                    {selectedContainer.container_gross_weight} Metric Tonnes
                  </span>
                </div>
              </div>
            </div>

            {/* Section 2: Cargo Consignment */}
            <div className="space-y-2">
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400 border-b border-slate-200 dark:border-slate-800 pb-1">
                2. Cargo Consignment Details
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                  <span className="text-slate-400 text-[10px] font-medium block">Cargo Consignment</span>
                  <span className="font-mono font-bold text-[#D49A24] mt-0.5 block">
                    #CRG-00{selectedContainer.cargo_context?.cargo_id || selectedContainer.container_cargo_id}
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                  <span className="text-slate-400 text-[10px] font-medium block">Cargo Description</span>
                  <span className="font-bold text-slate-900 dark:text-white mt-0.5 block truncate">
                    {selectedContainer.cargo_context?.cargo_description || '—'}
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                  <span className="text-slate-400 text-[10px] font-medium block">Cargo Quantity</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200 mt-0.5 block">
                    {selectedContainer.cargo_context?.cargo_quantity || '—'} {selectedContainer.cargo_context?.cargo_unit || ''}
                  </span>
                </div>
              </div>
            </div>

            {/* Section 3: Vessel & Arrival Information */}
            <div className="space-y-2">
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 border-b border-slate-200 dark:border-slate-800 pb-1">
                3. Carrier Vessel & Arrival Request
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                  <span className="text-slate-400 text-[10px] font-medium block">Vessel Name</span>
                  <span className="font-bold text-slate-900 dark:text-white mt-0.5 block">
                    {selectedContainer.cargo_context?.vessel_name || 'Carrier Vessel'}
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                  <span className="text-slate-400 text-[10px] font-medium block">IMO Number</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200 mt-0.5 block">
                    {selectedContainer.cargo_context?.vessel_imo_number || '—'}
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                  <span className="text-slate-400 text-[10px] font-medium block">Arrival Request ID</span>
                  <span className="font-mono font-bold text-sky-600 dark:text-sky-400 mt-0.5 block">
                    AR-00{selectedContainer.cargo_context?.arrival_request_id || '—'}
                  </span>
                </div>
              </div>
            </div>

            {/* Section 4: Customs Clearance Details */}
            <div className="space-y-2">
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 border-b border-slate-200 dark:border-slate-800 pb-1">
                4. Customs Clearance & Inspection Handoff
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                  <span className="text-slate-400 text-[10px] font-medium block">Customs Status</span>
                  <span className="font-bold text-slate-900 dark:text-white mt-0.5 block">
                    {selectedContainer.customs_inspection?.inspection_status_display ||
                      selectedContainer.customs_inspection?.inspection_status ||
                      (selectedContainer.container_status === 'CLEARED' ? 'COMPLETED' : '—')}
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                  <span className="text-slate-400 text-[10px] font-medium block">Customs Clearance Result</span>
                  <span className={`font-bold mt-0.5 block ${
                    selectedContainer.customs_inspection?.inspection_result === 'CLEARED' || selectedContainer.container_status === 'CLEARED' || selectedContainer.container_status === 'RELEASED'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-amber-600'
                  }`}>
                    {selectedContainer.customs_inspection?.inspection_result_display ||
                      selectedContainer.customs_inspection?.inspection_result ||
                      (selectedContainer.container_status === 'CLEARED' || selectedContainer.container_status === 'RELEASED' ? 'CLEARED' : 'PENDING')}
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                  <span className="text-slate-400 text-[10px] font-medium block">Customs Officer</span>
                  <span className="font-bold text-slate-900 dark:text-white mt-0.5 block truncate">
                    {selectedContainer.customs_inspection?.officer_name ||
                      selectedContainer.latest_customs_inspection?.customs_inspection_officer_name ||
                      'Customs Authority'}
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                  <span className="text-slate-400 text-[10px] font-medium block">Customs Clearance Date</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300 mt-0.5 block">
                    {formatDate(
                      selectedContainer.customs_inspection?.clearance_date ||
                      selectedContainer.latest_customs_inspection?.customs_inspection_clearance_date
                    )}
                  </span>
                </div>
              </div>
            </div>

            {/* Section 5: Digital Gate Pass Association (if present) */}
            {selectedContainer.gate_pass && (
              <div className="space-y-2">
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400 border-b border-slate-200 dark:border-slate-800 pb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <QrCode className="w-3.5 h-3.5" />
                    <span>5. Digital Gate Pass Authorization</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedContainer.gate_pass?.id) {
                        handleViewPassById(selectedContainer.gate_pass.id);
                      }
                    }}
                    className="text-[10px] text-teal-600 hover:underline font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Eye className="w-3 h-3" />
                    <span>View Pass & QR Code</span>
                  </button>
                </h4>

                <div className="p-4 rounded-xl bg-teal-500/10 border border-teal-500/30 text-xs space-y-2">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div>
                      <span className="text-slate-400 text-[10px] font-medium block">Gate Pass ID</span>
                      <span className="font-mono font-black text-teal-900 dark:text-teal-100">
                        {selectedContainer.gate_pass.gate_pass_id}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 text-[10px] font-medium block">Pass Status</span>
                      <span className="font-bold text-teal-800 dark:text-teal-200">
                        {selectedContainer.gate_pass.gate_pass_status}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 text-[10px] font-medium block">Assigned Truck</span>
                      <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                        {selectedContainer.gate_pass.truck_number}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 text-[10px] font-medium block">Assigned Driver</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {selectedContainer.gate_pass.driver_name}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-teal-500/20 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                    <div>
                      <span className="text-slate-400 text-[10px]">Designated Gate: </span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {selectedContainer.gate_pass.gate_name}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px]">Valid Until: </span>
                      <span className="font-mono text-slate-800 dark:text-slate-200">
                        {formatDate(selectedContainer.gate_pass.gate_pass_valid_until)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Section 6: Gate Release Audit Record (if released) */}
            {selectedContainer.gate_release && (
              <div className="space-y-2">
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400 border-b border-slate-200 dark:border-slate-800 pb-1 flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5" />
                  <span>6. Gate Release Audit Record</span>
                </h4>
                <div className="p-4 rounded-xl bg-teal-500/10 border border-teal-500/30 text-xs space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div>
                      <span className="text-slate-400 text-[10px] font-medium block">Truck / Registration</span>
                      <span className="font-mono font-bold text-teal-800 dark:text-teal-200">
                        {selectedContainer.gate_release.truck_number}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 text-[10px] font-medium block">Driver Name</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {selectedContainer.gate_release.driver_name}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 text-[10px] font-medium block">License Reference</span>
                      <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                        {selectedContainer.gate_release.driver_license}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 text-[10px] font-medium block">Exit Point</span>
                      <span className="font-bold text-teal-800 dark:text-teal-200">
                        {selectedContainer.gate_release.exit_point}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-teal-500/20 grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-[11px]">
                    <div>
                      <span className="text-slate-400 text-[10px] font-medium block">Gate Officer</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {selectedContainer.gate_release.officer_name || 'Gate Officer'}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 text-[10px] font-medium block">Release Timestamp</span>
                      <span className="font-mono text-slate-800 dark:text-slate-200">
                        {formatDate(selectedContainer.gate_release.release_time)}
                      </span>
                    </div>

                    {selectedContainer.gate_release.remarks && (
                      <div>
                        <span className="text-slate-400 text-[10px] font-medium block">Remarks</span>
                        <span className="text-slate-700 dark:text-slate-300">
                          {selectedContainer.gate_release.remarks}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Footer actions */}
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setSelectedContainer(null)}
                className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs hover:bg-slate-300 transition-colors cursor-pointer"
              >
                Close
              </button>

              {selectedContainer.container_status === 'CLEARED' && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const c = selectedContainer;
                      setSelectedContainer(null);
                      handleOpenGenerateGatePass(c);
                    }}
                    className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-sm"
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    <span>Assign Driver & Generate Gate Pass</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* DIRECT GATE RELEASE MODAL (LEGACY FALLBACK) */}
      <Modal
        isOpen={!!releasingContainer}
        onClose={() => setReleasingContainer(null)}
        title="Gate Release Verification Form"
        subtitle={`Container #${releasingContainer?.container_number} • Mandatory Carrier & Truck Handoff`}
        icon={<Truck className="w-5 h-5 text-teal-600" />}
        maxWidth="lg"
      >
        {releasingContainer && (
          <form onSubmit={handleSubmitRelease} className="space-y-4">
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Container</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white text-sm">
                  {releasingContainer.container_number}
                </span>
                <span className="text-[10px] text-slate-500 block">
                  {releasingContainer.container_gross_weight} MT • {releasingContainer.teu_equivalent} TEU
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-0.5">Customs</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/30 inline-flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                  <span>CLEARED</span>
                </span>
              </div>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-400 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span>Truck Number / Registration Number *</span>
                <span className="text-[10px] font-normal text-slate-400">e.g. TRK-9824-AX</span>
              </label>
              <input
                type="text"
                required
                placeholder="Enter truck registration number"
                value={truckNumber}
                onChange={(e) => setTruckNumber(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono uppercase text-slate-900 dark:text-white focus:outline-none focus:border-teal-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Driver Full Name *
              </label>
              <input
                type="text"
                required
                placeholder="Enter driver's full legal name"
                value={driverName}
                onChange={(e) => setDriverName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-teal-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span>Driver Identification / License Reference *</span>
                <span className="text-[10px] font-normal text-slate-400">e.g. DL-8829104</span>
              </label>
              <input
                type="text"
                required
                placeholder="Enter commercial driver license or government ID"
                value={driverLicense}
                onChange={(e) => setDriverLicense(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono uppercase text-slate-900 dark:text-white focus:outline-none focus:border-teal-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Gate / Exit Point *
              </label>
              <select
                value={exitPoint}
                onChange={(e) => setExitPoint(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-teal-500"
              >
                {PREDEFINED_GATES.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span>Gate Verification Remarks (Optional)</span>
                <span className="text-[10px] font-normal text-slate-400">Optional notes</span>
              </label>
              <textarea
                rows={2}
                placeholder="Add any gate or security inspection notes if applicable..."
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-teal-500"
              />
            </div>

            <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-[11px] text-slate-600 dark:text-slate-400 space-y-1">
              <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
                <span>Pre-Release Verification Checklist</span>
              </div>
              <ul className="list-disc list-inside space-y-0.5 text-[10px]">
                <li>Container status verified as <strong>CLEARED</strong></li>
                <li>Customs document status confirmed as <strong>VERIFIED</strong></li>
                <li>Driver identity and truck plate match dispatch booking</li>
              </ul>
            </div>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setReleasingContainer(null)}
                disabled={releaseLoading}
                className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs hover:bg-slate-300 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={releaseLoading}
                className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-sm disabled:opacity-60"
              >
                {releaseLoading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Authorizing Release...</span>
                  </>
                ) : (
                  <>
                    <Truck className="w-3.5 h-3.5" />
                    <span>Authorize Gate Release</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};
