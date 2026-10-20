import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { Modal } from '../common/Modal';
import { BackendVessel, BackendVesselArrivalRequest, BackendBerth, BackendVesselSchedule } from '../../types';
import { BerthAvailabilityView } from './BerthAvailabilityView';
import { cleanBerthDisplayName } from '../../utils/berthUtils';
import { API_BASE_URL } from '../../services/api';
import { 
  Anchor, 
  Ship, 
  FileCheck, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Search, 
  RefreshCw, 
  Eye, 
  Check, 
  X, 
  AlertTriangle, 
  Building2, 
  ArrowRight,
  Compass,
  FileText
} from 'lucide-react';

interface PortOperationsDashboardProps {
  activeTab?: string;
  onNavigate?: (tab: string) => void;
}

export const PortOperationsDashboard: React.FC<PortOperationsDashboardProps> = ({ 
  activeTab = 'overview', 
  onNavigate 
}) => {
  const { currentUser, addToast } = useApp();

  const [arrivalRequests, setArrivalRequests] = useState<BackendVesselArrivalRequest[]>([]);
  const [allVessels, setAllVessels] = useState<BackendVessel[]>([]);
  const [berths, setBerths] = useState<BackendBerth[]>([]);
  const [schedules, setSchedules] = useState<BackendVesselSchedule[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  const [statusFilter, setStatusFilter] = useState<string>('PENDING');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [vesselSearchQuery, setVesselSearchQuery] = useState<string>('');

  // Scheduling tab filters
  const [schedulingStatusFilter, setSchedulingStatusFilter] = useState<string>('all');
  const [schedulingSearchQuery, setSchedulingSearchQuery] = useState<string>('');

  // Selected request for View Details Modal
  const [selectedRequest, setSelectedRequest] = useState<BackendVesselArrivalRequest | null>(null);

  // Selected vessel for Vessel Directory View Details Modal
  const [selectedVesselDetail, setSelectedVesselDetail] = useState<BackendVessel | null>(null);
  
  // Review Remarks state inside Details Modal
  const [reviewRemarks, setReviewRemarks] = useState<string>('');
  const [remarksError, setRemarksError] = useState<string>('');

  // Confirmation Modals State
  const [approvingRequest, setApprovingRequest] = useState<BackendVesselArrivalRequest | null>(null);
  const [approvalBerthOption, setApprovalBerthOption] = useState<'preferred' | 'alternate' | 'none'>('preferred');
  const [approvalSelectedBerthId, setApprovalSelectedBerthId] = useState<string>('');
  const [approvalError, setApprovalError] = useState<string>('');
  const [rejectingRequest, setRejectingRequest] = useState<BackendVesselArrivalRequest | null>(null);
  const [confirmRejectionReason, setConfirmRejectionReason] = useState<string>('');
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  // Schedule Create Modal State
  const [selectedScheduleRequest, setSelectedScheduleRequest] = useState<BackendVesselArrivalRequest | null>(null);
  const [selectedBerthId, setSelectedBerthId] = useState<string>('');
  const [scheduledArrivalAt, setScheduledArrivalAt] = useState<string>('');
  const [scheduledDepartureAt, setScheduledDepartureAt] = useState<string>('');
  const [scheduleRemarks, setScheduleRemarks] = useState<string>('');
  const [scheduleError, setScheduleError] = useState<string>('');
  const [scheduleLoading, setScheduleLoading] = useState<boolean>(false);

  // Update Status Modal State
  const [selectedStatusSchedule, setSelectedStatusSchedule] = useState<BackendVesselSchedule | null>(null);
  const [selectedStatusRequest, setSelectedStatusRequest] = useState<BackendVesselArrivalRequest | null>(null);
  const [targetStatus, setTargetStatus] = useState<string>('');
  const [statusUpdateRemarks, setStatusUpdateRemarks] = useState<string>('');
  const [statusUpdateError, setStatusUpdateError] = useState<string>('');
  const [statusUpdateLoading, setStatusUpdateLoading] = useState<boolean>(false);

  const fetchOperationsData = async () => {
    setLoading(true);
    setError('');
    try {
      const headers = {
        'X-User-Email': currentUser?.email || '',
        'X-User-Role': 'port_operations_officer',
        'X-User-Id': currentUser?.id || ''
      };

      const [requestsRes, vesselsRes, berthsRes, schedulesRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/arrival-requests/`, { headers }),
        fetch(`${API_BASE_URL}/api/vessels/`, { headers }),
        fetch(`${API_BASE_URL}/api/berths/`, { headers }),
        fetch(`${API_BASE_URL}/api/schedules/`, { headers })
      ]);

      const requestsJson = await requestsRes.json();
      const vesselsJson = await vesselsRes.json();

      if (requestsRes.ok && requestsJson.status === 'success') {
        setArrivalRequests(requestsJson.data || []);
      } else {
        setError(requestsJson.message || 'Failed to load vessel arrival requests.');
      }

      if (vesselsRes.ok && vesselsJson.status === 'success') {
        setAllVessels(vesselsJson.data || []);
      }

      if (berthsRes.ok) {
        const berthsJson = await berthsRes.json();
        if (berthsJson.status === 'success') {
          setBerths(berthsJson.data || []);
        }
      }

      if (schedulesRes.ok) {
        const schedulesJson = await schedulesRes.json();
        if (schedulesJson.status === 'success') {
          setSchedules(schedulesJson.data || []);
        }
      }
    } catch (err) {
      setError('Unable to connect to backend server. Please ensure Django is running.');
    } finally {
      setLoading(false);
    }
  };

  const openScheduleModal = (req: BackendVesselArrivalRequest) => {
    setSelectedScheduleRequest(req);
    setSelectedBerthId('');
    setScheduleRemarks('');
    setScheduleError('');
    if (req.vessel_arrival_request_requested_arrival_at) {
      try {
        const d = new Date(req.vessel_arrival_request_requested_arrival_at);
        const isoStr = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
        setScheduledArrivalAt(isoStr);
      } catch {
        setScheduledArrivalAt('');
      }
    } else {
      setScheduledArrivalAt('');
    }

    if (req.vessel_arrival_request_requested_departure_at) {
      try {
        const d = new Date(req.vessel_arrival_request_requested_departure_at);
        const isoStr = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
        setScheduledDepartureAt(isoStr);
      } catch {
        setScheduledDepartureAt('');
      }
    } else {
      setScheduledDepartureAt('');
    }
  };

  const handleCreateSchedule = async () => {
    if (!selectedScheduleRequest) return;
    if (!selectedBerthId) {
      setScheduleError('Please select an available berth.');
      return;
    }
    if (!scheduledArrivalAt || !scheduledDepartureAt) {
      setScheduleError('Scheduled arrival and departure date/time are required.');
      return;
    }
    if (new Date(scheduledDepartureAt) <= new Date(scheduledArrivalAt)) {
      setScheduleError('Scheduled departure time cannot be earlier than or equal to scheduled arrival time.');
      return;
    }

    setScheduleError('');
    setScheduleLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/schedules/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Email': currentUser?.email || '',
          'X-User-Role': 'port_operations_officer',
          'X-User-Id': currentUser?.id || ''
        },
        body: JSON.stringify({
          vessel_arrival_request_id: selectedScheduleRequest.vessel_arrival_request_id,
          berth_id: parseInt(selectedBerthId, 10),
          scheduled_arrival_at: scheduledArrivalAt,
          scheduled_departure_at: scheduledDepartureAt,
          operational_remarks: scheduleRemarks
        })
      });

      const resJson = await response.json();
      setScheduleLoading(false);

      if (response.ok && resJson.status === 'success') {
        addToast('success', 'Schedule Created', `Berth assigned and schedule created for '${selectedScheduleRequest.vessel?.vessel_name}'.`);
        setSelectedScheduleRequest(null);
        fetchOperationsData();
      } else {
        setScheduleError(resJson.message || 'Failed to create schedule.');
      }
    } catch (err) {
      setScheduleLoading(false);
      setScheduleError('Network error connecting to backend server.');
    }
  };

  const openStatusUpdateModal = (req: BackendVesselArrivalRequest, sch: BackendVesselSchedule) => {
    setSelectedStatusRequest(req);
    setSelectedStatusSchedule(sch);
    setStatusUpdateRemarks(sch.vessel_schedule_operational_remarks || '');
    setStatusUpdateError('');
    if (sch.vessel_schedule_status === 'SCHEDULED') setTargetStatus('ARRIVED');
    else if (sch.vessel_schedule_status === 'ARRIVED') setTargetStatus('AT_BERTH');
    else if (sch.vessel_schedule_status === 'AT_BERTH') setTargetStatus('DEPARTED');
    else setTargetStatus('');
  };

  const handleConfirmStatusUpdate = async () => {
    if (!selectedStatusSchedule || !targetStatus) return;
    setStatusUpdateError('');
    setStatusUpdateLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/schedules/${selectedStatusSchedule.vessel_schedule_id}/status/`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Email': currentUser?.email || '',
          'X-User-Role': 'port_operations_officer',
          'X-User-Id': currentUser?.id || ''
        },
        body: JSON.stringify({
          status: targetStatus,
          operational_remarks: statusUpdateRemarks
        })
      });

      const resJson = await response.json();
      setStatusUpdateLoading(false);

      if (response.ok && resJson.status === 'success') {
        addToast('success', 'Vessel Status Updated', 'Vessel status updated successfully.');
        setSelectedStatusSchedule(null);
        setSelectedStatusRequest(null);
        fetchOperationsData();
      } else {
        const errMsg = resJson.message || 'Failed to update operational status.';
        setStatusUpdateError(errMsg);
        addToast('error', 'Update Failed', errMsg);
      }
    } catch (err) {
      setStatusUpdateLoading(false);
      setStatusUpdateError('Network error connecting to backend server.');
      addToast('error', 'Network Error', 'Unable to connect to backend server.');
    }
  };

  useEffect(() => {
    fetchOperationsData();
  }, [currentUser?.email]);

  const openDetailsModal = (req: BackendVesselArrivalRequest) => {
    setSelectedRequest(req);
    setReviewRemarks(req.vessel_arrival_request_remarks || '');
    setRemarksError('');
  };

  const handleApproveClick = (req: BackendVesselArrivalRequest, forcedOption?: 'preferred' | 'alternate') => {
    setApprovingRequest(req);
    setApprovalError('');
    if (req.preferred_berth) {
      const vLen = parseFloat(String(req.vessel?.vessel_length || 0));
      const vDraft = parseFloat(String(req.vessel?.vessel_draft || 0));
      const bLen = parseFloat(String(req.preferred_berth.berth_max_length ?? (req.preferred_berth as any).berth_length_capacity ?? 0));
      const bDraft = parseFloat(String(req.preferred_berth.berth_max_draft ?? (req.preferred_berth as any).berth_draft_capacity ?? 0));
      const isSuitable = vLen <= bLen && vDraft <= bDraft && req.preferred_berth.berth_status !== 'MAINTENANCE' && req.preferred_berth.berth_status !== 'INACTIVE';

      // Check conflict
      const reqArr = new Date(req.vessel_arrival_request_requested_arrival_at).getTime();
      const reqDep = new Date(req.vessel_arrival_request_requested_departure_at).getTime();
      const conflict = schedules.find(sch => {
        const schBerthId = sch.vessel_schedule_berth_id || sch.berth?.berth_id;
        if (schBerthId !== req.preferred_berth?.berth_id) return false;
        if (sch.vessel_schedule_status === 'DEPARTED') return false;
        const schA = new Date(sch.vessel_schedule_scheduled_arrival_at).getTime();
        const schD = new Date(sch.vessel_schedule_scheduled_departure_at).getTime();
        return schA < reqDep && schD > reqArr;
      });

      if (forcedOption === 'alternate' || !isSuitable || conflict) {
        setApprovalBerthOption('alternate');
        setApprovalSelectedBerthId('');
      } else {
        setApprovalBerthOption('preferred');
        setApprovalSelectedBerthId(String(req.preferred_berth.berth_id));
      }
    } else {
      setApprovalBerthOption('alternate');
      setApprovalSelectedBerthId('');
    }
  };

  const handleConfirmApproval = async () => {
    if (!approvingRequest) return;
    setApprovalError('');

    const payload: Record<string, any> = {
      remarks: reviewRemarks.trim() || 'Approved for port operations and scheduling.'
    };

    if (approvalBerthOption === 'preferred' && approvingRequest.preferred_berth) {
      const vLen = parseFloat(String(approvingRequest.vessel?.vessel_length || 0));
      const vDraft = parseFloat(String(approvingRequest.vessel?.vessel_draft || 0));
      const bLen = parseFloat(String(approvingRequest.preferred_berth.berth_max_length ?? (approvingRequest.preferred_berth as any).berth_length_capacity ?? 0));
      const bDraft = parseFloat(String(approvingRequest.preferred_berth.berth_max_draft ?? (approvingRequest.preferred_berth as any).berth_draft_capacity ?? 0));
      if (vLen > bLen || vDraft > bDraft) {
        setApprovalError('Preferred berth is technically incompatible with vessel dimensions. Please select an alternate suitable berth.');
        return;
      }
      if (approvingRequest.preferred_berth.berth_status === 'MAINTENANCE' || approvingRequest.preferred_berth.berth_status === 'INACTIVE') {
        setApprovalError('Preferred berth is currently inactive or under maintenance. Please select an alternate berth.');
        return;
      }
      // Check conflict
      const reqArr = new Date(approvingRequest.vessel_arrival_request_requested_arrival_at).getTime();
      const reqDep = new Date(approvingRequest.vessel_arrival_request_requested_departure_at).getTime();
      const conflict = schedules.find(sch => {
        const schBerthId = sch.vessel_schedule_berth_id || sch.berth?.berth_id;
        if (schBerthId !== approvingRequest.preferred_berth?.berth_id) return false;
        if (sch.vessel_schedule_status === 'DEPARTED') return false;
        const schA = new Date(sch.vessel_schedule_scheduled_arrival_at).getTime();
        const schD = new Date(sch.vessel_schedule_scheduled_departure_at).getTime();
        return schA < reqDep && schD > reqArr;
      });
      if (conflict) {
        setApprovalError(`Berth availability conflict: ${cleanBerthDisplayName(approvingRequest.preferred_berth.berth_name)} is already allocated to '${conflict.vessel_name || 'scheduled vessel'}' during this timeframe. Please choose an alternate berth.`);
        return;
      }
      payload.berth_id = approvingRequest.preferred_berth.berth_id;
    } else if (approvalBerthOption === 'alternate') {
      if (!approvalSelectedBerthId) {
        setApprovalError('Please select an alternate berth to allocate.');
        return;
      }
      payload.berth_id = parseInt(approvalSelectedBerthId, 10);
    }

    setActionLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/arrival-requests/${approvingRequest.vessel_arrival_request_id}/approve/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Email': currentUser?.email || '',
          'X-User-Role': 'port_operations_officer',
          'X-User-Id': currentUser?.id || ''
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      setActionLoading(false);

      if (response.ok && result.status === 'success') {
        const isAllocated = !!(result.data?.schedule || payload.berth_id);
        addToast(
          'success', 
          isAllocated ? 'Arrival Request Approved & Berth Allocated' : 'Arrival Request Approved', 
          result.message || `Arrival request for '${approvingRequest.vessel?.vessel_name}' approved successfully.`
        );
        if (selectedRequest?.vessel_arrival_request_id === approvingRequest.vessel_arrival_request_id) {
          setSelectedRequest(null);
        }
        setApprovingRequest(null);
        fetchOperationsData();
      } else {
        setApprovalError(result.message || 'Failed to approve arrival request.');
        addToast('error', 'Approval Blocked', result.message || 'Failed to approve arrival request.');
      }
    } catch (err) {
      setActionLoading(false);
      setApprovalError('Unable to connect to server. Please try again.');
      addToast('error', 'Network Error', 'Unable to connect to server. Please try again.');
    }
  };

  const handleRejectClick = (req: BackendVesselArrivalRequest) => {
    const trimmedRemarks = reviewRemarks.trim();
    if (!trimmedRemarks) {
      setRemarksError('Rejection reason is required.');
      return;
    }
    setRemarksError('');
    setRejectingRequest(req);
    setConfirmRejectionReason(trimmedRemarks);
  };

  const handleConfirmRejection = async () => {
    if (!rejectingRequest) return;
    const finalReason = confirmRejectionReason.trim();
    if (!finalReason) {
      setRemarksError('Rejection reason is required.');
      return;
    }

    setActionLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/arrival-requests/${rejectingRequest.vessel_arrival_request_id}/reject/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Email': currentUser?.email || '',
          'X-User-Role': 'port_operations_officer',
          'X-User-Id': currentUser?.id || ''
        },
        body: JSON.stringify({
          remarks: finalReason
        })
      });

      const result = await response.json();
      setActionLoading(false);

      if (response.ok && result.status === 'success') {
        addToast('info', 'Arrival Request Rejected', `Arrival request for '${rejectingRequest.vessel?.vessel_name}' rejected.`);
        if (selectedRequest?.vessel_arrival_request_id === rejectingRequest.vessel_arrival_request_id) {
          setSelectedRequest(null);
        }
        setRejectingRequest(null);
        setConfirmRejectionReason('');
        setReviewRemarks('');
        fetchOperationsData();
      } else {
        addToast('error', 'Rejection Failed', result.message || 'Failed to reject arrival request.');
      }
    } catch (err) {
      setActionLoading(false);
      addToast('error', 'Network Error', 'Unable to connect to server. Please try again.');
    }
  };

  // Filtered arrival requests
  const filteredRequests = arrivalRequests.filter(req => {
    const matchesStatus = statusFilter === 'all' || req.vessel_arrival_request_status === statusFilter;
    const q = searchQuery.toLowerCase().trim();
    const vesselName = req.vessel?.vessel_name || '';
    const imo = req.vessel?.vessel_imo_number || '';
    const company = req.vessel?.company_name || '';
    const cargo = req.vessel_arrival_request_cargo_type || '';
    const reqId = `AR-00${req.vessel_arrival_request_id}`.toLowerCase();

    const matchesSearch = !q ||
      vesselName.toLowerCase().includes(q) ||
      imo.toLowerCase().includes(q) ||
      company.toLowerCase().includes(q) ||
      cargo.toLowerCase().includes(q) ||
      reqId.includes(q);

    return matchesStatus && matchesSearch;
  });

  // Filtered Vessels for Vessel Directory
  const filteredVessels = allVessels.filter(v => {
    const q = vesselSearchQuery.toLowerCase().trim();
    const name = v.vessel_name || '';
    const imo = v.vessel_imo_number || '';
    const company = v.company_name || '';
    const flag = v.vessel_flag || '';
    const type = v.vessel_type || '';

    return !q ||
      name.toLowerCase().includes(q) ||
      imo.toLowerCase().includes(q) ||
      company.toLowerCase().includes(q) ||
      flag.toLowerCase().includes(q) ||
      type.toLowerCase().includes(q);
  });

  const pendingCount = arrivalRequests.filter(r => r.vessel_arrival_request_status === 'PENDING').length;
  const approvedCount = arrivalRequests.filter(r => r.vessel_arrival_request_status === 'APPROVED').length;
  const rejectedCount = arrivalRequests.filter(r => r.vessel_arrival_request_status === 'REJECTED').length;
  const scheduledCount = schedules.filter(s => s.vessel_schedule_status === 'SCHEDULED').length;
  const inPortCount = schedules.filter(s => s.vessel_schedule_status === 'ARRIVED' || s.vessel_schedule_status === 'AT_BERTH').length;
  const departedCount = schedules.filter(s => s.vessel_schedule_status === 'DEPARTED').length;

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  const approvedRequests = arrivalRequests.filter(req => req.vessel_arrival_request_status === 'APPROVED');

  const filteredSchedulingRequests = approvedRequests.filter(req => {
    const sch = req.schedule || schedules.find(s => s.vessel_schedule_arrival_request_id === req.vessel_arrival_request_id);
    const schStatus = sch ? sch.vessel_schedule_status : 'Awaiting Scheduling';

    const q = schedulingSearchQuery.toLowerCase().trim();
    const vesselName = req.vessel?.vessel_name || '';
    const imo = req.vessel?.vessel_imo_number || '';
    const company = req.vessel?.company_name || '';
    const cargo = req.vessel_arrival_request_cargo_type || '';
    const reqId = `AR-00${req.vessel_arrival_request_id}`.toLowerCase();
    const berthName = sch?.berth_name || sch?.berth?.berth_name || '';

    const filterUpper = schedulingStatusFilter.toUpperCase();
    const statusUpper = schStatus.toUpperCase();

    let matchesStatus = false;
    if (filterUpper === 'ALL') {
      matchesStatus = true;
    } else if (filterUpper === 'AWAITING SCHEDULING' || filterUpper === 'AWAITING_SCHEDULING') {
      matchesStatus = !sch || statusUpper === 'AWAITING SCHEDULING' || statusUpper === 'AWAITING_SCHEDULING';
    } else {
      matchesStatus = filterUpper === statusUpper;
    }

    const matchesSearch = !q ||
      vesselName.toLowerCase().includes(q) ||
      imo.toLowerCase().includes(q) ||
      company.toLowerCase().includes(q) ||
      cargo.toLowerCase().includes(q) ||
      berthName.toLowerCase().includes(q) ||
      reqId.includes(q);

    return matchesStatus && matchesSearch;
  });

  const awaitingCount = approvedRequests.filter(req => {
    const sch = schedules.find(s => 
      s.vessel_schedule_arrival_request_id === req.vessel_arrival_request_id || 
      (typeof s.vessel_schedule_arrival_request_id === 'object' && (s.vessel_schedule_arrival_request_id as any)?.vessel_arrival_request_id === req.vessel_arrival_request_id)
    ) || req.schedule;
    return !sch;
  }).length;

  const scheduledFilterCount = approvedRequests.filter(req => {
    const sch = schedules.find(s => 
      s.vessel_schedule_arrival_request_id === req.vessel_arrival_request_id || 
      (typeof s.vessel_schedule_arrival_request_id === 'object' && (s.vessel_schedule_arrival_request_id as any)?.vessel_arrival_request_id === req.vessel_arrival_request_id)
    ) || req.schedule;
    return sch?.vessel_schedule_status === 'SCHEDULED';
  }).length;

  const arrivedFilterCount = approvedRequests.filter(req => {
    const sch = schedules.find(s => 
      s.vessel_schedule_arrival_request_id === req.vessel_arrival_request_id || 
      (typeof s.vessel_schedule_arrival_request_id === 'object' && (s.vessel_schedule_arrival_request_id as any)?.vessel_arrival_request_id === req.vessel_arrival_request_id)
    ) || req.schedule;
    return sch?.vessel_schedule_status === 'ARRIVED';
  }).length;

  const atBerthFilterCount = approvedRequests.filter(req => {
    const sch = schedules.find(s => 
      s.vessel_schedule_arrival_request_id === req.vessel_arrival_request_id || 
      (typeof s.vessel_schedule_arrival_request_id === 'object' && (s.vessel_schedule_arrival_request_id as any)?.vessel_arrival_request_id === req.vessel_arrival_request_id)
    ) || req.schedule;
    return sch?.vessel_schedule_status === 'AT_BERTH';
  }).length;

  const departedFilterCount = approvedRequests.filter(req => {
    const sch = schedules.find(s => 
      s.vessel_schedule_arrival_request_id === req.vessel_arrival_request_id || 
      (typeof s.vessel_schedule_arrival_request_id === 'object' && (s.vessel_schedule_arrival_request_id as any)?.vessel_arrival_request_id === req.vessel_arrival_request_id)
    ) || req.schedule;
    return sch?.vessel_schedule_status === 'DEPARTED';
  }).length;

  return (
    <>
      {activeTab === 'berth-availability' && (
        <BerthAvailabilityView
          berths={berths}
          loading={loading}
          onRefresh={fetchOperationsData}
        />
      )}

      {/* ========================================================================= */}
      {/* VIEW 1: DASHBOARD OVERVIEW (activeTab === 'overview') */}
      {/* ========================================================================= */}
      {activeTab === 'overview' && (
        <div className="space-y-6 font-sans selection:bg-[#D49A24] selection:text-white animate-fade-in">
          
          {/* HEADER BANNER */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-1">
                <Compass className="w-4 h-4" />
                <span>Port Operations Control Center</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                Operational Dashboard
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">
                High-level operational summary of vessel arrival requests, fleet movements, and operational status across port berths.
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={fetchOperationsData}
                disabled={loading}
                className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all cursor-pointer border border-slate-200 dark:border-slate-700 flex items-center gap-2"
                title="Refresh Requests"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Sync Data</span>
              </button>
            </div>
          </div>

          {/* DYNAMIC STAT CARDS */}
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            <div 
              onClick={() => onNavigate && onNavigate('arrival-requests')}
              className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 hover:border-amber-500 transition-all cursor-pointer shadow-xs space-y-1.5 group"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Pending Review</span>
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
                  <Clock className="w-4 h-4 animate-pulse" />
                </div>
              </div>
              <div className="text-2xl font-black text-amber-600 dark:text-amber-400">
                {pendingCount}
              </div>
              <div className="text-[10px] font-medium text-slate-500">Awaiting Review</div>
            </div>

            <div 
              onClick={() => onNavigate && onNavigate('arrival-requests')}
              className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 hover:border-emerald-500 transition-all cursor-pointer shadow-xs space-y-1.5 group"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Approved Arrivals</span>
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                {approvedCount}
              </div>
              <div className="text-[10px] font-medium text-slate-500">Approved Requests</div>
            </div>

            <div 
              onClick={() => onNavigate && onNavigate('scheduling')}
              className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 hover:border-sky-500 transition-all cursor-pointer shadow-xs space-y-1.5 group"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Scheduled Vessels</span>
                <div className="w-8 h-8 rounded-xl bg-sky-500/10 text-sky-600 flex items-center justify-center font-bold">
                  <Anchor className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-sky-600 dark:text-sky-400">
                {scheduledCount}
              </div>
              <div className="text-[10px] font-medium text-slate-500">Berth Assigned</div>
            </div>

            <div 
              onClick={() => onNavigate && onNavigate('scheduling')}
              className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 hover:border-purple-500 transition-all cursor-pointer shadow-xs space-y-1.5 group"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Vessels In Port</span>
                <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center font-bold">
                  <Ship className="w-4 h-4 animate-bounce" />
                </div>
              </div>
              <div className="text-2xl font-black text-purple-600 dark:text-purple-400">
                {inPortCount}
              </div>
              <div className="text-[10px] font-medium text-slate-500">Arrived / At Berth</div>
            </div>

            <div 
              onClick={() => onNavigate && onNavigate('scheduling')}
              className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 hover:border-indigo-500 transition-all cursor-pointer shadow-xs space-y-1.5 group"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Completed Departures</span>
                <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center font-bold">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
                {departedCount}
              </div>
              <div className="text-[10px] font-medium text-slate-500">Departed Port</div>
            </div>

            <div 
              onClick={() => onNavigate && onNavigate('arrival-requests')}
              className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 hover:border-rose-500 transition-all cursor-pointer shadow-xs space-y-1.5 group"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Rejected Requests</span>
                <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center font-bold">
                  <XCircle className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-rose-600 dark:text-rose-400">
                {rejectedCount}
              </div>
              <div className="text-[10px] font-medium text-slate-500">With Remarks</div>
            </div>
          </div>

          {/* QUICK ACCESS MODULE LINKS */}
          <div className="space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              PORT OPERATIONS MODULES
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div 
                onClick={() => onNavigate && onNavigate('arrival-requests')}
                className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 hover:border-emerald-500 transition-all cursor-pointer shadow-xs flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
                    <FileCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white text-sm group-hover:text-emerald-600 transition-colors">Vessel Arrival Requests</h3>
                    <p className="text-slate-400 text-xs">Review, verify, and approve/reject requests</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
              </div>

              <div 
                onClick={() => onNavigate && onNavigate('scheduling')}
                className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 hover:border-sky-500 transition-all cursor-pointer shadow-xs flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-600 flex items-center justify-center font-bold">
                    <Anchor className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white text-sm group-hover:text-sky-500 transition-colors">Berth & Arrival Scheduling</h3>
                    <p className="text-slate-400 text-xs">Assign berths & manage vessel lifecycle</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
              </div>

              <div 
                onClick={() => onNavigate && onNavigate('vessels')}
                className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 hover:border-[#D49A24] transition-all cursor-pointer shadow-xs flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#D49A24]/10 text-[#D49A24] flex items-center justify-center font-bold">
                    <Ship className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white text-sm group-hover:text-[#D49A24] transition-colors">Vessel Directory</h3>
                    <p className="text-slate-400 text-xs">Browse registered fleet specs & IMO numbers</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </div>

          {/* RECENT OPERATIONAL ACTIVITY SUMMARY TABLE */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Recent Arrival Requests
              </h2>
              <button 
                onClick={() => onNavigate && onNavigate('arrival-requests')}
                className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
              >
                View All ({arrivalRequests.length}) <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 overflow-hidden shadow-xs">
              {arrivalRequests.length === 0 ? (
                <div className="p-8 text-center space-y-2">
                  <Anchor className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-700" />
                  <p className="text-xs font-bold text-slate-500">No recent operational activity.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-black uppercase tracking-wider text-[11px]">
                        <th className="p-3.5">Req #</th>
                        <th className="p-3.5">Vessel Name</th>
                        <th className="p-3.5">IMO Number</th>
                        <th className="p-3.5">Shipping Company</th>
                        <th className="p-3.5">Arrival Time</th>
                        <th className="p-3.5">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium text-slate-700 dark:text-slate-300">
                      {arrivalRequests.slice(0, 5).map(req => (
                        <tr key={req.vessel_arrival_request_id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                          <td className="p-3.5 font-mono font-bold text-sky-600">AR-00{req.vessel_arrival_request_id}</td>
                          <td className="p-3.5 font-bold text-slate-900 dark:text-white">{req.vessel?.vessel_name}</td>
                          <td className="p-3.5 font-mono text-[#D49A24] font-bold">{req.vessel?.vessel_imo_number}</td>
                          <td className="p-3.5">{req.vessel?.company_name}</td>
                          <td className="p-3.5">{formatDate(req.vessel_arrival_request_requested_arrival_at)}</td>
                          <td className="p-3.5">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              req.vessel_arrival_request_status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-600' :
                              req.vessel_arrival_request_status === 'REJECTED' ? 'bg-rose-500/10 text-rose-600' :
                              'bg-amber-500/10 text-amber-600'
                            }`}>
                              {req.vessel_arrival_request_status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 2: VESSEL DIRECTORY (activeTab === 'vessels') */}
      {/* ========================================================================= */}
      {activeTab === 'vessels' && (
        <div className="space-y-6 font-sans selection:bg-[#D49A24] selection:text-white animate-fade-in">
          
          {/* HEADER BANNER */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#D49A24] mb-1">
                <Ship className="w-4 h-4" />
                <span>Fleet Reference Directory</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                Registered Vessel Directory
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">
                Reference and verification directory of all shipping company vessels registered on the PORTIDE platform.
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={fetchOperationsData}
                disabled={loading}
                className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all cursor-pointer border border-slate-200 dark:border-slate-700 flex items-center gap-2"
                title="Refresh Fleet Vessels"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Sync Directory</span>
              </button>
            </div>
          </div>

          {/* SEARCH BAR */}
          <div className="flex items-center justify-between gap-3">
            <div className="relative max-w-sm w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search by vessel name, IMO, company, flag..."
                value={vesselSearchQuery}
                onChange={(e) => setVesselSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-medium focus:outline-none focus:border-[#D49A24]"
              />
            </div>

            <div className="text-xs font-bold text-slate-500">
              Total Fleet Vessels: <span className="text-slate-900 dark:text-white font-mono">{filteredVessels.length}</span>
            </div>
          </div>

          {/* VESSELS TABLE */}
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 overflow-hidden shadow-xs">
            {loading ? (
              <div className="p-12 text-center space-y-3">
                <RefreshCw className="w-8 h-8 mx-auto text-[#D49A24] animate-spin" />
                <p className="text-xs font-bold text-slate-600 dark:text-slate-400">Loading registered vessels from PostgreSQL...</p>
              </div>
            ) : filteredVessels.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <Ship className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-700" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">No registered vessels found.</h3>
                <p className="text-xs text-slate-500">No vessels match the search criteria or exist in the database.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-black uppercase tracking-wider text-[11px]">
                      <th className="p-4">VESSEL NAME</th>
                      <th className="p-4">IMO NUMBER</th>
                      <th className="p-4">TYPE</th>
                      <th className="p-4">FLAG</th>
                      <th className="p-4">LENGTH</th>
                      <th className="p-4">DRAFT</th>
                      <th className="p-4">CAPACITY</th>
                      <th className="p-4">SHIPPING COMPANY</th>
                      <th className="p-4">STATUS</th>
                      <th className="p-4 text-right">ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium text-slate-700 dark:text-slate-300">
                    {filteredVessels.map(vessel => (
                      <tr 
                        key={vessel.vessel_id} 
                        onClick={() => setSelectedVesselDetail(vessel)}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors cursor-pointer group"
                        title="Click row to view vessel technical specifications"
                      >
                        <td className="p-4 font-bold text-slate-900 dark:text-white">
                          <div 
                            className="flex items-center gap-1.5 text-slate-900 dark:text-white group-hover:text-[#D49A24] dark:group-hover:text-[#D49A24] transition-colors"
                          >
                            <Ship className="w-4 h-4 text-[#D49A24] shrink-0 group-hover:scale-110 transition-transform" />
                            <span className="group-hover:underline">{vessel.vessel_name}</span>
                          </div>
                        </td>
                        <td className="p-4 font-mono font-bold text-[#D49A24]">{vessel.vessel_imo_number}</td>
                        <td className="p-4 font-semibold text-slate-800 dark:text-slate-200">{vessel.vessel_type}</td>
                        <td className="p-4 font-medium">{vessel.vessel_flag}</td>
                        <td className="p-4 font-mono">{vessel.vessel_length} m</td>
                        <td className="p-4 font-mono text-emerald-600 font-bold">{vessel.vessel_draft} m</td>
                        <td className="p-4 font-mono font-bold text-slate-900 dark:text-white">{vessel.vessel_capacity} TEU</td>
                        <td className="p-4 font-semibold text-slate-800 dark:text-slate-200">{vessel.company_name}</td>
                        <td className="p-4">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/30">
                            {vessel.vessel_status || 'ACTIVE'}
                          </span>
                        </td>
                        <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={(e) => { e.stopPropagation(); setSelectedVesselDetail(vessel); }}
                            className="px-2.5 py-1 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-600 dark:text-sky-400 font-bold text-xs inline-flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>View Details</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 3: BERTH & ARRIVAL SCHEDULING (activeTab === 'scheduling') */}
      {/* ========================================================================= */}
      {activeTab === 'scheduling' && (
        <div className="space-y-6 font-sans selection:bg-[#D49A24] selection:text-white animate-fade-in">
          {/* HEADER BANNER */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400 mb-1">
                <Anchor className="w-4 h-4" />
                <span>Berth Allocation & Operational Control</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                Berth & Arrival Scheduling
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">
                Schedule approved vessel arrivals and assign available berths for port operations.
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={fetchOperationsData}
                disabled={loading}
                className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all cursor-pointer border border-slate-200 dark:border-slate-700 flex items-center gap-2"
                title="Refresh Scheduling Data"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Sync Schedules</span>
              </button>
            </div>
          </div>

          {/* SEARCH & FILTERS BAR */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative max-w-sm w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search approved vessels, berths, IMO..."
                value={schedulingSearchQuery}
                onChange={(e) => setSchedulingSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-sky-500"
              />
            </div>

            {/* STATUS FILTER PILLS */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              {[
                { id: 'all', label: 'All Approved', count: approvedRequests.length },
                { id: 'Awaiting Scheduling', label: 'Awaiting Scheduling', count: awaitingCount },
                { id: 'SCHEDULED', label: 'Scheduled', count: scheduledFilterCount },
                { id: 'ARRIVED', label: 'Arrived', count: arrivedFilterCount },
                { id: 'AT_BERTH', label: 'At Berth', count: atBerthFilterCount },
                { id: 'DEPARTED', label: 'Departed', count: departedFilterCount }
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setSchedulingStatusFilter(f.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                    schedulingStatusFilter === f.id
                      ? 'bg-sky-500 text-white shadow-xs'
                      : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <span>{f.label}</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                    schedulingStatusFilter === f.id
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                  }`}>
                    {f.count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* SCHEDULING TABLE */}
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 overflow-hidden shadow-xs">
            {loading ? (
              <div className="p-12 text-center text-slate-400 text-xs font-bold">
                Loading approved requests & berth schedules...
              </div>
            ) : filteredSchedulingRequests.length === 0 ? (
              <div className="p-12 text-center space-y-2">
                <Anchor className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-700" />
                <div className="text-xs font-bold text-slate-700 dark:text-slate-300">No approved arrival requests match your filters.</div>
                <p className="text-[11px] text-slate-400">Only requests approved by Port Operations Officer appear in this scheduling queue.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-black uppercase tracking-wider text-[11px]">
                      <th className="p-3.5">Req #</th>
                      <th className="p-3.5">Vessel Name</th>
                      <th className="p-3.5">IMO Number</th>
                      <th className="p-3.5">Shipping Company</th>
                      <th className="p-3.5">Requested Arrival</th>
                      <th className="p-3.5">Requested Departure</th>
                      <th className="p-3.5">Cargo</th>
                      <th className="p-3.5">Approval Status</th>
                      <th className="p-3.5">Scheduling Status</th>
                      <th className="p-3.5">Assigned Berth</th>
                      <th className="p-3.5">Scheduled Arrival</th>
                      <th className="p-3.5">Scheduled Departure</th>
                      <th className="p-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium text-slate-700 dark:text-slate-300">
                    {filteredSchedulingRequests.map(req => {
                      const sch = req.schedule || schedules.find(s => s.vessel_schedule_arrival_request_id === req.vessel_arrival_request_id);
                      const schStatus = sch ? sch.vessel_schedule_status : 'Awaiting Scheduling';
                      const berthName = sch?.berth_name || sch?.berth?.berth_name || 'Unassigned';

                      return (
                        <tr key={req.vessel_arrival_request_id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                          <td className="p-3.5 font-mono font-bold text-sky-600">AR-00{req.vessel_arrival_request_id}</td>
                          <td className="p-3.5 font-bold text-slate-900 dark:text-white">{req.vessel?.vessel_name}</td>
                          <td className="p-3.5 font-mono text-[#D49A24] font-bold">{req.vessel?.vessel_imo_number}</td>
                          <td className="p-3.5">{req.vessel?.company_name}</td>
                          <td className="p-3.5">{formatDate(req.vessel_arrival_request_requested_arrival_at)}</td>
                          <td className="p-3.5">{formatDate(req.vessel_arrival_request_requested_departure_at)}</td>
                          <td className="p-3.5">
                            <span className="font-semibold">{req.vessel_arrival_request_cargo_type}</span>
                          </td>
                          <td className="p-3.5">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600">
                              <CheckCircle2 className="w-3 h-3" />
                              APPROVED
                            </span>
                          </td>
                          <td className="p-3.5">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              schStatus === 'SCHEDULED' ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400' :
                              schStatus === 'ARRIVED' ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400' :
                              schStatus === 'AT_BERTH' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
                              schStatus === 'DEPARTED' ? 'bg-slate-500/10 text-slate-500 dark:text-slate-400' :
                              'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                            }`}>
                              {schStatus.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="p-3.5">
                            <span className={`font-bold ${berthName !== 'Unassigned' ? 'text-slate-900 dark:text-white' : 'text-slate-400 font-normal'}`}>
                              {berthName}
                            </span>
                          </td>
                          <td className="p-3.5">{sch ? formatDate(sch.vessel_schedule_scheduled_arrival_at) : '—'}</td>
                          <td className="p-3.5">{sch ? formatDate(sch.vessel_schedule_scheduled_departure_at) : '—'}</td>
                          <td className="p-3.5 text-right">
                            {!sch ? (
                              <button
                                type="button"
                                onClick={() => openScheduleModal(req)}
                                className="px-3 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs transition-colors cursor-pointer shadow-xs"
                              >
                                Schedule
                              </button>
                            ) : sch.vessel_schedule_status !== 'DEPARTED' ? (
                              <button
                                type="button"
                                onClick={() => openStatusUpdateModal(req, sch)}
                                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white font-bold text-xs transition-colors cursor-pointer shadow-xs"
                              >
                                Update Status
                              </button>
                            ) : (
                              <span className="text-[11px] font-bold text-slate-400">Completed</span>
                            )}
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

      {/* ========================================================================= */}
      {/* VIEW 4: VESSEL ARRIVAL REQUESTS (activeTab === 'arrival-requests' or default) */}
      {/* ========================================================================= */}
      {(activeTab === 'arrival-requests' || (activeTab !== 'overview' && activeTab !== 'vessels' && activeTab !== 'scheduling')) && (
        <div className="space-y-6 font-sans selection:bg-[#D49A24] selection:text-white animate-fade-in">
          
          {/* HEADER BANNER */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-1">
                <Compass className="w-4 h-4" />
                <span>Port Operations Control Center</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                Vessel Arrival Request Review
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">
                Review incoming vessel arrival requests, verify vessel and cargo information, and approve or reject arrival requests for further port scheduling.
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={fetchOperationsData}
                disabled={loading}
                className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all cursor-pointer border border-slate-200 dark:border-slate-700 flex items-center gap-2"
                title="Refresh Requests"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Sync Requests</span>
              </button>
            </div>
          </div>

          {/* STAT CARDS */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            
            <div 
              onClick={() => setStatusFilter('PENDING')}
              className={`p-5 rounded-2xl border transition-all cursor-pointer shadow-xs space-y-2 ${
                statusFilter === 'PENDING' 
                  ? 'bg-amber-500/10 border-amber-500 dark:border-amber-500' 
                  : 'bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Pending Review</span>
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
                  <Clock className="w-5 h-5 animate-pulse" />
                </div>
              </div>
              <div className="text-3xl font-black text-amber-600 dark:text-amber-400">
                {pendingCount}
              </div>
              <div className="text-[11px] font-medium text-slate-500">Awaiting Ops Approval</div>
            </div>

            <div 
              onClick={() => setStatusFilter('APPROVED')}
              className={`p-5 rounded-2xl border transition-all cursor-pointer shadow-xs space-y-2 ${
                statusFilter === 'APPROVED' 
                  ? 'bg-emerald-500/10 border-emerald-500 dark:border-emerald-500' 
                  : 'bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Approved Arrivals</span>
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              </div>
              <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400">
                {approvedCount}
              </div>
              <div className="text-[11px] font-medium text-slate-500">Ready for Berth Allocation</div>
            </div>

            <div 
              onClick={() => setStatusFilter('REJECTED')}
              className={`p-5 rounded-2xl border transition-all cursor-pointer shadow-xs space-y-2 ${
                statusFilter === 'REJECTED' 
                  ? 'bg-rose-500/10 border-rose-500 dark:border-rose-500' 
                  : 'bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Rejected Requests</span>
                <div className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center font-bold">
                  <XCircle className="w-5 h-5" />
                </div>
              </div>
              <div className="text-3xl font-black text-rose-600 dark:text-rose-400">
                {rejectedCount}
              </div>
              <div className="text-[11px] font-medium text-slate-500">With Operational Remarks</div>
            </div>

            <div 
              onClick={() => setStatusFilter('all')}
              className={`p-5 rounded-2xl border transition-all cursor-pointer shadow-xs space-y-2 ${
                statusFilter === 'all' 
                  ? 'bg-[#D49A24]/10 border-[#D49A24]' 
                  : 'bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Arrival Requests</span>
                <div className="w-9 h-9 rounded-xl bg-[#D49A24]/10 text-[#D49A24] flex items-center justify-center font-bold">
                  <FileCheck className="w-5 h-5" />
                </div>
              </div>
              <div className="text-3xl font-black text-slate-900 dark:text-white">
                {arrivalRequests.length}
              </div>
              <div className="text-[11px] font-medium text-slate-500">All Registered Requests</div>
            </div>
          </div>

          {/* ERROR BANNER */}
          {error && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-400 text-xs flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{error}</span>
              </div>
              <button onClick={fetchOperationsData} className="px-3 py-1 rounded-lg bg-rose-600 text-white font-bold text-xs">
                Retry
              </button>
            </div>
          )}

          {/* MAIN CONTENT AREA */}
          <div className="space-y-4">
            
            {/* FILTER BAR */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              
              <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-1.5 shrink-0 overflow-x-auto">
                <button
                  onClick={() => setStatusFilter('PENDING')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    statusFilter === 'PENDING'
                      ? 'bg-amber-500 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  Pending ({pendingCount})
                </button>
                <button
                  onClick={() => setStatusFilter('APPROVED')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    statusFilter === 'APPROVED'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  Approved ({approvedCount})
                </button>
                <button
                  onClick={() => setStatusFilter('REJECTED')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    statusFilter === 'REJECTED'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  Rejected ({rejectedCount})
                </button>
                <button
                  onClick={() => setStatusFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    statusFilter === 'all'
                      ? 'bg-slate-800 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  All ({arrivalRequests.length})
                </button>
              </div>

              <div className="relative max-w-xs w-full">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search by vessel, IMO, shipping company..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-medium focus:outline-none focus:border-emerald-500"
                />
              </div>

            </div>

        {/* ARRIVAL REQUESTS TABLE */}
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 overflow-hidden shadow-xs">
          {loading ? (
            <div className="p-12 text-center space-y-3">
              <RefreshCw className="w-8 h-8 mx-auto text-emerald-600 animate-spin" />
              <p className="text-xs font-bold text-slate-600 dark:text-slate-400">Loading arrival requests from PostgreSQL...</p>
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <Anchor className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-700" />
              <h3 className="text-base font-bold text-slate-900 dark:text-white">No arrival requests found.</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {statusFilter === 'PENDING' ? 'No pending vessel arrival requests awaiting review.' : 'No arrival requests match the selected status filter.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-black uppercase tracking-wider text-[11px]">
                    <th className="p-4">REQUEST #</th>
                    <th className="p-4">VESSEL SPECS</th>
                    <th className="p-4">SHIPPING COMPANY</th>
                    <th className="p-4">REQUESTED ARRIVAL</th>
                    <th className="p-4">REQUESTED DEPARTURE</th>
                    <th className="p-4">CARGO TYPE</th>
                    <th className="p-4">PREFERRED BERTH</th>
                    <th className="p-4">STATUS</th>
                    <th className="p-4 text-right">OPERATIONAL ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium text-slate-700 dark:text-slate-300">
                  {filteredRequests.map((req) => (
                    <tr 
                      key={req.vessel_arrival_request_id} 
                      onClick={() => openDetailsModal(req)}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors cursor-pointer group"
                      title="Click row to view complete arrival request details"
                    >
                      
                      <td className="p-4 font-mono font-bold text-sky-600 group-hover:text-sky-500 transition-colors">
                        AR-00{req.vessel_arrival_request_id}
                      </td>

                      <td className="p-4">
                        <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 group-hover:text-[#D49A24] transition-colors">
                          <Ship className="w-4 h-4 text-[#D49A24] shrink-0" />
                          <span>{req.vessel?.vessel_name || 'Vessel'}</span>
                        </div>
                        <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                          IMO: {req.vessel?.vessel_imo_number} | Draft: {req.vessel?.vessel_draft}m
                        </div>
                      </td>

                      <td className="p-4">
                        <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                          <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{req.vessel?.company_name || 'Shipping Company'}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 truncate max-w-[150px]">{req.vessel?.company_email}</div>
                      </td>

                      <td className="p-4 font-medium text-slate-800 dark:text-slate-200">
                        {formatDate(req.vessel_arrival_request_requested_arrival_at)}
                      </td>

                      <td className="p-4 font-medium text-slate-800 dark:text-slate-200">
                        {formatDate(req.vessel_arrival_request_requested_departure_at)}
                      </td>

                      <td className="p-4">
                        <div className="font-semibold text-slate-800 dark:text-slate-200">{req.vessel_arrival_request_cargo_type}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{req.vessel_arrival_request_cargo_quantity} units</div>
                      </td>

                      <td className="p-4">
                        {req.preferred_berth ? (
                          <div>
                            <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1">
                              <span>{cleanBerthDisplayName(req.preferred_berth.berth_name)}</span>
                            </div>
                            <div className="text-[10px] font-mono text-sky-600 dark:text-sky-400">
                              {req.preferred_berth.berth_code}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs italic">Open allocation</span>
                        )}
                      </td>

                      <td className="p-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          req.vessel_arrival_request_status === 'APPROVED'
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                            : req.vessel_arrival_request_status === 'REJECTED'
                            ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                            : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                        }`}>
                          {req.vessel_arrival_request_status === 'APPROVED' && <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
                          {req.vessel_arrival_request_status === 'REJECTED' && <XCircle className="w-3 h-3 text-rose-500" />}
                          {req.vessel_arrival_request_status === 'PENDING' && <Clock className="w-3 h-3 text-amber-500 animate-pulse" />}
                          {req.vessel_arrival_request_status}
                        </span>
                      </td>

                      <td className="p-4 text-right space-x-1.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => openDetailsModal(req)}
                          className="px-2.5 py-1 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-600 dark:text-sky-400 font-bold text-xs inline-flex items-center gap-1 transition-colors cursor-pointer"
                          title="View Complete Request Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View</span>
                        </button>

                        {req.vessel_arrival_request_status === 'PENDING' && (
                          <>
                            <button
                              onClick={() => {
                                openDetailsModal(req);
                                handleApproveClick(req);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] transition-colors cursor-pointer inline-flex items-center gap-1 shadow-xs"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Approve</span>
                            </button>

                            <button
                              onClick={() => {
                                openDetailsModal(req);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11px] transition-colors cursor-pointer inline-flex items-center gap-1 shadow-xs"
                            >
                              <X className="w-3.5 h-3.5" />
                              <span>Reject</span>
                            </button>
                          </>
                        )}
                      </td>

                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )}

      {/* SHARED MODALS */}
      <Modal
        isOpen={!!selectedRequest}
        onClose={() => setSelectedRequest(null)}
        title="Vessel Arrival Request Details"
        subtitle={`Request #AR-00${selectedRequest?.vessel_arrival_request_id} • ${selectedRequest?.vessel?.vessel_name}`}
        icon={<Anchor className="w-4 h-4 text-emerald-600" />}
        maxWidth="3xl"
        footer={
          (() => {
            const vLen = parseFloat(String(selectedRequest?.vessel?.vessel_length || 0));
            const vDraft = parseFloat(String(selectedRequest?.vessel?.vessel_draft || 0));
            const pref = selectedRequest?.preferred_berth;
            const bLen = parseFloat(String(pref?.berth_max_length ?? (pref as any)?.berth_length_capacity ?? 0));
            const bDraft = parseFloat(String(pref?.berth_max_draft ?? (pref as any)?.berth_draft_capacity ?? 0));
            const isLenOk = pref ? vLen <= bLen : false;
            const isDraftOk = pref ? vDraft <= bDraft : false;
            const isCompatible = pref ? (isLenOk && isDraftOk) : false;
            const isOperational = pref ? (pref.berth_is_active !== false && pref.berth_status !== 'MAINTENANCE' && pref.berth_status !== 'INACTIVE') : false;

            const reqArr = selectedRequest ? new Date(selectedRequest.vessel_arrival_request_requested_arrival_at).getTime() : 0;
            const reqDep = selectedRequest ? new Date(selectedRequest.vessel_arrival_request_requested_departure_at).getTime() : 0;

            const conflictingSchedule = pref ? schedules.find(sch => {
              const schBerthId = sch.vessel_schedule_berth_id || sch.berth?.berth_id;
              if (schBerthId !== pref.berth_id) return false;
              if (sch.vessel_schedule_status === 'DEPARTED') return false;
              const schA = new Date(sch.vessel_schedule_scheduled_arrival_at).getTime();
              const schD = new Date(sch.vessel_schedule_scheduled_departure_at).getTime();
              return schA < reqDep && schD > reqArr;
            }) : null;

            const canApprovePreferred = pref ? (isCompatible && isOperational && !conflictingSchedule) : false;

            return (
              <div className="flex items-center justify-between w-full">
                <button
                  onClick={() => setSelectedRequest(null)}
                  className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors cursor-pointer"
                >
                  Close
                </button>

                {selectedRequest?.vessel_arrival_request_status === 'PENDING' && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleRejectClick(selectedRequest)}
                      disabled={actionLoading}
                      className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-md transition-all cursor-pointer disabled:opacity-50"
                    >
                      <XCircle className="w-4 h-4" /> Reject Request
                    </button>

                    {pref ? (
                      canApprovePreferred ? (
                        <>
                          <button
                            onClick={() => handleApproveClick(selectedRequest, 'alternate')}
                            disabled={actionLoading}
                            className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                            title="Assign an alternative berth instead of preferred"
                          >
                            <ArrowRight className="w-3.5 h-3.5 text-sky-600" /> Change Berth
                          </button>
                          <button
                            onClick={() => handleApproveClick(selectedRequest, 'preferred')}
                            disabled={actionLoading}
                            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-md transition-all cursor-pointer disabled:opacity-50"
                          >
                            <CheckCircle2 className="w-4 h-4" /> Approve Request
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => handleApproveClick(selectedRequest, 'alternate')}
                          disabled={actionLoading}
                          className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-md transition-all cursor-pointer disabled:opacity-50"
                          title="Preferred berth cannot be finalized. Select another suitable berth to approve."
                        >
                          <ArrowRight className="w-4 h-4" /> Change Berth &amp; Approve
                        </button>
                      )
                    ) : (
                      <button
                        onClick={() => handleApproveClick(selectedRequest, 'alternate')}
                        disabled={actionLoading}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-md transition-all cursor-pointer disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-4 h-4" /> Assign Berth &amp; Approve
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })()
        }
      >
        {selectedRequest && (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
              <div>
                <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Request Number & Status</div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="font-mono font-bold text-sky-600 text-xs">AR-00{selectedRequest.vessel_arrival_request_id}</span>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                    selectedRequest.vessel_arrival_request_status === 'APPROVED'
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      : selectedRequest.vessel_arrival_request_status === 'REJECTED'
                      ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                      : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                  }`}>
                    {selectedRequest.vessel_arrival_request_status}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Submission Timestamp</div>
                <div className="text-slate-900 dark:text-white font-bold text-xs mt-0.5">
                  {formatDate(selectedRequest.vessel_arrival_request_submitted_at)}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 border-b border-slate-200 dark:border-slate-800 pb-1">
                1. Vessel Specifications
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
                <div className="p-2.5 px-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                  <div className="text-slate-400 text-[10px] font-medium">Vessel Name:</div>
                  <div className="font-bold text-slate-900 dark:text-white text-xs mt-0.5 truncate">
                    {selectedRequest.vessel?.vessel_name || 'N/A'}
                  </div>
                </div>

                <div className="p-2.5 px-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                  <div className="text-slate-400 text-[10px] font-medium">IMO Number:</div>
                  <div className="font-mono font-bold text-[#D49A24] text-xs mt-0.5 truncate">
                    {selectedRequest.vessel?.vessel_imo_number || 'N/A'}
                  </div>
                </div>

                <div className="p-2.5 px-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                  <div className="text-slate-400 text-[10px] font-medium">Vessel Type:</div>
                  <div className="font-semibold text-slate-900 dark:text-white text-xs mt-0.5 truncate">
                    {selectedRequest.vessel?.vessel_type || 'CONTAINER_SHIP'}
                  </div>
                </div>

                <div className="p-2.5 px-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                  <div className="text-slate-400 text-[10px] font-medium">Flag State:</div>
                  <div className="font-semibold text-slate-900 dark:text-white text-xs mt-0.5 truncate">
                    {selectedRequest.vessel?.vessel_flag || 'N/A'}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="p-2.5 px-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                  <div className="text-slate-400 text-[10px] font-medium">Length (m):</div>
                  <div className="font-mono font-bold text-slate-900 dark:text-white text-xs mt-0.5">
                    {selectedRequest.vessel?.vessel_length ? `${selectedRequest.vessel.vessel_length} m` : 'N/A'}
                  </div>
                </div>

                <div className="p-2.5 px-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                  <div className="text-slate-400 text-[10px] font-medium">Max Draft (m):</div>
                  <div className="font-mono font-bold text-emerald-600 text-xs mt-0.5">
                    {selectedRequest.vessel?.vessel_draft ? `${selectedRequest.vessel.vessel_draft} m` : 'N/A'}
                  </div>
                </div>

                <div className="p-2.5 px-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                  <div className="text-slate-400 text-[10px] font-medium">Capacity (TEU):</div>
                  <div className="font-mono font-bold text-slate-900 dark:text-white text-xs mt-0.5">
                    {selectedRequest.vessel?.vessel_capacity ? `${selectedRequest.vessel.vessel_capacity} TEU` : 'N/A'}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 border-b border-slate-200 dark:border-slate-800 pb-1">
                2. Shipping Company / Operator
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="p-2.5 px-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                  <div className="text-slate-400 text-[10px] font-medium">Company Name:</div>
                  <div className="font-bold text-slate-900 dark:text-white text-xs mt-0.5 truncate">
                    {selectedRequest.shipping_company?.shipping_company_name || selectedRequest.vessel?.company_name || 'N/A'}
                  </div>
                </div>

                <div className="p-2.5 px-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                  <div className="text-slate-400 text-[10px] font-medium">License #:</div>
                  <div className="font-mono font-bold text-slate-900 dark:text-white text-xs mt-0.5 truncate">
                    {selectedRequest.shipping_company?.shipping_company_license_number || 'N/A'}
                  </div>
                </div>

                <div className="p-2.5 px-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                  <div className="text-slate-400 text-[10px] font-medium">Status:</div>
                  <div className="font-bold text-emerald-600 dark:text-emerald-400 text-xs mt-0.5">
                    ACTIVE
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 border-b border-slate-200 dark:border-slate-800 pb-1">
                  3. Schedule Timestamps
                </h3>
                <div className="space-y-2">
                  <div className="p-2.5 px-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                    <div className="text-slate-400 text-[10px] font-medium">Requested Arrival:</div>
                    <div className="font-bold text-slate-900 dark:text-white text-xs mt-0.5">
                      {formatDate(selectedRequest.vessel_arrival_request_requested_arrival_at)}
                    </div>
                  </div>
                  <div className="p-2.5 px-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                    <div className="text-slate-400 text-[10px] font-medium">Requested Departure:</div>
                    <div className="font-bold text-slate-900 dark:text-white text-xs mt-0.5">
                      {formatDate(selectedRequest.vessel_arrival_request_requested_departure_at)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 border-b border-slate-200 dark:border-slate-800 pb-1">
                  4. Cargo Specifications
                </h3>
                <div className="space-y-2">
                  <div className="p-2.5 px-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                    <div className="text-slate-400 text-[10px] font-medium">Cargo Type:</div>
                    <div className="font-bold text-slate-900 dark:text-white text-xs mt-0.5">
                      {selectedRequest.vessel_arrival_request_cargo_type}
                    </div>
                  </div>
                  <div className="p-2.5 px-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                    <div className="text-slate-400 text-[10px] font-medium">Cargo Quantity:</div>
                    <div className="font-mono font-bold text-slate-900 dark:text-white text-xs mt-0.5">
                      {selectedRequest.vessel_arrival_request_cargo_quantity} units
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 5. PREFERRED BERTH & QUAYSIDE SUITABILITY */}
            <div className="space-y-2">
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400 border-b border-slate-200 dark:border-slate-800 pb-1 flex items-center justify-between">
                <span>5. Quayside Preferred Berth Request</span>
                <span className="text-[9px] font-normal text-slate-400 lowercase">
                  {selectedRequest.preferred_berth ? 'Shipping Company indicated preference' : 'No preference specified'}
                </span>
              </h3>
              {selectedRequest.preferred_berth ? (
                (() => {
                  const pref = selectedRequest.preferred_berth;
                  const vLen = parseFloat(String(selectedRequest.vessel?.vessel_length || 0));
                  const vDraft = parseFloat(String(selectedRequest.vessel?.vessel_draft || 0));
                  const bLen = parseFloat(String(pref.berth_max_length ?? (pref as any)?.berth_length_capacity ?? 0));
                  const bDraft = parseFloat(String(pref.berth_max_draft ?? (pref as any)?.berth_draft_capacity ?? 0));
                  const isLenOk = vLen <= bLen;
                  const isDraftOk = vDraft <= bDraft;
                  const isCompatible = isLenOk && isDraftOk;
                  const isOperational = pref.berth_is_active !== false && pref.berth_status !== 'MAINTENANCE' && pref.berth_status !== 'INACTIVE';

                  const reqArr = new Date(selectedRequest.vessel_arrival_request_requested_arrival_at).getTime();
                  const reqDep = new Date(selectedRequest.vessel_arrival_request_requested_departure_at).getTime();

                  const conflictingSchedule = schedules.find(sch => {
                    const schBerthId = sch.vessel_schedule_berth_id || sch.berth?.berth_id;
                    if (schBerthId !== pref.berth_id) return false;
                    if (sch.vessel_schedule_status === 'DEPARTED') return false;
                    const schA = new Date(sch.vessel_schedule_scheduled_arrival_at).getTime();
                    const schD = new Date(sch.vessel_schedule_scheduled_departure_at).getTime();
                    return schA < reqDep && schD > reqArr;
                  });

                  const competingPendingRequests = arrivalRequests.filter(other => {
                    if (other.vessel_arrival_request_id === selectedRequest.vessel_arrival_request_id) return false;
                    if (other.vessel_arrival_request_status !== 'PENDING') return false;
                    const otherBerthId = other.preferred_berth?.berth_id || other.vessel_arrival_request_preferred_berth_id;
                    if (otherBerthId !== pref.berth_id) return false;
                    const otherArr = new Date(other.vessel_arrival_request_requested_arrival_at).getTime();
                    const otherDep = new Date(other.vessel_arrival_request_requested_departure_at).getTime();
                    return otherArr < reqDep && otherDep > reqArr;
                  });

                  const canApprove = isCompatible && isOperational && !conflictingSchedule;

                  return (
                    <div className="p-3.5 rounded-xl bg-sky-50/70 dark:bg-sky-950/20 border border-sky-200 dark:border-sky-800/60 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="font-bold text-slate-900 dark:text-white text-xs flex items-center gap-1.5">
                          <Anchor className="w-3.5 h-3.5 text-sky-600" />
                          <span>{cleanBerthDisplayName(pref.berth_name)}</span>
                          <span className="font-mono text-sky-600 text-[11px]">({pref.berth_code})</span>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-sky-100 dark:bg-sky-900/50 text-sky-700 dark:text-sky-300">
                          Requested Preference
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200/80 dark:border-slate-800">
                        <div>
                          <span className="text-[9px] text-slate-400 uppercase font-bold block">Type</span>
                          <span className="font-semibold text-slate-700 dark:text-slate-300">{pref.berth_type || 'General'}</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-slate-400 uppercase font-bold block">Max LOA</span>
                          <span className="font-mono text-slate-900 dark:text-white font-bold text-xs">{bLen} m</span>
                          <span className="text-[10px] text-slate-400 block font-mono">Vessel: {vLen} m</span>
                          <span className={`text-[10px] font-bold block mt-0.5 ${isLenOk ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                            {isLenOk ? '✓ Length OK' : '✕ Length Exceeded'}
                          </span>
                        </div>
                        <div>
                          <span className="text-[9px] text-slate-400 uppercase font-bold block">Max Draft</span>
                          <span className="font-mono text-slate-900 dark:text-white font-bold text-xs">{bDraft} m</span>
                          <span className="text-[10px] text-slate-400 block font-mono">Vessel: {vDraft} m</span>
                          <span className={`text-[10px] font-bold block mt-0.5 ${isDraftOk ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                            {isDraftOk ? '✓ Draft OK' : '✕ Draft Exceeded'}
                          </span>
                        </div>
                        <div>
                          <span className="text-[9px] text-slate-400 uppercase font-bold block">Technical Match</span>
                          <span className={`inline-flex items-center gap-1 text-[11px] font-bold mt-1 px-2 py-0.5 rounded ${
                            isCompatible 
                              ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' 
                              : 'bg-rose-500/10 text-rose-600 border border-rose-500/20'
                          }`}>
                            {isCompatible ? '✓ Compatible' : '✕ Dimensions Exceeded'}
                          </span>
                        </div>
                      </div>

                      {/* Status Diagnostics / Warnings */}
                      {canApprove ? (
                        <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[11px] font-medium flex flex-wrap items-center gap-3">
                          <span className="font-bold">✓ Preferred berth is technically compatible</span>
                          <span>•</span>
                          <span className="font-bold">✓ Berth is operational &amp; available</span>
                          <span>•</span>
                          <span className="font-bold">✓ No scheduling conflict</span>
                        </div>
                      ) : !isCompatible ? (
                        <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 text-xs flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                          <div>
                            <div className="font-bold text-rose-700 dark:text-rose-300">⚠ Preferred berth is technically incompatible.</div>
                            <div className="text-[11px] text-rose-600 dark:text-rose-400 mt-0.5">
                              The vessel exceeds the permitted dimensions of this berth ({!isLenOk && !isDraftOk ? 'Length and Draft exceeded' : !isLenOk ? 'Length exceeded' : 'Draft exceeded'}). Use &quot;Change Berth &amp; Approve&quot; below to assign an alternative suitable berth.
                            </div>
                          </div>
                        </div>
                      ) : conflictingSchedule ? (
                        <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 text-xs flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                          <div>
                            <div className="font-bold text-rose-700 dark:text-rose-300">⚠ Berth Scheduling Conflict Detected</div>
                            <div className="text-[11px] text-rose-600 dark:text-rose-400 mt-0.5">
                              {cleanBerthDisplayName(pref.berth_name)} has an active allocation for &apos;{conflictingSchedule.vessel_name || 'Scheduled Vessel'}&apos; during this timeframe ({formatDate(conflictingSchedule.vessel_schedule_scheduled_arrival_at)} – {formatDate(conflictingSchedule.vessel_schedule_scheduled_departure_at)}). Please assign an alternative berth.
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 text-xs flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                          <div>
                            <div className="font-bold text-amber-800 dark:text-amber-300">⚠ Berth Inactive / Maintenance</div>
                            <div className="text-[11px] text-amber-700 dark:text-amber-400 mt-0.5">
                              {cleanBerthDisplayName(pref.berth_name)} status is currently {pref.berth_status}. Please select an active alternative berth.
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Competing Pending Requests Warning */}
                      {competingPendingRequests.length > 0 && (
                        <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 text-xs flex items-start gap-2">
                          <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                          <div>
                            <div className="font-bold text-amber-800 dark:text-amber-300">⚠ Competing Pending Allocation ({competingPendingRequests.length} other request{competingPendingRequests.length > 1 ? 's' : ''})</div>
                            <div className="text-[11px] text-amber-700 dark:text-amber-400 mt-0.5 space-y-0.5">
                              {competingPendingRequests.map(other => (
                                <div key={other.vessel_arrival_request_id} className="font-mono text-[10px]">
                                  • Request #AR-00{other.vessel_arrival_request_id}: {other.vessel?.vessel_name} ({other.vessel?.company_name || 'Shipping Line'})
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()
              ) : (
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-xs text-slate-500">
                  The shipping company did not specify a preferred berth. Port Operations will assign an available berth.
                </div>
              )}
            </div>

            <div className="space-y-2 pt-1 border-t border-slate-200 dark:border-slate-800">
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-[#D49A24]">
                6. Operational Review
              </h3>

              {selectedRequest.vessel_arrival_request_status === 'PENDING' ? (
                <div className="space-y-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                      Review Remarks:
                    </label>
                    <textarea
                      value={reviewRemarks}
                      onChange={(e) => {
                        setReviewRemarks(e.target.value);
                        if (e.target.value.trim()) setRemarksError('');
                      }}
                      placeholder="Enter operational review remarks or required rejection reason..."
                      rows={2}
                      className={`w-full p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border text-slate-900 dark:text-white text-xs focus:outline-none transition-all ${
                        remarksError 
                          ? 'border-rose-500 focus:border-rose-500' 
                          : 'border-slate-300 dark:border-slate-700 focus:border-emerald-500'
                      }`}
                    />
                    {remarksError && (
                      <div className="text-[10px] font-bold text-rose-500 mt-0.5">
                        {remarksError}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1.5 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <span className="text-slate-400 font-medium">Reviewed On: </span>
                      <span className="font-bold text-slate-900 dark:text-white">
                        {formatDate(selectedRequest.vessel_arrival_request_reviewed_at)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 font-medium">Reviewed By: </span>
                      <span className="font-bold text-slate-900 dark:text-white">
                        {selectedRequest.reviewed_by_name || 'Port Operations Officer'}
                      </span>
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-400 font-medium">Review Remarks / Reason: </span>
                    <div className="font-semibold text-slate-900 dark:text-white mt-0.5 bg-white dark:bg-slate-900 p-2 rounded border border-slate-200 dark:border-slate-800">
                      {selectedRequest.vessel_arrival_request_remarks || 'No remarks recorded.'}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* APPROVAL CONFIRMATION DIALOG */}
      <Modal
        isOpen={!!approvingRequest}
        onClose={() => setApprovingRequest(null)}
        title="Approve Arrival Request & Berth Allocation"
        subtitle={`Request #AR-00${approvingRequest?.vessel_arrival_request_id} • ${approvingRequest?.vessel?.vessel_name}`}
        icon={<CheckCircle2 className="w-4 h-4 text-emerald-600" />}
        maxWidth="2xl"
        footer={
          <div className="flex items-center justify-end gap-2.5 w-full">
            <button
              onClick={() => setApprovingRequest(null)}
              className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmApproval}
              disabled={actionLoading}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{actionLoading ? 'Processing Approval...' : 'Confirm Approval & Allocation'}</span>
            </button>
          </div>
        }
      >
        {approvingRequest && (
          <div className="space-y-4">
            {approvalError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{approvalError}</span>
              </div>
            )}

            {/* Vessel & Window Summary */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-[9px] uppercase font-bold text-slate-400 block">Vessel</span>
                <span className="font-bold text-slate-900 dark:text-white truncate block">{approvingRequest.vessel?.vessel_name}</span>
                <span className="font-mono text-[10px] text-slate-500 block">IMO: {approvingRequest.vessel?.vessel_imo_number}</span>
              </div>
              <div>
                <span className="text-[9px] uppercase font-bold text-slate-400 block">Dimensions</span>
                <span className="font-mono text-slate-800 dark:text-slate-200 text-[11px] block">
                  LOA: {approvingRequest.vessel?.vessel_length}m
                </span>
                <span className="font-mono text-emerald-600 font-bold text-[11px] block">
                  Draft: {approvingRequest.vessel?.vessel_draft}m
                </span>
              </div>
              <div className="col-span-2">
                <span className="text-[9px] uppercase font-bold text-slate-400 block">Requested Window</span>
                <span className="font-mono text-slate-800 dark:text-slate-200 text-[11px] block">
                  {formatDate(approvingRequest.vessel_arrival_request_requested_arrival_at)}
                </span>
                <span className="font-mono text-slate-800 dark:text-slate-200 text-[11px] block">
                  → {formatDate(approvingRequest.vessel_arrival_request_requested_departure_at)}
                </span>
              </div>
            </div>

            {/* Berth Allocation Options */}
            <div className="space-y-2.5">
              <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Berth Allocation Decision
              </label>

              {/* Option 1: Preferred Berth */}
              {approvingRequest.preferred_berth ? (
                (() => {
                  const pref = approvingRequest.preferred_berth;
                  const vLen = parseFloat(String(approvingRequest.vessel?.vessel_length || 0));
                  const vDraft = parseFloat(String(approvingRequest.vessel?.vessel_draft || 0));
                  const bLen = parseFloat(String(pref.berth_max_length ?? (pref as any)?.berth_length_capacity ?? 0));
                  const bDraft = parseFloat(String(pref.berth_max_draft ?? (pref as any)?.berth_draft_capacity ?? 0));
                  const isLenOk = vLen <= bLen;
                  const isDraftOk = vDraft <= bDraft;
                  const isCompatible = isLenOk && isDraftOk;
                  const isOperational = pref.berth_is_active !== false && pref.berth_status !== 'MAINTENANCE' && pref.berth_status !== 'INACTIVE';

                  const reqArr = new Date(approvingRequest.vessel_arrival_request_requested_arrival_at).getTime();
                  const reqDep = new Date(approvingRequest.vessel_arrival_request_requested_departure_at).getTime();
                  const conflict = schedules.find(sch => {
                    const schBerthId = sch.vessel_schedule_berth_id || sch.berth?.berth_id;
                    if (schBerthId !== pref.berth_id) return false;
                    if (sch.vessel_schedule_status === 'DEPARTED') return false;
                    const schA = new Date(sch.vessel_schedule_scheduled_arrival_at).getTime();
                    const schD = new Date(sch.vessel_schedule_scheduled_departure_at).getTime();
                    return schA < reqDep && schD > reqArr;
                  });

                  const isPrefSuitable = isCompatible && isOperational && !conflict;

                  return (
                    <div 
                      onClick={() => {
                        if (isPrefSuitable) {
                          setApprovalBerthOption('preferred');
                          setApprovalSelectedBerthId(String(pref.berth_id));
                        }
                      }}
                      className={`p-3 rounded-xl border transition-all ${
                        approvalBerthOption === 'preferred'
                          ? 'bg-sky-500/10 border-sky-500 ring-2 ring-sky-500/20'
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-sky-300'
                      } ${!isPrefSuitable ? 'opacity-60 cursor-not-allowed bg-slate-50 dark:bg-slate-900/40' : 'cursor-pointer'}`}
                    >
                      <div className="flex items-center justify-between">
                        <label className={`flex items-center gap-2 ${isPrefSuitable ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
                          <input
                            type="radio"
                            name="berthAllocationChoice"
                            value="preferred"
                            checked={approvalBerthOption === 'preferred'}
                            disabled={!isPrefSuitable}
                            onChange={() => {
                              if (isPrefSuitable) {
                                setApprovalBerthOption('preferred');
                                setApprovalSelectedBerthId(String(pref.berth_id));
                              }
                            }}
                            className="text-sky-600 focus:ring-sky-500"
                          />
                          <span className="font-bold text-xs text-slate-900 dark:text-white">
                            Allocate Preferred Berth: {cleanBerthDisplayName(pref.berth_name)} ({pref.berth_code})
                          </span>
                        </label>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          isPrefSuitable 
                            ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/30'
                            : 'bg-rose-500/10 text-rose-600 border border-rose-500/30'
                        }`}>
                          {isPrefSuitable ? '✓ Suitable' : !isCompatible ? '✕ Dimensions Exceeded' : !isOperational ? '✕ Inactive/Maintenance' : '✕ Schedule Conflict'}
                        </span>
                      </div>

                      <div className="mt-2 text-[11px] text-slate-500 grid grid-cols-3 gap-2 pl-5 font-mono">
                        <div>Type: <span className="font-sans font-medium text-slate-700 dark:text-slate-300">{pref.berth_type || 'General'}</span></div>
                        <div>Max LOA: <span className={isLenOk ? 'text-slate-700 dark:text-slate-300 font-bold' : 'text-rose-600 font-bold'}>{bLen}m</span> ({isLenOk ? '✓' : `✕ Exceeded by ${(vLen - bLen).toFixed(1)}m`})</div>
                        <div>Max Draft: <span className={isDraftOk ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'}>{bDraft}m</span> ({isDraftOk ? '✓' : `✕ Exceeded by ${(vDraft - bDraft).toFixed(1)}m`})</div>
                      </div>

                      {!isPrefSuitable && (
                        <div className="mt-2.5 ml-5 p-2 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 text-[11px] text-rose-700 dark:text-rose-300 font-medium">
                          {!isCompatible
                            ? 'Preferred berth is technically incompatible with vessel dimensions. Please choose "Assign Alternative Berth" below.'
                            : conflict
                            ? `Conflict: Berth already allocated to ${conflict.vessel_name || 'another vessel'} during this timeframe. Please choose an alternative berth.`
                            : 'Berth is currently under maintenance or inactive. Please choose an alternative berth.'}
                        </div>
                      )}
                    </div>
                  );
                })()
              ) : (
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-xs text-slate-500">
                  No preferred berth was requested by the shipping company.
                </div>
              )}

              {/* Option 2: Alternate Berth Selection */}
              <div 
                className={`p-3 rounded-xl border transition-all ${
                  approvalBerthOption === 'alternate'
                    ? 'bg-sky-500/10 border-sky-500 ring-2 ring-sky-500/20'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-sky-300'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="berthAllocationChoice"
                      value="alternate"
                      checked={approvalBerthOption === 'alternate'}
                      onChange={() => setApprovalBerthOption('alternate')}
                      className="text-sky-600 focus:ring-sky-500"
                    />
                    <span className="font-bold text-xs text-slate-900 dark:text-white">
                      Assign Alternative Berth
                    </span>
                  </label>
                  <span className="text-[10px] text-slate-400 font-medium">
                    Vessel LOA: {approvingRequest.vessel?.vessel_length}m • Draft: {approvingRequest.vessel?.vessel_draft}m
                  </span>
                </div>

                {approvalBerthOption === 'alternate' && (
                  <div className="mt-2 pl-5 space-y-2">
                    <select
                      value={approvalSelectedBerthId}
                      onChange={(e) => {
                        setApprovalSelectedBerthId(e.target.value);
                        if (approvalError) setApprovalError('');
                      }}
                      className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:border-sky-500"
                    >
                      <option value="">-- Choose Alternative Berth --</option>
                      {berths.map(b => {
                        const vLen = parseFloat(String(approvingRequest.vessel?.vessel_length || 0));
                        const vDraft = parseFloat(String(approvingRequest.vessel?.vessel_draft || 0));
                        const bLen = parseFloat(String(b.berth_max_length ?? (b as any).berth_length_capacity ?? 0));
                        const bDraft = parseFloat(String(b.berth_max_draft ?? (b as any).berth_draft_capacity ?? 0));
                        const isLenOk = vLen <= bLen;
                        const isDraftOk = vDraft <= bDraft;
                        const isCompatible = isLenOk && isDraftOk;
                        const isOperational = b.berth_is_active !== false && b.berth_status !== 'MAINTENANCE' && b.berth_status !== 'INACTIVE';

                        const reqArr = new Date(approvingRequest.vessel_arrival_request_requested_arrival_at).getTime();
                        const reqDep = new Date(approvingRequest.vessel_arrival_request_requested_departure_at).getTime();
                        const conflict = schedules.find(sch => {
                          const schBerthId = sch.vessel_schedule_berth_id || sch.berth?.berth_id;
                          if (schBerthId !== b.berth_id) return false;
                          if (sch.vessel_schedule_status === 'DEPARTED') return false;
                          const schA = new Date(sch.vessel_schedule_scheduled_arrival_at).getTime();
                          const schD = new Date(sch.vessel_schedule_scheduled_departure_at).getTime();
                          return schA < reqDep && schD > reqArr;
                        });

                        const fits = isCompatible && isOperational && !conflict;
                        let statusText = '✓ Suitable & Available';
                        if (!isCompatible) {
                          if (!isLenOk && !isDraftOk) statusText = '✕ Length & Draft Exceeded';
                          else if (!isLenOk) statusText = '✕ Length Exceeded';
                          else statusText = '✕ Draft Exceeded';
                        } else if (!isOperational) {
                          statusText = `✕ ${b.berth_status}`;
                        } else if (conflict) {
                          statusText = '✕ Conflict (Occupied)';
                        }

                        return (
                          <option 
                            key={b.berth_id} 
                            value={b.berth_id} 
                            disabled={!fits}
                          >
                            {cleanBerthDisplayName(b.berth_name)} ({b.berth_code}) — Max LOA: {bLen}m, Draft: {bDraft}m [{statusText}]
                          </option>
                        );
                      })}
                    </select>

                    {/* Summary of selected alternate berth */}
                    {approvalSelectedBerthId && (() => {
                      const selectedAlt = berths.find(b => String(b.berth_id) === String(approvalSelectedBerthId));
                      if (!selectedAlt) return null;
                      const bLen = parseFloat(String(selectedAlt.berth_max_length ?? (selectedAlt as any).berth_length_capacity ?? 0));
                      const bDraft = parseFloat(String(selectedAlt.berth_max_draft ?? (selectedAlt as any).berth_draft_capacity ?? 0));
                      return (
                        <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs flex items-center justify-between">
                          <span className="font-bold flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            Selected: {cleanBerthDisplayName(selectedAlt.berth_name)} ({selectedAlt.berth_code})
                          </span>
                          <span className="font-mono text-[11px]">
                            Max LOA: {bLen}m • Draft: {bDraft}m
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>

              {/* Option 3: Approve without Allocation */}
              <div 
                className={`p-3 rounded-xl border transition-all ${
                  approvalBerthOption === 'none'
                    ? 'bg-sky-500/10 border-sky-500 ring-2 ring-sky-500/20'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-sky-300'
                }`}
              >
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="berthAllocationChoice"
                    value="none"
                    checked={approvalBerthOption === 'none'}
                    onChange={() => setApprovalBerthOption('none')}
                    className="text-sky-600 focus:ring-sky-500"
                  />
                  <div>
                    <span className="font-bold text-xs text-slate-900 dark:text-white block">
                      Approve Request Only (Schedule Berth Later)
                    </span>
                    <span className="text-[10px] text-slate-400 block">
                      Approves the arrival request without immediately assigning a berth or creating a schedule.
                    </span>
                  </div>
                </label>
              </div>
            </div>

            {reviewRemarks.trim() && (
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs">
                <span className="text-slate-400 text-[10px] font-bold uppercase">Review Remarks:</span>
                <div className="text-slate-800 dark:text-slate-200 font-medium mt-0.5">{reviewRemarks}</div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* REJECTION CONFIRMATION DIALOG */}
      <Modal
        isOpen={!!rejectingRequest}
        onClose={() => setRejectingRequest(null)}
        title="Reject Arrival Request"
        subtitle={rejectingRequest?.vessel?.vessel_name}
        icon={<AlertTriangle className="w-4 h-4 text-rose-500" />}
        maxWidth="xl"
        footer={
          <div className="flex items-center justify-end gap-2.5 w-full">
            <button
              onClick={() => setRejectingRequest(null)}
              className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmRejection}
              disabled={actionLoading}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md transition-all cursor-pointer disabled:opacity-50"
            >
              {actionLoading ? 'Rejecting...' : 'Confirm Rejection'}
            </button>
          </div>
        }
      >
        {rejectingRequest && (
          <div className="space-y-3">
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Are you sure you want to reject this vessel arrival request for{' '}
              <span className="font-bold text-slate-900 dark:text-white">
                {rejectingRequest.vessel?.vessel_name}
              </span>?
            </p>

            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs">
              <span className="text-rose-700 dark:text-rose-400 text-[10px] font-bold uppercase">Rejection Reason:</span>
              <div className="text-rose-900 dark:text-rose-200 font-semibold mt-0.5">{confirmRejectionReason}</div>
            </div>
          </div>
        )}
      </Modal>

      {/* CREATE SCHEDULE MODAL */}
      <Modal
        isOpen={!!selectedScheduleRequest}
        onClose={() => setSelectedScheduleRequest(null)}
        title="Schedule Vessel Arrival & Assign Berth"
        subtitle={`Request #AR-00${selectedScheduleRequest?.vessel_arrival_request_id} • ${selectedScheduleRequest?.vessel?.vessel_name}`}
        icon={<Anchor className="w-4 h-4 text-sky-500" />}
        maxWidth="2xl"
        footer={
          <div className="flex items-center justify-end gap-2.5 w-full">
            <button
              onClick={() => setSelectedScheduleRequest(null)}
              className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateSchedule}
              disabled={scheduleLoading}
              className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs shadow-md transition-all cursor-pointer disabled:opacity-50"
            >
              {scheduleLoading ? 'Saving Schedule...' : 'Assign Berth & Create Schedule'}
            </button>
          </div>
        }
      >
        {selectedScheduleRequest && (
          <div className="space-y-4">
            {scheduleError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{scheduleError}</span>
              </div>
            )}

            {/* Read-Only Summary Grid */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-xs grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <span className="text-slate-400 text-[10px] font-bold uppercase block">Vessel Name</span>
                <span className="font-bold text-slate-900 dark:text-white">{selectedScheduleRequest.vessel?.vessel_name}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] font-bold uppercase block">IMO Number</span>
                <span className="font-mono text-[#D49A24] font-bold">{selectedScheduleRequest.vessel?.vessel_imo_number}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] font-bold uppercase block">Shipping Company</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedScheduleRequest.vessel?.company_name}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] font-bold uppercase block">Requested Arrival</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{formatDate(selectedScheduleRequest.vessel_arrival_request_requested_arrival_at)}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] font-bold uppercase block">Requested Departure</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{formatDate(selectedScheduleRequest.vessel_arrival_request_requested_departure_at)}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] font-bold uppercase block">Cargo</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedScheduleRequest.vessel_arrival_request_cargo_type}</span>
              </div>
            </div>

            {/* Form Fields */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Berth Allocation <span className="text-rose-500">*</span>
                </label>
                <select
                  value={selectedBerthId}
                  onChange={(e) => setSelectedBerthId(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-sky-500"
                >
                  <option value="">-- Select Available Berth --</option>
                  {berths.map(b => (
                    <option key={b.berth_id} value={b.berth_id} disabled={b.berth_status === 'MAINTENANCE'}>
                      {b.berth_name} ({b.berth_status === 'AVAILABLE' ? 'Available' : b.berth_status}) - Max Draft: {b.berth_max_draft}m
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Scheduled Arrival Date & Time <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={scheduledArrivalAt}
                    onChange={(e) => setScheduledArrivalAt(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Scheduled Departure Date & Time <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={scheduledDepartureAt}
                    onChange={(e) => setScheduledDepartureAt(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Operational Remarks (Optional)
                </label>
                <textarea
                  rows={3}
                  placeholder="Enter tugboat, pilotage, or berth preparation remarks..."
                  value={scheduleRemarks}
                  onChange={(e) => setScheduleRemarks(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-sky-500"
                />
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* UPDATE OPERATIONAL STATUS MODAL */}
      <Modal
        isOpen={!!selectedStatusSchedule && !!selectedStatusRequest}
        onClose={() => {
          setSelectedStatusSchedule(null);
          setSelectedStatusRequest(null);
        }}
        title="Update Vessel Operational Status"
        subtitle={selectedStatusRequest ? `Request #AR-00${selectedStatusRequest.vessel_arrival_request_id} • ${selectedStatusRequest.vessel?.vessel_name}` : ''}
        icon={<Clock className="w-4 h-4 text-purple-500" />}
        maxWidth="lg"
        footer={
          <div className="flex items-center justify-end gap-2.5 w-full">
            <button
              type="button"
              onClick={() => {
                setSelectedStatusSchedule(null);
                setSelectedStatusRequest(null);
              }}
              className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmStatusUpdate}
              disabled={statusUpdateLoading}
              className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-md transition-all cursor-pointer disabled:opacity-50"
            >
              {statusUpdateLoading ? 'Updating Status...' : 'Update Status'}
            </button>
          </div>
        }
      >
        {selectedStatusSchedule && selectedStatusRequest && (
          <div className="space-y-4">
            {statusUpdateError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{statusUpdateError}</span>
              </div>
            )}

            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-xs grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <span className="text-slate-400 text-[10px] font-bold uppercase block">Request Number</span>
                <span className="font-mono font-bold text-sky-600">AR-00{selectedStatusRequest.vessel_arrival_request_id}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] font-bold uppercase block">Vessel Name</span>
                <span className="font-bold text-slate-900 dark:text-white">{selectedStatusRequest.vessel?.vessel_name}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] font-bold uppercase block">IMO Number</span>
                <span className="font-mono text-[#D49A24] font-bold">{selectedStatusRequest.vessel?.vessel_imo_number}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] font-bold uppercase block">Assigned Berth</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{selectedStatusSchedule.berth_name || selectedStatusSchedule.berth?.berth_name}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] font-bold uppercase block">Current Status</span>
                <span className="font-bold text-purple-600 dark:text-purple-400">{selectedStatusSchedule.vessel_schedule_status.replace('_', ' ')}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] font-bold uppercase block">Target Next Status</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">{targetStatus.replace('_', ' ')}</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                New Operational Status <span className="text-rose-500">*</span>
              </label>
              <select
                value={targetStatus}
                onChange={(e) => setTargetStatus(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-purple-500"
              >
                {selectedStatusSchedule.vessel_schedule_status === 'SCHEDULED' && (
                  <option value="ARRIVED">SCHEDULED → ARRIVED (Vessel Arrived at Port Anchorage)</option>
                )}
                {selectedStatusSchedule.vessel_schedule_status === 'ARRIVED' && (
                  <option value="AT_BERTH">ARRIVED → AT BERTH (Vessel Docked at Assigned Berth)</option>
                )}
                {selectedStatusSchedule.vessel_schedule_status === 'AT_BERTH' && (
                  <option value="DEPARTED">AT BERTH → DEPARTED (Vessel Completed Operations & Departed)</option>
                )}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Operational Log / Remarks (Optional)
              </label>
              <textarea
                rows={3}
                placeholder="Enter relevant operational notes, delays, clearance information, or other remarks..."
                value={statusUpdateRemarks}
                onChange={(e) => setStatusUpdateRemarks(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>
        )}
      </Modal>

      {/* VIEW VESSEL DETAILS MODAL (VESSEL DIRECTORY) */}
      <Modal
        isOpen={!!selectedVesselDetail}
        onClose={() => setSelectedVesselDetail(null)}
        title="Vessel Specifications & Identity"
        subtitle={selectedVesselDetail ? `${selectedVesselDetail.vessel_name} • IMO: ${selectedVesselDetail.vessel_imo_number}` : ''}
        icon={<Ship className="w-4 h-4 text-[#D49A24]" />}
        maxWidth="2xl"
        footer={
          <div className="flex items-center justify-end w-full">
            <button
              onClick={() => setSelectedVesselDetail(null)}
              className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        }
      >
        {selectedVesselDetail && (
          <div className="space-y-4">
            {/* Header info */}
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
              <div>
                <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Vessel Name & Identity</div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="font-bold text-slate-900 dark:text-white text-base">{selectedVesselDetail.vessel_name}</span>
                  <span className="font-mono font-bold text-[#D49A24] text-xs">IMO: {selectedVesselDetail.vessel_imo_number}</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Operational Status</div>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/30 mt-0.5">
                  {selectedVesselDetail.vessel_status || 'ACTIVE'}
                </span>
              </div>
            </div>

            {/* Technical Specifications */}
            <div className="space-y-2">
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-[#D49A24] border-b border-slate-200 dark:border-slate-800 pb-1">
                1. Technical Specifications
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
                <div className="p-2.5 px-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                  <div className="text-slate-400 text-[10px] font-medium">Vessel Type:</div>
                  <div className="font-semibold text-slate-900 dark:text-white text-xs mt-0.5">
                    {selectedVesselDetail.vessel_type}
                  </div>
                </div>

                <div className="p-2.5 px-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                  <div className="text-slate-400 text-[10px] font-medium">Flag State:</div>
                  <div className="font-semibold text-slate-900 dark:text-white text-xs mt-0.5">
                    {selectedVesselDetail.vessel_flag}
                  </div>
                </div>

                <div className="p-2.5 px-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                  <div className="text-slate-400 text-[10px] font-medium">Overall Length:</div>
                  <div className="font-mono font-bold text-slate-900 dark:text-white text-xs mt-0.5">
                    {selectedVesselDetail.vessel_length} m
                  </div>
                </div>

                <div className="p-2.5 px-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                  <div className="text-slate-400 text-[10px] font-medium">Max Draft:</div>
                  <div className="font-mono font-bold text-emerald-600 text-xs mt-0.5">
                    {selectedVesselDetail.vessel_draft} m
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="p-2.5 px-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                  <div className="text-slate-400 text-[10px] font-medium">Cargo Capacity:</div>
                  <div className="font-mono font-bold text-slate-900 dark:text-white text-xs mt-0.5">
                    {selectedVesselDetail.vessel_capacity} TEU
                  </div>
                </div>

                <div className="p-2.5 px-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                  <div className="text-slate-400 text-[10px] font-medium">Call Sign / Reg ID:</div>
                  <div className="font-mono font-bold text-slate-900 dark:text-white text-xs mt-0.5">
                    {selectedVesselDetail.vessel_call_sign || `VES-${selectedVesselDetail.vessel_id}`}
                  </div>
                </div>
              </div>
            </div>

            {/* Shipping Company / Operator */}
            <div className="space-y-2">
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400 border-b border-slate-200 dark:border-slate-800 pb-1">
                2. Shipping Company / Operator
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="p-2.5 px-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                  <div className="text-slate-400 text-[10px] font-medium">Company Name:</div>
                  <div className="font-bold text-slate-900 dark:text-white text-xs mt-0.5">
                    {selectedVesselDetail.company_name || 'N/A'}
                  </div>
                </div>

                <div className="p-2.5 px-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                  <div className="text-slate-400 text-[10px] font-medium">Contact Email:</div>
                  <div className="font-medium text-slate-900 dark:text-white text-xs mt-0.5 truncate">
                    {selectedVesselDetail.company_email || 'N/A'}
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Associated Arrival Requests */}
            {(() => {
              const vesselRequests = arrivalRequests.filter(
                r => r.vessel_id === selectedVesselDetail.vessel_id || 
                     r.vessel?.vessel_imo_number === selectedVesselDetail.vessel_imo_number ||
                     r.vessel?.vessel_name === selectedVesselDetail.vessel_name
              );
              return (
                <div className="space-y-2">
                  <h3 className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 border-b border-slate-200 dark:border-slate-800 pb-1">
                    3. Port Activity & Arrival History ({vesselRequests.length} Requests)
                  </h3>
                  {vesselRequests.length === 0 ? (
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-slate-500 text-xs">
                      No arrival requests filed for this vessel yet.
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-40 overflow-y-auto">
                      {vesselRequests.map(r => (
                        <div key={r.vessel_arrival_request_id} className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
                          <div>
                            <span className="font-mono font-bold text-sky-600">AR-00{r.vessel_arrival_request_id}</span>
                            <span className="text-slate-400 mx-2">•</span>
                            <span className="text-slate-600 dark:text-slate-300 font-medium">ETA: {formatDate(r.vessel_arrival_request_requested_arrival_at)}</span>
                          </div>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            r.vessel_arrival_request_status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-600' :
                            r.vessel_arrival_request_status === 'REJECTED' ? 'bg-rose-500/10 text-rose-600' :
                            'bg-amber-500/10 text-amber-600'
                          }`}>
                            {r.vessel_arrival_request_status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}
      </Modal>

    </>
  );
};
