import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { Modal } from '../common/Modal';
import { BackendVessel, BackendVesselArrivalRequest } from '../../types';
import { 
  Ship, 
  FileCheck, 
  Plus, 
  Search, 
  RefreshCw, 
  Anchor, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Eye, 
  Edit, 
  Building2, 
  Calendar, 
  Boxes, 
  AlertTriangle, 
  X, 
  Compass,
  ArrowRight,
  User,
  Trash2
} from 'lucide-react';

interface ShippingCompanyDashboardProps {
  activeTab?: string;
  onNavigate?: (tab: string) => void;
}

export const ShippingCompanyDashboard: React.FC<ShippingCompanyDashboardProps> = ({ 
  activeTab = 'overview', 
  onNavigate 
}) => {
  const { currentUser, addToast } = useApp();

  const [vessels, setVessels] = useState<BackendVessel[]>([]);
  const [arrivalRequests, setArrivalRequests] = useState<BackendVesselArrivalRequest[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  // Search & Filter
  const [vesselSearch, setVesselSearch] = useState<string>('');
  const [requestSearch, setRequestSearch] = useState<string>('');
  const [requestStatusFilter, setRequestStatusFilter] = useState<string>('all');

  // Modals
  const [isRegisterVesselOpen, setIsRegisterVesselOpen] = useState<boolean>(false);
  const [isNewArrivalOpen, setIsNewArrivalOpen] = useState<boolean>(false);
  const [selectedVesselDetail, setSelectedVesselDetail] = useState<BackendVessel | null>(null);
  const [editingVessel, setEditingVessel] = useState<BackendVessel | null>(null);
  const [selectedRequestDetail, setSelectedRequestDetail] = useState<BackendVesselArrivalRequest | null>(null);

  // Deletion Modal States
  const [vesselToDelete, setVesselToDelete] = useState<BackendVessel | null>(null);
  const [vesselDeleteLoading, setVesselDeleteLoading] = useState<boolean>(false);
  const [requestToDelete, setRequestToDelete] = useState<BackendVesselArrivalRequest | null>(null);
  const [requestDeleteLoading, setRequestDeleteLoading] = useState<boolean>(false);

  const handleDeleteVesselConfirm = async () => {
    if (!vesselToDelete) return;
    setVesselDeleteLoading(true);
    try {
      const response = await fetch(`http://127.0.0.1:8000/api/vessels/${vesselToDelete.vessel_id}/`, {
        method: 'DELETE',
        headers: {
          'X-User-Email': currentUser?.email || '',
          'X-User-Role': 'shipping_company',
          'X-User-Id': currentUser?.id || ''
        }
      });

      const result = await response.json();
      setVesselDeleteLoading(false);

      if (response.ok && result.status === 'success') {
        addToast('success', 'Vessel Deleted', 'Vessel deleted successfully.');
        setVessels(prev => prev.filter(v => v.vessel_id !== vesselToDelete.vessel_id));
        setVesselToDelete(null);
        fetchDashboardData();
      } else {
        const errorMsg = result.message || 'This vessel cannot be deleted because it has associated operational records or arrival requests.';
        addToast('error', 'Deletion Blocked', errorMsg);
        setVesselToDelete(null);
      }
    } catch (err) {
      setVesselDeleteLoading(false);
      addToast('error', 'Deletion Failed', 'Unable to delete vessel. Please try again.');
      setVesselToDelete(null);
    }
  };

  const handleDeleteArrivalRequestConfirm = async () => {
    if (!requestToDelete) return;
    setRequestDeleteLoading(true);
    try {
      const response = await fetch(`http://127.0.0.1:8000/api/arrival-requests/${requestToDelete.vessel_arrival_request_id}/`, {
        method: 'DELETE',
        headers: {
          'X-User-Email': currentUser?.email || '',
          'X-User-Role': 'shipping_company',
          'X-User-Id': currentUser?.id || ''
        }
      });

      const result = await response.json();
      setRequestDeleteLoading(false);

      if (response.ok && result.status === 'success') {
        addToast('success', 'Arrival Request Deleted', 'Arrival request deleted successfully.');
        setArrivalRequests(prev => prev.filter(r => r.vessel_arrival_request_id !== requestToDelete.vessel_arrival_request_id));
        setRequestToDelete(null);
        fetchDashboardData();
      } else {
        const errorMsg = result.message || 'Only pending arrival requests can be deleted.';
        addToast('error', 'Deletion Failed', errorMsg);
        setRequestToDelete(null);
      }
    } catch (err) {
      setRequestDeleteLoading(false);
      addToast('error', 'Deletion Error', 'Unable to delete arrival request. Please try again.');
      setRequestToDelete(null);
    }
  };

  // Form States - Register Vessel
  const [vesselName, setVesselName] = useState<string>('');
  const [vesselImo, setVesselImo] = useState<string>('');
  const [vesselType, setVesselType] = useState<string>('CONTAINER_SHIP');
  const [vesselFlag, setVesselFlag] = useState<string>('Panama');
  const [vesselCallSign, setVesselCallSign] = useState<string>('');
  const [vesselLength, setVesselLength] = useState<string>('210');
  const [vesselDraft, setVesselDraft] = useState<string>('8.5');
  const [vesselCapacity, setVesselCapacity] = useState<string>('2500');
  const [vesselSubmitLoading, setVesselSubmitLoading] = useState<boolean>(false);
  const [vesselFormError, setVesselFormError] = useState<string>('');

  // Form States - New Arrival Request
  const [selectedVesselId, setSelectedVesselId] = useState<string>('');
  const [requestedArrival, setRequestedArrival] = useState<string>('');
  const [requestedDeparture, setRequestedDeparture] = useState<string>('');
  const [cargoType, setCargoType] = useState<string>('Container Cargo');
  const [cargoQuantity, setCargoQuantity] = useState<string>('1200');
  const [requestSubmitLoading, setRequestSubmitLoading] = useState<boolean>(false);
  const [requestFormError, setRequestFormError] = useState<string>('');

  const fetchDashboardData = async () => {
    setLoading(true);
    setError('');
    try {
      const headers = {
        'X-User-Email': currentUser?.email || '',
        'X-User-Role': 'shipping_company',
        'X-User-Id': currentUser?.id || ''
      };

      const [vesselsRes, requestsRes] = await Promise.all([
        fetch('http://127.0.0.1:8000/api/vessels/', { headers }),
        fetch('http://127.0.0.1:8000/api/arrival-requests/', { headers })
      ]);

      const vesselsJson = await vesselsRes.json();
      const requestsJson = await requestsRes.json();

      if (vesselsRes.ok && vesselsJson.status === 'success') {
        setVessels(vesselsJson.data || []);
      } else {
        setError(vesselsJson.message || 'Failed to load fleet vessels.');
      }

      if (requestsRes.ok && requestsJson.status === 'success') {
        setArrivalRequests(requestsJson.data || []);
      }
    } catch (err) {
      setError('Unable to connect to backend server. Please verify Django is running.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [currentUser?.email]);

  // Open Edit Modal with Pre-populated data
  const handleOpenEditVessel = (vessel: BackendVessel) => {
    setEditingVessel(vessel);
    setVesselName(vessel.vessel_name);
    setVesselImo(vessel.vessel_imo_number);
    setVesselType(vessel.vessel_type);
    setVesselFlag(vessel.vessel_flag);
    setVesselCallSign(vessel.vessel_call_sign || '');
    setVesselLength(String(vessel.vessel_length));
    setVesselDraft(String(vessel.vessel_draft));
    setVesselCapacity(String(vessel.vessel_capacity));
    setVesselFormError('');
    setIsRegisterVesselOpen(true);
  };

  const handleOpenRegisterVessel = () => {
    setEditingVessel(null);
    setVesselName('');
    setVesselImo('');
    setVesselType('CONTAINER_SHIP');
    setVesselFlag('Panama');
    setVesselCallSign('');
    setVesselLength('210');
    setVesselDraft('8.5');
    setVesselCapacity('2500');
    setVesselFormError('');
    setIsRegisterVesselOpen(true);
  };

  const handleOpenNewArrivalRequest = () => {
    if (vessels.length === 0) {
      addToast('warning', 'No Vessels Registered', 'Please register at least one vessel before submitting an arrival request.');
      if (onNavigate) onNavigate('vessels');
      return;
    }

    setSelectedVesselId('');

    // Default dates: tomorrow 10:00 AM to 3 days later 18:00
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const departure = new Date(now.getTime() + 72 * 60 * 60 * 1000);

    setRequestedArrival(tomorrow.toISOString().slice(0, 16));
    setRequestedDeparture(departure.toISOString().slice(0, 16));
    setCargoType('Container Cargo');
    setCargoQuantity('1200');
    setRequestFormError('');
    setIsNewArrivalOpen(true);
  };

  const handleSaveVesselSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setVesselFormError('');

    if (!vesselName.trim() || !vesselImo.trim() || !vesselFlag.trim() || !vesselLength || !vesselDraft || !vesselCapacity) {
      setVesselFormError('Please fill in all required fields.');
      return;
    }

    const cleanImo = vesselImo.replace(/\D/g, '').trim();
    if (!/^\d{7}$/.test(cleanImo)) {
      setVesselFormError('IMO Number must be exactly 7 numeric digits (e.g. 9876543).');
      return;
    }

    setVesselSubmitLoading(true);
    try {
      const url = editingVessel 
        ? `http://127.0.0.1:8000/api/vessels/${editingVessel.vessel_id}/`
        : 'http://127.0.0.1:8000/api/vessels/';
      
      const method = editingVessel ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-User-Email': currentUser?.email || '',
          'X-User-Role': 'shipping_company',
          'X-User-Id': currentUser?.id || ''
        },
        body: JSON.stringify({
          vessel_name: vesselName.trim(),
          vessel_imo_number: vesselImo.trim(),
          vessel_type: vesselType,
          vessel_flag: vesselFlag.trim(),
          vessel_call_sign: vesselCallSign.trim(),
          vessel_length: parseFloat(vesselLength),
          vessel_draft: parseFloat(vesselDraft),
          vessel_capacity: parseInt(vesselCapacity, 10)
        })
      });

      const result = await response.json();
      setVesselSubmitLoading(false);

      if (response.ok && result.status === 'success') {
        addToast(
          'success', 
          editingVessel ? 'Vessel Updated' : 'Vessel Registered', 
          result.message || `Vessel '${vesselName}' has been saved successfully.`
        );
        setIsRegisterVesselOpen(false);
        fetchDashboardData();
      } else {
        const errorDetail = result.errors 
          ? Object.values(result.errors).flat().join(' ') 
          : result.message;
        setVesselFormError(errorDetail || 'Failed to save vessel details.');
      }
    } catch (err) {
      setVesselSubmitLoading(false);
      setVesselFormError('Unable to connect to server. Please try again.');
    }
  };

  const handleSaveArrivalRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRequestFormError('');

    if (!selectedVesselId) {
      setRequestFormError('Please select a vessel.');
      return;
    }

    if (!requestedArrival || !requestedDeparture || !cargoType.trim() || !cargoQuantity) {
      setRequestFormError('Please fill in all required fields.');
      return;
    }

    const arrDate = new Date(requestedArrival);
    const depDate = new Date(requestedDeparture);
    const now = new Date();

    if (arrDate < now) {
      setRequestFormError('Requested arrival time cannot be in the past.');
      return;
    }

    if (depDate <= arrDate) {
      setRequestFormError('Requested departure time must be later than requested arrival time.');
      return;
    }

    const qty = parseFloat(cargoQuantity);
    if (isNaN(qty) || qty <= 0) {
      setRequestFormError('Cargo quantity must be greater than zero.');
      return;
    }

    // Check overlapping active requests locally
    const targetVesselId = parseInt(selectedVesselId, 10);
    const hasOverlap = arrivalRequests.some(req => {
      if (req.vessel_arrival_request_vessel_id !== targetVesselId) return false;
      if (req.vessel_arrival_request_status !== 'PENDING' && req.vessel_arrival_request_status !== 'APPROVED') return false;
      const existingArr = new Date(req.vessel_arrival_request_requested_arrival_at);
      const existingDep = new Date(req.vessel_arrival_request_requested_departure_at);
      return arrDate < existingDep && depDate > existingArr;
    });

    if (hasOverlap) {
      setRequestFormError('This vessel already has an active arrival request during the selected period.');
      return;
    }

    setRequestSubmitLoading(true);
    try {
      const response = await fetch('http://127.0.0.1:8000/api/arrival-requests/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Email': currentUser?.email || '',
          'X-User-Role': 'shipping_company',
          'X-User-Id': currentUser?.id || ''
        },
        body: JSON.stringify({
          vessel_arrival_request_vessel_id: targetVesselId,
          vessel_arrival_request_requested_arrival_at: requestedArrival,
          vessel_arrival_request_requested_departure_at: requestedDeparture,
          vessel_arrival_request_cargo_type: cargoType.trim(),
          vessel_arrival_request_cargo_quantity: qty
        })
      });

      const result = await response.json();
      setRequestSubmitLoading(false);

      if (response.ok && result.status === 'success') {
        addToast('success', 'Arrival Request Submitted', 'Vessel arrival request submitted successfully.');
        setIsNewArrivalOpen(false);
        fetchDashboardData();
      } else {
        const errorDetail = result.errors 
          ? Object.values(result.errors).flat().join(' ') 
          : result.message;
        setRequestFormError(errorDetail || 'Failed to submit arrival request.');
      }
    } catch (err) {
      setRequestSubmitLoading(false);
      setRequestFormError('Unable to connect to server. Please try again.');
    }
  };

  // Filtered lists
  const filteredVessels = vessels.filter(v => {
    const q = vesselSearch.toLowerCase().trim();
    return !q || 
      v.vessel_name.toLowerCase().includes(q) ||
      v.vessel_imo_number.toLowerCase().includes(q) ||
      v.vessel_flag.toLowerCase().includes(q) ||
      v.vessel_type.toLowerCase().includes(q);
  });

  const filteredRequests = arrivalRequests.filter(r => {
    const matchesStatus = requestStatusFilter === 'all' || r.vessel_arrival_request_status === requestStatusFilter;
    const q = requestSearch.toLowerCase().trim();
    const vesselName = r.vessel?.vessel_name || '';
    const imo = r.vessel?.vessel_imo_number || '';
    const cargo = r.vessel_arrival_request_cargo_type || '';
    const reqId = `AR-00${r.vessel_arrival_request_id}`.toLowerCase();

    const matchesQuery = !q || 
      vesselName.toLowerCase().includes(q) ||
      imo.toLowerCase().includes(q) ||
      cargo.toLowerCase().includes(q) ||
      reqId.includes(q);

    return matchesStatus && matchesQuery;
  });

  const pendingCount = arrivalRequests.filter(r => r.vessel_arrival_request_status === 'PENDING').length;
  const approvedCount = arrivalRequests.filter(r => r.vessel_arrival_request_status === 'APPROVED').length;
  const rejectedCount = arrivalRequests.filter(r => r.vessel_arrival_request_status === 'REJECTED').length;

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

  // Shared Modals JSX Render Helper
  const renderSharedModals = () => (
    <>
      {/* REGISTER / EDIT VESSEL MODAL */}
      <Modal
        isOpen={isRegisterVesselOpen}
        onClose={() => setIsRegisterVesselOpen(false)}
        title={editingVessel ? 'Edit Vessel Specifications' : 'Register New Fleet Vessel'}
        subtitle="Submit official IMO specs & maritime vessel registration"
        icon={<Ship className="w-4 h-4 text-[#D49A24]" />}
        maxWidth="3xl"
      >
        <form onSubmit={handleSaveVesselSubmit} className="space-y-4">
          {vesselFormError && (
            <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-400 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{vesselFormError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3">
            <div className="md:col-span-2">
              <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Vessel Name *
              </label>
              <input
                type="text"
                required
                value={vesselName}
                onChange={(e) => setVesselName(e.target.value)}
                placeholder="e.g. MV Ocean Star"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-bold focus:outline-none focus:border-[#D49A24]"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                IMO Number *
              </label>
              <input
                type="text"
                required
                disabled={!!editingVessel}
                value={vesselImo}
                onChange={(e) => {
                  const cleanDigits = e.target.value.replace(/\D/g, '').slice(0, 7);
                  setVesselImo(cleanDigits);
                  if (vesselFormError) setVesselFormError('');
                }}
                placeholder="e.g. 9876543"
                maxLength={7}
                pattern="\d{7}"
                title="IMO Number must be exactly 7 numeric digits"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-mono font-bold text-[#D49A24] focus:outline-none focus:border-[#D49A24] disabled:opacity-60"
              />
              <p className="text-[9px] text-slate-400 mt-0.5">Unique 7-digit IMO ship identifier.</p>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Vessel Type *
              </label>
              <select
                value={vesselType}
                onChange={(e) => setVesselType(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-semibold focus:outline-none focus:border-[#D49A24]"
              >
                <option value="CONTAINER_SHIP">Container Ship</option>
                <option value="BULK_CARRIER">Bulk Carrier</option>
                <option value="OIL_TANKER">Oil Tanker</option>
                <option value="GENERAL_CARGO">General Cargo</option>
                <option value="CHEMICAL_TANKER">Chemical Tanker</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Flag State *
              </label>
              <input
                type="text"
                required
                value={vesselFlag}
                onChange={(e) => setVesselFlag(e.target.value)}
                placeholder="Panama"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-medium focus:outline-none focus:border-[#D49A24]"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Call Sign
              </label>
              <input
                type="text"
                value={vesselCallSign}
                onChange={(e) => setVesselCallSign(e.target.value)}
                placeholder="3E245"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-mono font-bold focus:outline-none focus:border-[#D49A24]"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Length Overall (Meters) *
              </label>
              <input
                type="number"
                step="0.1"
                required
                value={vesselLength}
                onChange={(e) => setVesselLength(e.target.value)}
                placeholder="210"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-mono font-bold focus:outline-none focus:border-[#D49A24]"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Maximum Draft (Meters) *
              </label>
              <input
                type="number"
                step="0.1"
                required
                value={vesselDraft}
                onChange={(e) => setVesselDraft(e.target.value)}
                placeholder="8.5"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-mono font-bold focus:outline-none focus:border-[#D49A24]"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Capacity (TEU) *
              </label>
              <input
                type="number"
                required
                value={vesselCapacity}
                onChange={(e) => setVesselCapacity(e.target.value)}
                placeholder="2500"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-mono font-bold focus:outline-none focus:border-[#D49A24]"
              />
            </div>
          </div>

          <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsRegisterVesselOpen(false)}
              className="px-4 py-2 rounded-xl font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={vesselSubmitLoading}
              className="px-5 py-2.5 rounded-xl font-bold uppercase tracking-wider text-white bg-[#D49A24] hover:bg-[#b8831c] text-xs shadow-md disabled:opacity-50 cursor-pointer border border-[#D49A24]"
            >
              {vesselSubmitLoading ? 'Saving Vessel...' : editingVessel ? 'Update Vessel' : 'Register Vessel'}
            </button>
          </div>
        </form>
      </Modal>

      {/* NEW ARRIVAL REQUEST MODAL */}
      <Modal
        isOpen={isNewArrivalOpen}
        onClose={() => setIsNewArrivalOpen(false)}
        title="Submit Vessel Arrival Request"
        subtitle="Schedule ETA/ETD window and cargo declaration"
        icon={<Anchor className="w-4 h-4 text-sky-600" />}
        maxWidth="3xl"
      >
        <form onSubmit={handleSaveArrivalRequestSubmit} className="space-y-4">
          {requestFormError && (
            <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-400 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{requestFormError}</span>
            </div>
          )}

          <div>
            <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              Select Vessel *
            </label>
            <select
              value={selectedVesselId}
              onChange={(e) => {
                setSelectedVesselId(e.target.value);
                if (requestFormError) setRequestFormError('');
              }}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-bold text-slate-900 dark:text-white focus:outline-none focus:border-sky-500"
            >
              <option value="">Select a registered vessel</option>
              {vessels.map((v) => (
                <option key={v.vessel_id} value={v.vessel_id}>
                  {v.vessel_name} (IMO: {v.vessel_imo_number}) - {v.vessel_capacity} TEU
                </option>
              ))}
            </select>
            <p className="text-[9px] text-slate-400 mt-0.5">Contains vessels belonging to your registered shipping company.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Requested Arrival *
              </label>
              <input
                type="datetime-local"
                required
                value={requestedArrival}
                onChange={(e) => setRequestedArrival(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-medium focus:outline-none focus:border-sky-500"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Requested Departure *
              </label>
              <input
                type="datetime-local"
                required
                value={requestedDeparture}
                onChange={(e) => setRequestedDeparture(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-medium focus:outline-none focus:border-sky-500"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Cargo Type *
              </label>
              <input
                type="text"
                required
                value={cargoType}
                onChange={(e) => setCargoType(e.target.value)}
                placeholder="e.g. Container / Bulk Grain / Oil"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-medium focus:outline-none focus:border-sky-500"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Cargo Quantity *
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  required
                  value={cargoQuantity}
                  onChange={(e) => setCargoQuantity(e.target.value)}
                  placeholder="1200"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-mono font-bold focus:outline-none focus:border-sky-500 text-xs"
                />
                <span className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono font-bold text-slate-500 text-xs shrink-0">
                  TEU
                </span>
              </div>
            </div>
          </div>

          <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsNewArrivalOpen(false)}
              className="px-4 py-2 rounded-xl font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={requestSubmitLoading}
              className="px-5 py-2.5 rounded-xl font-bold uppercase tracking-wider text-white bg-sky-600 hover:bg-sky-700 text-xs shadow-md disabled:opacity-50 cursor-pointer"
            >
              {requestSubmitLoading ? 'Submitting Request...' : 'Submit Arrival Request'}
            </button>
          </div>
        </form>
      </Modal>

      {/* VIEW VESSEL DETAILS MODAL */}
      <Modal
        isOpen={!!selectedVesselDetail}
        onClose={() => setSelectedVesselDetail(null)}
        title="Vessel Specifications"
        subtitle={selectedVesselDetail?.vessel_name}
        icon={<Ship className="w-4 h-4 text-[#D49A24]" />}
        maxWidth="2xl"
      >
        {selectedVesselDetail && (
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Vessel Name</div>
              <div className="font-bold text-slate-900 dark:text-white text-base">{selectedVesselDetail.vessel_name}</div>
              <div className="font-mono font-bold text-[#D49A24] text-xs">IMO: {selectedVesselDetail.vessel_imo_number}</div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Category / Type:</div>
                <div className="font-bold text-slate-900 dark:text-white mt-0.5">{selectedVesselDetail.vessel_type}</div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Flag State:</div>
                <div className="font-bold text-slate-900 dark:text-white mt-0.5">{selectedVesselDetail.vessel_flag}</div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Length / Draft:</div>
                <div className="font-bold font-mono text-slate-900 dark:text-white mt-0.5">{selectedVesselDetail.vessel_length}m / {selectedVesselDetail.vessel_draft}m</div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Capacity:</div>
                <div className="font-bold font-mono text-slate-900 dark:text-white mt-0.5">{selectedVesselDetail.vessel_capacity} TEU</div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => setSelectedVesselDetail(null)}
                className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs hover:bg-slate-300 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* VIEW ARRIVAL REQUEST DETAILS MODAL */}
      <Modal
        isOpen={!!selectedRequestDetail}
        onClose={() => setSelectedRequestDetail(null)}
        title={`Arrival Request #AR-00${selectedRequestDetail?.vessel_arrival_request_id}`}
        subtitle={selectedRequestDetail?.vessel?.vessel_name}
        icon={<Anchor className="w-4 h-4 text-sky-600" />}
        maxWidth="3xl"
      >
        {selectedRequestDetail && (
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Vessel Technical Specifications</div>
              <div className="font-bold text-slate-900 dark:text-white text-sm">
                {selectedRequestDetail.vessel?.vessel_name} (IMO: {selectedRequestDetail.vessel?.vessel_imo_number})
              </div>
              <div className="text-[11px] text-slate-500 pt-0.5">
                Type: <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedRequestDetail.vessel?.vessel_type}</span> | Draft: <span className="font-mono font-bold text-emerald-600">{selectedRequestDetail.vessel?.vessel_draft}m</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                <div className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Requested Arrival</div>
                <div className="font-bold text-slate-900 dark:text-white text-xs mt-0.5">{formatDate(selectedRequestDetail.vessel_arrival_request_requested_arrival_at)}</div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                <div className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Requested Departure</div>
                <div className="font-bold text-slate-900 dark:text-white text-xs mt-0.5">{formatDate(selectedRequestDetail.vessel_arrival_request_requested_departure_at)}</div>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
              <div className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Cargo Specifications</div>
              <div className="font-bold text-slate-900 dark:text-white text-xs mt-0.5">
                {selectedRequestDetail.vessel_arrival_request_cargo_type} ({selectedRequestDetail.vessel_arrival_request_cargo_quantity} TEU)
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2">
              <div className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Review Audit Trail & Operational Remarks</div>
              <div className="flex items-center justify-between">
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                  selectedRequestDetail.vessel_arrival_request_status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/30' :
                  selectedRequestDetail.vessel_arrival_request_status === 'REJECTED' ? 'bg-rose-500/10 text-rose-600 border border-rose-500/30' :
                  'bg-amber-500/10 text-amber-600 border border-amber-500/30'
                }`}>
                  {selectedRequestDetail.vessel_arrival_request_status}
                </span>
                {selectedRequestDetail.reviewed_by_name && (
                  <span className="text-[10px] text-slate-400 font-medium">Reviewed by: {selectedRequestDetail.reviewed_by_name}</span>
                )}
              </div>

              {selectedRequestDetail.vessel_arrival_request_status === 'PENDING' && (
                <p className="text-[11px] text-amber-600 font-medium pt-1">
                  Pending — Awaiting Port Operations Officer review and berth scheduling.
                </p>
              )}

              {selectedRequestDetail.vessel_arrival_request_remarks && (
                <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-xs text-slate-800 dark:text-slate-200">
                  "{selectedRequestDetail.vessel_arrival_request_remarks}"
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => setSelectedRequestDetail(null)}
                className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs hover:bg-slate-300 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* DELETE VESSEL CONFIRMATION MODAL */}
      <Modal
        isOpen={!!vesselToDelete}
        onClose={() => setVesselToDelete(null)}
        title="Delete Vessel?"
        subtitle="Remove Vessel from Fleet"
        icon={<AlertTriangle className="w-4 h-4 text-rose-600" />}
        maxWidth="md"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
            Are you sure you want to delete <span className="font-bold text-slate-900 dark:text-white">{vesselToDelete?.vessel_name}</span> (IMO: <span className="font-mono font-bold text-[#D49A24]">{vesselToDelete?.vessel_imo_number}</span>)?
          </p>

          <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setVesselToDelete(null)}
              disabled={vesselDeleteLoading}
              className="px-4 py-2 rounded-xl font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDeleteVesselConfirm}
              disabled={vesselDeleteLoading}
              className="px-4 py-2 rounded-xl font-bold text-white bg-rose-600 hover:bg-rose-700 text-xs shadow-md disabled:opacity-50 cursor-pointer"
            >
              {vesselDeleteLoading ? 'Deleting Vessel...' : 'Delete Vessel'}
            </button>
          </div>
        </div>
      </Modal>

      {/* DELETE ARRIVAL REQUEST CONFIRMATION MODAL */}
      <Modal
        isOpen={!!requestToDelete}
        onClose={() => setRequestToDelete(null)}
        title="Delete Arrival Request?"
        subtitle="Cancel Pending Schedule Request"
        icon={<AlertTriangle className="w-4 h-4 text-rose-600" />}
        maxWidth="md"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
            Are you sure you want to delete the arrival request for <span className="font-bold text-slate-900 dark:text-white">{requestToDelete?.vessel?.vessel_name || 'this vessel'}</span>? This action cannot be undone.
          </p>

          <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setRequestToDelete(null)}
              disabled={requestDeleteLoading}
              className="px-4 py-2 rounded-xl font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDeleteArrivalRequestConfirm}
              disabled={requestDeleteLoading}
              className="px-4 py-2 rounded-xl font-bold text-white bg-rose-600 hover:bg-rose-700 text-xs shadow-md disabled:opacity-50 cursor-pointer"
            >
              {requestDeleteLoading ? 'Deleting Request...' : 'Delete Request'}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );

  // =========================================================================
  // VIEW 1: DASHBOARD OVERVIEW (activeTab === 'overview')
  // =========================================================================
  if (activeTab === 'overview') {
    return (
      <div className="space-y-6 font-sans selection:bg-[#D49A24] selection:text-white animate-fade-in">
        
        {/* HEADER BANNER */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400 mb-1">
              <Compass className="w-4 h-4" />
              <span>Shipping Company Operations Control</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              Fleet & Arrival Overview
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">
              High-level overview of registered fleet vessels, pending arrival requests, and port operational activity.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleOpenRegisterVessel}
              className="px-3.5 py-2.5 rounded-xl bg-[#D49A24] hover:bg-[#b8831c] text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Register Vessel</span>
            </button>
            <button
              onClick={handleOpenNewArrivalRequest}
              className="px-3.5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>New Arrival Request</span>
            </button>
          </div>
        </div>

        {/* STAT CARDS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div 
            onClick={() => onNavigate && onNavigate('vessels')}
            className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 hover:border-[#D49A24] transition-all cursor-pointer shadow-xs space-y-2 group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Fleet Vessels</span>
              <div className="w-9 h-9 rounded-xl bg-[#D49A24]/10 text-[#D49A24] flex items-center justify-center font-bold">
                <Ship className="w-5 h-5" />
              </div>
            </div>
            <div className="text-3xl font-black text-slate-900 dark:text-white">
              {vessels.length}
            </div>
            <div className="text-[11px] font-medium text-slate-500">Registered Ships</div>
          </div>

          <div 
            onClick={() => onNavigate && onNavigate('arrival-requests')}
            className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 hover:border-amber-500 transition-all cursor-pointer shadow-xs space-y-2 group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Pending Requests</span>
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
                <Clock className="w-5 h-5 animate-pulse" />
              </div>
            </div>
            <div className="text-3xl font-black text-amber-600 dark:text-amber-400">
              {pendingCount}
            </div>
            <div className="text-[11px] font-medium text-slate-500">Awaiting Ops Review</div>
          </div>

          <div 
            onClick={() => onNavigate && onNavigate('arrival-requests')}
            className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 hover:border-emerald-500 transition-all cursor-pointer shadow-xs space-y-2 group"
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
            <div className="text-[11px] font-medium text-slate-500">Approved for Berth Scheduling</div>
          </div>

          <div 
            onClick={() => onNavigate && onNavigate('arrival-requests')}
            className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 hover:border-rose-500 transition-all cursor-pointer shadow-xs space-y-2 group"
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
        </div>

        {/* RECENT ACTIVITY SHORT SUMMARY TABLE */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Recent Activity
            </h2>
            <button 
              onClick={() => onNavigate && onNavigate('arrival-requests')}
              className="text-xs font-bold text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1"
            >
              View All Arrival Requests ({arrivalRequests.length}) <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 overflow-hidden shadow-xs">
            {arrivalRequests.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <Anchor className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-700" />
                <p className="text-xs font-bold text-slate-500">No recent activity.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-black uppercase tracking-wider text-[11px]">
                      <th className="p-3.5">Request ID</th>
                      <th className="p-3.5">Vessel</th>
                      <th className="p-3.5">Requested Arrival</th>
                      <th className="p-3.5">Status</th>
                      <th className="p-3.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium text-slate-700 dark:text-slate-300">
                    {arrivalRequests.slice(0, 5).map(req => (
                      <tr key={req.vessel_arrival_request_id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                        <td className="p-3.5 font-mono font-bold text-sky-600">AR-00{req.vessel_arrival_request_id}</td>
                        <td className="p-3.5 font-bold text-slate-900 dark:text-white">{req.vessel?.vessel_name}</td>
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
                        <td className="p-3.5 text-right">
                          <button
                            onClick={() => setSelectedRequestDetail(req)}
                            className="p-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-sky-600"
                            title="View Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
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

        {/* REGISTERED FLEET SUMMARY */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Registered Fleet Overview
            </h2>
            <button 
              onClick={() => onNavigate && onNavigate('vessels')}
              className="text-xs font-bold text-[#D49A24] hover:underline flex items-center gap-1"
            >
              View All Fleet Vessels ({vessels.length}) <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {vessels.slice(0, 3).map(v => (
              <div key={v.vessel_id} className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 dark:text-white text-sm">{v.vessel_name}</span>
                  <span className="font-mono text-[10px] font-bold text-[#D49A24]">IMO: {v.vessel_imo_number}</span>
                </div>
                <div className="text-[11px] text-slate-400">
                  {v.vessel_type} | {v.vessel_capacity} TEU
                </div>
              </div>
            ))}
          </div>
        </div>

        {renderSharedModals()}
      </div>
    );
  }

  // =========================================================================
  // VIEW 2: VESSEL MANAGEMENT (activeTab === 'vessels')
  // =========================================================================
  if (activeTab === 'vessels') {
    return (
      <div className="space-y-6 font-sans selection:bg-[#D49A24] selection:text-white animate-fade-in">
        
        {/* HEADER BANNER */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#D49A24] mb-1">
              <Ship className="w-4 h-4" />
              <span>Company Fleet Management</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              Fleet Vessel Management
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">
              Manage and view your registered fleet vessels, technical specifications, and company registration status.
            </p>
          </div>

          <button
            onClick={handleOpenRegisterVessel}
            className="px-4 py-2.5 rounded-xl bg-[#D49A24] hover:bg-[#b8831c] text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Register Vessel</span>
          </button>
        </div>

        {/* SEARCH BAR */}
        <div className="flex items-center justify-between gap-3">
          <div className="relative max-w-sm w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search fleet vessels by name, IMO, flag, type..."
              value={vesselSearch}
              onChange={(e) => setVesselSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-medium focus:outline-none focus:border-[#D49A24]"
            />
          </div>

          <div className="text-xs font-bold text-slate-500">
            Registered Vessels: <span className="text-slate-900 dark:text-white font-mono">{filteredVessels.length}</span>
          </div>
        </div>

        {/* FLEET VESSELS TABLE */}
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 overflow-hidden shadow-xs">
          {loading ? (
            <div className="p-12 text-center space-y-3">
              <RefreshCw className="w-8 h-8 mx-auto text-[#D49A24] animate-spin" />
              <p className="text-xs font-bold text-slate-600 dark:text-slate-400">Loading fleet vessels from PostgreSQL...</p>
            </div>
          ) : filteredVessels.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <Ship className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-700" />
              <h3 className="text-base font-bold text-slate-900 dark:text-white">No vessels registered yet.</h3>
              <p className="text-xs text-slate-500">Register your first vessel to begin submitting arrival requests.</p>
              <button
                onClick={handleOpenRegisterVessel}
                className="px-4 py-2 rounded-xl bg-[#D49A24] text-white font-bold text-xs shadow-md"
              >
                Register Vessel
              </button>
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
                    <th className="p-4">STATUS</th>
                    <th className="p-4 text-right">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium text-slate-700 dark:text-slate-300">
                  {filteredVessels.map(vessel => (
                    <tr key={vessel.vessel_id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="p-4 font-bold text-slate-900 dark:text-white">
                        <div 
                          onClick={() => setSelectedVesselDetail(vessel)}
                          className="flex items-center gap-1.5 cursor-pointer hover:text-[#D49A24] dark:hover:text-[#D49A24] transition-colors group"
                          title="Click to view vessel technical specifications"
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
                      <td className="p-4">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/30">
                          {vessel.vessel_status || 'ACTIVE'}
                        </span>
                      </td>
                      <td className="p-4 text-right space-x-1.5">
                        <button
                          onClick={(e) => { e.stopPropagation(); setSelectedVesselDetail(vessel); }}
                          className="px-2.5 py-1 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-600 dark:text-sky-400 font-bold text-xs inline-flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View Details</span>
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setVesselToDelete(vessel); }}
                          className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 transition-colors cursor-pointer"
                          title="Delete Vessel"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {renderSharedModals()}
      </div>
    );
  }

  // =========================================================================
  // VIEW 3: ARRIVAL REQUESTS (activeTab === 'arrival-requests' or default)
  // =========================================================================
  return (
    <div className="space-y-6 font-sans selection:bg-[#D49A24] selection:text-white animate-fade-in">
      
      {/* HEADER BANNER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400 mb-1">
            <Anchor className="w-4 h-4" />
            <span>Vessel Arrival Management</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            Vessel Arrival Requests
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">
            Submit, track, and manage your vessel arrival requests and operational review responses from Port Operations.
          </p>
        </div>

        <button
          onClick={handleOpenNewArrivalRequest}
          className="px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>New Arrival Request</span>
        </button>
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-1.5 shrink-0 overflow-x-auto">
          <button
            onClick={() => setRequestStatusFilter('PENDING')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              requestStatusFilter === 'PENDING' ? 'bg-amber-500 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Pending ({pendingCount})
          </button>
          <button
            onClick={() => setRequestStatusFilter('APPROVED')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              requestStatusFilter === 'APPROVED' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Approved ({approvedCount})
          </button>
          <button
            onClick={() => setRequestStatusFilter('REJECTED')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              requestStatusFilter === 'REJECTED' ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Rejected ({rejectedCount})
          </button>
          <button
            onClick={() => setRequestStatusFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              requestStatusFilter === 'all' ? 'bg-slate-800 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            All ({arrivalRequests.length})
          </button>
        </div>

        <div className="relative max-w-xs w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by vessel, IMO, cargo, request ID..."
            value={requestSearch}
            onChange={(e) => setRequestSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-medium focus:outline-none focus:border-sky-500"
          />
        </div>
      </div>

      {/* REQUESTS TABLE */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-12 text-center space-y-3">
            <RefreshCw className="w-8 h-8 mx-auto text-sky-600 animate-spin" />
            <p className="text-xs font-bold text-slate-600 dark:text-slate-400">Loading arrival requests from PostgreSQL...</p>
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Anchor className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-700" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">No arrival requests submitted yet.</h3>
            <p className="text-xs text-slate-500">Submit an arrival request for one of your registered fleet vessels.</p>
            <button
              onClick={handleOpenNewArrivalRequest}
              className="px-4 py-2 rounded-xl bg-sky-600 text-white font-bold text-xs shadow-md"
            >
              New Arrival Request
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-black uppercase tracking-wider text-[11px]">
                  <th className="p-4">REQUEST #</th>
                  <th className="p-4">VESSEL SPECS</th>
                  <th className="p-4">REQUESTED ARRIVAL</th>
                  <th className="p-4">REQUESTED DEPARTURE</th>
                  <th className="p-4">CARGO SPECIFICATIONS</th>
                  <th className="p-4">STATUS</th>
                  <th className="p-4 text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium text-slate-700 dark:text-slate-300">
                {filteredRequests.map((req) => (
                  <tr key={req.vessel_arrival_request_id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="p-4 font-mono font-bold text-sky-600">AR-00{req.vessel_arrival_request_id}</td>
                    <td className="p-4">
                      <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <Ship className="w-4 h-4 text-[#D49A24] shrink-0" />
                        <span>{req.vessel?.vessel_name || 'Vessel'}</span>
                      </div>
                      <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                        IMO: {req.vessel?.vessel_imo_number} | Draft: {req.vessel?.vessel_draft}m
                      </div>
                    </td>
                    <td className="p-4 font-medium text-slate-800 dark:text-slate-200">{formatDate(req.vessel_arrival_request_requested_arrival_at)}</td>
                    <td className="p-4 font-medium text-slate-800 dark:text-slate-200">{formatDate(req.vessel_arrival_request_requested_departure_at)}</td>
                    <td className="p-4">
                      <div className="font-semibold text-slate-800 dark:text-slate-200">{req.vessel_arrival_request_cargo_type}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{req.vessel_arrival_request_cargo_quantity} TEU</div>
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        req.vessel_arrival_request_status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/30' :
                        req.vessel_arrival_request_status === 'REJECTED' ? 'bg-rose-500/10 text-rose-600 border border-rose-500/30' :
                        'bg-amber-500/10 text-amber-600 border border-amber-500/30'
                      }`}>
                        {req.vessel_arrival_request_status}
                      </span>
                    </td>
                    <td className="p-4 text-right space-x-1.5">
                      <button
                        onClick={() => setSelectedRequestDetail(req)}
                        className="px-2.5 py-1 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-600 dark:text-sky-400 font-bold text-xs inline-flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View Details</span>
                      </button>
                      {req.vessel_arrival_request_status === 'PENDING' && (
                        <button
                          onClick={() => setRequestToDelete(req)}
                          className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 transition-colors cursor-pointer"
                          title="Delete Arrival Request"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {renderSharedModals()}
    </div>
  );
};
