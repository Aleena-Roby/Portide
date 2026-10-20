import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { Modal } from './Modal';
import { API_BASE_URL } from '../../services/api';
import { BackendCargo } from '../../types';
import { 
  Boxes, 
  Search, 
  RefreshCw, 
  Eye, 
  Ship, 
  MapPin, 
  ArrowRight,
  PackageCheck,
  Scale,
  CheckCircle2,
  ShieldCheck,
  Info
} from 'lucide-react';
import { ContainerManagementModal } from '../dashboards/shipping/ContainerManagementModal';

interface ReadOnlyCargoDirectoryProps {
  title?: string;
  subtitle?: string;
  roleBadgeText?: string;
}

const ITEMS_PER_PAGE = 10;

export const ReadOnlyCargoDirectory: React.FC<ReadOnlyCargoDirectoryProps> = ({
  title = 'Cargo Operations Directory',
  subtitle = 'Operational review and tracking of vessel freight consignments',
  roleBadgeText = 'Operational Cargo Oversight'
}) => {
  const { currentUser } = useApp();

  const [cargoes, setCargoes] = useState<BackendCargo[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [selectedCargoDetail, setSelectedCargoDetail] = useState<BackendCargo | null>(null);

  // Container Management Modal State
  const [selectedCargoForContainers, setSelectedCargoForContainers] = useState<BackendCargo | null>(null);
  const [isContainerModalOpen, setIsContainerModalOpen] = useState<boolean>(false);

  const fetchCargoes = async () => {
    setLoading(true);
    setError('');
    try {
      const headers = {
        'X-User-Email': currentUser?.email || '',
        'X-User-Role': currentUser?.role || '',
        'X-User-Id': currentUser?.id || ''
      };

      const response = await fetch(`${API_BASE_URL}/api/cargo/`, { headers });
      const json = await response.json();

      if (response.ok && json.status === 'success') {
        setCargoes(json.data || []);
      } else {
        setError(json.message || 'Failed to load cargo directory.');
      }
    } catch (err) {
      setError('Unable to connect to backend server. Please verify Django is running.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCargoes();
  }, [currentUser?.email]);

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

  const filteredCargoes = useMemo(() => {
    return cargoes.filter(c => {
      const matchesStatus = statusFilter === 'all' || c.cargo_status === statusFilter;
      const matchesType = typeFilter === 'all' || c.cargo_type === typeFilter;
      
      const q = searchQuery.toLowerCase().trim();
      const desc = (c.cargo_description || '').toLowerCase();
      const origin = (c.cargo_origin || '').toLowerCase();
      const dest = (c.cargo_destination || '').toLowerCase();
      const vessel = (c.arrival_request_summary?.vessel_name || '').toLowerCase();
      const imo = (c.arrival_request_summary?.vessel_imo_number || '').toLowerCase();
      const company = (c.arrival_request_summary?.company_name || '').toLowerCase();
      const cargoId = `crg-00${c.cargo_id}`.toLowerCase();
      const reqId = `ar-00${c.cargo_arrival_request_id}`.toLowerCase();

      const matchesQuery = !q || 
        desc.includes(q) || 
        origin.includes(q) || 
        dest.includes(q) || 
        vessel.includes(q) || 
        imo.includes(q) || 
        company.includes(q) ||
        cargoId.includes(q) || 
        reqId.includes(q);

      return matchesStatus && matchesType && matchesQuery;
    });
  }, [cargoes, statusFilter, typeFilter, searchQuery]);

  const totalPages = Math.ceil(filteredCargoes.length / ITEMS_PER_PAGE) || 1;
  const paginatedCargoes = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredCargoes.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredCargoes, currentPage]);

  const containerizedCount = cargoes.filter(c => c.cargo_type === 'CONTAINERIZED').length;
  const generalCount = cargoes.filter(c => c.cargo_type === 'GENERAL_CARGO').length;
  const bulkCount = cargoes.filter(c => c.cargo_type === 'BULK_CARGO').length;

  return (
    <div className="space-y-6 font-sans selection:bg-[#D49A24] selection:text-white animate-fade-in">
      
      {/* HEADER BANNER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400 mb-1">
            <Boxes className="w-4 h-4" />
            <span>{roleBadgeText}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            {title}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">
            {subtitle}
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
            <span className="hidden sm:inline">Sync Directory</span>
          </button>
        </div>
      </div>

      {/* METRICS CARDS */}
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
          <div className="text-[11px] font-medium text-slate-500">Total Manifest Consignments</div>
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

      {/* FILTER & SEARCH */}
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
            Registered ({cargoes.filter(c => c.cargo_status === 'REGISTERED').length})
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

      {/* CARGO TABLE */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-12 text-center space-y-3">
            <RefreshCw className="w-8 h-8 mx-auto text-[#D49A24] animate-spin" />
            <p className="text-xs font-bold text-slate-600 dark:text-slate-400">Loading cargo directory from PostgreSQL...</p>
          </div>
        ) : filteredCargoes.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Boxes className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-700" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">No cargo records found.</h3>
            <p className="text-xs text-slate-500">No records match your search query or filter selection.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-black uppercase tracking-wider text-[11px]">
                  <th className="p-4">CARGO ID</th>
                  <th className="p-4">VESSEL & OPERATOR</th>
                  <th className="p-4">DESCRIPTION & TYPE</th>
                  <th className="p-4">QUANTITY</th>
                  <th className="p-4">GROSS WEIGHT</th>
                  <th className="p-4">ROUTE</th>
                  <th className="p-4">STATUS</th>
                  <th className="p-4 text-right">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium text-slate-700 dark:text-slate-300">
                {paginatedCargoes.map((cargo) => {
                  const summary = cargo.arrival_request_summary;

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
                          Req: AR-00{cargo.cargo_arrival_request_id} • {summary?.company_name || 'Line'}
                        </div>
                      </td>

                      <td className="p-4">
                        <div className="font-bold text-slate-900 dark:text-white truncate max-w-xs group-hover:text-[#D49A24] transition-colors" title={cargo.cargo_description}>
                          {cargo.cargo_description}
                        </div>
                        <div className="text-[10px] text-slate-500 font-medium mt-0.5">
                          {cargo.cargo_type_display || cargo.cargo_type}
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

                      <td className="p-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        {cargo.cargo_type === 'CONTAINERIZED' ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedCargoForContainers(cargo);
                              setIsContainerModalOpen(true);
                            }}
                            className="p-2 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 transition-colors cursor-pointer inline-flex items-center gap-1.5 text-xs font-bold mr-1.5"
                            title="Inspect Containers"
                          >
                            <Boxes className="w-4 h-4" />
                            <span className="hidden xl:inline">Containers</span>
                          </button>
                        ) : (
                          <button
                            disabled
                            className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-300 dark:text-slate-600 cursor-not-allowed inline-flex items-center gap-1.5 text-xs font-bold mr-1.5"
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
                          title="View Specifications"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* PAGINATION */}
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

      {/* VIEW CARGO MODAL */}
      <Modal
        isOpen={!!selectedCargoDetail}
        onClose={() => setSelectedCargoDetail(null)}
        title={`Cargo Details #CRG-00${selectedCargoDetail?.cargo_id}`}
        subtitle={selectedCargoDetail?.cargo_description}
        icon={<Boxes className="w-4 h-4 text-sky-600" />}
        maxWidth="2xl"
      >
        {selectedCargoDetail && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Associated Vessel Arrival</span>
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
                  <span className="text-[9px] uppercase font-bold text-slate-400 block">Shipping Line</span>
                  <span className="font-bold text-slate-900 dark:text-white block mt-0.5">
                    {selectedCargoDetail.arrival_request_summary?.company_name || '—'}
                  </span>
                  <span className="text-[10px] font-mono text-sky-600 block">
                    Request #AR-00{selectedCargoDetail.cargo_arrival_request_id}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Classification</span>
                <div className="font-bold text-slate-900 dark:text-white mt-1">
                  {selectedCargoDetail.cargo_type_display || selectedCargoDetail.cargo_type}
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
                  {formatDate(selectedCargoDetail.cargo_created_at)}
                </div>
              </div>
            </div>

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
                      Container Manifest & Tracking Available
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      Review registered containers, sizing breakdown, and real-time terminal status.
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
                  <span>Inspect Containers</span>
                </button>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <Info className="w-4 h-4 text-slate-400 shrink-0" />
                <span>Containers can only be registered for containerized cargo.</span>
              </div>
            )}

            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end">
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
