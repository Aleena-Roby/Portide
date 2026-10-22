import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../../context/AppContext';
import { Modal } from '../../common/Modal';
import { BackendCargo, BackendVesselArrivalRequest, BackendPort } from '../../../types';
import { API_BASE_URL } from '../../../services/api';
import { 
  Boxes, 
  Plus, 
  Search, 
  RefreshCw, 
  Eye, 
  Edit, 
  CheckCircle2, 
  AlertTriangle, 
  Anchor, 
  Ship, 
  MapPin, 
  Calendar, 
  ArrowRight,
  PackageCheck,
  Scale,
  Hash,
  ShieldCheck,
  Clock,
  CheckCircle,
  FileCheck,
  Globe,
  Info
} from 'lucide-react';
import { ContainerManagementModal } from './ContainerManagementModal';

interface CargoManagementProps {
  arrivalRequests: BackendVesselArrivalRequest[];
  onRefreshRequests?: () => void;
  onNavigateToArrivalRequests?: () => void;
}

const CARGO_TYPE_OPTIONS = [
  { value: 'CONTAINERIZED', label: 'Containerized' },
  { value: 'BULK_CARGO', label: 'Bulk Cargo' },
  { value: 'GENERAL_CARGO', label: 'General Cargo' }
];

const TYPE_UNIT_OPTIONS_MAP: Record<string, { value: string; label: string }[]> = {
  CONTAINERIZED: [
    { value: 'TEU', label: 'TEU (Twenty-foot Equivalent Unit)' },
    { value: 'FEU', label: 'FEU (Forty-foot Equivalent Unit)' }
  ],
  BULK_CARGO: [
    { value: 'TONNES', label: 'Metric Tonnes (MT)' },
    { value: 'KG', label: 'Kilograms (KG)' }
  ],
  GENERAL_CARGO: [
    { value: 'UNITS', label: 'Units / Pieces' },
    { value: 'PACKAGES', label: 'Packages / Cartons' },
    { value: 'TONNES', label: 'Metric Tonnes (MT)' }
  ]
};

const ITEMS_PER_PAGE = 10;

export const CargoManagement: React.FC<CargoManagementProps> = ({ 
  arrivalRequests,
  onRefreshRequests,
  onNavigateToArrivalRequests
}) => {
  const { currentUser, addToast } = useApp();

  const [cargoes, setCargoes] = useState<BackendCargo[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  // Search, Filtering & Pagination
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Modals
  const [isRegisterOpen, setIsRegisterOpen] = useState<boolean>(false);
  const [selectedCargoDetail, setSelectedCargoDetail] = useState<BackendCargo | null>(null);
  const [editingCargo, setEditingCargo] = useState<BackendCargo | null>(null);

  // Container Management Modal State
  const [selectedCargoForContainers, setSelectedCargoForContainers] = useState<BackendCargo | null>(null);
  const [isContainerModalOpen, setIsContainerModalOpen] = useState<boolean>(false);

  // Master Ports State
  const [ports, setPorts] = useState<BackendPort[]>([]);
  const [portsLoading, setPortsLoading] = useState<boolean>(false);

  // Form States - Register / Edit
  const [selectedArrivalRequestId, setSelectedArrivalRequestId] = useState<string>('');
  const [cargoDescription, setCargoDescription] = useState<string>('');
  const [cargoType, setCargoType] = useState<string>('CONTAINERIZED');
  const [cargoDirection, setCargoDirection] = useState<'IMPORT' | 'EXPORT'>('IMPORT');
  const [cargoQuantity, setCargoQuantity] = useState<string>('500');
  const [cargoUnit, setCargoUnit] = useState<string>('TEU');
  const [cargoWeight, setCargoWeight] = useState<string>('6000');
  const [cargoOriginPortId, setCargoOriginPortId] = useState<number | ''>('');
  const [cargoDestinationPortId, setCargoDestinationPortId] = useState<number | ''>('');
  const [submitLoading, setSubmitLoading] = useState<boolean>(false);
  const [formError, setFormError] = useState<string>('');
  const [freshArrivalRequests, setFreshArrivalRequests] = useState<BackendVesselArrivalRequest[]>(arrivalRequests || []);
  const [requestsLoading, setRequestsLoading] = useState<boolean>(false);

  // Sync with prop changes if parent dashboard updates
  useEffect(() => {
    if (arrivalRequests && arrivalRequests.length > 0) {
      setFreshArrivalRequests(arrivalRequests);
    }
  }, [arrivalRequests]);

  // Real-time backend fetch for active eligible arrival requests
  const fetchEligibleArrivalRequests = async () => {
    setRequestsLoading(true);
    try {
      const headers = {
        'X-User-Email': currentUser?.email || '',
        'X-User-Role': 'shipping_company',
        'X-User-Id': currentUser?.id || ''
      };
      const response = await fetch(`${API_BASE_URL}/api/arrival-requests/?eligible_for_cargo=true`, { headers });
      const json = await response.json();
      if (response.ok && json.status === 'success') {
        setFreshArrivalRequests(json.data || []);
      }
    } catch (err) {
      console.error('Failed to load eligible arrival requests', err);
    } finally {
      setRequestsLoading(false);
    }
  };

  // Filter arrival requests strictly to APPROVED and currently eligible (not expired)
  const eligibleArrivalRequests = useMemo(() => {
    const sourceList = freshArrivalRequests.length > 0 ? freshArrivalRequests : (arrivalRequests || []);
    const nowMs = Date.now();
    return sourceList.filter(req => {
      // Must have actual APPROVED status from backend
      if (req.vessel_arrival_request_status !== 'APPROVED') return false;
      // If backend evaluated is_cargo_eligible flag is present
      if (req.is_cargo_eligible !== undefined) {
        return req.is_cargo_eligible;
      }
      // If backend evaluated is_expired flag is present
      if (req.is_expired !== undefined && req.is_expired) {
        return false;
      }
      // Departure time check (eligible while current time < requested departure)
      if (req.vessel_arrival_request_requested_departure_at) {
        return new Date(req.vessel_arrival_request_requested_departure_at).getTime() > nowMs;
      }
      return true;
    });
  }, [freshArrivalRequests, arrivalRequests]);

  const fetchCargoes = async () => {
    setLoading(true);
    setError('');
    try {
      const headers = {
        'X-User-Email': currentUser?.email || '',
        'X-User-Role': 'shipping_company',
        'X-User-Id': currentUser?.id || ''
      };

      const response = await fetch(`${API_BASE_URL}/api/cargo/`, { headers });
      const json = await response.json();

      if (response.ok && json.status === 'success') {
        setCargoes(json.data || []);
      } else {
        setError(json.message || 'Failed to load cargo records.');
      }
    } catch (err) {
      setError('Unable to connect to backend server. Please verify Django is running.');
    } finally {
      setLoading(false);
    }
  };

  const fetchPorts = async () => {
    setPortsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/ports/`);
      const json = await response.json();
      if (response.ok && json.status === 'success') {
        setPorts(json.data || []);
      }
    } catch (err) {
      console.error('Failed to load ports directory', err);
    } finally {
      setPortsLoading(false);
    }
  };

  useEffect(() => {
    fetchCargoes();
    fetchPorts();
    fetchEligibleArrivalRequests();
  }, [currentUser?.email]);

  const formatDateTime = (dateStr?: string | null) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const month = months[d.getMonth()];
      const day = d.getDate();
      const year = d.getFullYear();
      let hours = d.getHours();
      const minutes = d.getMinutes().toString().padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12;
      const hoursStr = hours.toString().padStart(2, '0');
      return `${month} ${day}, ${year} ${hoursStr}:${minutes} ${ampm}`;
    } catch {
      return dateStr;
    }
  };

  const formatDate = formatDateTime;

  // Find selected arrival request for read-only preview
  const selectedArrivalRequestObj = useMemo(() => {
    if (!selectedArrivalRequestId) return null;
    const combined = [...freshArrivalRequests, ...(arrivalRequests || [])];
    return combined.find(r => String(r.vessel_arrival_request_id) === String(selectedArrivalRequestId)) || null;
  }, [selectedArrivalRequestId, freshArrivalRequests, arrivalRequests]);

  // Handle Cargo Type Change with dynamic unit synchronization
  const handleCargoTypeChange = (newType: string) => {
    setCargoType(newType);
    const availableUnits = TYPE_UNIT_OPTIONS_MAP[newType] || [];
    const isCurrentValid = availableUnits.some(u => u.value === cargoUnit);
    if (!isCurrentValid && availableUnits.length > 0) {
      setCargoUnit(availableUnits[0].value);
    }
  };

  // Pre-select valid request when modal is open and options change
  useEffect(() => {
    if (isRegisterOpen && !editingCargo) {
      if (eligibleArrivalRequests.length > 0) {
        const stillValid = eligibleArrivalRequests.some(r => String(r.vessel_arrival_request_id) === String(selectedArrivalRequestId));
        if (!stillValid) {
          setSelectedArrivalRequestId(String(eligibleArrivalRequests[0].vessel_arrival_request_id));
        }
      } else {
        setSelectedArrivalRequestId('');
      }
    }
  }, [isRegisterOpen, editingCargo, eligibleArrivalRequests]);

  // Open Register Modal
  const handleOpenRegister = async () => {
    setEditingCargo(null);
    await fetchEligibleArrivalRequests();
    onRefreshRequests?.();

    setCargoDescription('');
    setCargoType('CONTAINERIZED');
    setCargoDirection('IMPORT');
    setCargoQuantity('500');
    setCargoUnit('TEU');
    setCargoWeight('6000');

    // Default origin and destination ports if available
    if (ports.length >= 2) {
      const sgPort = ports.find(p => p.port_code === 'SGSIN') || ports[0];
      const inPort = ports.find(p => p.port_code === 'INBOM' || p.port_code === 'INNSA') || ports[1];
      setCargoOriginPortId(sgPort ? sgPort.port_id : '');
      setCargoDestinationPortId(inPort ? inPort.port_id : '');
    } else {
      setCargoOriginPortId('');
      setCargoDestinationPortId('');
    }
    setFormError('');
    setIsRegisterOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (cargo: BackendCargo) => {
    if (cargo.cargo_status !== 'REGISTERED') {
      addToast('error', 'Cannot Edit', `Cargo with status '${cargo.cargo_status}' cannot be edited.`);
      return;
    }
    setEditingCargo(cargo);
    setSelectedArrivalRequestId(String(cargo.cargo_arrival_request_id));
    setCargoDescription(cargo.cargo_description);
    setCargoType(cargo.cargo_type);
    setCargoDirection(cargo.cargo_direction || 'IMPORT');
    setCargoQuantity(String(cargo.cargo_quantity));
    setCargoUnit(cargo.cargo_unit);
    setCargoWeight(String(cargo.cargo_weight));
    setCargoOriginPortId(cargo.cargo_origin_port_id || '');
    setCargoDestinationPortId(cargo.cargo_destination_port_id || '');
    setFormError('');
    setIsRegisterOpen(true);
  };

  // Form Submit Handler
  const handleSaveCargo = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!selectedArrivalRequestId) {
      setFormError('Please select an APPROVED Vessel Arrival Request.');
      return;
    }

    if (!cargoDescription.trim()) {
      setFormError('Cargo description is required.');
      return;
    }

    const qtyNum = parseFloat(cargoQuantity);
    if (isNaN(qtyNum) || qtyNum <= 0) {
      setFormError('Cargo quantity must be a positive number greater than zero.');
      return;
    }

    const weightNum = parseFloat(cargoWeight);
    if (isNaN(weightNum) || weightNum <= 0) {
      setFormError('Gross weight must be a positive number greater than zero.');
      return;
    }

    if (!cargoOriginPortId) {
      setFormError('Port of origin is required. Please select a valid origin port.');
      return;
    }

    if (!cargoDestinationPortId) {
      setFormError('Port of destination is required. Please select a valid destination port.');
      return;
    }

    if (cargoOriginPortId === cargoDestinationPortId) {
      setFormError('Port of destination cannot be the same as port of origin.');
      return;
    }

    setSubmitLoading(true);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-User-Email': currentUser?.email || '',
        'X-User-Role': 'shipping_company',
        'X-User-Id': currentUser?.id || ''
      };

      const payload = {
        cargo_arrival_request_id: parseInt(selectedArrivalRequestId, 10),
        cargo_description: cargoDescription.trim(),
        cargo_type: cargoType,
        cargo_direction: cargoDirection,
        cargo_quantity: qtyNum,
        cargo_unit: cargoUnit,
        cargo_weight: weightNum,
        cargo_origin_port_id: cargoOriginPortId,
        cargo_destination_port_id: cargoDestinationPortId
      };

      let url = `${API_BASE_URL}/api/cargo/`;
      let method = 'POST';

      if (editingCargo) {
        url = `${API_BASE_URL}/api/cargo/${editingCargo.cargo_id}/`;
        method = 'PATCH';
      }

      const response = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      setSubmitLoading(false);

      if (response.ok && (result.status === 'success' || result.data)) {
        addToast(
          'success',
          editingCargo ? 'Cargo Updated' : 'Cargo Registered',
          editingCargo 
            ? `Cargo #${editingCargo.cargo_id} was updated successfully.` 
            : `Cargo record linked to Arrival Request #AR-00${selectedArrivalRequestId} was registered successfully.`
        );
        setIsRegisterOpen(false);
        setEditingCargo(null);
        fetchCargoes();
      } else {
        const errorDetail = result.errors 
          ? Object.values(result.errors).flat().join(' ') 
          : result.message || 'Operation failed. Please verify the input values.';
        setFormError(errorDetail);
        fetchEligibleArrivalRequests();
        onRefreshRequests?.();
      }
    } catch (err) {
      setSubmitLoading(false);
      setFormError('Network communication error. Please ensure the Django backend server is accessible.');
    }
  };

  // Filtered and Searched Cargoes
  const filteredCargoes = useMemo(() => {
    return cargoes.filter(c => {
      const matchesStatus = statusFilter === 'all' || c.cargo_status === statusFilter;
      const matchesType = typeFilter === 'all' || c.cargo_type === typeFilter;
      
      const q = searchQuery.toLowerCase().trim();
      const desc = (c.cargo_description || '').toLowerCase();
      const origin = (c.cargo_origin || '').toLowerCase();
      const dest = (c.cargo_destination || '').toLowerCase();
      const direction = (c.cargo_direction || 'IMPORT').toLowerCase();
      const vessel = (c.arrival_request_summary?.vessel_name || '').toLowerCase();
      const imo = (c.arrival_request_summary?.vessel_imo_number || '').toLowerCase();
      const cargoId = `crg-${c.cargo_id}`.toLowerCase();
      const reqId = `ar-00${c.cargo_arrival_request_id}`.toLowerCase();

      const matchesQuery = !q || 
        desc.includes(q) || 
        origin.includes(q) || 
        dest.includes(q) || 
        direction.includes(q) ||
        vessel.includes(q) || 
        imo.includes(q) || 
        cargoId.includes(q) || 
        reqId.includes(q);

      return matchesStatus && matchesType && matchesQuery;
    });
  }, [cargoes, statusFilter, typeFilter, searchQuery]);

  // Pagination logic
  const totalPages = Math.ceil(filteredCargoes.length / ITEMS_PER_PAGE) || 1;
  const paginatedCargoes = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredCargoes.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredCargoes, currentPage]);

  // Metrics
  const containerizedCount = cargoes.filter(c => c.cargo_type === 'CONTAINERIZED').length;
  const generalCount = cargoes.filter(c => c.cargo_type === 'GENERAL_CARGO').length;
  const bulkCount = cargoes.filter(c => c.cargo_type === 'BULK_CARGO').length;
  const registeredStatusCount = cargoes.filter(c => c.cargo_status === 'REGISTERED').length;

  return (
    <div className="space-y-6 font-sans selection:bg-[#D49A24] selection:text-white animate-fade-in">
      
      {/* 1. HEADER BANNER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#D49A24] mb-1">
            <Boxes className="w-4 h-4" />
            <span>Maritime Cargo Registration & Manifest</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            Cargo Management
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">
            Register, link, and manage cargo directly connected to your company's vessel arrival requests.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={fetchCargoes}
            disabled={loading}
            className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all cursor-pointer border border-slate-200 dark:border-slate-700 flex items-center gap-2"
            title="Refresh Cargo Records"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Sync Cargo</span>
          </button>
          <button
            onClick={handleOpenRegister}
            className="px-4 py-2.5 rounded-xl bg-[#D49A24] hover:bg-[#b8831c] text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Register Cargo</span>
          </button>
        </div>
      </div>

      {/* 2. STATS CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div 
          onClick={() => { setStatusFilter('all'); setTypeFilter('all'); }}
          className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 hover:border-[#D49A24] transition-all cursor-pointer shadow-xs space-y-2 group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Cargo Items</span>
            <div className="w-9 h-9 rounded-xl bg-[#D49A24]/10 text-[#D49A24] flex items-center justify-center font-bold">
              <Boxes className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-black text-slate-900 dark:text-white">
            {cargoes.length}
          </div>
          <div className="text-[11px] font-medium text-slate-500">Linked to Arrival Requests</div>
        </div>

        <div 
          onClick={() => setTypeFilter('CONTAINERIZED')}
          className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 hover:border-sky-500 transition-all cursor-pointer shadow-xs space-y-2 group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Containerized</span>
            <div className="w-9 h-9 rounded-xl bg-sky-500/10 text-sky-600 flex items-center justify-center font-bold">
              <PackageCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-black text-sky-600 dark:text-sky-400">
            {containerizedCount}
          </div>
          <div className="text-[11px] font-medium text-slate-500">ISO Containers / TEU</div>
        </div>

        <div 
          onClick={() => setTypeFilter('BULK_CARGO')}
          className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 hover:border-amber-500 transition-all cursor-pointer shadow-xs space-y-2 group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Bulk Cargo</span>
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
              <Scale className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-black text-amber-600 dark:text-amber-400">
            {bulkCount}
          </div>
          <div className="text-[11px] font-medium text-slate-500">Liquid & Dry Bulk (MT)</div>
        </div>

        <div 
          onClick={() => setTypeFilter('GENERAL_CARGO')}
          className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 hover:border-emerald-500 transition-all cursor-pointer shadow-xs space-y-2 group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">General Cargo</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400">
            {generalCount}
          </div>
          <div className="text-[11px] font-medium text-slate-500">Breakbulk & Project Units</div>
        </div>
      </div>

      {/* 3. FILTERS & SEARCH BAR */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-1.5 shrink-0 overflow-x-auto">
          <button
            onClick={() => { setStatusFilter('all'); setCurrentPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              statusFilter === 'all' ? 'bg-[#D49A24] text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            All ({cargoes.length})
          </button>
          <button
            onClick={() => { setStatusFilter('REGISTERED'); setCurrentPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              statusFilter === 'REGISTERED' ? 'bg-sky-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Registered ({registeredStatusCount})
          </button>
          <button
            onClick={() => { setStatusFilter('IN_PORT'); setCurrentPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              statusFilter === 'IN_PORT' ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            In Port ({cargoes.filter(c => c.cargo_status === 'IN_PORT').length})
          </button>
          <button
            onClick={() => { setStatusFilter('COMPLETED'); setCurrentPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              statusFilter === 'COMPLETED' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Completed ({cargoes.filter(c => c.cargo_status === 'COMPLETED').length})
          </button>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value); setCurrentPage(1); }}
            className="px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:border-[#D49A24]"
          >
            <option value="all">All Types</option>
            <option value="CONTAINERIZED">Containerized</option>
            <option value="GENERAL_CARGO">General Cargo</option>
            <option value="BULK_CARGO">Bulk Cargo</option>
          </select>

          <div className="relative max-w-xs w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by description, vessel, origin, destination..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-medium focus:outline-none focus:border-[#D49A24]"
            />
          </div>
        </div>
      </div>

      {/* 4. CARGO TABLE */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-12 text-center space-y-3">
            <RefreshCw className="w-8 h-8 mx-auto text-[#D49A24] animate-spin" />
            <p className="text-xs font-bold text-slate-600 dark:text-slate-400">Loading cargo records from PostgreSQL...</p>
          </div>
        ) : filteredCargoes.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Boxes className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-700" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">No cargo records found.</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              {cargoes.length === 0 
                ? 'Register cargo for one of your submitted vessel arrival requests to begin manifest tracking.' 
                : 'No cargo records match your current search or filter criteria.'}
            </p>
            {cargoes.length === 0 && (
              <button
                onClick={handleOpenRegister}
                className="px-4 py-2 rounded-xl bg-[#D49A24] text-white font-bold text-xs shadow-md"
              >
                + Register First Cargo
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-black uppercase tracking-wider text-[11px]">
                  <th className="p-4">CARGO ID</th>
                  <th className="p-4">ARRIVAL REQUEST & VESSEL</th>
                  <th className="p-4">DESCRIPTION & TYPE</th>
                  <th className="p-4">QUANTITY</th>
                  <th className="p-4">GROSS WEIGHT</th>
                  <th className="p-4">ROUTE (ORIGIN → DESTINATION)</th>
                  <th className="p-4">STATUS</th>
                  <th className="p-4 text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium text-slate-700 dark:text-slate-300">
                {paginatedCargoes.map((cargo) => {
                  const summary = cargo.arrival_request_summary;
                  const isEditable = cargo.cargo_status === 'REGISTERED';

                  return (
                    <tr 
                      key={cargo.cargo_id} 
                      onClick={() => setSelectedCargoDetail(cargo)}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors cursor-pointer group"
                      title="Click / tap to view cargo specifications"
                    >
                      <td className="p-4 font-mono font-bold text-[#D49A24] group-hover:text-[#b8831c] group-hover:underline">
                        CRG-00{cargo.cargo_id}
                      </td>

                      <td className="p-4">
                        <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <Ship className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                          <span>{summary?.vessel_name || 'Vessel'}</span>
                        </div>
                        <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                          Req: AR-00{cargo.cargo_arrival_request_id} • IMO: {summary?.vessel_imo_number || '—'}
                        </div>
                      </td>

                      <td className="p-4">
                        <div className="font-bold text-slate-900 dark:text-white truncate max-w-xs group-hover:text-[#D49A24] transition-colors" title={cargo.cargo_description}>
                          {cargo.cargo_description}
                        </div>
                        <div className="text-[10px] text-slate-500 font-medium mt-0.5 flex items-center gap-1.5 flex-wrap">
                          <span>{cargo.cargo_type_display || cargo.cargo_type}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                            cargo.cargo_direction === 'EXPORT'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                              : 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-300 dark:border-blue-800'
                          }`}>
                            {cargo.cargo_direction === 'EXPORT' ? '📤 EXPORT' : '📥 IMPORT'}
                          </span>
                        </div>
                      </td>

                      <td className="p-4 font-mono font-bold text-slate-900 dark:text-white">
                        {cargo.cargo_quantity} <span className="text-[10px] text-slate-400 font-normal">{cargo.cargo_unit}</span>
                      </td>

                      <td className="p-4 font-mono text-emerald-600 font-bold">
                        {cargo.cargo_weight} <span className="text-[10px] text-slate-400 font-normal">MT</span>
                      </td>

                      <td className="p-4">
                        <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[220px]">
                          <span title={cargo.cargo_origin}>{cargo.cargo_origin}</span>
                          <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                          <span title={cargo.cargo_destination}>{cargo.cargo_destination}</span>
                        </div>
                      </td>

                      <td className="p-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                          cargo.cargo_status === 'REGISTERED'
                            ? 'bg-sky-500/10 text-sky-600 border-sky-500/30'
                            : cargo.cargo_status === 'IN_PORT'
                            ? 'bg-amber-500/10 text-amber-600 border-amber-500/30'
                            : 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
                        }`}>
                          {cargo.cargo_status_display || cargo.cargo_status}
                        </span>
                      </td>

                      <td className="p-4 text-right space-x-1.5 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        {cargo.cargo_type === 'CONTAINERIZED' ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedCargoForContainers(cargo);
                              setIsContainerModalOpen(true);
                            }}
                            className="p-2 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 transition-colors cursor-pointer inline-flex items-center gap-1.5 text-xs font-bold"
                            title="Manage Containers"
                          >
                            <Boxes className="w-4 h-4" />
                            <span className="hidden xl:inline">Containers</span>
                          </button>
                        ) : (
                          <button
                            disabled
                            className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-300 dark:text-slate-600 cursor-not-allowed inline-flex items-center gap-1.5 text-xs font-bold"
                            title="Containers can only be registered for containerized cargo."
                          >
                            <Boxes className="w-4 h-4" />
                            <span className="hidden xl:inline">Containers</span>
                          </button>
                        )}

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedCargoDetail(cargo);
                          }}
                          className="p-2 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-600 dark:text-sky-400 transition-colors cursor-pointer inline-flex items-center"
                          title="View Cargo Specifications"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {isEditable ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenEdit(cargo);
                            }}
                            className="p-2 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 transition-colors cursor-pointer inline-flex items-center"
                            title="Edit Cargo"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                        ) : (
                          <span 
                            className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-300 dark:text-slate-600 cursor-not-allowed inline-flex items-center"
                            title="Cannot edit completed or in-port cargo"
                          >
                            <Edit className="w-4 h-4" />
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* PAGINATION FOOTER */}
        {filteredCargoes.length > ITEMS_PER_PAGE && (
          <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
            <div>
              Showing <span className="font-bold text-slate-900 dark:text-white">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> to{' '}
              <span className="font-bold text-slate-900 dark:text-white">
                {Math.min(currentPage * ITEMS_PER_PAGE, filteredCargoes.length)}
              </span>{' '}
              of <span className="font-bold text-slate-900 dark:text-white">{filteredCargoes.length}</span> records
            </div>

            <div className="flex items-center gap-2">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
              >
                Previous
              </button>
              <span className="font-bold text-slate-700 dark:text-slate-300">
                Page {currentPage} of {totalPages}
              </span>
              <button
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 5. REGISTER / EDIT CARGO MODAL (+ REGISTER CARGO FLOW) */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isRegisterOpen}
        onClose={() => {
          setIsRegisterOpen(false);
          setEditingCargo(null);
        }}
        title={editingCargo ? `Edit Cargo #CRG-00${editingCargo.cargo_id}` : 'Register Cargo to Arrival Request'}
        subtitle={editingCargo ? 'Update cargo specification details' : 'Directly link freight consignment to an active arrival request'}
        icon={<Boxes className="w-4 h-4 text-[#D49A24]" />}
        maxWidth="3xl"
      >
        <form onSubmit={handleSaveCargo} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-400 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* STEP 1: SELECT ARRIVAL REQUEST */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Select Vessel Arrival Request *
              </label>
              <button
                type="button"
                onClick={fetchEligibleArrivalRequests}
                disabled={requestsLoading}
                className="text-[10px] text-sky-600 hover:text-sky-700 dark:text-sky-400 font-bold flex items-center gap-1 cursor-pointer transition-colors"
                title="Refresh active arrival requests"
              >
                <RefreshCw className={`w-3 h-3 ${requestsLoading ? 'animate-spin' : ''}`} />
                <span>Refresh Requests</span>
              </button>
            </div>
            {eligibleArrivalRequests.length === 0 ? (
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                <div>
                  <p className="font-bold">No approved active arrival requests are currently available for cargo registration.</p>
                  <p className="text-[11px] mt-0.5 text-amber-700/80 dark:text-amber-400">
                    Cargo can only be registered for approved vessel arrival requests before their scheduled departure time has passed.
                  </p>
                </div>
              </div>
            ) : (
              <select
                required
                disabled={!!editingCargo}
                value={selectedArrivalRequestId}
                onChange={(e) => setSelectedArrivalRequestId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-bold text-xs focus:outline-none focus:border-[#D49A24] disabled:opacity-75"
              >
                <option value="">-- Choose Approved Arrival Request --</option>
                {eligibleArrivalRequests.map(req => (
                  <option key={req.vessel_arrival_request_id} value={req.vessel_arrival_request_id}>
                    AR-00{req.vessel_arrival_request_id} — {req.vessel?.vessel_name || 'Vessel'} — {formatDateTime(req.vessel_arrival_request_requested_arrival_at)} — {req.vessel_arrival_request_status}
                  </option>
                ))}
              </select>
            )}
            <p className="text-[10px] text-slate-400 mt-1">
              {editingCargo 
                ? 'Arrival request assignment cannot be altered once cargo is created.' 
                : 'Only APPROVED arrival requests for your shipping company within the active time window are eligible for cargo registration.'}
            </p>
          </div>

          {/* STEP 2: READ-ONLY CONTEXTUAL SUMMARY CARD */}
          {selectedArrivalRequestObj && (
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>ARRIVAL REQUEST DETAILS</span>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  selectedArrivalRequestObj.vessel_arrival_request_status === 'APPROVED'
                    ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/30'
                    : selectedArrivalRequestObj.vessel_arrival_request_status === 'PENDING'
                    ? 'bg-amber-500/10 text-amber-600 border border-amber-500/30'
                    : 'bg-rose-500/10 text-rose-600 border border-rose-500/30'
                }`}>
                  Status: {selectedArrivalRequestObj.vessel_arrival_request_status}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-1">
                <div>
                  <span className="text-[9px] uppercase font-bold text-slate-400 block">Vessel Name</span>
                  <span className="font-bold text-slate-900 dark:text-white truncate block">
                    {selectedArrivalRequestObj.vessel?.vessel_name || '—'}
                  </span>
                  <span className="text-[10px] font-mono text-[#D49A24] block">
                    IMO: {selectedArrivalRequestObj.vessel?.vessel_imo_number || '—'}
                  </span>
                </div>

                <div>
                  <span className="text-[9px] uppercase font-bold text-slate-400 block">Requested Arrival</span>
                  <span className="font-mono text-slate-800 dark:text-slate-200 text-[11px] block">
                    {formatDateTime(selectedArrivalRequestObj.vessel_arrival_request_requested_arrival_at)}
                  </span>
                </div>

                <div>
                  <span className="text-[9px] uppercase font-bold text-slate-400 block">Requested Departure</span>
                  <span className="font-mono text-slate-800 dark:text-slate-200 text-[11px] block">
                    {formatDateTime(selectedArrivalRequestObj.vessel_arrival_request_requested_departure_at)}
                  </span>
                </div>

                <div>
                  <span className="text-[9px] uppercase font-bold text-slate-400 block">Arrival Request ID</span>
                  <span className="font-mono font-bold text-sky-600 dark:text-sky-400 text-xs block">
                    #AR-00{selectedArrivalRequestObj.vessel_arrival_request_id}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: CARGO DETAILS INPUTS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3 pt-1">
            <div className="md:col-span-2">
              <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Cargo Description *
              </label>
              <input
                type="text"
                required
                value={cargoDescription}
                onChange={(e) => setCargoDescription(e.target.value)}
                placeholder="e.g. Consumer Electronics, Industrial Machinery & Auto Parts"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-bold focus:outline-none focus:border-[#D49A24]"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Cargo Classification / Type *
              </label>
              <select
                value={cargoType}
                onChange={(e) => handleCargoTypeChange(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-bold focus:outline-none focus:border-[#D49A24]"
              >
                {CARGO_TYPE_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Trade Direction *
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setCargoDirection('IMPORT')}
                  className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                    cargoDirection === 'IMPORT'
                      ? 'bg-blue-50 dark:bg-blue-900/40 border-blue-500 text-blue-700 dark:text-blue-300 shadow-sm ring-2 ring-blue-500/20'
                      : 'bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  <span>📥</span> Inbound (Import)
                </button>
                <button
                  type="button"
                  onClick={() => setCargoDirection('EXPORT')}
                  className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                    cargoDirection === 'EXPORT'
                      ? 'bg-emerald-50 dark:bg-emerald-900/40 border-emerald-500 text-emerald-700 dark:text-emerald-300 shadow-sm ring-2 ring-emerald-500/20'
                      : 'bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  <span>📤</span> Outbound (Export)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Quantity *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={cargoQuantity}
                  onChange={(e) => setCargoQuantity(e.target.value)}
                  placeholder="500"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-mono font-bold focus:outline-none focus:border-[#D49A24]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Unit *
                </label>
                <select
                  value={cargoUnit}
                  onChange={(e) => setCargoUnit(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-bold text-xs focus:outline-none focus:border-[#D49A24]"
                >
                  {(TYPE_UNIT_OPTIONS_MAP[cargoType] || []).map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Gross Weight (Metric Tonnes) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={cargoWeight}
                onChange={(e) => setCargoWeight(e.target.value)}
                placeholder="6000.00"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-mono font-bold focus:outline-none focus:border-[#D49A24]"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Port of Origin (UN/LOCODE) *
              </label>
              <select
                required
                value={cargoOriginPortId}
                onChange={(e) => setCargoOriginPortId(e.target.value ? parseInt(e.target.value, 10) : '')}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-bold text-xs focus:outline-none focus:border-[#D49A24]"
              >
                <option value="">-- Select Origin Port --</option>
                {ports.map(p => (
                  <option key={p.port_id} value={p.port_id}>
                    {p.port_name} ({p.port_code}) — {p.port_country}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Port of Destination (UN/LOCODE) *
              </label>
              <select
                required
                value={cargoDestinationPortId}
                onChange={(e) => setCargoDestinationPortId(e.target.value ? parseInt(e.target.value, 10) : '')}
                className={`w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border font-bold text-xs focus:outline-none ${
                  cargoOriginPortId && cargoDestinationPortId && cargoOriginPortId === cargoDestinationPortId
                    ? 'border-rose-500 focus:border-rose-500'
                    : 'border-slate-300 dark:border-slate-700 focus:border-[#D49A24]'
                }`}
              >
                <option value="">-- Select Destination Port --</option>
                {ports.map(p => (
                  <option key={p.port_id} value={p.port_id} disabled={p.port_id === cargoOriginPortId}>
                    {p.port_name} ({p.port_code}) — {p.port_country} {p.port_id === cargoOriginPortId ? '(Origin)' : ''}
                  </option>
                ))}
              </select>
              {cargoOriginPortId && cargoDestinationPortId && cargoOriginPortId === cargoDestinationPortId && (
                <p className="text-[10px] text-rose-500 mt-1 font-semibold">
                  Destination cannot be the same as origin port.
                </p>
              )}
            </div>
          </div>

          {/* ACTIONS */}
          <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => {
                setIsRegisterOpen(false);
                setEditingCargo(null);
              }}
              className="px-4 py-2 rounded-xl font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitLoading || eligibleArrivalRequests.length === 0 || (!!cargoOriginPortId && !!cargoDestinationPortId && cargoOriginPortId === cargoDestinationPortId)}
              className="px-5 py-2.5 rounded-xl font-bold uppercase tracking-wider text-white bg-[#D49A24] hover:bg-[#b8831c] text-xs shadow-md disabled:opacity-50 cursor-pointer"
            >
              {submitLoading ? 'Saving Cargo...' : (editingCargo ? 'Update Cargo Specifications' : 'Save & Register Cargo')}
            </button>
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* 6. VIEW CARGO DETAILS MODAL */}
      {/* ========================================================================= */}
      <Modal
        isOpen={!!selectedCargoDetail}
        onClose={() => setSelectedCargoDetail(null)}
        title={`Cargo Details #CRG-00${selectedCargoDetail?.cargo_id}`}
        subtitle={selectedCargoDetail?.cargo_description}
        icon={<Boxes className="w-4 h-4 text-[#D49A24]" />}
        maxWidth="2xl"
      >
        {selectedCargoDetail && (
          <div className="space-y-4">
            
            {/* Context Card */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Linked Arrival Request</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  selectedCargoDetail.cargo_status === 'REGISTERED'
                    ? 'bg-sky-500/10 text-sky-600 border border-sky-500/30'
                    : selectedCargoDetail.cargo_status === 'IN_PORT'
                    ? 'bg-amber-500/10 text-amber-600 border border-amber-500/30'
                    : 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/30'
                }`}>
                  Status: {selectedCargoDetail.cargo_status_display || selectedCargoDetail.cargo_status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs pt-1">
                <div>
                  <span className="text-[9px] uppercase font-bold text-slate-400 block">Vessel Name</span>
                  <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 mt-0.5">
                    <Ship className="w-3.5 h-3.5 text-[#D49A24]" />
                    {selectedCargoDetail.arrival_request_summary?.vessel_name || 'Vessel'}
                  </span>
                  <span className="font-mono text-[10px] text-[#D49A24] block">
                    IMO: {selectedCargoDetail.arrival_request_summary?.vessel_imo_number}
                  </span>
                </div>

                <div>
                  <span className="text-[9px] uppercase font-bold text-slate-400 block">Arrival Request ID</span>
                  <span className="font-mono font-bold text-sky-600 dark:text-sky-400 block mt-0.5">
                    AR-00{selectedCargoDetail.cargo_arrival_request_id}
                  </span>
                  <span className="text-[10px] text-slate-400 block">
                    ETA: {formatDateTime(selectedCargoDetail.arrival_request_summary?.requested_arrival_at)}
                  </span>
                </div>
              </div>
            </div>

            {/* Technical Specs Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Classification</span>
                <div className="font-bold text-slate-900 dark:text-white mt-1">
                  {selectedCargoDetail.cargo_type_display || selectedCargoDetail.cargo_type}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Trade Direction</span>
                <div className="font-bold text-slate-900 dark:text-white mt-1">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    selectedCargoDetail.cargo_direction === 'EXPORT'
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                      : 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-300 dark:border-blue-800'
                  }`}>
                    {selectedCargoDetail.cargo_direction === 'EXPORT' ? '📤 OUTBOUND EXPORT' : '📥 INBOUND IMPORT'}
                  </span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Quantity & Unit</span>
                <div className="font-mono font-bold text-slate-900 dark:text-white mt-1">
                  {selectedCargoDetail.cargo_quantity} {selectedCargoDetail.cargo_unit}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Gross Weight</span>
                <div className="font-mono font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                  {selectedCargoDetail.cargo_weight} Metric Tonnes (MT)
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Registered Date</span>
                <div className="font-mono text-slate-700 dark:text-slate-300 mt-1">
                  {formatDateTime(selectedCargoDetail.cargo_created_at)}
                </div>
              </div>
            </div>

            {/* Route */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-1.5 text-xs">
              <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider block">Port Routing</span>
              <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200">
                <MapPin className="w-4 h-4 text-rose-500 shrink-0" />
                <span className="font-bold">{selectedCargoDetail.cargo_origin}</span>
                <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
                <MapPin className="w-4 h-4 text-emerald-500 shrink-0" />
                <span className="font-bold">{selectedCargoDetail.cargo_destination}</span>
              </div>
            </div>

            {/* Container Management Integration */}
            {selectedCargoDetail.cargo_type === 'CONTAINERIZED' ? (
              <div className="p-3.5 rounded-xl bg-emerald-500/5 dark:bg-emerald-950/20 border border-emerald-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <Boxes className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <div>
                    <span className="font-bold text-slate-900 dark:text-white text-xs block">
                      Container Management & Tracking Available
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      Register individual containers, verify ISO-6346 formatting, and track operational status.
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const c = selectedCargoDetail;
                    setSelectedCargoDetail(null);
                    setSelectedCargoForContainers(c);
                    setIsContainerModalOpen(true);
                  }}
                  className="px-3.5 py-1.5 rounded-xl font-bold text-xs uppercase tracking-wider text-white bg-emerald-600 hover:bg-emerald-700 transition-colors cursor-pointer shrink-0 shadow-sm flex items-center gap-1.5"
                >
                  <Boxes className="w-3.5 h-3.5" />
                  <span>Manage Containers</span>
                </button>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <Info className="w-4 h-4 text-slate-400 shrink-0" />
                <span>Containers can only be registered for containerized cargo.</span>
              </div>
            )}

            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
              {selectedCargoDetail.cargo_status === 'REGISTERED' && (
                <button
                  onClick={() => {
                    const cargo = selectedCargoDetail;
                    setSelectedCargoDetail(null);
                    handleOpenEdit(cargo);
                  }}
                  className="px-4 py-2 rounded-xl bg-[#D49A24] text-white font-bold text-xs hover:bg-[#b8831c] transition-colors cursor-pointer"
                >
                  Edit Cargo
                </button>
              )}
              <button
                onClick={() => setSelectedCargoDetail(null)}
                className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs hover:bg-slate-300 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* CONTAINER MANAGEMENT & TRACKING MODAL */}
      <ContainerManagementModal
        isOpen={isContainerModalOpen}
        onClose={() => {
          setIsContainerModalOpen(false);
          setSelectedCargoForContainers(null);
        }}
        cargo={selectedCargoForContainers}
        onRefreshCargo={fetchCargoes}
      />
    </div>
  );
};
