import React, { useState, useEffect, useMemo } from 'react';
import { Modal } from '../../common/Modal';
import { apiFetch } from '../../../services/api';
import { useApp } from '../../../context/AppContext';
import { 
  BackendCargo, 
  BackendContainer, 
  ContainerType, 
  ContainerStatus,
  ContainerSummaryStats 
} from '../../../types';
import { 
  Boxes, 
  Plus, 
  Search, 
  RefreshCw, 
  Eye, 
  Edit, 
  CheckCircle2, 
  AlertTriangle, 
  Ship, 
  Scale, 
  MapPin, 
  Calendar, 
  ArrowRight,
  Info,
  Clock,
  ShieldCheck,
  CheckCircle,
  XCircle,
  Truck,
  Anchor,
  FileCheck,
  UploadCloud,
  FileText
} from 'lucide-react';
import { ContainerTrackingModal } from '../../modals/ContainerTrackingModal';
import { SubmitCustomsDocumentModal } from './SubmitCustomsDocumentModal';
import { SubmitPreArrivalCustomsModal } from './SubmitPreArrivalCustomsModal';

interface ContainerManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  cargo: BackendCargo | null;
  onRefreshCargo?: () => void;
}

const CONTAINER_TYPES: { value: ContainerType; label: string; teu: number }[] = [
  { value: '20FT', label: '20 FT', teu: 1.0 },
  { value: '40FT', label: '40 FT', teu: 2.0 },
  { value: '40FT_HC', label: '40 FT High Cube', teu: 2.0 },
];

const LIFECYCLE_STEPS: { key: ContainerStatus; label: string; stepNumber: number }[] = [
  { key: 'REGISTERED', label: 'Registered', stepNumber: 1 },
  { key: 'ARRIVED', label: 'Arrived', stepNumber: 2 },
  { key: 'AT_TERMINAL', label: 'At Terminal', stepNumber: 3 },
  { key: 'UNDER_INSPECTION', label: 'Under Inspection', stepNumber: 4 },
  { key: 'CLEARED', label: 'Cleared', stepNumber: 5 },
  { key: 'RELEASED', label: 'Gate Exit Completed', stepNumber: 6 },
];

export const ContainerManagementModal: React.FC<ContainerManagementModalProps> = ({
  isOpen,
  onClose,
  cargo,
  onRefreshCargo
}) => {
  const { currentUser, activeRole, addToast, addNotification } = useApp();

  const isTerminalOperator = activeRole === 'terminal_operator' || 
    activeRole === 'terminal_logistics_operator' || 
    currentUser?.role === 'terminal_operator' || 
    currentUser?.role === 'terminal_logistics_operator';

  const [containers, setContainers] = useState<BackendContainer[]>([]);
  const [summary, setSummary] = useState<ContainerSummaryStats | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Form state
  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [editingContainer, setEditingContainer] = useState<BackendContainer | null>(null);
  const [containerNumber, setContainerNumber] = useState<string>('');
  const [containerType, setContainerType] = useState<ContainerType>('20FT');
  const [grossWeight, setGrossWeight] = useState<string>('18.5');
  const [submitLoading, setSubmitLoading] = useState<boolean>(false);
  const [formError, setFormError] = useState<string>('');

  // Detail inspection modal
  const [selectedContainerDetail, setSelectedContainerDetail] = useState<BackendContainer | null>(null);
  const [transitioningContainerId, setTransitioningContainerId] = useState<number | null>(null);
  const [trackingContainerId, setTrackingContainerId] = useState<number | null>(null);

  // Pre-Arrival Customs Declaration Modal State
  const [declaringContainer, setDeclaringContainer] = useState<BackendContainer | null>(null);

  // Delivery Order Modal State
  const [doContainer, setDoContainer] = useState<BackendContainer | null>(null);
  const [doNumber, setDoNumber] = useState<string>('');
  const [doTruckingCompany, setDoTruckingCompany] = useState<string>('');
  const [doTruckNumber, setDoTruckNumber] = useState<string>('');
  const [doDriverName, setDoDriverName] = useState<string>('');
  const [doValidUntil, setDoValidUntil] = useState<string>('');
  const [submittingDO, setSubmittingDO] = useState<boolean>(false);

  // Normal Customs Supporting Document Upload Modal State
  const [customsDocContainer, setCustomsDocContainer] = useState<BackendContainer | null>(null);

  const fetchContainers = async () => {
    if (!cargo) return;
    setLoading(true);
    setError('');
    try {
      const roleHeader = currentUser?.role || activeRole || (isTerminalOperator ? 'terminal_logistics_operator' : 'shipping_company');
      const headers = {
        'X-User-Email': currentUser?.email || '',
        'X-User-Role': roleHeader,
        'X-User-Id': currentUser?.id || ''
      };

      const res = await fetch(`http://127.0.0.1:8000/api/cargo/${cargo.cargo_id}/containers/`, { headers });
      const json = await res.json();

      if (res.ok && json.status === 'success') {
        setContainers(json.data || []);
        setSummary(json.summary || null);
      } else {
        setError(json.message || 'Failed to fetch container manifest.');
      }
    } catch (err) {
      setError('Network communication failed while fetching container manifest.');
    } finally {
      setLoading(false);
    }
  };

  const handleTransitionStatus = async (container: BackendContainer, targetStatus: 'ARRIVED' | 'AT_TERMINAL' | 'AWAITING_CUSTOMS') => {
    setTransitioningContainerId(container.container_id);
    try {
      const roleHeader = currentUser?.role || activeRole || 'terminal_logistics_operator';
      const headers = {
        'Content-Type': 'application/json',
        'X-User-Email': currentUser?.email || '',
        'X-User-Role': roleHeader,
        'X-User-Id': currentUser?.id || ''
      };

      const res = await fetch(`http://127.0.0.1:8000/api/containers/${container.container_id}/status/`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ status: targetStatus })
      });
      const json = await res.json();

      if (res.ok && json.status === 'success') {
        const actionLabel = targetStatus === 'ARRIVED' 
          ? 'received into port (ARRIVED)' 
          : targetStatus === 'AT_TERMINAL' 
          ? 'moved to terminal yard (AT TERMINAL)' 
          : 'sent to Customs for inspection (AWAITING CUSTOMS)';
        addToast(`Container ${container.container_number} successfully ${actionLabel}.`, 'success');
        if (targetStatus === 'AWAITING_CUSTOMS') {
          addNotification(
            'Customs Handoff',
            `Container ${container.container_number} dispatched to Customs for inspection.`,
            'info'
          );
        }
        await fetchContainers();
        if (onRefreshCargo) onRefreshCargo();
        if (selectedContainerDetail && selectedContainerDetail.container_id === container.container_id) {
          setSelectedContainerDetail(json.data);
        }
      } else {
        addToast(json.message || `Failed to transition container status to ${targetStatus}.`, 'error');
      }
    } catch (err) {
      addToast('Network error while updating container status.', 'error');
    } finally {
      setTransitioningContainerId(null);
    }
  };


  useEffect(() => {
    if (isOpen && cargo) {
      setShowAddForm(false);
      setEditingContainer(null);
      setFormError('');
      fetchContainers();
    }
  }, [isOpen, cargo]);

  const handleOpenAdd = () => {
    setEditingContainer(null);
    setContainerNumber('');
    setContainerType('20FT');
    setGrossWeight('18.5');
    setFormError('');
    setShowAddForm(true);
  };

  const handleOpenEdit = (container: BackendContainer) => {
    setEditingContainer(container);
    setContainerNumber(container.container_number);
    setContainerType(container.container_type);
    setGrossWeight(String(container.container_gross_weight));
    setFormError('');
    setShowAddForm(true);
  };

  const handleSaveContainer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cargo) return;
    setFormError('');
    setSubmitLoading(true);

    try {
      const normalizedNumber = containerNumber.trim().toUpperCase();
      const weightNum = parseFloat(grossWeight);

      if (!normalizedNumber) {
        setFormError('Container Number is required.');
        setSubmitLoading(false);
        return;
      }

      if (!/^[A-Z]{4}\d{7}$/.test(normalizedNumber)) {
        setFormError('Invalid format. Container number must be 4 uppercase letters + 7 digits (e.g. MSCU1234567).');
        setSubmitLoading(false);
        return;
      }

      if (isNaN(weightNum) || weightNum <= 0) {
        setFormError('Gross Weight must be a positive number greater than zero.');
        setSubmitLoading(false);
        return;
      }

      const headers = {
        'Content-Type': 'application/json',
        'X-User-Email': currentUser?.email || '',
        'X-User-Role': currentUser?.role || activeRole || 'shipping_company',
        'X-User-Id': currentUser?.id || ''
      };


      const payload = {
        container_cargo_id: cargo.cargo_id,
        container_number: normalizedNumber,
        container_type: containerType,
        container_gross_weight: weightNum
      };

      let response: Response;
      if (editingContainer) {
        response = await fetch(`http://127.0.0.1:8000/api/containers/${editingContainer.container_id}/`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify(payload)
        });
      } else {
        response = await fetch('http://127.0.0.1:8000/api/containers/', {
          method: 'POST',
          headers,
          body: JSON.stringify(payload)
        });
      }

      const json = await response.json();

      if (response.ok && json.status === 'success') {
        addToast(
          editingContainer
            ? `Container ${normalizedNumber} updated successfully.`
            : `Container ${normalizedNumber} registered successfully.`,
          'success'
        );
        setShowAddForm(false);
        setEditingContainer(null);
        fetchContainers();
        if (onRefreshCargo) onRefreshCargo();
      } else {
        let msg = json.message || 'Operation failed.';
        if (json.errors) {
          const errList = Object.entries(json.errors).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`);
          msg += ` (${errList.join(' | ')})`;
        }
        setFormError(msg);
      }
    } catch (err) {
      setFormError('An unexpected network error occurred while submitting.');
    } finally {
      setSubmitLoading(false);
    }
  };

  // Filtered containers
  const filteredContainers = useMemo(() => {
    return containers.filter(c => {
      const matchSearch = searchQuery.trim() === '' || 
        c.container_number.toLowerCase().includes(searchQuery.toLowerCase().trim());
      
      const matchType = typeFilter === 'all' || c.container_type === typeFilter;
      const matchStatus = statusFilter === 'all' || c.container_status === statusFilter;

      return matchSearch && matchType && matchStatus;
    });
  }, [containers, searchQuery, typeFilter, statusFilter]);

  const getStepProgressIndex = (status: ContainerStatus): number => {
    if (status === 'AWAITING_CUSTOMS' || status === 'UNDER_INSPECTION' || status === 'CUSTOMS_HOLD') return 3;
    if (status === 'CLEARED') return 4;
    if (status === 'RELEASED') return 5;
    const idx = LIFECYCLE_STEPS.findIndex(s => s.key === status);
    return idx >= 0 ? idx : 0;
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

  const getStatusBadge = (status: ContainerStatus, display?: string) => {
    switch (status) {
      case 'REGISTERED':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/30 inline-flex items-center gap-1">
            <Clock className="w-3 h-3 text-sky-500" />
            <span>{display || 'Registered'}</span>
          </span>
        );
      case 'ARRIVED':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30 inline-flex items-center gap-1">
            <Anchor className="w-3 h-3 text-indigo-500" />
            <span>{display || 'Arrived'}</span>
          </span>
        );
      case 'AT_TERMINAL':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 inline-flex items-center gap-1">
            <Boxes className="w-3 h-3 text-amber-500" />
            <span>{display || 'At Terminal'}</span>
          </span>
        );
      case 'AWAITING_CUSTOMS':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 inline-flex items-center gap-1">
            <Clock className="w-3 h-3 text-amber-500" />
            <span>{display || 'Awaiting Customs'}</span>
          </span>
        );
      case 'UNDER_INSPECTION':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/30 inline-flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-purple-500" />
            <span>{display || 'Under Inspection'}</span>
          </span>
        );
      case 'CUSTOMS_HOLD':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30 inline-flex items-center gap-1">
            <XCircle className="w-3 h-3 text-rose-500" />
            <span>{display || 'Customs Hold'}</span>
          </span>
        );
      case 'CLEARED':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 inline-flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
            <span>{display || 'Cleared'}</span>
          </span>
        );
      case 'RELEASED':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/30 inline-flex items-center gap-1">
            <Truck className="w-3 h-3 text-teal-500" />
            <span>{display || 'Released'}</span>
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-300">
            {display || status}
          </span>
        );
    }
  };

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

  if (!cargo) return null;

  const isContainerized = cargo.cargo_type === 'CONTAINERIZED';

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={`Container Management & Tracking`}
        subtitle={`Cargo Consignment #CRG-00${cargo.cargo_id} • ${cargo.cargo_description}`}
        icon={<Boxes className="w-5 h-5 text-[#D49A24]" />}
        maxWidth="5xl"
      >
        <div className="space-y-5">
          {/* ================================================================= */}
          {/* 1. READ-ONLY CARGO RELATIONSHIP CONTEXT BANNER */}
          {/* ================================================================= */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white border border-slate-700/80 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-700/60 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-[#D49A24] text-sm">#CRG-00{cargo.cargo_id}</span>
                <span className="text-slate-500">•</span>
                <span className="font-bold text-white text-sm">{cargo.cargo_description}</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ml-1 ${
                  isContainerized
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                }`}>
                  {cargo.cargo_type_display || cargo.cargo_type}
                </span>
              </div>

              <div className="flex items-center gap-2 text-slate-300 text-xs">
                <span className="text-slate-400 font-medium">Declared:</span>
                <span className="font-mono font-bold text-white bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700">
                  {cargo.cargo_quantity} {cargo.cargo_unit}
                </span>
                <span className="text-slate-400 font-medium ml-1">Total Weight:</span>
                <span className="font-mono font-bold text-emerald-400 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700">
                  {cargo.cargo_weight} MT
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-3 text-slate-300">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Vessel & IMO</span>
                <div className="font-bold text-white flex items-center gap-1 mt-0.5">
                  <Ship className="w-3.5 h-3.5 text-[#D49A24] shrink-0" />
                  <span className="truncate">{cargo.arrival_request_summary?.vessel_name || 'Vessel'}</span>
                </div>
                <div className="text-[10px] font-mono text-[#D49A24]">
                  IMO: {cargo.arrival_request_summary?.vessel_imo_number || '—'}
                </div>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Arrival Request</span>
                <div className="font-mono font-bold text-sky-400 mt-0.5">
                  AR-00{cargo.cargo_arrival_request_id}
                </div>
                <div className="text-[10px] text-slate-400">
                  ETA: {formatDate(cargo.arrival_request_summary?.requested_arrival_at)}
                </div>
              </div>

              <div className="col-span-2">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Route Clearance</span>
                <div className="flex items-center gap-1.5 text-xs text-white mt-0.5 truncate">
                  <span className="font-semibold">{cargo.cargo_origin}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-[#D49A24] shrink-0" />
                  <span className="font-semibold">{cargo.cargo_destination}</span>
                </div>
              </div>
            </div>
          </div>

          {/* ================================================================= */}
          {/* 2. NON-CONTAINERIZED CARGO GUARD */}
          {/* ================================================================= */}
          {!isContainerized ? (
            <div className="p-6 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-center space-y-2">
              <AlertTriangle className="w-8 h-8 mx-auto text-amber-600" />
              <h3 className="font-bold text-base">Container Registration Not Applicable</h3>
              <p className="text-xs max-w-md mx-auto leading-relaxed">
                Containers can only be registered for <strong>Containerized Cargo</strong>. This cargo consignment is classified as <strong>{cargo.cargo_type_display || cargo.cargo_type}</strong> ({cargo.cargo_quantity} {cargo.cargo_unit}).
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs hover:bg-slate-300 transition-colors cursor-pointer"
                >
                  Close Panel
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* ============================================================= */}
              {/* 3. DYNAMIC SUMMARY STATISTICS BAR */}
              {/* ============================================================= */}
              {summary && (
                <div className="space-y-2.5">
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 text-center">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block">Total Units</span>
                      <span className="text-lg font-black text-slate-900 dark:text-white block mt-0.5">
                        {summary.total_containers}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 text-center">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-[#D49A24] block">Capacity</span>
                      <span className="text-lg font-black text-[#D49A24] block mt-0.5">
                        {summary.total_teu} <span className="text-[10px] font-semibold text-slate-400">TEU</span>
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-sky-500/5 dark:bg-sky-950/20 border border-sky-500/20 text-center">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400 block">Registered</span>
                      <span className="text-lg font-black text-sky-600 dark:text-sky-400 block mt-0.5">
                        {summary.status_breakdown.REGISTERED}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-indigo-500/5 dark:bg-indigo-950/20 border border-indigo-500/20 text-center">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 block">Arrived</span>
                      <span className="text-lg font-black text-indigo-600 dark:text-indigo-400 block mt-0.5">
                        {summary.status_breakdown.ARRIVED}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-amber-500/5 dark:bg-amber-950/20 border border-amber-500/20 text-center">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 block">At Terminal</span>
                      <span className="text-lg font-black text-amber-600 dark:text-amber-400 block mt-0.5">
                        {summary.status_breakdown.AT_TERMINAL}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-purple-500/5 dark:bg-purple-950/20 border border-purple-500/20 text-center">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 block">Inspection</span>
                      <span className="text-lg font-black text-purple-600 dark:text-purple-400 block mt-0.5">
                        {summary.status_breakdown.UNDER_INSPECTION}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-emerald-500/5 dark:bg-emerald-950/20 border border-emerald-500/20 text-center">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block">Cleared</span>
                      <span className="text-lg font-black text-emerald-600 dark:text-emerald-400 block mt-0.5">
                        {summary.status_breakdown.CLEARED}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-teal-500/5 dark:bg-teal-950/20 border border-teal-500/20 text-center">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400 block">Released</span>
                      <span className="text-lg font-black text-teal-600 dark:text-teal-400 block mt-0.5">
                        {summary.status_breakdown.RELEASED}
                      </span>
                    </div>
                  </div>

                  {/* Non-blocking capacity mismatch warning */}
                  {summary.capacity_mismatch && (
                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Info className="w-4 h-4 shrink-0 text-amber-600" />
                        <span>
                          <strong>Progressive Manifest Notice:</strong> {summary.mismatch_message}
                        </span>
                      </div>
                      <span className="text-[10px] text-amber-700/80 dark:text-amber-400 font-mono shrink-0">
                        {summary.total_teu} / {summary.declared_cargo_quantity} {summary.declared_cargo_unit}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* ============================================================= */}
              {/* 4. ACTIONS & FILTERS HEADER */}
              {/* ============================================================= */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-2 flex-1">
                  <div className="relative flex-1 max-w-xs">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Search container number..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-[#D49A24]"
                    />
                  </div>

                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-[#D49A24]"
                  >
                    <option value="all">All Types</option>
                    <option value="20FT">20 FT</option>
                    <option value="40FT">40 FT</option>
                    <option value="40FT_HC">40 FT High Cube</option>
                  </select>

                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-[#D49A24]"
                  >
                    <option value="all">All Statuses</option>
                    <option value="REGISTERED">Registered</option>
                    <option value="ARRIVED">Arrived</option>
                    <option value="AT_TERMINAL">At Terminal</option>
                    <option value="AWAITING_CUSTOMS">Awaiting Customs</option>
                    <option value="UNDER_INSPECTION">Under Inspection</option>
                    <option value="CUSTOMS_HOLD">Customs Hold</option>
                    <option value="CLEARED">Cleared</option>
                    <option value="RELEASED">Released</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={fetchContainers}
                    disabled={loading}
                    className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 text-xs font-bold transition-colors cursor-pointer border border-slate-200 dark:border-slate-700"
                    title="Refresh containers"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  </button>

                  {!isTerminalOperator && (
                    <button
                      onClick={handleOpenAdd}
                      className="px-3.5 py-1.5 rounded-xl font-bold text-xs uppercase tracking-wider text-white bg-[#D49A24] hover:bg-[#b8831c] transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Container</span>
                    </button>
                  )}
                </div>

              </div>

              {/* ============================================================= */}
              {/* 5. ADD / EDIT CONTAINER FORM (EXPANDABLE) */}
              {/* ============================================================= */}
              {showAddForm && (
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-3 animate-fade-in">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700 text-xs">
                    <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Boxes className="w-4 h-4 text-[#D49A24]" />
                      <span>{editingContainer ? `Edit Container ${editingContainer.container_number}` : 'Register New Container'}</span>
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Cargo: <strong className="text-slate-800 dark:text-slate-200">{cargo.cargo_description}</strong>
                    </span>
                  </div>

                  {formError && (
                    <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-400 text-xs flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>{formError}</span>
                    </div>
                  )}

                  <form onSubmit={handleSaveContainer} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                        Container Number (ISO-6346) *
                      </label>
                      <input
                        type="text"
                        required
                        disabled={!!editingContainer}
                        value={containerNumber}
                        onChange={(e) => setContainerNumber(e.target.value.toUpperCase())}
                        placeholder="e.g. MSCU1234567"
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono font-bold text-xs uppercase focus:outline-none focus:border-[#D49A24]"
                      />
                      <span className="text-[9px] text-slate-400 mt-0.5 block">4 uppercase letters + 7 digits</span>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                        Container Type *
                      </label>
                      <select
                        required
                        value={containerType}
                        onChange={(e) => setContainerType(e.target.value as ContainerType)}
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-bold text-xs focus:outline-none focus:border-[#D49A24]"
                      >
                        {CONTAINER_TYPES.map(t => (
                          <option key={t.value} value={t.value}>
                            {t.label} ({t.teu} TEU)
                          </option>
                        ))}
                      </select>
                      <span className="text-[9px] text-slate-400 mt-0.5 block">Controlled standard sizing</span>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                        Gross Weight (Metric Tonnes) *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        required
                        value={grossWeight}
                        onChange={(e) => setGrossWeight(e.target.value)}
                        placeholder="e.g. 18.50"
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono font-bold text-xs focus:outline-none focus:border-[#D49A24]"
                      />
                      <span className="text-[9px] text-slate-400 mt-0.5 block">Individual container gross weight</span>
                    </div>

                    <div className="sm:col-span-3 flex items-center justify-end gap-2 pt-1 border-t border-slate-200 dark:border-slate-700">
                      <button
                        type="button"
                        onClick={() => {
                          setShowAddForm(false);
                          setEditingContainer(null);
                        }}
                        className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={submitLoading}
                        className="px-4 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider text-white bg-[#D49A24] hover:bg-[#b8831c] transition-colors cursor-pointer shadow-sm disabled:opacity-50"
                      >
                        {submitLoading ? 'Registering...' : (editingContainer ? 'Update Container' : 'Register Container')}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* ============================================================= */}
              {/* 6. CONTAINERS DATA TABLE & LIFECYCLE STEPPER */}
              {/* ============================================================= */}
              {error && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-400 text-xs">
                  {error}
                </div>
              )}

              {loading ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  <RefreshCw className="w-5 h-5 mx-auto animate-spin mb-2 text-[#D49A24]" />
                  <span>Loading container manifest...</span>
                </div>
              ) : filteredContainers.length === 0 ? (
                <div className="p-8 text-center rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-slate-400 space-y-2">
                  <Boxes className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
                  <p className="font-bold text-xs text-slate-600 dark:text-slate-300">
                    No containers registered yet
                  </p>
                  <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                    Click <strong>"+ Add Container"</strong> above to register individual containers under this cargo manifest.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-black uppercase tracking-wider text-[10px]">
                        <th className="p-3">Container Number</th>
                        <th className="p-3">Type</th>
                        <th className="p-3">Capacity</th>
                        <th className="p-3">Gross Weight</th>
                        <th className="p-3">Status</th>
                        <th className="p-3 min-w-[200px]">Lifecycle Progress</th>
                        <th className="p-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium text-slate-700 dark:text-slate-300">
                      {filteredContainers.map((container) => {
                        const currentStepIdx = getStepProgressIndex(container.container_status);

                        return (
                          <tr
                            key={container.container_id}
                            onClick={() => setSelectedContainerDetail(container)}
                            className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors cursor-pointer group"
                            title="Click row to view complete container tracking details"
                          >
                            <td className="p-3 font-mono font-bold text-slate-900 dark:text-white group-hover:text-[#D49A24] transition-colors">
                              {container.container_number}
                            </td>

                            <td className="p-3 font-semibold text-slate-800 dark:text-slate-200">
                              {container.container_type_display || container.container_type}
                            </td>

                            <td className="p-3 font-mono text-[#D49A24] font-bold">
                              {container.teu_equivalent} TEU
                            </td>

                            <td className="p-3 font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                              {container.container_gross_weight} MT
                            </td>

                            <td className="p-3">
                              {getStatusBadge(container.container_status, container.container_status_display)}
                              {container.gate_pass && (
                                <div className="mt-1">
                                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                    container.gate_pass.gate_pass_status === 'ACTIVE'
                                      ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/30'
                                      : container.gate_pass.gate_pass_status === 'USED'
                                      ? 'bg-teal-500/10 text-teal-600 border border-teal-500/30'
                                      : 'bg-slate-100 text-slate-500 border border-slate-200'
                                  }`}>
                                    <Truck className="w-2.5 h-2.5" />
                                    <span>Pass: {container.gate_pass.gate_pass_status}</span>
                                  </span>
                                </div>
                              )}
                              {container.yard_location && (
                                <div className="mt-1" id={`current-location-${container.container_id}`}>
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                                    <MapPin className="w-2.5 h-2.5 text-amber-500" />
                                    <span>{container.yard_location.location_display}</span>
                                  </span>
                                </div>
                              )}
                              {container.customs_declaration ? (
                                <div className="mt-1">
                                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                    container.customs_declaration.declaration_status === 'CLEARED'
                                      ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/30'
                                      : container.customs_declaration.declaration_status === 'CUSTOMS_HOLD'
                                      ? 'bg-rose-500/10 text-rose-600 border border-rose-500/30'
                                      : 'bg-purple-500/10 text-purple-600 border border-purple-500/30'
                                  }`}>
                                    <ShieldCheck className="w-2.5 h-2.5" />
                                    <span>Pre-Arrival: {container.customs_declaration.declaration_status_display}</span>
                                  </span>
                                </div>
                              ) : container.is_customs_cleared ? (
                                <div className="mt-1">
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/30">
                                    <ShieldCheck className="w-2.5 h-2.5" />
                                    <span>Customs Cleared</span>
                                  </span>
                                </div>
                              ) : null}

                              {container.customs_documents && container.customs_documents.length > 0 && (
                                <div className="mt-1">
                                  {container.customs_documents.every(d => d.review_status === 'VERIFIED') ? (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/30">
                                      <FileText className="w-2.5 h-2.5" />
                                      <span>Docs Verified</span>
                                    </span>
                                  ) : container.customs_documents.some(d => d.review_status === 'REJECTED') ? (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-500/10 text-rose-600 border border-rose-500/30">
                                      <FileText className="w-2.5 h-2.5" />
                                      <span>Issue Found</span>
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-500/30">
                                      <FileText className="w-2.5 h-2.5" />
                                      <span>Docs Submitted</span>
                                    </span>
                                  )}
                                </div>
                              )}
                            </td>

                            {/* Lifecycle Stepper / Progress Bar */}
                            <td className="p-3">
                              {(() => {
                                const stageInfo = getLifecycleStageInfo(container.container_status);
                                const isAllCompleted = container.container_status === 'RELEASED';
                                return (
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-1">
                                      {LIFECYCLE_STEPS.map((step, idx) => {
                                        const isCompleted = isAllCompleted || idx < stageInfo.stepIndex;
                                        const isCurrent = !isAllCompleted && idx === stageInfo.stepIndex;

                                        let dotBg = 'bg-slate-200 dark:bg-slate-700 text-slate-400';
                                        if (isCompleted) {
                                          dotBg = 'bg-emerald-500 text-white';
                                        } else if (isCurrent) {
                                          if (stageInfo.stepStatus === 'awaiting_customs') {
                                            dotBg = 'bg-amber-500 text-white ring-2 ring-amber-500/40 animate-pulse';
                                          } else if (stageInfo.stepStatus === 'under_inspection') {
                                            dotBg = 'bg-purple-600 text-white ring-2 ring-purple-600/40';
                                          } else if (stageInfo.stepStatus === 'customs_hold') {
                                            dotBg = 'bg-rose-600 text-white ring-2 ring-rose-600/40';
                                          } else {
                                            dotBg = 'bg-[#D49A24] text-white ring-2 ring-[#D49A24]/30';
                                          }
                                        }

                                        return (
                                          <React.Fragment key={step.key}>
                                            <div
                                              className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-black transition-colors ${dotBg}`}
                                              title={`Step ${step.stepNumber}: ${step.label}`}
                                            >
                                              {isCompleted ? '✓' : step.stepNumber}
                                            </div>
                                            {idx < LIFECYCLE_STEPS.length - 1 && (
                                              <div
                                                className={`h-0.5 flex-1 transition-colors ${
                                                  isAllCompleted || idx < stageInfo.stepIndex ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700'
                                                }`}
                                              />
                                            )}
                                          </React.Fragment>
                                        );
                                      })}
                                    </div>
                                    <div className="text-[9px] font-semibold text-slate-500 dark:text-slate-400 flex items-center justify-between">
                                      <span className={
                                        stageInfo.stepStatus === 'awaiting_customs' ? 'text-amber-600 dark:text-amber-400 font-bold' :
                                        stageInfo.stepStatus === 'under_inspection' ? 'text-purple-600 dark:text-purple-400 font-bold' :
                                        stageInfo.stepStatus === 'customs_hold' ? 'text-rose-600 dark:text-rose-400 font-bold' :
                                        stageInfo.stepStatus === 'cleared' ? 'text-emerald-600 dark:text-emerald-400 font-bold' :
                                        stageInfo.stepStatus === 'released' ? 'text-emerald-600 dark:text-emerald-400 font-bold' :
                                        'text-slate-700 dark:text-slate-300'
                                      }>
                                        {stageInfo.label}
                                      </span>
                                      <span>Step {stageInfo.stepNumber}/6</span>
                                    </div>
                                  </div>
                                );
                              })()}
                            </td>

                            <td className="p-3 text-right space-x-1.5 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedContainerDetail(container);
                                }}
                                className="p-1.5 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-600 dark:text-sky-400 transition-colors cursor-pointer inline-flex items-center"
                                title="View Container Details"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>

                              {isTerminalOperator ? (
                                <>
                                  {container.container_status === 'REGISTERED' && (
                                    <button
                                      type="button"
                                      disabled={transitioningContainerId === container.container_id}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleTransitionStatus(container, 'ARRIVED');
                                      }}
                                      className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] transition-colors cursor-pointer inline-flex items-center gap-1 shadow-xs disabled:opacity-50"
                                      title="Receive Container from Vessel"
                                    >
                                      {transitioningContainerId === container.container_id ? (
                                        <RefreshCw className="w-3 h-3 animate-spin" />
                                      ) : (
                                        <Anchor className="w-3 h-3" />
                                      )}
                                      <span>Receive Container</span>
                                    </button>
                                  )}

                                  {container.container_status === 'ARRIVED' && (
                                    <button
                                      type="button"
                                      disabled={transitioningContainerId === container.container_id}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleTransitionStatus(container, 'AT_TERMINAL');
                                      }}
                                      className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] transition-colors cursor-pointer inline-flex items-center gap-1 shadow-xs disabled:opacity-50"
                                      title="Move Container to Terminal Yard"
                                    >
                                      {transitioningContainerId === container.container_id ? (
                                        <RefreshCw className="w-3 h-3 animate-spin" />
                                      ) : (
                                        <Boxes className="w-3 h-3" />
                                      )}
                                      <span>Move to Terminal</span>
                                    </button>
                                  )}

                                  {container.container_status === 'AT_TERMINAL' && (
                                    <button
                                      type="button"
                                      disabled={transitioningContainerId === container.container_id}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleTransitionStatus(container, 'AWAITING_CUSTOMS');
                                      }}
                                      className="px-2.5 py-1 rounded-lg bg-[#D49A24] hover:bg-[#b8831c] text-white font-bold text-[11px] transition-colors cursor-pointer inline-flex items-center gap-1 shadow-xs disabled:opacity-50"
                                      title="Send Container to Customs for Inspection"
                                    >
                                      {transitioningContainerId === container.container_id ? (
                                        <RefreshCw className="w-3 h-3 animate-spin" />
                                      ) : (
                                        <ShieldCheck className="w-3 h-3" />
                                      )}
                                      <span>Send to Customs</span>
                                    </button>
                                  )}

                                  {container.container_status === 'AWAITING_CUSTOMS' && (
                                    <span className="px-2 py-0.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-[10px] font-bold inline-flex items-center gap-1">
                                      <Clock className="w-3 h-3 text-amber-500" />
                                      <span>Awaiting Customs</span>
                                    </span>
                                  )}

                                  {container.container_status === 'CUSTOMS_HOLD' && (
                                    <span className="px-2 py-0.5 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30 text-[10px] font-bold inline-flex items-center gap-1">
                                      <XCircle className="w-3 h-3 text-rose-500" />
                                      <span>Customs Hold</span>
                                    </span>
                                  )}
                                </>
                              ) : (
                                <>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setCustomsDocContainer(container);
                                    }}
                                    className="px-2 py-1 rounded-lg bg-teal-600/10 hover:bg-teal-600/20 text-teal-800 dark:text-teal-200 font-bold text-[10px] transition-colors cursor-pointer inline-flex items-center gap-1 border border-teal-600/30"
                                    title="Submit Normal Customs Supporting Documents"
                                  >
                                    <UploadCloud className="w-3 h-3 text-teal-600 dark:text-teal-400" />
                                    <span>Customs Docs</span>
                                  </button>

                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setDeclaringContainer(container);
                                    }}
                                    className="px-2 py-1 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-700 dark:text-purple-300 font-bold text-[10px] transition-colors cursor-pointer inline-flex items-center gap-1 border border-purple-500/30"
                                    title="Submit Pre-Arrival Customs Declaration"
                                  >
                                    <FileCheck className="w-3 h-3" />
                                    <span>Pre-Arrival</span>
                                  </button>

                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setDoContainer(container);
                                      setDoNumber(`DO-${Date.now().toString().slice(-6)}`);
                                      setDoTruckingCompany('Port Express Logistics');
                                      setDoTruckNumber('TRK-4088');
                                      setDoDriverName('John Smith');
                                      setDoValidUntil(new Date(Date.now() + 86400000 * 3).toISOString().slice(0, 16));
                                    }}
                                    className="px-2 py-1 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-700 dark:text-blue-300 font-bold text-[10px] transition-colors cursor-pointer inline-flex items-center gap-1 border border-blue-500/30"
                                    title="Issue Delivery Order"
                                  >
                                    <Truck className="w-3 h-3" />
                                    <span>Issue DO</span>
                                  </button>

                                  {container.container_status === 'REGISTERED' && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleOpenEdit(container);
                                      }}
                                      className="p-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 transition-colors cursor-pointer inline-flex items-center"
                                      title="Edit Container Specs"
                                    >
                                      <Edit className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </>
                              )}
                            </td>

                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {/* FOOTER */}
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs hover:bg-slate-300 transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>

      {/* ===================================================================== */}
      {/* 7. VIEW CONTAINER DETAILS MODAL */}
      {/* ===================================================================== */}
      <Modal
        isOpen={!!selectedContainerDetail}
        onClose={() => setSelectedContainerDetail(null)}
        title={`Container Specifications`}
        subtitle={selectedContainerDetail?.container_number}
        icon={<Boxes className="w-4 h-4 text-[#D49A24]" />}
        maxWidth="2xl"
      >
        {selectedContainerDetail && (
          <div className="space-y-4">
            {/* Header info card */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Container Number</span>
                <h3 className="text-xl font-black font-mono text-slate-900 dark:text-white mt-0.5">
                  {selectedContainerDetail.container_number}
                </h3>
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  {selectedContainerDetail.container_type_display || selectedContainerDetail.container_type} • {selectedContainerDetail.teu_equivalent} TEU Capacity
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Status</span>
                {getStatusBadge(selectedContainerDetail.container_status, selectedContainerDetail.container_status_display)}
              </div>
            </div>

            {/* Stepper Visual Tracker */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400 block">
                Operational Tracking Pipeline
              </span>
              {(() => {
                const stageInfo = getLifecycleStageInfo(selectedContainerDetail.container_status);
                const isAllCompleted = selectedContainerDetail.container_status === 'RELEASED';
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
                            dotBg = 'bg-[#D49A24] text-white ring-2 ring-[#D49A24]/40 shadow-sm';
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
                              <span className={`text-[9px] font-bold mt-1 block truncate ${
                                isCurrent
                                  ? 'text-[#D49A24]'
                                  : isCompleted
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-slate-400'
                              }`}>
                                {step.label}
                              </span>
                            </div>
                            {idx < LIFECYCLE_STEPS.length - 1 && (
                              <div
                                className={`h-0.5 w-4 mb-4 transition-colors ${
                                  isAllCompleted || idx < stageInfo.stepIndex ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700'
                                }`}
                              />
                            )}
                          </React.Fragment>
                        );
                      })}
                    </div>
                    <div className="pt-2 text-center text-xs font-bold text-slate-700 dark:text-slate-300">
                      Current Operational Milestone: <span className={isAllCompleted ? 'text-emerald-600 dark:text-emerald-400' : 'text-[#D49A24]'}>{stageInfo.label}</span> (Step {stageInfo.stepNumber}/6)
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Specifications & Linked Cargo */}
            <div className="space-y-2">
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-[#D49A24] border-b border-slate-200 dark:border-slate-800 pb-1">
                1. Technical & Capacity Specifications
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                  <span className="text-slate-400 text-[10px] font-medium block">Gross Weight</span>
                  <div className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-xs mt-0.5">
                    {selectedContainerDetail.container_gross_weight} Metric Tonnes
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                  <span className="text-slate-400 text-[10px] font-medium block">Standard Sizing</span>
                  <div className="font-bold text-slate-900 dark:text-white text-xs mt-0.5">
                    {selectedContainerDetail.container_type_display || selectedContainerDetail.container_type}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                  <span className="text-slate-400 text-[10px] font-medium block">Container System ID</span>
                  <div className="font-mono font-bold text-slate-700 dark:text-slate-300 text-xs mt-0.5">
                    CNT-00{selectedContainerDetail.container_id}
                  </div>
                </div>
              </div>
            </div>

            {/* Linked Cargo & Vessel Context */}
            <div className="space-y-2">
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400 border-b border-slate-200 dark:border-slate-800 pb-1">
                2. Linked Cargo Consignment & Vessel Manifest Details
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                  <span className="text-slate-400 text-[10px] font-medium block">Linked Cargo Consignment</span>
                  <div className="font-bold text-slate-900 dark:text-white text-xs mt-0.5">
                    #CRG-00{selectedContainerDetail.cargo_context?.cargo_id}: {selectedContainerDetail.cargo_context?.cargo_description}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                  <span className="text-slate-400 text-[10px] font-medium block">Carrier Vessel</span>
                  <div className="font-bold text-slate-900 dark:text-white text-xs mt-0.5 flex items-center gap-1">
                    <Ship className="w-3.5 h-3.5 text-[#D49A24]" />
                    <span>{selectedContainerDetail.cargo_context?.vessel_name || 'Vessel'}</span>
                    <span className="font-mono text-slate-400 text-[10px]">({selectedContainerDetail.cargo_context?.vessel_imo_number})</span>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                  <span className="text-slate-400 text-[10px] font-medium block">Arrival Request ID</span>
                  <div className="font-mono font-bold text-sky-600 dark:text-sky-400 text-xs mt-0.5">
                    AR-00{selectedContainerDetail.cargo_context?.arrival_request_id}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                  <span className="text-slate-400 text-[10px] font-medium block">Port Routing</span>
                  <div className="font-semibold text-slate-900 dark:text-white text-xs mt-0.5 flex items-center gap-1.5 truncate">
                    <span>{selectedContainerDetail.cargo_context?.cargo_origin}</span>
                    <ArrowRight className="w-3 h-3 text-[#D49A24]" />
                    <span>{selectedContainerDetail.cargo_context?.cargo_destination}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Audit Timestamps */}
            <div className="space-y-2">
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-200 dark:border-slate-800 pb-1">
                3. Audit & Registration Timeline
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                  <span className="text-slate-400 text-[10px] font-medium block">Registered At</span>
                  <div className="font-mono text-slate-700 dark:text-slate-300 text-xs mt-0.5">
                    {formatDate(selectedContainerDetail.container_created_at)}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                  <span className="text-slate-400 text-[10px] font-medium block">Last Status Update</span>
                  <div className="font-mono text-slate-700 dark:text-slate-300 text-xs mt-0.5">
                    {formatDate(selectedContainerDetail.container_updated_at)}
                  </div>
                </div>
              </div>
            </div>

            {/* Current Physical Yard Location Card */}
            {selectedContainerDetail.yard_location && (
              <div className="p-4 rounded-xl bg-amber-500/5 dark:bg-amber-950/20 border border-amber-500/20 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5" />
                    Current Physical Yard Location
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                    ALLOCATED
                  </span>
                </div>
                <div className="text-sm font-mono font-black text-slate-900 dark:text-white" id={`current-location-${selectedContainerDetail.container_id}`}>
                  {selectedContainerDetail.yard_location.location_display}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-xs">
                  <div>
                    <span className="text-slate-400 text-[10px] block">Yard</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      {selectedContainerDetail.yard_location.yard_name} ({selectedContainerDetail.yard_location.yard_code})
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] block">Block</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      {selectedContainerDetail.yard_location.block_name} ({selectedContainerDetail.yard_location.block_code})
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] block">Coordinates</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300 font-mono">
                      Row {selectedContainerDetail.yard_location.slot_row} • Bay {selectedContainerDetail.yard_location.slot_bay} • Tier {selectedContainerDetail.yard_location.slot_tier}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Terminal Operator Operational Action Card */}
            {isTerminalOperator && (
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Terminal & Logistics Action</span>
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {selectedContainerDetail.container_status === 'REGISTERED' && 'Container is on carrier vessel. Ready to be received into port.'}
                    {selectedContainerDetail.container_status === 'ARRIVED' && 'Container received at berth. Ready to move to terminal yard.'}
                    {selectedContainerDetail.container_status === 'AT_TERMINAL' && 'Container positioned at terminal yard. Ready for customs handover.'}
                    {selectedContainerDetail.container_status === 'AWAITING_CUSTOMS' && 'Container dispatched to Customs. Awaiting inspection.'}
                    {selectedContainerDetail.container_status === 'UNDER_INSPECTION' && 'Container is currently undergoing Customs Inspection.'}
                    {selectedContainerDetail.container_status === 'CUSTOMS_HOLD' && 'Container is currently on Customs Hold.'}
                    {selectedContainerDetail.container_status === 'CLEARED' && 'Customs Clearance completed. Container ready for gate release.'}
                    {selectedContainerDetail.container_status === 'RELEASED' && 'Container released from port.'}
                  </span>
                </div>
                <div className="shrink-0">
                  {selectedContainerDetail.container_status === 'REGISTERED' && (
                    <button
                      type="button"
                      disabled={transitioningContainerId === selectedContainerDetail.container_id}
                      onClick={() => handleTransitionStatus(selectedContainerDetail, 'ARRIVED')}
                      className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                    >
                      {transitioningContainerId === selectedContainerDetail.container_id ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Anchor className="w-3.5 h-3.5" />
                      )}
                      <span>Receive Container</span>
                    </button>
                  )}
                  {selectedContainerDetail.container_status === 'ARRIVED' && (
                    <button
                      type="button"
                      disabled={transitioningContainerId === selectedContainerDetail.container_id}
                      onClick={() => handleTransitionStatus(selectedContainerDetail, 'AT_TERMINAL')}
                      className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                    >
                      {transitioningContainerId === selectedContainerDetail.container_id ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Boxes className="w-3.5 h-3.5" />
                      )}
                      <span>Move to Terminal</span>
                    </button>
                  )}
                  {selectedContainerDetail.container_status === 'AT_TERMINAL' && (
                    <button
                      type="button"
                      disabled={transitioningContainerId === selectedContainerDetail.container_id}
                      onClick={() => handleTransitionStatus(selectedContainerDetail, 'AWAITING_CUSTOMS')}
                      className="px-3.5 py-1.5 rounded-xl bg-[#D49A24] hover:bg-[#b8831c] text-white font-bold text-xs transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                    >
                      {transitioningContainerId === selectedContainerDetail.container_id ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <ShieldCheck className="w-3.5 h-3.5" />
                      )}
                      <span>Send to Customs</span>
                    </button>
                  )}
                  {selectedContainerDetail.container_status === 'AWAITING_CUSTOMS' && (
                    <span className="px-3 py-1.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-xs font-bold inline-flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-amber-500" />
                      <span>Awaiting Customs</span>
                    </span>
                  )}
                  {selectedContainerDetail.container_status === 'CUSTOMS_HOLD' && (
                    <span className="px-3 py-1.5 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30 text-xs font-bold inline-flex items-center gap-1.5">
                      <XCircle className="w-3.5 h-3.5 text-rose-500" />
                      <span>Customs Hold</span>
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Customs Inspection Information Section if available */}
            {selectedContainerDetail.latest_customs_inspection && (
              <div className="space-y-2">
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 border-b border-slate-200 dark:border-slate-800 pb-1">
                  4. Customs Inspection & Clearance Details
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                    <span className="text-slate-400 text-[10px] font-medium block">Customs Result & Status</span>
                    <div className="font-bold text-slate-900 dark:text-white text-xs mt-0.5 flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                        selectedContainerDetail.latest_customs_inspection.customs_inspection_result === 'CLEARED'
                          ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/30'
                          : selectedContainerDetail.latest_customs_inspection.customs_inspection_result === 'HOLD'
                          ? 'bg-rose-500/10 text-rose-600 border border-rose-500/30'
                          : 'bg-amber-500/10 text-amber-600 border border-amber-500/30'
                      }`}>
                        {selectedContainerDetail.latest_customs_inspection.customs_inspection_result}
                      </span>
                      <span className="text-slate-500 text-[11px]">
                        Doc: {selectedContainerDetail.latest_customs_inspection.customs_inspection_document_status}
                      </span>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                    <span className="text-slate-400 text-[10px] font-medium block">Customs Officer</span>
                    <div className="font-bold text-slate-900 dark:text-white text-xs mt-0.5">
                      {selectedContainerDetail.latest_customs_inspection.customs_inspection_officer_name || 'Assigned Officer'}
                      {selectedContainerDetail.latest_customs_inspection.customs_inspection_officer_email && (
                        <span className="text-[10px] text-slate-400 block font-normal">
                          {selectedContainerDetail.latest_customs_inspection.customs_inspection_officer_email}
                        </span>
                      )}
                    </div>
                  </div>

                  {selectedContainerDetail.latest_customs_inspection.customs_inspection_hold_reason && (
                    <div className="sm:col-span-2 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-400 text-xs">
                      <span className="font-bold block uppercase text-[10px]">Hold Reason:</span>
                      <span>{selectedContainerDetail.latest_customs_inspection.customs_inspection_hold_reason}</span>
                    </div>
                  )}

                  {selectedContainerDetail.latest_customs_inspection.customs_inspection_remarks && (
                    <div className="sm:col-span-2 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 text-xs">
                      <span className="font-bold text-slate-400 block uppercase text-[10px]">Inspection Remarks:</span>
                      <span className="text-slate-700 dark:text-slate-300">
                        {selectedContainerDetail.latest_customs_inspection.customs_inspection_remarks}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Section 4B: Customs Supporting Documents Section (Always visible) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-1">
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" />
                  <span>Customs Supporting Documents ({selectedContainerDetail.customs_documents?.length || 0})</span>
                </h4>
                <button
                  type="button"
                  onClick={() => setCustomsDocContainer(selectedContainerDetail)}
                  className="px-2.5 py-1 rounded-lg bg-[#064e43] hover:bg-[#053d34] text-white text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 shadow-xs transition-colors cursor-pointer"
                >
                  <UploadCloud className="w-3 h-3" />
                  <span>Submit Customs Documents</span>
                </button>
              </div>

              {(!selectedContainerDetail.customs_documents || selectedContainerDetail.customs_documents.length === 0) ? (
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 text-xs text-slate-400 flex items-center justify-between">
                  <span>No customs documents uploaded yet for this container.</span>
                  <button
                    type="button"
                    onClick={() => setCustomsDocContainer(selectedContainerDetail)}
                    className="text-[11px] text-teal-600 dark:text-teal-400 font-bold hover:underline cursor-pointer"
                  >
                    Upload now &rarr;
                  </button>
                </div>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {selectedContainerDetail.customs_documents.map((doc) => (
                    <div
                      key={doc.document_id}
                      className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="w-4 h-4 text-teal-600 shrink-0" />
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 dark:text-white truncate flex items-center gap-1.5">
                            <span>{doc.original_filename}</span>
                            <span className={`px-1.5 py-0.2 rounded text-[9px] font-black uppercase ${
                              doc.workflow_type === 'PRE_ARRIVAL'
                                ? 'bg-purple-500/10 text-purple-600 border border-purple-500/20'
                                : 'bg-teal-500/10 text-teal-600 border border-teal-500/20'
                            }`}>
                              {doc.workflow_type_display || doc.workflow_type}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-500 flex items-center gap-1.5">
                            <span>{doc.document_type_display || doc.document_type}</span>
                            <span>•</span>
                            <span>{doc.file_size_formatted}</span>
                            <span>•</span>
                            <span>{doc.uploader_name || 'Uploader'}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                          doc.review_status === 'VERIFIED'
                            ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/30'
                            : doc.review_status === 'REJECTED'
                            ? 'bg-rose-500/10 text-rose-600 border border-rose-500/30'
                            : 'bg-amber-500/10 text-amber-600 border border-amber-500/30'
                        }`}>
                          {doc.review_status_display || doc.review_status}
                        </span>
                        <button
                          type="button"
                          onClick={() => setCustomsDocContainer(selectedContainerDetail)}
                          className="text-[10px] text-teal-600 dark:text-teal-400 font-bold hover:underline cursor-pointer"
                        >
                          View / Upload
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Section 5: Digital Gate Pass Tracking if available */}
            {selectedContainerDetail.gate_pass && (
              <div className="space-y-2">
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400 border-b border-slate-200 dark:border-slate-800 pb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5" />
                    <span>5. Digital Gate Pass & Dispatch Tracking</span>
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                    selectedContainerDetail.gate_pass.gate_pass_status === 'ACTIVE'
                      ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/30'
                      : selectedContainerDetail.gate_pass.gate_pass_status === 'USED'
                      ? 'bg-teal-500/10 text-teal-600 border border-teal-500/30'
                      : 'bg-slate-100 text-slate-500 border border-slate-200'
                  }`}>
                    Pass Status: {selectedContainerDetail.gate_pass.gate_pass_status}
                  </span>
                </h4>
                <div className="p-3 rounded-lg bg-teal-500/5 border border-teal-500/20 text-xs grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div>
                    <span className="text-slate-400 text-[10px] block">Gate Pass ID</span>
                    <span className="font-mono font-bold text-teal-900 dark:text-teal-200">
                      {selectedContainerDetail.gate_pass.gate_pass_id}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] block">Assigned Truck</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                      {selectedContainerDetail.gate_pass.truck_number}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] block">Assigned Driver</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {selectedContainerDetail.gate_pass.driver_name}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] block">Authorized Gate</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {selectedContainerDetail.gate_pass.gate_name}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center">
              {selectedContainerDetail.container_status === 'RELEASED' && (
                <button
                  type="button"
                  onClick={() => {
                    const id = selectedContainerDetail.container_id;
                    setSelectedContainerDetail(null);
                    setTrackingContainerId(id);
                  }}
                  className="px-4 py-2 rounded-xl bg-[#064e43] hover:bg-[#053d34] text-white font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                >
                  <Truck className="w-3.5 h-3.5" />
                  <span>View Delivery Tracking</span>
                </button>
              )}
              <div className="ml-auto">
                <button
                  type="button"
                  onClick={() => setSelectedContainerDetail(null)}
                  className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs hover:bg-slate-300 transition-colors cursor-pointer"
                >
                  Close Specifications
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Container Delivery Tracking Modal */}
      {trackingContainerId && (
        <ContainerTrackingModal
          containerId={trackingContainerId}
          isOpen={Boolean(trackingContainerId)}
          onClose={() => setTrackingContainerId(null)}
          onStatusUpdated={() => {
            fetchContainers();
          }}
          userRole={activeRole || currentUser?.role}
        />
      )}

      {/* Pre-Arrival Customs Declaration Submission Modal */}
      {declaringContainer && (
        <SubmitPreArrivalCustomsModal
          isOpen={!!declaringContainer}
          onClose={() => setDeclaringContainer(null)}
          container={declaringContainer}
          onDeclarationSubmitted={() => {
            setDeclaringContainer(null);
            fetchContainers();
            if (onRefreshCargo) onRefreshCargo();
          }}
        />
      )}

      {/* Delivery Order Issue Modal */}
      <Modal
        isOpen={!!doContainer}
        onClose={() => setDoContainer(null)}
        title="Issue Delivery Order (DO)"
        subtitle={`Container #${doContainer?.container_number} • Consignment Delivery Authorization`}
        maxWidth="md"
      >
        {doContainer && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setSubmittingDO(true);
              try {
                const res = await apiFetch('/api/shipping/delivery-orders/', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    container_id: doContainer.container_id,
                    delivery_order_number: doNumber.trim(),
                    delivery_order_trucking_company: doTruckingCompany.trim(),
                    delivery_order_truck_number: doTruckNumber.trim().toUpperCase(),
                    delivery_order_driver_name: doDriverName.trim(),
                    delivery_order_valid_until: doValidUntil || new Date(Date.now() + 86400000 * 3).toISOString()
                  })
                });
                const data = await res.json();
                if (!res.ok || data?.status === 'error') {
                  throw new Error(data?.message || 'Failed to issue delivery order.');
                }
                addToast(data?.message || 'Delivery Order issued successfully!', 'success');
                setDoContainer(null);
                fetchContainers();
              } catch (err: any) {
                addToast(err?.message || 'Failed to issue delivery order.', 'error');
              } finally {
                setSubmittingDO(false);
              }
            }}
            className="space-y-3"
          >
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                Delivery Order Number *
              </label>
              <input
                type="text"
                required
                value={doNumber}
                onChange={(e) => setDoNumber(e.target.value.toUpperCase())}
                placeholder="e.g. DO-2026-0001"
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono font-bold text-xs uppercase focus:outline-none focus:border-[#D49A24]"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                Authorized Trucking Company
              </label>
              <input
                type="text"
                value={doTruckingCompany}
                onChange={(e) => setDoTruckingCompany(e.target.value)}
                placeholder="e.g. Port Express Logistics"
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs focus:outline-none focus:border-[#D49A24]"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                  Designated Truck #
                </label>
                <input
                  type="text"
                  value={doTruckNumber}
                  onChange={(e) => setDoTruckNumber(e.target.value.toUpperCase())}
                  placeholder="TRK-4088"
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono text-xs uppercase focus:outline-none focus:border-[#D49A24]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                  Designated Driver Name
                </label>
                <input
                  type="text"
                  value={doDriverName}
                  onChange={(e) => setDoDriverName(e.target.value)}
                  placeholder="John Smith"
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs focus:outline-none focus:border-[#D49A24]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setDoContainer(null)}
                className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingDO}
                className="px-4 py-1.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-sm cursor-pointer disabled:opacity-50"
              >
                {submittingDO ? 'Issuing...' : 'Issue Delivery Order'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Normal Customs Document Submission Modal */}
      {customsDocContainer && (
        <SubmitCustomsDocumentModal
          isOpen={Boolean(customsDocContainer)}
          onClose={() => setCustomsDocContainer(null)}
          container={customsDocContainer}
          onDocumentUploaded={() => {
            fetchContainers();
            if (onRefreshCargo) onRefreshCargo();
          }}
        />
      )}
    </>
  );
};
