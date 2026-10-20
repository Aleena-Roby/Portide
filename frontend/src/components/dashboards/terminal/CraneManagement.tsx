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
  Ship,
  Layers,
  ChevronRight,
  ChevronDown,
  Info,
  Calendar,
  User,
  SlidersHorizontal,
  History,
  Activity,
  BarChart3,
  Check,
  AlertTriangle,
  X,
  Play,
  CheckSquare,
  Ban,
  Plus,
  Edit,
  Eye,
  Trash2,
  Anchor,
  Wrench,
  Gauge,
  MoveHorizontal
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../../../services/api';
import { useApp } from '../../../context/AppContext';
import { Modal } from '../../common/Modal';
import {
  CraneItem,
  CraneAllocationItem,
  CraneOperationsSummary,
  EligibleVesselSchedule,
  CraneType,
  CraneStatus,
  CraneOperationType,
  CraneAllocationStatus
} from '../../../types';

interface CraneManagementProps {
  onNavigate?: (tab: string) => void;
}

export const CraneManagement: React.FC<CraneManagementProps> = ({ onNavigate }) => {
  const navigate = useNavigate();
  const { activeRole, addToast } = useApp();

  // Navigation Sub-tab
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'cranes' | 'allocations' | 'history'>('overview');

  // State
  const [cranes, setCranes] = useState<CraneItem[]>([]);
  const [allocations, setAllocations] = useState<CraneAllocationItem[]>([]);
  const [summary, setSummary] = useState<CraneOperationsSummary | null>(null);
  const [eligibleSchedules, setEligibleSchedules] = useState<EligibleVesselSchedule[]>([]);
  const [berths, setBerths] = useState<Array<{ berth_id: number; berth_name: string; berth_code?: string }>>([]);

  // Loading States
  const [loadingSummary, setLoadingSummary] = useState<boolean>(true);
  const [loadingCranes, setLoadingCranes] = useState<boolean>(true);
  const [loadingAllocations, setLoadingAllocations] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Filters for Cranes
  const [craneSearchQuery, setCraneSearchQuery] = useState<string>('');
  const [selectedCraneStatus, setSelectedCraneStatus] = useState<string>('');
  const [selectedCraneType, setSelectedCraneType] = useState<string>('');

  // Filters for Allocations
  const [allocSearchQuery, setAllocSearchQuery] = useState<string>('');
  const [selectedAllocStatus, setSelectedAllocStatus] = useState<string>('');
  const [selectedOpType, setSelectedOpType] = useState<string>('');

  // Modals
  const [isAddCraneModalOpen, setIsAddCraneModalOpen] = useState<boolean>(false);
  const [editingCrane, setEditingCrane] = useState<CraneItem | null>(null);
  const [viewingCrane, setViewingCrane] = useState<CraneItem | null>(null);
  const [isCreateAllocModalOpen, setIsCreateAllocModalOpen] = useState<boolean>(false);
  const [cancellingAlloc, setCancellingAlloc] = useState<CraneAllocationItem | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('');

  // Form State: Crane
  const [craneForm, setCraneForm] = useState<{
    crane_code: string;
    crane_name: string;
    crane_type: CraneType;
    crane_max_lifting_capacity_mt: string;
    crane_status: CraneStatus;
    crane_assigned_berth_id: string;
    crane_last_maintenance_date: string;
    crane_next_maintenance_due: string;
    crane_maintenance_remarks: string;
  }>({
    crane_code: '',
    crane_name: '',
    crane_type: 'STS',
    crane_max_lifting_capacity_mt: '65.00',
    crane_status: 'AVAILABLE',
    crane_assigned_berth_id: '',
    crane_last_maintenance_date: '',
    crane_next_maintenance_due: '',
    crane_maintenance_remarks: '',
  });

  // Form State: Allocation
  const [allocForm, setAllocForm] = useState<{
    crane_id: string;
    vessel_schedule_id: string;
    operation_type: CraneOperationType;
    planned_start_at: string;
    planned_end_at: string;
    remarks: string;
  }>({
    crane_id: '',
    vessel_schedule_id: '',
    operation_type: 'UNLOADING',
    planned_start_at: '',
    planned_end_at: '',
    remarks: '',
  });

  // Filter compatible operational cranes for vessel/berth allocation:
  // - Only quayside crane types (STS and MHC); RTG and RMG are excluded.
  // - If a vessel schedule is selected and the STS crane has a fixed assigned berth,
  //   the assigned berth must match the vessel schedule's assigned berth.
  const compatibleVesselCranes = useMemo(() => {
    const selectedSchedule = eligibleSchedules.find(
      s => String(s.vessel_schedule_id) === allocForm.vessel_schedule_id
    );
    return cranes.filter(c => {
      if (!c.is_operational) return false;
      if (!['STS', 'MHC'].includes(c.crane_type)) return false;
      if (c.crane_type === 'STS' && c.crane_assigned_berth_id && selectedSchedule) {
        if (c.crane_assigned_berth_id !== selectedSchedule.vessel_schedule_berth_id) {
          return false;
        }
      }
      return true;
    });
  }, [cranes, eligibleSchedules, allocForm.vessel_schedule_id]);

  // ============================================================================
  // API Fetch Functions
  // ============================================================================

  const fetchSummary = useCallback(async () => {
    setLoadingSummary(true);
    try {
      const res = await apiFetch('/api/terminal/crane-operations/summary/');
      if (res.ok) {
        const json = await res.json();
        setSummary(json.data);
      }
    } catch {
      // Quiet fail on summary
    } finally {
      setLoadingSummary(false);
    }
  }, []);

  const fetchCranes = useCallback(async () => {
    setLoadingCranes(true);
    try {
      const params = new URLSearchParams();
      if (craneSearchQuery) params.append('q', craneSearchQuery);
      if (selectedCraneStatus) params.append('status', selectedCraneStatus);
      if (selectedCraneType) params.append('type', selectedCraneType);

      const res = await apiFetch(`/api/terminal/cranes/?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setCranes(json.data || []);
      }
    } catch {
      addToast('error', 'Failed to load cranes inventory.');
    } finally {
      setLoadingCranes(false);
    }
  }, [craneSearchQuery, selectedCraneStatus, selectedCraneType, addToast]);

  const fetchAllocations = useCallback(async () => {
    setLoadingAllocations(true);
    try {
      const params = new URLSearchParams();
      if (allocSearchQuery) params.append('q', allocSearchQuery);
      if (selectedAllocStatus) params.append('status', selectedAllocStatus);
      if (selectedOpType) params.append('operation_type', selectedOpType);

      const res = await apiFetch(`/api/terminal/crane-allocations/?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setAllocations(json.data || []);
      }
    } catch {
      addToast('error', 'Failed to load crane allocations.');
    } finally {
      setLoadingAllocations(false);
    }
  }, [allocSearchQuery, selectedAllocStatus, selectedOpType, addToast]);

  const fetchMetadata = useCallback(async () => {
    try {
      const [schedulesRes, berthsRes] = await Promise.all([
        apiFetch('/api/terminal/crane-allocations/eligible-schedules/'),
        apiFetch('/api/berths/')
      ]);

      if (schedulesRes.ok) {
        const json = await schedulesRes.json();
        setEligibleSchedules(json.data || []);
      }

      if (berthsRes.ok) {
        const json = await berthsRes.json();
        setBerths(json.data || json || []);
      }
    } catch {
      // Quiet fail on metadata
    }
  }, []);

  const refreshAll = useCallback(() => {
    fetchSummary();
    fetchCranes();
    fetchAllocations();
    fetchMetadata();
  }, [fetchSummary, fetchCranes, fetchAllocations, fetchMetadata]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  // Re-fetch cranes when filters change
  useEffect(() => {
    fetchCranes();
  }, [fetchCranes]);

  // Re-fetch allocations when filters change
  useEffect(() => {
    fetchAllocations();
  }, [fetchAllocations]);

  // ============================================================================
  // Handlers: Crane Master Create & Edit
  // ============================================================================

  const handleOpenAddCrane = () => {
    setCraneForm({
      crane_code: '',
      crane_name: '',
      crane_type: 'STS',
      crane_max_lifting_capacity_mt: '65.00',
      crane_status: 'AVAILABLE',
      crane_assigned_berth_id: '',
      crane_last_maintenance_date: '',
      crane_next_maintenance_due: '',
      crane_maintenance_remarks: '',
    });
    setIsAddCraneModalOpen(true);
  };

  const handleOpenEditCrane = (c: CraneItem) => {
    setEditingCrane(c);
    setCraneForm({
      crane_code: c.crane_code,
      crane_name: c.crane_name,
      crane_type: c.crane_type,
      crane_max_lifting_capacity_mt: String(c.crane_max_lifting_capacity_mt),
      crane_status: c.crane_status,
      crane_assigned_berth_id: c.crane_assigned_berth_id ? String(c.crane_assigned_berth_id) : '',
      crane_last_maintenance_date: c.crane_last_maintenance_date || '',
      crane_next_maintenance_due: c.crane_next_maintenance_due || '',
      crane_maintenance_remarks: c.crane_maintenance_remarks || '',
    });
  };

  const handleSubmitCrane = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!craneForm.crane_code.trim() || !craneForm.crane_name.trim()) {
      addToast('error', 'Crane code and name are required.');
      return;
    }

    const capacity = parseFloat(craneForm.crane_max_lifting_capacity_mt);
    if (isNaN(capacity) || capacity <= 0) {
      addToast('error', 'Maximum lifting capacity must be greater than zero.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: Record<string, any> = {
        crane_code: craneForm.crane_code.trim().toUpperCase(),
        crane_name: craneForm.crane_name.trim(),
        crane_type: craneForm.crane_type,
        crane_max_lifting_capacity_mt: capacity,
        crane_status: craneForm.crane_status,
        crane_assigned_berth_id: craneForm.crane_assigned_berth_id ? parseInt(craneForm.crane_assigned_berth_id) : null,
        crane_last_maintenance_date: craneForm.crane_last_maintenance_date || null,
        crane_next_maintenance_due: craneForm.crane_next_maintenance_due || null,
        crane_maintenance_remarks: craneForm.crane_maintenance_remarks.trim() || null,
      };

      const endpoint = editingCrane 
        ? `/api/terminal/cranes/${editingCrane.crane_id}/` 
        : '/api/terminal/cranes/';
      const method = editingCrane ? 'PATCH' : 'POST';

      const res = await apiFetch(endpoint, {
        method,
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) {
        const errorMsg = json.message || Object.values(json.errors || {}).flat().join(', ') || 'Operation failed.';
        addToast('error', errorMsg);
        return;
      }

      addToast('success', editingCrane ? `Crane '${payload.crane_code}' updated successfully.` : `Crane '${payload.crane_code}' registered successfully.`);
      setIsAddCraneModalOpen(false);
      setEditingCrane(null);
      fetchCranes();
      fetchSummary();
    } catch {
      addToast('error', 'Network error while saving crane.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleArchiveCrane = async (c: CraneItem) => {
    if (c.active_allocations_count > 0) {
      addToast('error', `Cannot delete or archive crane '${c.crane_code}' while it has active allocations.`);
      return;
    }

    if (!window.confirm(`Are you sure you want to deactivate or remove crane '${c.crane_code}'?`)) {
      return;
    }

    try {
      const res = await apiFetch(`/api/terminal/cranes/${c.crane_id}/`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (res.ok) {
        addToast('success', json.message || `Crane '${c.crane_code}' processed.`);
        fetchCranes();
        fetchSummary();
      } else {
        addToast('error', json.message || 'Failed to archive crane.');
      }
    } catch {
      addToast('error', 'Error connecting to server.');
    }
  };

  // ============================================================================
  // Handlers: Crane Allocation & Yard Operations Dispatch
  // ============================================================================

  const handleUseInYardOperations = (crane: CraneItem) => {
    addToast(
      'info',
      'Yard Equipment Routing',
      `Navigating to Yard Operations. Equipment '${crane.crane_code}' (${crane.crane_type}) is dedicated for yard container handling and can be selected when executing container relocations.`
    );
    if (onNavigate) {
      onNavigate('yard-operations');
    } else {
      const basePath = activeRole === 'admin' || activeRole === 'port_administrator' ? '/admin' : '/terminal';
      navigate(`${basePath}/yard-operations`);
    }
  };

  const handleOpenCreateAlloc = (preselectedCrane?: CraneItem) => {
    // Context-aware protection: If preselected crane is RTG or RMG, do not open vessel allocation form.
    // Instead route directly to Yard Operations with a helpful explanatory notice.
    if (preselectedCrane && ['RTG', 'RMG'].includes(preselectedCrane.crane_type)) {
      handleUseInYardOperations(preselectedCrane);
      return;
    }

    const now = new Date();
    const plusTwoHours = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    const plusSixHours = new Date(now.getTime() + 6 * 60 * 60 * 1000);

    const formatDt = (d: Date) => d.toISOString().slice(0, 16);

    let preselectedId = '';
    if (preselectedCrane) {
      if (!['STS', 'MHC'].includes(preselectedCrane.crane_type)) {
        addToast(
          'warning',
          `Equipment '${preselectedCrane.crane_code}' (${preselectedCrane.crane_type}) is designated for yard operations and cannot be allocated to a vessel schedule.`
        );
        return;
      } else if (!preselectedCrane.is_operational) {
        addToast(
          'warning',
          `Crane '${preselectedCrane.crane_code}' is currently ${preselectedCrane.crane_status_display} and cannot be allocated.`
        );
      } else {
        preselectedId = String(preselectedCrane.crane_id);
      }
    }

    setAllocForm({
      crane_id: preselectedId,
      vessel_schedule_id: '',
      operation_type: 'UNLOADING',
      planned_start_at: formatDt(plusTwoHours),
      planned_end_at: formatDt(plusSixHours),
      remarks: '',
    });
    setIsCreateAllocModalOpen(true);
  };

  const handleSubmitAllocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allocForm.crane_id || !allocForm.vessel_schedule_id) {
      addToast('error', 'Please select both a crane and a vessel schedule.');
      return;
    }

    if (!allocForm.planned_start_at || !allocForm.planned_end_at) {
      addToast('error', 'Planned start and end times are required.');
      return;
    }

    if (new Date(allocForm.planned_end_at) <= new Date(allocForm.planned_start_at)) {
      addToast('error', 'Planned end time must be after planned start time.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        crane_allocation_crane_id: parseInt(allocForm.crane_id),
        crane_allocation_vessel_schedule_id: parseInt(allocForm.vessel_schedule_id),
        crane_allocation_operation_type: allocForm.operation_type,
        crane_allocation_planned_start_at: new Date(allocForm.planned_start_at).toISOString(),
        crane_allocation_planned_end_at: new Date(allocForm.planned_end_at).toISOString(),
        crane_allocation_remarks: allocForm.remarks.trim(),
      };

      const res = await apiFetch('/api/terminal/crane-allocations/', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) {
        const errorMsg = json.message || Object.values(json.errors || {}).flat().join(', ') || 'Failed to create crane allocation.';
        addToast('error', errorMsg);
        return;
      }

      addToast('success', `Crane allocation #${json.data.crane_allocation_id} created successfully.`);
      setIsCreateAllocModalOpen(false);
      fetchAllocations();
      fetchSummary();
      fetchCranes();
    } catch {
      addToast('error', 'Network error creating allocation.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartAllocation = async (alloc: CraneAllocationItem) => {
    if (!window.confirm(`Start crane operation for allocation #${alloc.crane_allocation_id}? This will mark crane '${alloc.crane_code}' as IN_USE.`)) {
      return;
    }

    try {
      const res = await apiFetch(`/api/terminal/crane-allocations/${alloc.crane_allocation_id}/start/`, {
        method: 'POST',
      });
      const json = await res.json();
      if (res.ok) {
        addToast('success', json.message || 'Allocation started successfully.');
        fetchAllocations();
        fetchSummary();
        fetchCranes();
      } else {
        addToast('error', json.message || 'Failed to start allocation.');
      }
    } catch {
      addToast('error', 'Network error starting allocation.');
    }
  };

  const handleCompleteAllocation = async (alloc: CraneAllocationItem) => {
    if (!window.confirm(`Mark crane allocation #${alloc.crane_allocation_id} as COMPLETED? Crane '${alloc.crane_code}' will be released.`)) {
      return;
    }

    try {
      const res = await apiFetch(`/api/terminal/crane-allocations/${alloc.crane_allocation_id}/complete/`, {
        method: 'POST',
      });
      const json = await res.json();
      if (res.ok) {
        addToast('success', json.message || 'Allocation completed successfully.');
        fetchAllocations();
        fetchSummary();
        fetchCranes();
      } else {
        addToast('error', json.message || 'Failed to complete allocation.');
      }
    } catch {
      addToast('error', 'Network error completing allocation.');
    }
  };

  const handleConfirmCancelAllocation = async () => {
    if (!cancellingAlloc) return;

    try {
      const res = await apiFetch(`/api/terminal/crane-allocations/${cancellingAlloc.crane_allocation_id}/cancel/`, {
        method: 'POST',
        body: JSON.stringify({ reason: cancelReason.trim() }),
      });
      const json = await res.json();
      if (res.ok) {
        addToast('success', json.message || 'Allocation cancelled.');
        setCancellingAlloc(null);
        setCancelReason('');
        fetchAllocations();
        fetchSummary();
        fetchCranes();
      } else {
        addToast('error', json.message || 'Failed to cancel allocation.');
      }
    } catch {
      addToast('error', 'Network error cancelling allocation.');
    }
  };

  // ============================================================================
  // Helpers
  // ============================================================================

  const getStatusBadge = (status: CraneStatus) => {
    switch (status) {
      case 'AVAILABLE':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>Available</span>;
      case 'IN_USE':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"><span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>In Use</span>;
      case 'MAINTENANCE':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"><span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>Maintenance</span>;
      case 'INACTIVE':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20"><span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span>Inactive</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">{status}</span>;
    }
  };

  const getAllocStatusBadge = (status: CraneAllocationStatus) => {
    switch (status) {
      case 'SCHEDULED':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"><Clock className="w-3 h-3" /> Scheduled</span>;
      case 'ACTIVE':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"><Activity className="w-3 h-3 animate-spin" /> In Progress</span>;
      case 'COMPLETED':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"><CheckCircle className="w-3 h-3" /> Completed</span>;
      case 'CANCELLED':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-500/10 text-slate-500 dark:text-slate-400 border border-slate-500/20"><Ban className="w-3 h-3" /> Cancelled</span>;
      default:
        return <span>{status}</span>;
    }
  };

  const getCraneTypeLabel = (type: CraneType) => {
    switch (type) {
      case 'STS': return 'Ship-to-Shore (STS) Quay Crane';
      case 'RTG': return 'Rubber-Tyred Gantry (RTG)';
      case 'RMG': return 'Rail-Mounted Gantry (RMG)';
      case 'MHC': return 'Mobile Harbour Crane (MHC)';
      default: return type;
    }
  };

  return (
    <div id="crane-operations-page" data-testid="crane-operations-page" className="space-y-6 animate-fade-in font-sans">
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5 text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-1">
            <Anchor className="w-4 h-4" />
            <span>Terminal Heavy Equipment Operations</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            Crane Management & Allocation
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
            Register Quay and Yard Cranes, allocate equipment to scheduled vessels, and coordinate quay lifting operations.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-stretch sm:self-auto">
          <button
            onClick={refreshAll}
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors shadow-xs"
            title="Refresh Operations"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            id="add-crane-btn"
            data-testid="add-crane-btn"
            onClick={handleOpenAddCrane}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 font-bold text-sm hover:opacity-90 transition-opacity shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Add Crane</span>
          </button>
          <button
            id="create-allocation-btn"
            data-testid="create-allocation-btn"
            onClick={() => handleOpenCreateAlloc()}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#D49A24] text-white font-bold text-sm hover:bg-[#b8851e] transition-colors shadow-xs"
          >
            <Layers className="w-4 h-4" />
            <span>Allocate Vessel Crane</span>
          </button>
        </div>
      </div>

      {/* KPI METRIC CARDS */}
      <div id="crane-overview-summary" data-testid="crane-overview-summary" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-semibold mb-2">
            <span>Total Cranes</span>
            <Anchor className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white">
            {summary?.kpis?.total_cranes ?? 0}
          </p>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">Heavy lifting fleet</p>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 text-xs font-semibold mb-2">
            <span>Available</span>
            <CheckCircle className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
            {summary?.kpis?.available_cranes ?? 0}
          </p>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">Ready for deployment</p>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-amber-600 dark:text-amber-400 text-xs font-semibold mb-2">
            <span>In Use</span>
            <Activity className="w-4 h-4 text-amber-500 animate-pulse" />
          </div>
          <p className="text-2xl font-black text-amber-600 dark:text-amber-400">
            {summary?.kpis?.in_use_cranes ?? 0}
          </p>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">Actively discharging/loading</p>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-rose-600 dark:text-rose-400 text-xs font-semibold mb-2">
            <span>Maintenance</span>
            <Wrench className="w-4 h-4 text-rose-500" />
          </div>
          <p className="text-2xl font-black text-rose-600 dark:text-rose-400">
            {summary?.kpis?.maintenance_cranes ?? 0}
          </p>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">Service & repair</p>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-blue-600 dark:text-blue-400 text-xs font-semibold mb-2">
            <span>Scheduled</span>
            <Clock className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-2xl font-black text-blue-600 dark:text-blue-400">
            {summary?.kpis?.scheduled_allocations ?? 0}
          </p>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">Upcoming assignments</p>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-purple-600 dark:text-purple-400 text-xs font-semibold mb-2">
            <span>Active Ops</span>
            <Play className="w-4 h-4 text-purple-500" />
          </div>
          <p className="text-2xl font-black text-purple-600 dark:text-purple-400">
            {summary?.kpis?.active_allocations ?? 0}
          </p>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">Running assignments</p>
        </div>
      </div>

      {/* NAVIGATION TABS */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-2">
        <button
          onClick={() => setActiveSubTab('overview')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 transition-all ${
            activeSubTab === 'overview'
              ? 'border-[#D49A24] text-[#D49A24]'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Operations Overview</span>
        </button>

        <button
          onClick={() => setActiveSubTab('cranes')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 transition-all ${
            activeSubTab === 'cranes'
              ? 'border-[#D49A24] text-[#D49A24]'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Anchor className="w-4 h-4" />
          <span>Crane Master ({cranes.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('allocations')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 transition-all ${
            activeSubTab === 'allocations'
              ? 'border-[#D49A24] text-[#D49A24]'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Vessel Crane Allocations ({allocations.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('history')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 transition-all ${
            activeSubTab === 'history'
              ? 'border-[#D49A24] text-[#D49A24]'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Assignment History</span>
        </button>
      </div>

      {/* TAB 1: OVERVIEW & ACTIVE HIGHLIGHTS */}
      {activeSubTab === 'overview' && (
        <div className="space-y-6">
          {/* ACTIVE CRANE ALLOCATIONS RADAR */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-slate-900 dark:text-white">Active Vessel Quayside Lifting Operations</h2>
                <p className="text-xs text-slate-500">Real-time container handling assignments in progress for berthed vessels</p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20">
                Live Status
              </span>
            </div>

            {allocations.filter(a => a.crane_allocation_status === 'ACTIVE').length === 0 ? (
              <div className="text-center py-10 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                <Anchor className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">No active crane operations</p>
                <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                  Start an upcoming scheduled allocation or create a new assignment to mobilize quay and yard cranes.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {allocations.filter(a => a.crane_allocation_status === 'ACTIVE').map(alloc => (
                  <div key={alloc.crane_allocation_id} className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 dark:bg-amber-950/10 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-sm text-slate-900 dark:text-white">{alloc.crane_code}</span>
                      {getAllocStatusBadge(alloc.crane_allocation_status)}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-500">Vessel</p>
                      <p className="text-sm font-bold text-slate-900 dark:text-white">{alloc.vessel_name}</p>
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>Berth: <strong className="text-slate-800 dark:text-slate-200">{alloc.berth_name}</strong></span>
                      <span>Type: <strong className="text-slate-800 dark:text-slate-200">{alloc.operation_type_display}</strong></span>
                    </div>
                    <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between">
                      <span className="text-[11px] text-slate-400">Started: {alloc.crane_allocation_actual_start_at ? new Date(alloc.crane_allocation_actual_start_at).toLocaleTimeString() : 'N/A'}</span>
                      <button
                        onClick={() => handleCompleteAllocation(alloc)}
                        className="text-xs font-bold px-2.5 py-1 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                      >
                        Complete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* RECENT ALLOCATIONS LOG */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
            <h2 className="text-lg font-black text-slate-900 dark:text-white">Recent Vessel Crane Operations Schedule</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400">
                    <th className="py-2.5 px-3">Crane</th>
                    <th className="py-2.5 px-3">Vessel & Berth</th>
                    <th className="py-2.5 px-3">Operation</th>
                    <th className="py-2.5 px-3">Planned Window</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {allocations.slice(0, 5).map(alloc => (
                    <tr key={alloc.crane_allocation_id}>
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900 dark:text-white">{alloc.crane_code}</td>
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-slate-800 dark:text-slate-200">{alloc.vessel_name}</div>
                        <div className="text-[11px] text-slate-400">{alloc.berth_name}</div>
                      </td>
                      <td className="py-2.5 px-3 font-semibold">{alloc.operation_type_display}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-400">
                        {new Date(alloc.crane_allocation_planned_start_at).toLocaleDateString()} {new Date(alloc.crane_allocation_planned_start_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(alloc.crane_allocation_planned_end_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-2.5 px-3">{getAllocStatusBadge(alloc.crane_allocation_status)}</td>
                    </tr>
                  ))}
                  {allocations.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400">
                        No crane allocation records found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CRANE MASTER DIRECTORY */}
      {activeSubTab === 'cranes' && (
        <div className="space-y-4">
          {/* FILTERS */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            <div className="flex-1 flex items-center gap-2 bg-slate-50 dark:bg-slate-800 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                id="crane-search-input"
                data-testid="crane-search-input"
                type="text"
                placeholder="Search cranes by code or name..."
                value={craneSearchQuery}
                onChange={e => setCraneSearchQuery(e.target.value)}
                className="bg-transparent text-xs w-full text-slate-900 dark:text-white focus:outline-hidden"
              />
              {craneSearchQuery && (
                <button onClick={() => setCraneSearchQuery('')} className="text-slate-400 hover:text-slate-600">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <select
                id="crane-status-filter"
                data-testid="crane-status-filter"
                value={selectedCraneStatus}
                onChange={e => setSelectedCraneStatus(e.target.value)}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs rounded-lg px-3 py-2 text-slate-700 dark:text-slate-300 focus:outline-hidden"
              >
                <option value="">All Statuses</option>
                <option value="AVAILABLE">Available</option>
                <option value="IN_USE">In Use</option>
                <option value="MAINTENANCE">Maintenance</option>
                <option value="INACTIVE">Inactive</option>
              </select>

              <select
                id="crane-type-filter"
                data-testid="crane-type-filter"
                value={selectedCraneType}
                onChange={e => setSelectedCraneType(e.target.value)}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs rounded-lg px-3 py-2 text-slate-700 dark:text-slate-300 focus:outline-hidden"
              >
                <option value="">All Crane Types</option>
                <option value="STS">Ship-to-Shore (STS)</option>
                <option value="RTG">Rubber-Tyred Gantry (RTG)</option>
                <option value="RMG">Rail-Mounted Gantry (RMG)</option>
                <option value="MHC">Mobile Harbour Crane (MHC)</option>
              </select>
            </div>
          </div>

          {/* CRANE DIRECTORY TABLE */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table id="crane-directory-table" data-testid="crane-directory-table" className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
                    <th className="py-3 px-4">Crane Code</th>
                    <th className="py-3 px-4">Equipment Name</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Lifting Capacity</th>
                    <th className="py-3 px-4">Assigned Berth</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {cranes.map(crane => (
                    <tr key={crane.crane_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">
                        {crane.crane_code}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-800 dark:text-slate-200">
                        {crane.crane_name}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                        <span className="font-semibold text-slate-900 dark:text-white">{crane.crane_type}</span>
                        <span className="block text-[11px] text-slate-400">{getCraneTypeLabel(crane.crane_type)}</span>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">
                        {crane.crane_max_lifting_capacity_mt} {crane.crane_capacity_unit}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                        {crane.assigned_berth_name || <span className="text-slate-400 italic">Unassigned</span>}
                      </td>
                      <td className="py-3 px-4">
                        {getStatusBadge(crane.crane_status)}
                      </td>
                      <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                        <button
                          onClick={() => setViewingCrane(crane)}
                          className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 transition-colors"
                          title="View Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleOpenEditCrane(crane)}
                          className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 transition-colors"
                          title="Edit Crane"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        {['STS', 'MHC'].includes(crane.crane_type) ? (
                          <button
                            id={`allocate-crane-btn-${crane.crane_id}`}
                            data-testid={`allocate-crane-btn-${crane.crane_id}`}
                            onClick={() => handleOpenCreateAlloc(crane)}
                            disabled={!crane.is_operational}
                            className="px-2.5 py-1.5 rounded-lg bg-amber-500/15 text-[#D49A24] font-bold text-xs hover:bg-amber-500/25 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            title={crane.is_operational ? "Allocate Crane to Vessel Schedule" : "Crane is not operational"}
                          >
                            Allocate
                          </button>
                        ) : (
                          <button
                            id={`use-yard-ops-btn-${crane.crane_id}`}
                            data-testid={`use-yard-ops-btn-${crane.crane_id}`}
                            onClick={() => handleUseInYardOperations(crane)}
                            className="px-2.5 py-1.5 rounded-lg bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 font-bold text-xs hover:bg-indigo-500/25 transition-colors flex items-center gap-1"
                            title="Navigate to Yard Operations module for container relocations"
                          >
                            <MoveHorizontal className="w-3 h-3" />
                            Use in Yard Operations
                          </button>
                        )}
                        <button
                          onClick={() => handleArchiveCrane(crane)}
                          className="p-1.5 rounded-lg border border-rose-200 dark:border-rose-900/50 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-rose-600 dark:text-rose-400 transition-colors"
                          title="Deactivate / Archive Crane"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {cranes.length === 0 && !loadingCranes && (
                    <tr>
                      <td colSpan={7} className="py-12 text-center">
                        <Anchor className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                        <p className="text-sm font-bold text-slate-700 dark:text-slate-300">No cranes registered</p>
                        <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                          Click "Add Crane" to register heavy lifting equipment into the port master directory.
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: ALLOCATIONS */}
      {activeSubTab === 'allocations' && (
        <div className="space-y-4">
          {/* FILTERS */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            <div className="flex-1 flex items-center gap-2 bg-slate-50 dark:bg-slate-800 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search allocations by crane, vessel, or IMO..."
                value={allocSearchQuery}
                onChange={e => setAllocSearchQuery(e.target.value)}
                className="bg-transparent text-xs w-full text-slate-900 dark:text-white focus:outline-hidden"
              />
              {allocSearchQuery && (
                <button onClick={() => setAllocSearchQuery('')} className="text-slate-400 hover:text-slate-600">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <select
                id="allocation-status-filter"
                data-testid="allocation-status-filter"
                value={selectedAllocStatus}
                onChange={e => setSelectedAllocStatus(e.target.value)}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs rounded-lg px-3 py-2 text-slate-700 dark:text-slate-300 focus:outline-hidden"
              >
                <option value="">All Statuses</option>
                <option value="SCHEDULED">Scheduled</option>
                <option value="ACTIVE">Active / In Progress</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>

              <select
                value={selectedOpType}
                onChange={e => setSelectedOpType(e.target.value)}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs rounded-lg px-3 py-2 text-slate-700 dark:text-slate-300 focus:outline-hidden"
              >
                <option value="">All Operations</option>
                <option value="UNLOADING">Unloading (Discharge)</option>
                <option value="LOADING">Loading</option>
                <option value="BOTH">Discharge & Loading</option>
              </select>
            </div>
          </div>

          {/* ALLOCATIONS TABLE */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table id="allocation-table" data-testid="allocation-table" className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
                    <th className="py-3 px-4">Alloc #</th>
                    <th className="py-3 px-4">Crane</th>
                    <th className="py-3 px-4">Vessel Schedule</th>
                    <th className="py-3 px-4">Berth</th>
                    <th className="py-3 px-4">Operation</th>
                    <th className="py-3 px-4">Planned Time Window</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {allocations.map(alloc => (
                    <tr key={alloc.crane_allocation_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">
                        #{alloc.crane_allocation_id}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-mono font-bold text-slate-900 dark:text-white">{alloc.crane_code}</span>
                        <span className="block text-[11px] text-slate-400">{alloc.crane_name}</span>
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-800 dark:text-slate-200">
                        {alloc.vessel_name}
                        {alloc.vessel_imo && <span className="block text-[11px] font-mono text-slate-400">{alloc.vessel_imo}</span>}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">
                        {alloc.berth_name}
                      </td>
                      <td className="py-3 px-4 font-semibold">
                        {alloc.operation_type_display}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-400">
                        <div>{new Date(alloc.crane_allocation_planned_start_at).toLocaleDateString()}</div>
                        <div className="text-[11px] text-slate-400">
                          {new Date(alloc.crane_allocation_planned_start_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(alloc.crane_allocation_planned_end_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {getAllocStatusBadge(alloc.crane_allocation_status)}
                      </td>
                      <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                        {alloc.crane_allocation_status === 'SCHEDULED' && (
                          <button
                            id={`start-allocation-btn-${alloc.crane_allocation_id}`}
                            data-testid={`start-allocation-btn-${alloc.crane_allocation_id}`}
                            onClick={() => handleStartAllocation(alloc)}
                            className="px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 transition-colors shadow-xs"
                            title="Start Operation"
                          >
                            Start
                          </button>
                        )}
                        {alloc.crane_allocation_status === 'ACTIVE' && (
                          <button
                            id={`complete-allocation-btn-${alloc.crane_allocation_id}`}
                            data-testid={`complete-allocation-btn-${alloc.crane_allocation_id}`}
                            onClick={() => handleCompleteAllocation(alloc)}
                            className="px-2.5 py-1.5 rounded-lg bg-blue-600 text-white font-bold text-xs hover:bg-blue-700 transition-colors shadow-xs"
                            title="Complete Operation"
                          >
                            Complete
                          </button>
                        )}
                        {(alloc.crane_allocation_status === 'SCHEDULED' || alloc.crane_allocation_status === 'ACTIVE') && (
                          <button
                            id={`cancel-allocation-btn-${alloc.crane_allocation_id}`}
                            data-testid={`cancel-allocation-btn-${alloc.crane_allocation_id}`}
                            onClick={() => {
                              setCancellingAlloc(alloc);
                              setCancelReason('');
                            }}
                            className="p-1.5 rounded-lg border border-rose-200 dark:border-rose-900/50 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-rose-600 dark:text-rose-400 transition-colors"
                            title="Cancel Allocation"
                          >
                            <Ban className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {allocations.length === 0 && !loadingAllocations && (
                    <tr>
                      <td colSpan={8} className="py-12 text-center">
                        <Layers className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                        <p className="text-sm font-bold text-slate-700 dark:text-slate-300">No crane allocations found</p>
                        <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                          Click "Allocate Crane" to schedule equipment for inbound or outbound vessels.
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: HISTORY */}
      {activeSubTab === 'history' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
            <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider mb-2">
              Historical Crane Operations & Log
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              Permanent immutable records of all completed and cancelled crane assignments.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-semibold uppercase tracking-wider">
                    <th className="py-2.5 px-3">Alloc #</th>
                    <th className="py-2.5 px-3">Crane</th>
                    <th className="py-2.5 px-3">Vessel</th>
                    <th className="py-2.5 px-3">Actual Window</th>
                    <th className="py-2.5 px-3">Assigned By</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Remarks / Cancellation Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {allocations.filter(a => a.crane_allocation_status === 'COMPLETED' || a.crane_allocation_status === 'CANCELLED').map(alloc => (
                    <tr key={alloc.crane_allocation_id}>
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900 dark:text-white">#{alloc.crane_allocation_id}</td>
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-800 dark:text-slate-200">{alloc.crane_code}</td>
                      <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-200">{alloc.vessel_name}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-500">
                        {alloc.crane_allocation_actual_start_at ? new Date(alloc.crane_allocation_actual_start_at).toLocaleString() : 'N/A'} - {alloc.crane_allocation_actual_end_at ? new Date(alloc.crane_allocation_actual_end_at).toLocaleTimeString() : 'N/A'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">{alloc.assigned_by_name}</td>
                      <td className="py-2.5 px-3">{getAllocStatusBadge(alloc.crane_allocation_status)}</td>
                      <td className="py-2.5 px-3 text-slate-500 italic max-w-xs truncate">{alloc.crane_allocation_remarks || 'None'}</td>
                    </tr>
                  ))}
                  {allocations.filter(a => a.crane_allocation_status === 'COMPLETED' || a.crane_allocation_status === 'CANCELLED').length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        No historical crane operation records yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD / EDIT CRANE */}
      {/* ========================================================================= */}
      {(isAddCraneModalOpen || editingCrane) && (
        <Modal
          isOpen={true}
          onClose={() => {
            setIsAddCraneModalOpen(false);
            setEditingCrane(null);
          }}
          title={editingCrane ? `Edit Crane: ${editingCrane.crane_code}` : 'Register New Heavy Equipment Crane'}
        >
          <form onSubmit={handleSubmitCrane} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Crane Code / Identifier <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. QC-01, RTG-10"
                  value={craneForm.crane_code}
                  onChange={e => setCraneForm({ ...craneForm, crane_code: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 font-mono uppercase font-bold text-slate-900 dark:text-white focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Equipment Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ship-to-Shore Quay Crane 01"
                  value={craneForm.crane_name}
                  onChange={e => setCraneForm({ ...craneForm, crane_name: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 font-semibold text-slate-900 dark:text-white focus:outline-hidden"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Crane Type <span className="text-rose-500">*</span>
                </label>
                <select
                  value={craneForm.crane_type}
                  onChange={e => setCraneForm({ ...craneForm, crane_type: e.target.value as CraneType })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-slate-900 dark:text-white focus:outline-hidden font-semibold"
                >
                  <option value="STS">Ship-to-Shore (STS)</option>
                  <option value="RTG">Rubber-Tyred Gantry (RTG)</option>
                  <option value="RMG">Rail-Mounted Gantry (RMG)</option>
                  <option value="MHC">Mobile Harbour Crane (MHC)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Rated Capacity (MT) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.1"
                  required
                  placeholder="e.g. 65.00"
                  value={craneForm.crane_max_lifting_capacity_mt}
                  onChange={e => setCraneForm({ ...craneForm, crane_max_lifting_capacity_mt: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 font-mono text-slate-900 dark:text-white focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Operational Status <span className="text-rose-500">*</span>
                </label>
                <select
                  value={craneForm.crane_status}
                  onChange={e => setCraneForm({ ...craneForm, crane_status: e.target.value as CraneStatus })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-slate-900 dark:text-white focus:outline-hidden font-semibold"
                >
                  <option value="AVAILABLE">Available</option>
                  <option value="IN_USE">In Use</option>
                  <option value="MAINTENANCE">Maintenance</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Assigned Quay Berth (Optional)
              </label>
              <select
                value={craneForm.crane_assigned_berth_id}
                onChange={e => setCraneForm({ ...craneForm, crane_assigned_berth_id: e.target.value })}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-slate-900 dark:text-white focus:outline-hidden"
              >
                <option value="">No permanent berth assigned</option>
                {berths.map(b => (
                  <option key={b.berth_id} value={b.berth_id}>
                    {b.berth_name} {b.berth_code ? `(${b.berth_code})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Last Maintenance Date
                </label>
                <input
                  type="date"
                  value={craneForm.crane_last_maintenance_date}
                  onChange={e => setCraneForm({ ...craneForm, crane_last_maintenance_date: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-slate-900 dark:text-white focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Next Maintenance Due
                </label>
                <input
                  type="date"
                  value={craneForm.crane_next_maintenance_due}
                  onChange={e => setCraneForm({ ...craneForm, crane_next_maintenance_due: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-slate-900 dark:text-white focus:outline-hidden"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Maintenance Remarks / Notes
              </label>
              <textarea
                rows={2}
                placeholder="Log any recent inspections or service notes..."
                value={craneForm.crane_maintenance_remarks}
                onChange={e => setCraneForm({ ...craneForm, crane_maintenance_remarks: e.target.value })}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-slate-900 dark:text-white focus:outline-hidden"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setIsAddCraneModalOpen(false);
                  setEditingCrane(null);
                }}
                className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 rounded-lg bg-[#D49A24] text-white font-bold hover:bg-[#b8851e] transition-colors disabled:opacity-50"
              >
                {isSubmitting ? 'Saving...' : (editingCrane ? 'Update Crane' : 'Register Crane')}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CREATE CRANE ALLOCATION */}
      {/* ========================================================================= */}
      {isCreateAllocModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsCreateAllocModalOpen(false)}
          title="Vessel & Berth Crane Allocation"
        >
          <form onSubmit={handleSubmitAllocation} className="space-y-4 text-xs">
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-slate-700 dark:text-slate-300">
              <p className="font-bold text-amber-700 dark:text-amber-400">Vessel & Berth Allocation</p>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                Allocate operational quayside cranes (STS or MHC) to berthed vessel schedules for discharge and loading. Yard equipment (RTG/RMG) is dedicated to yard block handling and is not assigned to vessel schedules.
              </p>
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Select Operational Quayside Crane (STS / MHC) <span className="text-rose-500">*</span>
              </label>
              <select
                required
                id="allocation-crane-select"
                value={allocForm.crane_id}
                onChange={e => setAllocForm({ ...allocForm, crane_id: e.target.value })}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-slate-900 dark:text-white focus:outline-hidden font-semibold"
              >
                <option value="">-- Choose Compatible Crane --</option>
                {compatibleVesselCranes.map(c => (
                  <option key={c.crane_id} value={c.crane_id}>
                    {c.crane_code} - {c.crane_name} ({c.crane_type}{c.assigned_berth_name ? ` • Berth: ${c.assigned_berth_name}` : ''}, {c.crane_max_lifting_capacity_mt} MT)
                  </option>
                ))}
              </select>
              {compatibleVesselCranes.length === 0 ? (
                <p className="text-[11px] text-rose-500 mt-1">
                  No compatible operational quayside cranes (STS/MHC) available{allocForm.vessel_schedule_id ? ' matching the selected berth' : ''}. Check crane operational status and berth assignments.
                </p>
              ) : (
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                  Filtered to compatible operational quayside cranes (STS and MHC) for vessel operations.
                </p>
              )}
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Target Vessel Schedule & Berth <span className="text-rose-500">*</span>
              </label>
              <select
                required
                id="allocation-schedule-select"
                value={allocForm.vessel_schedule_id}
                onChange={e => {
                  const newSchedId = e.target.value;
                  const newSched = eligibleSchedules.find(s => String(s.vessel_schedule_id) === newSchedId);
                  const currentCrane = cranes.find(c => String(c.crane_id) === allocForm.crane_id);
                  let keepCrane = true;
                  if (currentCrane && currentCrane.crane_type === 'STS' && currentCrane.crane_assigned_berth_id && newSched) {
                    if (currentCrane.crane_assigned_berth_id !== newSched.vessel_schedule_berth_id) {
                      keepCrane = false;
                    }
                  }
                  setAllocForm({
                    ...allocForm,
                    vessel_schedule_id: newSchedId,
                    crane_id: keepCrane ? allocForm.crane_id : ''
                  });
                }}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-slate-900 dark:text-white focus:outline-hidden font-semibold"
              >
                <option value="">-- Choose Berthed Vessel Schedule --</option>
                {eligibleSchedules.map(s => (
                  <option key={s.vessel_schedule_id} value={s.vessel_schedule_id}>
                    #{s.vessel_schedule_id}: {s.vessel_name} at {s.berth_name} ({s.status_display})
                  </option>
                ))}
              </select>
              {eligibleSchedules.length === 0 && (
                <p className="text-[11px] text-amber-500 mt-1">No active vessel schedules currently at berth.</p>
              )}
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Vessel Operation Type (Quayside Only) <span className="text-rose-500">*</span>
              </label>
              <select
                value={allocForm.operation_type}
                onChange={e => setAllocForm({ ...allocForm, operation_type: e.target.value as CraneOperationType })}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-slate-900 dark:text-white focus:outline-hidden font-semibold"
              >
                <option value="UNLOADING">Unloading (Discharge to Quayside/Yard)</option>
                <option value="LOADING">Loading (Yard to Vessel)</option>
                <option value="BOTH">Discharge & Loading (Combined Operations)</option>
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Planned Start Time <span className="text-rose-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  required
                  value={allocForm.planned_start_at}
                  onChange={e => setAllocForm({ ...allocForm, planned_start_at: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-slate-900 dark:text-white focus:outline-hidden font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Planned End Time <span className="text-rose-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  required
                  value={allocForm.planned_end_at}
                  onChange={e => setAllocForm({ ...allocForm, planned_end_at: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-slate-900 dark:text-white focus:outline-hidden font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Operational Remarks (Optional)
              </label>
              <textarea
                rows={2}
                placeholder="Discharge bay details, special stowage instructions..."
                value={allocForm.remarks}
                onChange={e => setAllocForm({ ...allocForm, remarks: e.target.value })}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-slate-900 dark:text-white focus:outline-hidden"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsCreateAllocModalOpen(false)}
                className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 rounded-lg bg-[#D49A24] text-white font-bold hover:bg-[#b8851e] transition-colors disabled:opacity-50"
              >
                {isSubmitting ? 'Validating & Allocating...' : 'Confirm Allocation'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* MODAL: VIEW CRANE DETAILS */}
      {/* ========================================================================= */}
      {viewingCrane && (
        <Modal
          isOpen={true}
          onClose={() => setViewingCrane(null)}
          title={`Crane Details: ${viewingCrane.crane_code}`}
        >
          <div id="crane-detail-modal" data-testid="crane-detail-modal" className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl">
              <div>
                <p className="text-slate-400 font-semibold">Equipment Code</p>
                <p className="font-mono font-bold text-slate-900 dark:text-white text-sm">{viewingCrane.crane_code}</p>
              </div>
              <div>
                <p className="text-slate-400 font-semibold">Status</p>
                <div className="mt-0.5">{getStatusBadge(viewingCrane.crane_status)}</div>
              </div>
              <div>
                <p className="text-slate-400 font-semibold">Name</p>
                <p className="font-semibold text-slate-900 dark:text-white">{viewingCrane.crane_name}</p>
              </div>
              <div>
                <p className="text-slate-400 font-semibold">Equipment Type</p>
                <p className="font-semibold text-slate-900 dark:text-white">{getCraneTypeLabel(viewingCrane.crane_type)}</p>
              </div>
              <div>
                <p className="text-slate-400 font-semibold">Rated Lifting Capacity</p>
                <p className="font-mono font-bold text-slate-900 dark:text-white">{viewingCrane.crane_max_lifting_capacity_mt} {viewingCrane.crane_capacity_unit}</p>
              </div>
              <div>
                <p className="text-slate-400 font-semibold">Assigned Quay Berth</p>
                <p className="font-semibold text-slate-900 dark:text-white">{viewingCrane.assigned_berth_name || 'None'}</p>
              </div>
              <div>
                <p className="text-slate-400 font-semibold">Last Maintenance</p>
                <p className="font-mono text-slate-700 dark:text-slate-300">{viewingCrane.crane_last_maintenance_date || 'N/A'}</p>
              </div>
              <div>
                <p className="text-slate-400 font-semibold">Next Maintenance Due</p>
                <p className="font-mono text-slate-700 dark:text-slate-300">{viewingCrane.crane_next_maintenance_due || 'N/A'}</p>
              </div>
            </div>

            {viewingCrane.current_active_allocation && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-1">
                <p className="font-bold text-amber-700 dark:text-amber-400">Current Active Allocation</p>
                <p className="text-slate-800 dark:text-slate-200">
                  Vessel: <strong>{viewingCrane.current_active_allocation.vessel_name}</strong> ({viewingCrane.current_active_allocation.operation_type})
                </p>
                <p className="text-slate-500 text-[11px] font-mono">
                  Started: {viewingCrane.current_active_allocation.actual_start_at ? new Date(viewingCrane.current_active_allocation.actual_start_at).toLocaleString() : 'N/A'}
                </p>
              </div>
            )}

            {viewingCrane.crane_maintenance_remarks && (
              <div>
                <p className="text-slate-400 font-semibold mb-1">Maintenance Notes</p>
                <p className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 italic">
                  {viewingCrane.crane_maintenance_remarks}
                </p>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setViewingCrane(null)}
                className="px-4 py-2 rounded-lg bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CANCEL ALLOCATION CONFIRMATION */}
      {/* ========================================================================= */}
      {cancellingAlloc && (
        <Modal
          isOpen={true}
          onClose={() => setCancellingAlloc(null)}
          title={`Cancel Crane Allocation #${cancellingAlloc.crane_allocation_id}`}
        >
          <div className="space-y-4 text-xs">
            <div className="flex items-start gap-3 p-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 rounded-xl text-rose-700 dark:text-rose-400">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Are you sure you want to cancel this crane assignment?</p>
                <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-0.5">
                  Crane '{cancellingAlloc.crane_code}' for vessel '{cancellingAlloc.vessel_name}' will be released from this scheduled time slot.
                </p>
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Reason for Cancellation <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <textarea
                rows={3}
                placeholder="e.g. Weather delay, vessel rescheduling, equipment substitution..."
                value={cancelReason}
                onChange={e => setCancelReason(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-slate-900 dark:text-white focus:outline-hidden"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                id="cancel-action-btn"
                data-testid="cancel-action-btn"
                type="button"
                onClick={() => setCancellingAlloc(null)}
                className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Keep Allocation
              </button>
              <button
                id="confirm-action-btn"
                data-testid="confirm-action-btn"
                type="button"
                onClick={handleConfirmCancelAllocation}
                className="px-4 py-2 rounded-lg bg-rose-600 text-white font-bold hover:bg-rose-700 transition-colors shadow-xs"
              >
                Confirm Cancellation
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
