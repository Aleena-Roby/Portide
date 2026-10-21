import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useApp } from '../../../context/AppContext';
import { apiFetch } from '../../../services/api';
import { BackendCargo, BackendContainer } from '../../../types';
import { Modal } from '../../common/Modal';
import {
  Boxes,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Search,
  RefreshCw,
  Eye,
  Ship,
  MapPin,
  ArrowRight,
  FileText,
  FileCheck,
  Filter,
  Layers,
  AlertOctagon,
  Scale,
  Building2,
  Calendar,
  ExternalLink,
  ChevronRight,
  ShieldAlert,
  CheckCircle,
  XCircle,
  FileSearch,
  Download,
  Info
} from 'lucide-react';

interface CustomsCargoManifestOversightProps {
  onNavigateToNormalReview?: (containerNumber?: string) => void;
  onNavigateToPreArrival?: () => void;
}

interface CargoCustomsMetrics {
  total_consignments: number;
  containerized_consignments: number;
  in_port_consignments: number;
  registered_consignments: number;
  completed_consignments: number;
}

const ITEMS_PER_PAGE = 8;

export const CustomsCargoManifestOversight: React.FC<CustomsCargoManifestOversightProps> = ({
  onNavigateToNormalReview,
  onNavigateToPreArrival
}) => {
  const { currentUser, addToast } = useApp();

  const [cargoList, setCargoList] = useState<BackendCargo[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Deep-dive Consignment Audit Drawer/Modal
  const [selectedCargo, setSelectedCargo] = useState<BackendCargo | null>(null);
  const [cargoContainers, setCargoContainers] = useState<BackendContainer[]>([]);
  const [loadingContainers, setLoadingContainers] = useState<boolean>(false);
  const [selectedContainerDetail, setSelectedContainerDetail] = useState<BackendContainer | null>(null);

  // Fetch all cargo manifests
  const fetchCargoManifests = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch('/api/cargo/');
      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}`);
      }
      const json = await res.json();
      if (json && json.status === 'success' && Array.isArray(json.data)) {
        setCargoList(json.data);
      } else if (Array.isArray(json)) {
        setCargoList(json);
      } else {
        setCargoList([]);
      }
    } catch (err: any) {
      console.error('Failed to load cargo manifests for customs review:', err);
      setError(err.message || 'Unable to load cargo manifest records from server.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCargoManifests();
  }, [fetchCargoManifests]);

  // Fetch containers for a selected cargo consignment
  const fetchContainersForCargo = async (cargo: BackendCargo) => {
    setSelectedCargo(cargo);
    setCargoContainers([]);
    setSelectedContainerDetail(null);
    setLoadingContainers(true);

    try {
      const res = await apiFetch(`/api/cargo/${cargo.cargo_id}/containers/`);
      if (res.ok) {
        const json = await res.json();
        const containers: BackendContainer[] = json.containers || json.data || [];
        setCargoContainers(containers);
      } else {
        addToast('error', 'Containers Error', 'Could not fetch container manifest for this cargo.');
      }
    } catch (err) {
      console.error('Error fetching containers for cargo manifest:', err);
      addToast('error', 'Network Error', 'Failed to retrieve manifest container breakdown.');
    } finally {
      setLoadingContainers(false);
    }
  };

  // Compute customs summary metrics
  const metrics: CargoCustomsMetrics = useMemo(() => {
    let containerized = 0;
    let inPort = 0;
    let registered = 0;
    let completed = 0;

    cargoList.forEach((c) => {
      if (c.cargo_type === 'CONTAINERIZED') {
        containerized++;
      }
      if (c.cargo_status === 'IN_PORT') {
        inPort++;
      } else if (c.cargo_status === 'REGISTERED') {
        registered++;
      } else if (c.cargo_status === 'COMPLETED') {
        completed++;
      }
    });

    return {
      total_consignments: cargoList.length,
      containerized_consignments: containerized,
      in_port_consignments: inPort,
      registered_consignments: registered,
      completed_consignments: completed
    };
  }, [cargoList]);

  // Filtered Cargo List
  const filteredCargoList = useMemo(() => {
    return cargoList.filter((c) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const descMatch = c.cargo_description?.toLowerCase().includes(q);
        const vesselMatch = c.arrival_request_summary?.vessel_name?.toLowerCase().includes(q);
        const companyMatch = c.arrival_request_summary?.company_name?.toLowerCase().includes(q);
        const idMatch = String(c.cargo_id).includes(q);
        const originMatch = c.cargo_origin?.toLowerCase().includes(q);
        const destMatch = c.cargo_destination?.toLowerCase().includes(q);

        if (!descMatch && !vesselMatch && !companyMatch && !idMatch && !originMatch && !destMatch) {
          return false;
        }
      }

      // Status filter
      if (statusFilter !== 'all') {
        if (c.cargo_status !== statusFilter) {
          return false;
        }
      }

      // Type filter
      if (typeFilter !== 'all') {
        if (c.cargo_type !== typeFilter) {
          return false;
        }
      }

      return true;
    });
  }, [cargoList, searchQuery, statusFilter, typeFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredCargoList.length / ITEMS_PER_PAGE) || 1;
  const paginatedCargoList = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredCargoList.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredCargoList, currentPage]);

  const getCargoStatusBadge = (status: BackendCargo['cargo_status'] | string, display?: string) => {
    switch (status) {
      case 'COMPLETED':
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 inline-flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
            <span>{display || 'Completed'}</span>
          </span>
        );
      case 'IN_PORT':
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/30 inline-flex items-center gap-1">
            <Ship className="w-3 h-3 text-sky-500" />
            <span>{display || 'In Port'}</span>
          </span>
        );
      case 'REGISTERED':
      default:
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 inline-flex items-center gap-1">
            <Clock className="w-3 h-3 text-amber-500" />
            <span>{display || 'Manifest Registered'}</span>
          </span>
        );
    }
  };

  const getContainerCustomsBadge = (status: string, display?: string) => {
    switch (status) {
      case 'CLEARED':
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 inline-flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
            <span>{display || 'Cleared'}</span>
          </span>
        );
      case 'CUSTOMS_HOLD':
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30 inline-flex items-center gap-1">
            <AlertOctagon className="w-3 h-3 text-rose-500" />
            <span>{display || 'Customs Hold'}</span>
          </span>
        );
      case 'UNDER_INSPECTION':
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/30 inline-flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-purple-500" />
            <span>{display || 'Under Inspection'}</span>
          </span>
        );
      case 'RELEASED':
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/30 inline-flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-teal-500" />
            <span>{display || 'Released'}</span>
          </span>
        );
      case 'AWAITING_CUSTOMS':
      default:
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 inline-flex items-center gap-1">
            <Clock className="w-3 h-3 text-amber-500" />
            <span>{display || 'Pending Review'}</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 font-sans animate-fade-in">
      {/* 1. CUSTOMS MANIFEST OVERSIGHT HEADER BANNER */}
      <div className="p-6 sm:p-7 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-indigo-500/20 text-white shadow-lg relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-96 bg-radial from-indigo-500/10 to-transparent pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-3xl">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 inline-flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-indigo-400" />
                Customs Authority Regulatory Oversight
              </span>
              <span className="text-xs text-indigo-200/70 font-mono">
                Jurisdiction: Commercial Port Cargo Manifests
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Cargo Consignment & Manifest Oversight
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 font-normal">
              Statutory cargo compliance screening, vessel consignment audits, tariff verification, and containerized freight clearance tracking.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={fetchCargoManifests}
              disabled={loading}
              className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh Manifests</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. REGULATORY KPI METRIC CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between pb-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Total Manifests
            </span>
            <Boxes className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">
            {metrics.total_consignments}
          </div>
          <span className="text-[10px] text-slate-400 font-medium block mt-0.5">
            All registered voyage manifests
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between pb-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400">
              Containerized
            </span>
            <Layers className="w-4 h-4 text-sky-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">
            {metrics.containerized_consignments}
          </div>
          <span className="text-[10px] text-slate-400 font-medium block mt-0.5">
            TEU slotting & seal verification
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between pb-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              Pre-Arrival Manifests
            </span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-amber-600 dark:text-amber-400 font-mono">
            {metrics.registered_consignments}
          </div>
          <span className="text-[10px] text-slate-400 font-medium block mt-0.5">
            Filed & awaiting vessel arrival
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between pb-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400">
              In Port (Active)
            </span>
            <Ship className="w-4 h-4 text-sky-500" />
          </div>
          <div className="text-2xl font-black text-sky-600 dark:text-sky-400 font-mono">
            {metrics.in_port_consignments}
          </div>
          <span className="text-[10px] text-slate-400 font-medium block mt-0.5">
            Vessels berthed & discharging
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between pb-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Completed
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
            {metrics.completed_consignments}
          </div>
          <span className="text-[10px] text-slate-400 font-medium block mt-0.5">
            Discharged & fulfilled consignments
          </span>
        </div>
      </div>

      {/* 3. FILTERS & SEARCH TOOLBAR */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search by Cargo ID, description, vessel, shipping line, port..."
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:border-indigo-500 transition-colors"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" />
              <span>Status:</span>
            </span>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-hidden focus:border-indigo-500 cursor-pointer"
            >
              <option value="all">All Consignment Statuses</option>
              <option value="REGISTERED">Manifest Filed (Pre-Arrival)</option>
              <option value="IN_PORT">In Port (Active Vessel)</option>
              <option value="COMPLETED">Completed (Fulfilled)</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Type:</span>
            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-hidden focus:border-indigo-500 cursor-pointer"
            >
              <option value="all">All Cargo Types</option>
              <option value="CONTAINERIZED">Containerized Cargo</option>
              <option value="BULK_CARGO">Bulk Cargo</option>
              <option value="GENERAL_CARGO">General Cargo</option>
            </select>
          </div>
        </div>
      </div>

      {/* 4. MAIN CUSTOMS MANIFEST OVERSIGHT TABLE */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-16 text-center space-y-3">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs font-bold text-slate-500">Loading statutory cargo manifests from port registry...</p>
          </div>
        ) : error ? (
          <div className="p-12 text-center space-y-3">
            <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto" />
            <p className="text-sm font-bold text-rose-600">{error}</p>
            <button
              onClick={fetchCargoManifests}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold cursor-pointer"
            >
              Retry
            </button>
          </div>
        ) : paginatedCargoList.length === 0 ? (
          <div className="p-16 text-center space-y-2">
            <FileSearch className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">No Cargo Manifests Match Filters</h4>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              No cargo consignments matched the current search or regulatory status criteria.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="p-4">Consignment / Cargo</th>
                  <th className="p-4">Carrier Vessel & Arrival</th>
                  <th className="p-4">Shipping Line & Route</th>
                  <th className="p-4">Volume & Weight</th>
                  <th className="p-4">Customs Status</th>
                  <th className="p-4 text-right">Customs Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                {paginatedCargoList.map((cargo) => {
                  const vesselName = cargo.arrival_request_summary?.vessel_name || 'N/A';
                  const companyName = cargo.arrival_request_summary?.company_name || 'Commercial Carrier';
                  const arrivalId = cargo.cargo_arrival_request_id;
                  const isContainerized = cargo.cargo_type === 'CONTAINERIZED';

                  return (
                    <tr
                      key={cargo.cargo_id}
                      className="hover:bg-indigo-50/30 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* Consignment / Description */}
                      <td className="p-4">
                        <div className="flex items-start gap-2.5">
                          <div className={`p-2 rounded-xl shrink-0 mt-0.5 ${
                            isContainerized 
                              ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400' 
                              : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                          }`}>
                            <Boxes className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 dark:text-white text-xs">
                              {cargo.cargo_description}
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-slate-500 font-mono">
                              <span>Manifest #{cargo.cargo_id}</span>
                              <span>•</span>
                              <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                                {cargo.cargo_type_display || cargo.cargo_type}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Carrier Vessel & Voyage */}
                      <td className="p-4">
                        <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200">
                          <Ship className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                          <span>{vesselName}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          Voyage Request #{arrivalId}
                          {cargo.arrival_request_summary?.vessel_imo_number && (
                            <span> • IMO: {cargo.arrival_request_summary.vessel_imo_number}</span>
                          )}
                        </div>
                      </td>

                      {/* Shipping Line & Route */}
                      <td className="p-4">
                        <div className="flex items-center gap-1 text-slate-800 dark:text-slate-200 font-bold">
                          <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate max-w-[180px]">{companyName}</span>
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-0.5">
                          <span>{cargo.cargo_origin || 'Origin Port'}</span>
                          <ArrowRight className="w-2.5 h-2.5 text-slate-400" />
                          <span>{cargo.cargo_destination || 'Destination'}</span>
                        </div>
                      </td>

                      {/* Manifested Weight & Quantity */}
                      <td className="p-4 font-mono">
                        <div className="text-slate-900 dark:text-white font-bold">
                          {cargo.cargo_quantity} <span className="text-[10px] text-slate-400 font-normal">{cargo.cargo_unit}</span>
                        </div>
                        <div className="text-emerald-600 font-bold text-[11px] flex items-center gap-1">
                          <Scale className="w-3 h-3 text-emerald-500" />
                          <span>{cargo.cargo_weight} MT</span>
                        </div>
                      </td>

                      {/* Consignment Lifecycle Status */}
                      <td className="p-4">
                        {getCargoStatusBadge(cargo.cargo_status, cargo.cargo_status_display)}
                      </td>

                      {/* Actions */}
                      <td className="p-4 text-right whitespace-nowrap">
                        <button
                          onClick={() => fetchContainersForCargo(cargo)}
                          className="px-3 py-1.5 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30 text-xs font-bold transition-all inline-flex items-center gap-1.5 cursor-pointer mr-1.5 shadow-2xs"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>Audit Manifest</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* PAGINATION BAR */}
        {filteredCargoList.length > ITEMS_PER_PAGE && (
          <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
            <div>
              Showing <span className="font-bold text-slate-900 dark:text-white">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> to{' '}
              <span className="font-bold text-slate-900 dark:text-white">
                {Math.min(currentPage * ITEMS_PER_PAGE, filteredCargoList.length)}
              </span>{' '}
              of <span className="font-bold text-slate-900 dark:text-white">{filteredCargoList.length}</span> manifests
            </div>

            <div className="flex items-center gap-2">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
              >
                Previous
              </button>
              <span className="font-bold text-slate-700 dark:text-slate-300">
                Page {currentPage} of {totalPages}
              </span>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 5. DEEP-DIVE CUSTOMS CONSIGNMENT AUDIT MODAL */}
      {selectedCargo && (
        <Modal
          isOpen={!!selectedCargo}
          onClose={() => {
            setSelectedCargo(null);
            setCargoContainers([]);
            setSelectedContainerDetail(null);
          }}
          title={`Customs Consignment Audit: Manifest #${selectedCargo.cargo_id}`}
          maxWidth="3xl"
        >
          <div className="space-y-6">
            {/* Regulatory Summary Banner */}
            <div className="p-4 rounded-xl bg-slate-900 text-white border border-indigo-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    {selectedCargo.cargo_type_display || selectedCargo.cargo_type}
                  </span>
                  <span className="text-xs text-slate-300 font-bold">
                    {selectedCargo.cargo_description}
                  </span>
                </div>
                <div className="text-xs text-slate-400 flex items-center gap-2 font-mono">
                  <span>Carrier: {selectedCargo.arrival_request_summary?.vessel_name || 'Vessel'}</span>
                  <span>•</span>
                  <span>Declarant: {selectedCargo.arrival_request_summary?.company_name || 'Shipping Line'}</span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Declared Weight</div>
                  <div className="text-sm font-black text-emerald-400 font-mono">{selectedCargo.cargo_weight} MT</div>
                </div>
                {getCargoStatusBadge(selectedCargo.cargo_status, selectedCargo.cargo_status_display)}
              </div>
            </div>

            {/* Consignment Specification Badges */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Consignment Units</span>
                <span className="font-bold text-slate-900 dark:text-white font-mono text-sm mt-0.5 block">
                  {selectedCargo.cargo_quantity} {selectedCargo.cargo_unit}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Port of Origin</span>
                <span className="font-bold text-slate-900 dark:text-white text-xs mt-0.5 block truncate">
                  {selectedCargo.cargo_origin || 'Origin'}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Port of Discharge</span>
                <span className="font-bold text-slate-900 dark:text-white text-xs mt-0.5 block truncate">
                  {selectedCargo.cargo_destination || 'Destination'}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Voyage Arrival Req</span>
                <span className="font-bold text-indigo-600 dark:text-indigo-400 font-mono text-xs mt-0.5 block">
                  #{selectedCargo.cargo_arrival_request_id}
                </span>
              </div>
            </div>

            {/* CONTAINER BREAKDOWN SECTION */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    Manifested Containers ({cargoContainers.length})
                  </h4>
                </div>

                {onNavigateToNormalReview && cargoContainers.length > 0 && (
                  <button
                    onClick={() => {
                      setSelectedCargo(null);
                      onNavigateToNormalReview();
                    }}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 inline-flex items-center gap-1 cursor-pointer"
                  >
                    <span>Open in Normal Review</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                )}
              </div>

              {loadingContainers ? (
                <div className="p-8 text-center space-y-2 border border-slate-200 dark:border-slate-800 rounded-xl">
                  <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-xs text-slate-400 font-bold">Retrieving container manifest records...</p>
                </div>
              ) : cargoContainers.length === 0 ? (
                <div className="p-8 text-center space-y-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-800/30">
                  <Boxes className="w-8 h-8 text-slate-400 mx-auto" />
                  <p className="text-xs font-bold text-slate-600 dark:text-slate-400">
                    No individual containers manifested under this cargo record.
                  </p>
                  <p className="text-[11px] text-slate-400">
                    This consignment may be bulk cargo, or container filing has not yet been registered by the shipping line.
                  </p>
                </div>
              ) : (
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden max-h-80 overflow-y-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800 text-[10px] font-bold text-slate-500 uppercase tracking-wider sticky top-0">
                        <th className="p-3">Container No.</th>
                        <th className="p-3">Type</th>
                        <th className="p-3">Gross Weight</th>
                        <th className="p-3">Terminal Status</th>
                        <th className="p-3">Customs Status</th>
                        <th className="p-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                      {cargoContainers.map((cont) => {
                        return (
                          <tr
                            key={cont.container_id}
                            className="hover:bg-indigo-50/20 dark:hover:bg-slate-800/30 transition-colors"
                          >
                            <td className="p-3 font-mono font-bold text-slate-900 dark:text-white">
                              {cont.container_number}
                            </td>
                            <td className="p-3 text-slate-600 dark:text-slate-400 font-mono">
                              {cont.container_type}
                            </td>
                            <td className="p-3 font-mono text-emerald-600 font-bold">
                              {cont.container_gross_weight} MT
                            </td>
                            <td className="p-3">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                {cont.container_status_display || cont.container_status}
                              </span>
                            </td>
                            <td className="p-3">
                              {getContainerCustomsBadge(
                                cont.container_customs_status || 'AWAITING_CUSTOMS',
                                cont.container_customs_status_display
                              )}
                            </td>
                            <td className="p-3 text-right">
                              {onNavigateToNormalReview && (
                                <button
                                  onClick={() => {
                                    setSelectedCargo(null);
                                    onNavigateToNormalReview(cont.container_number);
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold transition-all inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <span>Inspect</span>
                                  <ArrowRight className="w-3 h-3" />
                                </button>
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

            {/* Action Bar */}
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="text-[11px] text-slate-400">
                Customs Authority Reference: Article 48 • Consignment Regulatory Log
              </div>
              <button
                onClick={() => {
                  setSelectedCargo(null);
                  setCargoContainers([]);
                  setSelectedContainerDetail(null);
                }}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all cursor-pointer"
              >
                Close Audit View
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
