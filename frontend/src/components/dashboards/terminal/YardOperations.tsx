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
  MoveHorizontal,
  BarChart3,
  Activity,
  Info
} from 'lucide-react';
import { apiFetch } from '../../../services/api';
import { useApp } from '../../../context/AppContext';
import { Modal } from '../../common/Modal';
import {
  YardOperationContainerItem,
  YardUtilizationSummary,
  YardItem,
  YardBlockItem
} from '../../../types';

export const YardOperations: React.FC = () => {
  const { addToast } = useApp();

  // Navigation Sub-tab: Simplified to Container Inventory & Capacity Utilization
  const [activeSubTab, setActiveSubTab] = useState<'inventory' | 'utilization'>('inventory');

  // Master & Operations State
  const [containers, setContainers] = useState<YardOperationContainerItem[]>([]);
  const [utilization, setUtilization] = useState<YardUtilizationSummary | null>(null);
  const [yards, setYards] = useState<YardItem[]>([]);

  // Loading States
  const [loadingContainers, setLoadingContainers] = useState<boolean>(true);
  const [loadingUtilization, setLoadingUtilization] = useState<boolean>(false);

  // Filters for Containers Inventory
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedYardFilter, setSelectedYardFilter] = useState<string>('ALL');
  const [selectedBlockFilter, setSelectedBlockFilter] = useState<string>('ALL');
  const [selectedStorageStatusFilter, setSelectedStorageStatusFilter] = useState<string>('ALL');

  // Container Detail Modal State
  const [selectedContainerDetail, setSelectedContainerDetail] = useState<YardOperationContainerItem | null>(null);

  // =========================================================================
  // DATA FETCHING & RESPONSE PARSING
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

  const fetchContainers = useCallback(async () => {
    setLoadingContainers(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.append('search', searchQuery.trim());
      if (selectedYardFilter !== 'ALL') params.append('yard_id', selectedYardFilter);
      if (selectedBlockFilter !== 'ALL') params.append('block_id', selectedBlockFilter);
      if (selectedStorageStatusFilter !== 'ALL') params.append('storage_status', selectedStorageStatusFilter);

      const url = `/api/terminal/yard-operations/containers/${params.toString() ? `?${params.toString()}` : ''}`;
      const res = await apiFetch(url);
      const data = await parseApiResponse(res);
      if (data && data.status === 'success' && Array.isArray(data.data)) {
        setContainers(data.data);
      } else {
        setContainers([]);
      }
    } catch (err: any) {
      console.error('Failed to fetch yard containers:', err);
      addToast('error', 'Fetch Error', err.message || 'Failed to fetch yard containers inventory.');
      setContainers([]);
    } finally {
      setLoadingContainers(false);
    }
  }, [searchQuery, selectedYardFilter, selectedBlockFilter, selectedStorageStatusFilter, addToast]);

  const fetchUtilization = useCallback(async () => {
    setLoadingUtilization(true);
    try {
      const res = await apiFetch('/api/terminal/yard-operations/utilization/');
      const data = await parseApiResponse(res);
      if (data && data.status === 'success' && data.data) {
        setUtilization(data.data);
      } else {
        setUtilization(null);
      }
    } catch (err: any) {
      console.error('Failed to fetch yard utilization:', err);
      addToast('error', 'Utilization Error', err.message || 'Failed to fetch capacity utilization.');
      setUtilization(null);
    } finally {
      setLoadingUtilization(false);
    }
  }, [addToast]);

  const fetchYards = useCallback(async () => {
    try {
      const res = await apiFetch('/api/terminal/yards/');
      const data = await parseApiResponse(res);
      if (data && data.status === 'success' && Array.isArray(data.data)) {
        setYards(data.data);
      }
    } catch (err) {
      console.error('Failed to load yards list:', err);
    }
  }, []);

  // Initial Data Load
  useEffect(() => {
    fetchYards();
  }, [fetchYards]);

  useEffect(() => {
    if (activeSubTab === 'inventory') {
      fetchContainers();
    } else if (activeSubTab === 'utilization') {
      fetchUtilization();
    }
  }, [activeSubTab, fetchContainers, fetchUtilization]);

  // Dependent block filtering options
  const filterBlocks: YardBlockItem[] = useMemo(() => {
    if (selectedYardFilter === 'ALL') return [];
    const targetYard = yards.find(y => String(y.yard_id) === String(selectedYardFilter));
    return targetYard?.blocks || [];
  }, [selectedYardFilter, yards]);

  // Handle yard filter change
  const handleYardFilterChange = (yardId: string) => {
    setSelectedYardFilter(yardId);
    setSelectedBlockFilter('ALL');
  };

  // Helper Badge Renderer for Container Storage Status
  const renderStorageStatusBadge = (status: string, display?: string) => {
    switch (status) {
      case 'STORED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-300/40">
            <CheckCircle className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
            <span>{display || 'Stored in Yard'}</span>
          </span>
        );
      case 'RELEASED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-300/40">
            <span>{display || 'Released'}</span>
          </span>
        );
      case 'NOT_ALLOCATED':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-300/40">
            <AlertCircle className="w-3 h-3 text-amber-600 dark:text-amber-400" />
            <span>{display || 'Unallocated'}</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">

      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-[#D49A24] flex items-center justify-center font-bold">
              <MoveHorizontal className="w-5 h-5 text-[#D49A24]" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                Yard Operations Management
              </h1>
              <span className="text-[11px] font-semibold tracking-wider uppercase text-[#D49A24] bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 rounded-md border border-amber-200/60 dark:border-amber-900/40">
                Phase T3 • Storage Positions & Capacity Intelligence
              </span>
            </div>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-3xl pt-1">
            Search container locations, inspect simple yard position codes (Y001, Y002), and monitor real-time block and yard capacity utilization.
          </p>
        </div>

        {/* REFRESH ACTION */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (activeSubTab === 'inventory') fetchContainers();
              else if (activeSubTab === 'utilization') fetchUtilization();
            }}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors shadow-xs"
            title="Refresh active view"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* NAVIGATION SUB-TABS */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 space-x-1 sm:space-x-3">
        <button
          onClick={() => setActiveSubTab('inventory')}
          className={`flex items-center gap-2 pb-3.5 px-3 sm:px-4 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer ${
            activeSubTab === 'inventory'
              ? 'border-[#D49A24] text-[#D49A24]'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <MapPin className="w-4 h-4" />
          <span>Container Locations & Search</span>
          <span className="ml-1.5 px-2 py-0.5 text-[10px] font-extrabold rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
            {containers.length}
          </span>
        </button>

        <button
          onClick={() => setActiveSubTab('utilization')}
          className={`flex items-center gap-2 pb-3.5 px-3 sm:px-4 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer ${
            activeSubTab === 'utilization'
              ? 'border-[#D49A24] text-[#D49A24]'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Yard & Block Utilization</span>
        </button>
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: CONTAINER LOCATIONS INVENTORY & SEARCH                         */}
      {/* ===================================================================== */}
      {activeSubTab === 'inventory' && (
        <div className="space-y-4">
          
          {/* SEARCH & FILTER BAR */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
              
              {/* Search by Container / Vessel / Cargo */}
              <div className="md:col-span-5 relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  id="search-yard-containers"
                  type="text"
                  placeholder="Search container number, vessel, cargo description..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-[#D49A24]"
                />
              </div>

              {/* Yard filter */}
              <div className="md:col-span-3">
                <div className="relative">
                  <Filter className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3.5 pointer-events-none" />
                  <select
                    value={selectedYardFilter}
                    onChange={(e) => handleYardFilterChange(e.target.value)}
                    className="w-full pl-8 pr-3 py-2.5 text-xs sm:text-sm rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-[#D49A24]"
                  >
                    <option value="ALL">All Yards</option>
                    {yards.map(y => (
                      <option key={y.yard_id} value={y.yard_id}>
                        {y.yard_name} ({y.yard_code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Block filter */}
              <div className="md:col-span-2">
                <select
                  value={selectedBlockFilter}
                  onChange={(e) => setSelectedBlockFilter(e.target.value)}
                  disabled={selectedYardFilter === 'ALL'}
                  className="w-full px-3 py-2.5 text-xs sm:text-sm rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-[#D49A24] disabled:opacity-50"
                >
                  <option value="ALL">All Blocks</option>
                  {filterBlocks.map(b => (
                    <option key={b.yard_block_id} value={b.yard_block_id}>
                      Block {b.yard_block_code}
                    </option>
                  ))}
                </select>
              </div>

              {/* Storage Status filter */}
              <div className="md:col-span-2">
                <select
                  value={selectedStorageStatusFilter}
                  onChange={(e) => setSelectedStorageStatusFilter(e.target.value)}
                  className="w-full px-3 py-2.5 text-xs sm:text-sm rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-[#D49A24]"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="STORED">Currently Stored</option>
                  <option value="NOT_ALLOCATED">Not Allocated</option>
                  <option value="RELEASED">Released</option>
                </select>
              </div>
            </div>
          </div>

          {/* CONTAINERS TABLE / LIST */}
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Boxes className="w-4 h-4 text-[#D49A24]" />
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  Yard Container Registry
                </h3>
                <span className="text-xs text-slate-500">
                  ({containers.length} container{containers.length === 1 ? '' : 's'})
                </span>
              </div>
            </div>

            {loadingContainers ? (
              <div className="p-12 text-center space-y-3">
                <div className="w-8 h-8 mx-auto border-3 border-[#D49A24] border-t-transparent rounded-full animate-spin" />
                <p className="text-xs text-slate-500 font-medium">Loading container locations...</p>
              </div>
            ) : containers.length === 0 ? (
              <div className="p-12 text-center space-y-2">
                <MapPin className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
                <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">No Containers Found</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  No container matching current filters was found in the inventory registry.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
                  <thead className="bg-slate-50/80 dark:bg-slate-800/50 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Container</th>
                      <th className="py-3 px-4">Storage Status</th>
                      <th className="py-3 px-4">Simple Yard Position</th>
                      <th className="py-3 px-4">Coordinates (R/B/T)</th>
                      <th className="py-3 px-4">Vessel / Cargo</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-normal">
                    {containers.map((c) => {
                      const hasActiveAlloc = c.storage_status === 'STORED' && !!c.current_location;
                      const simpleCode = c.current_location?.simple_code || (c.current_location?.slot_id ? `Y${String(c.current_location.slot_id).padStart(3, '0')}` : null);

                      return (
                        <tr
                          key={c.container_id}
                          id={`container-location-result-${c.container_id}`}
                          className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          {/* Container Number & Type */}
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                              <span className="font-mono">{c.container_number}</span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold">
                                {c.container_type}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                              {c.container_gross_weight} MT • {c.container_status}
                            </div>
                          </td>

                          {/* Storage Status */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            {renderStorageStatusBadge(c.storage_status, c.storage_status_display)}
                          </td>

                          {/* Simple Yard Position Code */}
                          <td className="py-3.5 px-4">
                            {hasActiveAlloc && c.current_location ? (
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-1.5">
                                  <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-black bg-amber-500 text-slate-950 border border-amber-400 shadow-xs">
                                    {simpleCode || 'ALLOCATED'}
                                  </span>
                                  <span className="font-bold text-slate-700 dark:text-slate-300 text-xs">
                                    {c.current_location.yard_code}
                                  </span>
                                </div>
                                <div className="text-[11px] text-slate-400 font-mono">
                                  Block {c.current_location.block_code} • {c.current_location.slot_code}
                                </div>
                              </div>
                            ) : (
                              <span className="italic text-slate-400">Not allocated</span>
                            )}
                          </td>

                          {/* Coordinates: Row, Bay, Tier */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            {hasActiveAlloc && c.current_location ? (
                              <div className="flex items-center gap-1.5 text-xs font-mono">
                                <span className="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                  R:{c.current_location.slot_row}
                                </span>
                                <span className="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                  B:{c.current_location.slot_bay}
                                </span>
                                <span className="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                  T:{c.current_location.slot_tier}
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>

                          {/* Vessel / Cargo */}
                          <td className="py-3.5 px-4">
                            <div className="font-medium text-slate-800 dark:text-slate-200 truncate max-w-[180px]">
                              {c.vessel_name}
                            </div>
                            <div className="text-[11px] text-slate-400 truncate max-w-[180px]">
                              {c.cargo_description || 'General Cargo'}
                            </div>
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <button
                              id={`view-container-detail-btn-${c.container_id}`}
                              onClick={() => setSelectedContainerDetail(c)}
                              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors shadow-xs"
                            >
                              View Details
                            </button>
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

      {/* ===================================================================== */}
      {/* TAB 2: YARD & BLOCK CAPACITY UTILIZATION                              */}
      {/* ===================================================================== */}
      {activeSubTab === 'utilization' && (
        <div className="space-y-6">
          {loadingUtilization ? (
            <div className="p-16 text-center space-y-3">
              <div className="w-8 h-8 mx-auto border-3 border-[#D49A24] border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-slate-500 font-medium">Computing yard & block utilization metrics...</p>
            </div>
          ) : !utilization ? (
            <div className="p-12 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
              <AlertCircle className="w-10 h-10 text-slate-400 mx-auto" />
              <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">Utilization Data Unavailable</h4>
              <p className="text-xs text-slate-400">Unable to load aggregate capacity metrics from the terminal engine.</p>
            </div>
          ) : (
            <>
              {/* TOP METRIC CARDS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                
                {/* Total Capacity */}
                <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
                  <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                    <span>Total Yard Capacity</span>
                    <Warehouse className="w-4 h-4 text-[#D49A24]" />
                  </div>
                  <div className="text-2xl font-black text-slate-900 dark:text-white">
                    {utilization.overall.total_capacity} <span className="text-xs font-semibold text-slate-400">Slots</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Across {utilization.overall.total_yards} active terminal storage yards
                  </p>
                </div>

                {/* Total Occupied */}
                <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
                  <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                    <span>Occupied Slots</span>
                    <Boxes className="w-4 h-4 text-blue-500" />
                  </div>
                  <div className="text-2xl font-black text-slate-900 dark:text-white">
                    {utilization.overall.total_occupied} <span className="text-xs font-semibold text-slate-400">Containers</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Currently positioned in storage coordinates
                  </p>
                </div>

                {/* Total Available */}
                <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
                  <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                    <span>Available Capacity</span>
                    <CheckCircle className="w-4 h-4 text-emerald-500" />
                  </div>
                  <div className="text-2xl font-black text-slate-900 dark:text-white">
                    {utilization.overall.total_available} <span className="text-xs font-semibold text-slate-400">Free Slots</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Ready for incoming container receiving
                  </p>
                </div>

                {/* Overall Occupancy % */}
                <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
                  <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                    <span>Terminal Occupancy</span>
                    <Activity className="w-4 h-4 text-[#D49A24]" />
                  </div>
                  <div className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <span>{utilization.overall.occupancy_percentage}%</span>
                    <span className={`text-xs px-2 py-0.5 rounded-md font-bold ${
                      utilization.overall.occupancy_percentage >= 90
                        ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400'
                        : utilization.overall.occupancy_percentage >= 75
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400'
                        : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400'
                    }`}>
                      {utilization.overall.occupancy_percentage >= 90 ? 'Critical' : utilization.overall.occupancy_percentage >= 75 ? 'Moderate' : 'Optimal'}
                    </span>
                  </div>
                  {/* Progress bar */}
                  <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 mt-2 overflow-hidden">
                    <div
                      className={`h-2 rounded-full transition-all duration-500 ${
                        utilization.overall.occupancy_percentage >= 90 ? 'bg-rose-500' : utilization.overall.occupancy_percentage >= 75 ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min(100, utilization.overall.occupancy_percentage)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* DETAILED YARD & BLOCK BREAKDOWN */}
              <div className="space-y-4">
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Warehouse className="w-4 h-4 text-[#D49A24]" />
                  <span>Individual Yard & Block Capacities</span>
                </h3>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {utilization.yards.map((yard) => (
                    <div
                      key={yard.yard_id}
                      className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4"
                    >
                      {/* Yard Header */}
                      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-black text-[#D49A24] bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 rounded border border-amber-200/50 dark:border-amber-900/40">
                              {yard.yard_code}
                            </span>
                            <h4 className="font-bold text-base text-slate-900 dark:text-white">
                              {yard.yard_name}
                            </h4>
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {yard.yard_type_display} • Status: {yard.yard_status}
                          </p>
                        </div>

                        <div className="text-right">
                          <div className="text-sm font-black text-slate-900 dark:text-white">
                            {yard.yard_occupied} / {yard.yard_capacity}
                          </div>
                          <div className="text-[11px] text-slate-400 font-semibold">
                            {yard.occupancy_percentage}% Occupied
                          </div>
                        </div>
                      </div>

                      {/* Yard Progress Gauge */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs text-slate-500 font-medium">
                          <span>Capacity Utilization</span>
                          <span>{yard.available_capacity} Slots Available</span>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden">
                          <div
                            className={`h-2.5 rounded-full transition-all duration-500 ${
                              yard.occupancy_percentage >= 90 ? 'bg-rose-500' : yard.occupancy_percentage >= 75 ? 'bg-amber-500' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${Math.min(100, yard.occupancy_percentage)}%` }}
                          />
                        </div>
                      </div>

                      {/* Blocks Sub-list */}
                      <div className="space-y-2 pt-2">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                          Constituent Blocks ({yard.blocks.length})
                        </div>

                        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                          {yard.blocks.map((block) => (
                            <div
                              key={block.block_id}
                              className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/50 space-y-2"
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                                    <span className="font-mono text-[#D49A24]">Block {block.block_code}</span>
                                    <span className="text-[10px] text-slate-400 font-normal">({block.block_type_display})</span>
                                  </div>
                                </div>
                                <div className="text-right font-mono text-xs">
                                  <span className="font-bold text-slate-900 dark:text-white">{block.block_occupied}</span>
                                  <span className="text-slate-400">/{block.block_capacity}</span>
                                  <span className="ml-2 text-[11px] font-semibold text-slate-500">({block.occupancy_percentage}%)</span>
                                </div>
                              </div>

                              <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
                                <div
                                  className={`h-1.5 rounded-full transition-all duration-500 ${
                                    block.occupancy_percentage >= 90 ? 'bg-rose-500' : block.occupancy_percentage >= 75 ? 'bg-amber-500' : 'bg-emerald-500'
                                  }`}
                                  style={{ width: `${Math.min(100, block.occupancy_percentage)}%` }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL: CONTAINER LOCATION DETAILS                                     */}
      {/* ===================================================================== */}
      <Modal
        isOpen={!!selectedContainerDetail}
        onClose={() => setSelectedContainerDetail(null)}
        title={
          <div className="flex items-center gap-2">
            <Info className="w-5 h-5 text-[#D49A24]" />
            <span>Container Location & Details</span>
          </div>
        }
        subtitle={selectedContainerDetail?.container_number}
        maxWidth="lg"
      >
        {selectedContainerDetail && (
          <div className="space-y-4 py-2 text-xs text-slate-600 dark:text-slate-300">
            <div className="grid grid-cols-2 gap-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60">
              <div>
                <span className="text-slate-400">Container Type:</span>
                <p className="font-bold text-slate-800 dark:text-white">{selectedContainerDetail.container_type}</p>
              </div>
              <div>
                <span className="text-slate-400">Gross Weight:</span>
                <p className="font-bold text-slate-800 dark:text-white">{selectedContainerDetail.container_gross_weight} MT</p>
              </div>
              <div>
                <span className="text-slate-400">Core Status:</span>
                <p className="font-bold text-slate-800 dark:text-white">{selectedContainerDetail.container_status}</p>
              </div>
              <div>
                <span className="text-slate-400">Storage Status:</span>
                <div className="mt-1">{renderStorageStatusBadge(selectedContainerDetail.storage_status, selectedContainerDetail.storage_status_display)}</div>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
              <h5 className="font-bold text-slate-900 dark:text-white">Active Yard Placement</h5>
              {selectedContainerDetail.current_location ? (
                <div className="space-y-2 font-mono">
                  <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-900/40 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase text-amber-700 dark:text-amber-400 tracking-wider">Simple Yard Position Code</span>
                      <p className="text-lg font-black text-[#D49A24]">
                        {selectedContainerDetail.current_location.simple_code || `Y${String(selectedContainerDetail.current_location.slot_id).padStart(3, '0')}`}
                      </p>
                    </div>
                    <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                      {selectedContainerDetail.current_location.slot_code}
                    </span>
                  </div>
                  <p><strong>Yard:</strong> {selectedContainerDetail.current_location.yard_name} ({selectedContainerDetail.current_location.yard_code})</p>
                  <p><strong>Block:</strong> {selectedContainerDetail.current_location.block_name} ({selectedContainerDetail.current_location.block_code})</p>
                  <p><strong>Coordinates:</strong> Row {selectedContainerDetail.current_location.slot_row}, Bay {selectedContainerDetail.current_location.slot_bay}, Tier {selectedContainerDetail.current_location.slot_tier}</p>
                  <p><strong>Allocated At:</strong> {selectedContainerDetail.current_location.allocated_at ? new Date(selectedContainerDetail.current_location.allocated_at).toLocaleString() : 'N/A'}</p>
                  <p><strong>Operator:</strong> {selectedContainerDetail.current_location.allocated_by_name || 'Terminal Operator'}</p>
                </div>
              ) : (
                <p className="italic text-slate-400">Container currently has no active storage slot allocated.</p>
              )}
            </div>
          </div>
        )}
      </Modal>

    </div>
  );
};
