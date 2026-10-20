import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Warehouse,
  Boxes,
  Plus,
  Search,
  Filter,
  RefreshCw,
  Eye,
  Edit2,
  Power,
  Trash2,
  X,
  AlertCircle,
  CheckCircle,
  Layers,
  Grid,
  ChevronRight,
  TrendingUp,
  ShieldCheck,
  Building2,
  ArrowUpDown,
  Info
} from 'lucide-react';
import { apiFetch } from '../../../services/api';
import { useApp } from '../../../context/AppContext';
import {
  YardItem,
  YardBlockItem,
  YardSlotItem,
  YardType,
  YardStatus,
  BlockType,
  BlockStatus,
  SlotStatus
} from '../../../types';

export const YardMaster: React.FC = () => {
  const { addToast } = useApp();

  // Master State
  const [yards, setYards] = useState<YardItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');

  // Drilldown Selected States
  const [selectedYard, setSelectedYard] = useState<YardItem | null>(null);
  const [selectedBlock, setSelectedBlock] = useState<YardBlockItem | null>(null);
  const [yardBlocks, setYardBlocks] = useState<YardBlockItem[]>([]);
  const [blockSlots, setBlockSlots] = useState<YardSlotItem[]>([]);
  const [loadingDetails, setLoadingDetails] = useState<boolean>(false);
  const [loadingSlots, setLoadingSlots] = useState<boolean>(false);

  // Modals
  const [isYardModalOpen, setIsYardModalOpen] = useState<boolean>(false);
  const [editingYard, setEditingYard] = useState<YardItem | null>(null);

  const [isBlockModalOpen, setIsBlockModalOpen] = useState<boolean>(false);
  const [editingBlock, setEditingBlock] = useState<YardBlockItem | null>(null);

  const [isSlotModalOpen, setIsSlotModalOpen] = useState<boolean>(false);
  const [editingSlot, setEditingSlot] = useState<YardSlotItem | null>(null);

  // Form States & Errors
  const [yardForm, setYardForm] = useState({
    yard_name: '',
    yard_code: '',
    yard_type: 'CONTAINER_YARD' as YardType,
    yard_capacity: 200,
    yard_occupied: 0,
    yard_status: 'ACTIVE' as YardStatus
  });

  const [blockForm, setBlockForm] = useState({
    yard_block_name: '',
    yard_block_code: '',
    yard_block_type: 'STANDARD' as BlockType,
    yard_block_capacity: 50,
    yard_block_occupied: 0,
    yard_block_status: 'ACTIVE' as BlockStatus
  });

  const [slotForm, setSlotForm] = useState({
    yard_slot_code: '',
    yard_slot_row: 1,
    yard_slot_bay: 1,
    yard_slot_tier: 1,
    yard_slot_status: 'AVAILABLE' as SlotStatus
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // ============================================================================
  // DATA FETCHING
  // ============================================================================

  const fetchYards = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.append('search', searchQuery.trim());
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      if (typeFilter !== 'ALL') params.append('type', typeFilter);

      const endpoint = `/api/terminal/yards/?${params.toString()}`;
      const response = await apiFetch(endpoint);
      if (!response.ok) {
        throw new Error(`Failed to load yards (${response.status})`);
      }
      const result = await response.json();
      if (result.status === 'success') {
        setYards(result.data || []);
      }
    } catch (err: any) {
      addToast('error', 'Yard Master', err.message || 'Error loading yards.');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, statusFilter, typeFilter, addToast]);

  useEffect(() => {
    fetchYards();
  }, [fetchYards]);

  // Load Details for Selected Yard
  const loadYardDetails = async (yardId: number) => {
    try {
      setLoadingDetails(true);
      const response = await apiFetch(`/api/terminal/yards/${yardId}/`);
      if (!response.ok) throw new Error('Failed to load yard details.');
      const res = await response.json();
      if (res.status === 'success') {
        setSelectedYard(res.data);
        setYardBlocks(res.data.blocks || []);
        // Reset block view
        setSelectedBlock(null);
        setBlockSlots([]);
      }
    } catch (err: any) {
      addToast('error', 'Yard Details', err.message || 'Error loading details.');
    } finally {
      setLoadingDetails(false);
    }
  };

  // Load Slots for Selected Block
  const loadBlockSlots = async (blockId: number) => {
    try {
      setLoadingSlots(true);
      const response = await apiFetch(`/api/terminal/blocks/${blockId}/`);
      if (!response.ok) throw new Error('Failed to load block slots.');
      const res = await response.json();
      if (res.status === 'success') {
        setSelectedBlock(res.data);
        setBlockSlots(res.data.slots || []);
      }
    } catch (err: any) {
      addToast('error', 'Block Slots', err.message || 'Error loading slots.');
    } finally {
      setLoadingSlots(false);
    }
  };

  // ============================================================================
  // SUMMARY METRICS
  // ============================================================================

  const metrics = useMemo(() => {
    const totalYards = yards.length;
    const totalCapacity = yards.reduce((acc, y) => acc + (y.yard_capacity || 0), 0);
    const totalOccupied = yards.reduce((acc, y) => acc + (y.yard_occupied || 0), 0);
    const totalAvailable = Math.max(0, totalCapacity - totalOccupied);
    const overallOccupancyPct = totalCapacity > 0 ? Number(((totalOccupied / totalCapacity) * 100).toFixed(1)) : 0;
    const activeYardsCount = yards.filter(y => y.yard_status === 'ACTIVE').length;

    return {
      totalYards,
      activeYardsCount,
      totalCapacity,
      totalOccupied,
      totalAvailable,
      overallOccupancyPct
    };
  }, [yards]);

  // ============================================================================
  // YARD CRUD ACTIONS
  // ============================================================================

  const openAddYardModal = () => {
    setEditingYard(null);
    setYardForm({
      yard_name: '',
      yard_code: '',
      yard_type: 'CONTAINER_YARD',
      yard_capacity: 200,
      yard_occupied: 0,
      yard_status: 'ACTIVE'
    });
    setFormErrors({});
    setIsYardModalOpen(true);
  };

  const openEditYardModal = (yard: YardItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingYard(yard);
    setYardForm({
      yard_name: yard.yard_name,
      yard_code: yard.yard_code,
      yard_type: yard.yard_type,
      yard_capacity: yard.yard_capacity,
      yard_occupied: yard.yard_occupied,
      yard_status: yard.yard_status
    });
    setFormErrors({});
    setIsYardModalOpen(true);
  };

  const handleSaveYard = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({});

    // Client-side validations
    const errors: Record<string, string> = {};
    if (!yardForm.yard_name.trim()) errors.yard_name = 'Yard name is required.';
    if (!yardForm.yard_code.trim()) errors.yard_code = 'Yard code is required.';
    if (yardForm.yard_capacity <= 0) errors.yard_capacity = 'Total capacity must be greater than 0.';
    if (yardForm.yard_occupied < 0) errors.yard_occupied = 'Occupied capacity cannot be negative.';
    if (yardForm.yard_occupied > yardForm.yard_capacity) {
      errors.yard_occupied = `Occupied capacity cannot exceed total capacity (${yardForm.yard_capacity}).`;
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setIsSubmitting(true);
    try {
      const isEdit = !!editingYard;
      const endpoint = isEdit ? `/api/terminal/yards/${editingYard.yard_id}/` : '/api/terminal/yards/';
      const method = isEdit ? 'PATCH' : 'POST';

      const response = await apiFetch(endpoint, {
        method,
        body: JSON.stringify(yardForm)
      });

      const res = await response.json();
      if (!response.ok || res.status === 'error') {
        if (res.errors) {
          const backendErrors: Record<string, string> = {};
          Object.keys(res.errors).forEach(key => {
            backendErrors[key] = Array.isArray(res.errors[key]) ? res.errors[key][0] : res.errors[key];
          });
          setFormErrors(backendErrors);
        }
        throw new Error(res.message || 'Failed to save yard.');
      }

      addToast('success', 'Yard Master', isEdit ? 'Yard updated successfully.' : 'Yard created successfully.');
      setIsYardModalOpen(false);
      fetchYards();
      if (selectedYard && editingYard && selectedYard.yard_id === editingYard.yard_id) {
        loadYardDetails(editingYard.yard_id);
      }
    } catch (err: any) {
      addToast('error', 'Yard Master', err.message || 'Operation failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleYardStatus = async (yard: YardItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const response = await apiFetch(`/api/terminal/yards/${yard.yard_id}/toggle-status/`, {
        method: 'POST'
      });
      const res = await response.json();
      if (!response.ok || res.status === 'error') {
        throw new Error(res.message || 'Failed to toggle status.');
      }
      addToast('success', 'Yard Master', `Yard ${yard.yard_code} status updated.`);
      fetchYards();
      if (selectedYard && selectedYard.yard_id === yard.yard_id) {
        loadYardDetails(yard.yard_id);
      }
    } catch (err: any) {
      addToast('error', 'Status Error', err.message);
    }
  };

  // ============================================================================
  // YARD BLOCK CRUD ACTIONS
  // ============================================================================

  const openAddBlockModal = () => {
    if (!selectedYard) return;
    setEditingBlock(null);
    setBlockForm({
      yard_block_name: '',
      yard_block_code: '',
      yard_block_type: 'STANDARD',
      yard_block_capacity: 50,
      yard_block_occupied: 0,
      yard_block_status: 'ACTIVE'
    });
    setFormErrors({});
    setIsBlockModalOpen(true);
  };

  const openEditBlockModal = (block: YardBlockItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingBlock(block);
    setBlockForm({
      yard_block_name: block.yard_block_name,
      yard_block_code: block.yard_block_code,
      yard_block_type: block.yard_block_type,
      yard_block_capacity: block.yard_block_capacity,
      yard_block_occupied: block.yard_block_occupied,
      yard_block_status: block.yard_block_status
    });
    setFormErrors({});
    setIsBlockModalOpen(true);
  };

  const handleSaveBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedYard) return;
    setFormErrors({});

    const errors: Record<string, string> = {};
    if (!blockForm.yard_block_name.trim()) errors.yard_block_name = 'Block name is required.';
    if (!blockForm.yard_block_code.trim()) errors.yard_block_code = 'Block code is required.';
    if (blockForm.yard_block_capacity <= 0) errors.yard_block_capacity = 'Block capacity must be greater than 0.';
    if (blockForm.yard_block_occupied < 0) errors.yard_block_occupied = 'Occupied capacity cannot be negative.';
    if (blockForm.yard_block_occupied > blockForm.yard_block_capacity) {
      errors.yard_block_occupied = `Occupied cannot exceed block capacity (${blockForm.yard_block_capacity}).`;
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setIsSubmitting(true);
    try {
      const isEdit = !!editingBlock;
      const endpoint = isEdit
        ? `/api/terminal/blocks/${editingBlock.yard_block_id}/`
        : `/api/terminal/yards/${selectedYard.yard_id}/blocks/`;
      const method = isEdit ? 'PATCH' : 'POST';

      const response = await apiFetch(endpoint, {
        method,
        body: JSON.stringify(blockForm)
      });

      const res = await response.json();
      if (!response.ok || res.status === 'error') {
        if (res.errors) {
          const backendErrors: Record<string, string> = {};
          Object.keys(res.errors).forEach(key => {
            backendErrors[key] = Array.isArray(res.errors[key]) ? res.errors[key][0] : res.errors[key];
          });
          setFormErrors(backendErrors);
        }
        throw new Error(res.message || 'Failed to save block.');
      }

      addToast('success', 'Yard Block', isEdit ? 'Block updated successfully.' : 'Block created successfully.');
      setIsBlockModalOpen(false);
      loadYardDetails(selectedYard.yard_id);
      fetchYards();
    } catch (err: any) {
      addToast('error', 'Yard Block', err.message || 'Operation failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleBlockStatus = async (block: YardBlockItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const response = await apiFetch(`/api/terminal/blocks/${block.yard_block_id}/toggle-status/`, {
        method: 'POST'
      });
      const res = await response.json();
      if (!response.ok || res.status === 'error') throw new Error(res.message || 'Failed to toggle status.');
      addToast('success', 'Yard Block', `Block ${block.yard_block_code} status updated.`);
      if (selectedYard) loadYardDetails(selectedYard.yard_id);
    } catch (err: any) {
      addToast('error', 'Status Error', err.message);
    }
  };

  // ============================================================================
  // YARD SLOT CRUD ACTIONS
  // ============================================================================

  const openAddSlotModal = () => {
    if (!selectedBlock) return;
    setEditingSlot(null);
    setSlotForm({
      yard_slot_code: '',
      yard_slot_row: 1,
      yard_slot_bay: 1,
      yard_slot_tier: 1,
      yard_slot_status: 'AVAILABLE'
    });
    setFormErrors({});
    setIsSlotModalOpen(true);
  };

  const openEditSlotModal = (slot: YardSlotItem) => {
    setEditingSlot(slot);
    setSlotForm({
      yard_slot_code: slot.yard_slot_code,
      yard_slot_row: slot.yard_slot_row,
      yard_slot_bay: slot.yard_slot_bay,
      yard_slot_tier: slot.yard_slot_tier,
      yard_slot_status: slot.yard_slot_status
    });
    setFormErrors({});
    setIsSlotModalOpen(true);
  };

  const handleSaveSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBlock || isSubmitting) return;
    setFormErrors({});

    const errors: Record<string, string> = {};
    if (slotForm.yard_slot_row <= 0) errors.yard_slot_row = 'Row must be a positive integer.';
    if (slotForm.yard_slot_bay <= 0) errors.yard_slot_bay = 'Bay must be a positive integer.';
    if (slotForm.yard_slot_tier <= 0) errors.yard_slot_tier = 'Tier must be a positive integer.';

    if (editingSlot && editingSlot.yard_slot_status === 'OCCUPIED' && slotForm.yard_slot_status !== 'OCCUPIED') {
      errors.yard_slot_status = 'Cannot change status of an occupied slot while an active container allocation exists.';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setIsSubmitting(true);
    try {
      const isEdit = !!editingSlot;
      const endpoint = isEdit
        ? `/api/terminal/slots/${editingSlot.yard_slot_id}/`
        : `/api/terminal/blocks/${selectedBlock.yard_block_id}/slots/`;
      const method = isEdit ? 'PATCH' : 'POST';

      const response = await apiFetch(endpoint, {
        method,
        body: JSON.stringify(slotForm)
      });

      const res = await response.json();
      if (!response.ok || res.status === 'error') {
        if (res.errors) {
          const backendErrors: Record<string, string> = {};
          Object.keys(res.errors).forEach(key => {
            backendErrors[key] = Array.isArray(res.errors[key]) ? res.errors[key][0] : res.errors[key];
          });
          setFormErrors(backendErrors);
        }
        throw new Error(res.message || 'Failed to save slot.');
      }

      addToast('success', 'Yard Slot', isEdit ? 'Slot updated successfully.' : 'Slot created successfully.');
      setIsSlotModalOpen(false);
      loadBlockSlots(selectedBlock.yard_block_id);
    } catch (err: any) {
      addToast('error', 'Yard Slot', err.message || 'Operation failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleSlotStatus = async (slot: YardSlotItem, targetStatus?: SlotStatus) => {
    if (slot.yard_slot_status === 'OCCUPIED') {
      addToast('error', 'Occupancy Conflict', 'Cannot toggle status of an occupied slot while an active container allocation exists.');
      return;
    }
    try {
      const newStatus = targetStatus || (slot.yard_slot_status === 'AVAILABLE' ? 'BLOCKED' : 'AVAILABLE');
      const response = await apiFetch(`/api/terminal/slots/${slot.yard_slot_id}/toggle-status/`, {
        method: 'POST',
        body: JSON.stringify({ yard_slot_status: newStatus })
      });
      const res = await response.json();
      if (!response.ok || res.status === 'error') throw new Error(res.message || 'Failed to update status.');
      addToast('success', 'Yard Slot', `Slot ${slot.yard_slot_code} marked as ${newStatus}.`);
      if (selectedBlock) loadBlockSlots(selectedBlock.yard_block_id);
    } catch (err: any) {
      addToast('error', 'Status Error', err.message);
    }
  };

  // Helper for Occupancy colors
  const getOccupancyBadgeColor = (pct: number) => {
    if (pct >= 90) return 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/50';
    if (pct >= 70) return 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/50';
    return 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/50';
  };

  const getSlotStatusBadge = (status: SlotStatus) => {
    switch (status) {
      case 'AVAILABLE':
        return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">Available</span>;
      case 'OCCUPIED':
        return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800">Occupied</span>;
      case 'RESERVED':
        return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">Reserved</span>;
      case 'BLOCKED':
        return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800">Blocked</span>;
      case 'INACTIVE':
      default:
        return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700">Inactive</span>;
    }
  };

  return (
    <div id="yard-master-container" className="space-y-6 font-sans selection:bg-[#D49A24] selection:text-white animate-fade-in pb-12">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Warehouse className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                Yard Master Management
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                Physical Yard, Block & Slot Hierarchy with Capacity & Occupancy Tracking
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            id="yard-refresh-btn"
            onClick={fetchYards}
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
            title="Refresh yards"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            id="add-yard-btn"
            onClick={openAddYardModal}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-sm shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            Add Yard
          </button>
        </div>
      </div>

      {/* METRIC CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Total Yards</span>
            <Building2 className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            {metrics.totalYards}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {metrics.activeYardsCount} Active Operational
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Total Capacity</span>
            <Boxes className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            {metrics.totalCapacity.toLocaleString()} TEU
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Master-Level Terminal Limit
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Available Capacity</span>
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
            {metrics.totalAvailable.toLocaleString()} TEU
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Unallocated Storage Volume
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Occupancy Rate</span>
            <TrendingUp className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            {metrics.overallOccupancyPct}%
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
            <div
              className="bg-amber-500 h-full rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, Math.max(0, metrics.overallOccupancyPct))}%` }}
            />
          </div>
        </div>
      </div>

      {/* FILTER BAR */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            id="yard-search-input"
            type="text"
            placeholder="Search yards by name or code..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-amber-500/30"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Filter className="w-3.5 h-3.5" />
            <span>Filter:</span>
          </div>

          <select
            id="yard-status-filter"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 focus:outline-hidden"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>

          <select
            id="yard-type-filter"
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 focus:outline-hidden"
          >
            <option value="ALL">All Yard Types</option>
            <option value="CONTAINER_YARD">Container Yard</option>
            <option value="EMPTY_CONTAINER_YARD">Empty Container Yard</option>
            <option value="REEFER_YARD">Reefer Yard</option>
            <option value="GENERAL_STORAGE">General Storage</option>
          </select>
        </div>
      </div>

      {/* YARD LIST TABLE */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table id="yard-table" className="w-full text-left text-sm">
            <thead className="bg-slate-50/80 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-xs uppercase font-bold text-slate-500 dark:text-slate-400">
              <tr>
                <th className="px-5 py-3.5">Yard Name & Code</th>
                <th className="px-4 py-3.5">Yard Type</th>
                <th className="px-4 py-3.5">Total Cap.</th>
                <th className="px-4 py-3.5">Occupied</th>
                <th className="px-4 py-3.5">Available</th>
                <th className="px-4 py-3.5">Occupancy Rate</th>
                <th className="px-4 py-3.5">Blocks</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-amber-500" />
                    Loading Yard Master records...
                  </td>
                </tr>
              ) : yards.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-slate-400">
                    <Warehouse className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-400" />
                    No yards found matching your filter criteria.
                  </td>
                </tr>
              ) : (
                yards.map(yard => {
                  const occupancy = yard.yard_capacity > 0 ? Number(((yard.yard_occupied / yard.yard_capacity) * 100).toFixed(1)) : 0;
                  const isSelected = selectedYard?.yard_id === yard.yard_id;

                  return (
                    <tr
                      key={yard.yard_id}
                      id={`yard-row-${yard.yard_id}`}
                      className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors ${
                        isSelected ? 'bg-amber-50/40 dark:bg-amber-950/20' : ''
                      }`}
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-300 font-bold text-xs">
                            {yard.yard_code.slice(0, 3)}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 dark:text-white">
                              {yard.yard_name}
                            </div>
                            <div className="text-xs font-mono font-semibold text-amber-600 dark:text-amber-400">
                              {yard.yard_code}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-xs">
                        <span className="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold border border-slate-200 dark:border-slate-700">
                          {yard.yard_type_display}
                        </span>
                      </td>
                      <td className="px-4 py-4 font-mono font-bold text-slate-900 dark:text-white">
                        {yard.yard_capacity}
                      </td>
                      <td className="px-4 py-4 font-mono font-bold text-slate-600 dark:text-slate-400">
                        {yard.yard_occupied}
                      </td>
                      <td className="px-4 py-4 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {yard.available_capacity}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 text-xs font-bold rounded-full border ${getOccupancyBadgeColor(occupancy)}`}>
                            {occupancy}%
                          </span>
                          <div className="w-16 bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden hidden sm:block">
                            <div
                              className="bg-amber-500 h-full rounded-full"
                              style={{ width: `${Math.min(100, Math.max(0, occupancy))}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-xs font-bold text-slate-600 dark:text-slate-400">
                        <span className="flex items-center gap-1">
                          <Layers className="w-3.5 h-3.5 text-slate-400" />
                          {yard.blocks_count} Blocks
                        </span>
                      </td>
                      <td className="px-4 py-4 text-xs">
                        {yard.yard_status === 'ACTIVE' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-700">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                            Inactive
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            id={`yard-view-btn-${yard.yard_id}`}
                            onClick={() => loadYardDetails(yard.yard_id)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors"
                            title="View Yard & Blocks"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            id={`yard-edit-btn-${yard.yard_id}`}
                            onClick={(e) => openEditYardModal(yard, e)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors"
                            title="Edit Yard"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            id={`yard-toggle-btn-${yard.yard_id}`}
                            onClick={(e) => handleToggleYardStatus(yard, e)}
                            className={`p-1.5 rounded-lg transition-colors ${
                              yard.yard_status === 'ACTIVE'
                                ? 'text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30'
                                : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
                            }`}
                            title={yard.yard_status === 'ACTIVE' ? 'Deactivate Yard' : 'Activate Yard'}
                          >
                            <Power className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* YARD DETAILS & DRILLDOWN SECTION */}
      {selectedYard && (
        <div id="yard-details-modal" className="space-y-6 pt-4 border-t border-slate-200 dark:border-slate-800 animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-1">
                <span>Selected Yard Hierarchy</span>
                <ChevronRight className="w-3.5 h-3.5" />
                <span>{selectedYard.yard_code}</span>
              </div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white">
                {selectedYard.yard_name} ({selectedYard.yard_code})
              </h2>
              <div className="flex items-center gap-4 text-xs text-slate-600 dark:text-slate-400 mt-1 font-medium">
                <span>Type: <strong className="text-slate-900 dark:text-white">{selectedYard.yard_type_display}</strong></span>
                <span>Total Capacity: <strong className="text-slate-900 dark:text-white">{selectedYard.yard_capacity} TEU</strong></span>
                <span>Occupied: <strong className="text-slate-900 dark:text-white">{selectedYard.yard_occupied} TEU</strong></span>
                <span>Available: <strong className="text-emerald-600 dark:text-emerald-400">{selectedYard.available_capacity} TEU</strong></span>
                <span>Occupancy: <strong className="text-slate-900 dark:text-white">{selectedYard.occupancy_percentage}%</strong></span>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                id="add-block-btn"
                onClick={openAddBlockModal}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-xs transition-colors"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                Add Yard Block
              </button>
              <button
                onClick={() => setSelectedYard(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                title="Close drilldown"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* YARD BLOCKS TABLE */}
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-amber-500" />
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  Blocks inside {selectedYard.yard_code} ({yardBlocks.length})
                </h3>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table id="block-table" className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-xs uppercase font-bold text-slate-500 dark:text-slate-400">
                  <tr>
                    <th className="px-5 py-3.5">Block Code & Name</th>
                    <th className="px-4 py-3.5">Block Type</th>
                    <th className="px-4 py-3.5">Capacity</th>
                    <th className="px-4 py-3.5">Occupied</th>
                    <th className="px-4 py-3.5">Available</th>
                    <th className="px-4 py-3.5">Occupancy</th>
                    <th className="px-4 py-3.5">Slots</th>
                    <th className="px-4 py-3.5">Status</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                  {loadingDetails ? (
                    <tr>
                      <td colSpan={9} className="px-6 py-8 text-center text-slate-400">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-1 text-amber-500" />
                        Loading blocks...
                      </td>
                    </tr>
                  ) : yardBlocks.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-6 py-8 text-center text-slate-400">
                        No blocks added to this yard yet. Click &quot;Add Yard Block&quot; to configure.
                      </td>
                    </tr>
                  ) : (
                    yardBlocks.map(block => {
                      const occupancy = block.yard_block_capacity > 0 ? Number(((block.yard_block_occupied / block.yard_block_capacity) * 100).toFixed(1)) : 0;
                      const isBlockSelected = selectedBlock?.yard_block_id === block.yard_block_id;

                      return (
                        <tr
                          key={block.yard_block_id}
                          id={`block-row-${block.yard_block_id}`}
                          className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors ${
                            isBlockSelected ? 'bg-amber-50/40 dark:bg-amber-950/20' : ''
                          }`}
                        >
                          <td className="px-5 py-3.5">
                            <div className="font-bold text-slate-900 dark:text-white">
                              {block.yard_block_name}
                            </div>
                            <div className="text-xs font-mono font-semibold text-amber-600 dark:text-amber-400">
                              {block.yard_block_code}
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-xs text-slate-600 dark:text-slate-300">
                            {block.yard_block_type_display}
                          </td>
                          <td className="px-4 py-3.5 font-mono font-bold text-slate-900 dark:text-white">
                            {block.yard_block_capacity}
                          </td>
                          <td className="px-4 py-3.5 font-mono font-bold text-slate-500">
                            {block.yard_block_occupied}
                          </td>
                          <td className="px-4 py-3.5 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            {block.available_capacity}
                          </td>
                          <td className="px-4 py-3.5">
                            <span className={`px-2 py-0.5 text-xs font-bold rounded-full border ${getOccupancyBadgeColor(occupancy)}`}>
                              {occupancy}%
                            </span>
                          </td>
                          <td className="px-4 py-4 text-xs font-bold text-slate-600 dark:text-slate-400">
                            <span className="flex items-center gap-1">
                              <Grid className="w-3.5 h-3.5 text-slate-400" />
                              {block.slots_count} Slots
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-xs">
                            {block.yard_block_status === 'ACTIVE' ? (
                              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
                                Active
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-700">
                                Inactive
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                id={`block-view-btn-${block.yard_block_id}`}
                                onClick={() => loadBlockSlots(block.yard_block_id)}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors"
                                title="Manage Slots"
                              >
                                <Grid className="w-4 h-4" />
                              </button>
                              <button
                                id={`block-edit-btn-${block.yard_block_id}`}
                                onClick={(e) => openEditBlockModal(block, e)}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors"
                                title="Edit Block"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                id={`block-toggle-btn-${block.yard_block_id}`}
                                onClick={(e) => handleToggleBlockStatus(block, e)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors"
                                title="Toggle Block Status"
                              >
                                <Power className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* BLOCK SLOTS SECTION */}
          {selectedBlock && (
            <div id="block-slots-section" className="space-y-4 p-5 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Grid className="w-5 h-5 text-amber-500" />
                  <div>
                    <h3 className="font-black text-slate-900 dark:text-white">
                      Slots in Block {selectedBlock.yard_block_code} ({selectedBlock.yard_block_name})
                    </h3>
                    <p className="text-xs text-slate-500">
                      Row, Bay & Tier Layout Management
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    id="add-slot-btn"
                    onClick={openAddSlotModal}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                    Add Slot
                  </button>
                  <button
                    onClick={() => setSelectedBlock(null)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    title="Close slots"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* SLOTS TABLE */}
              <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
                <table id="slot-table" className="w-full text-left text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-xs uppercase font-bold text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Slot Code</th>
                      <th className="px-4 py-3">Row</th>
                      <th className="px-4 py-3">Bay</th>
                      <th className="px-4 py-3">Tier</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                    {loadingSlots ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                          <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-1 text-amber-500" />
                          Loading slots...
                        </td>
                      </tr>
                    ) : blockSlots.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-slate-400 text-xs">
                          No slots generated for this block yet. Click &quot;Add Slot&quot; to configure.
                        </td>
                      </tr>
                    ) : (
                      blockSlots.map(slot => (
                        <tr key={slot.yard_slot_id} id={`slot-row-${slot.yard_slot_id}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="px-4 py-3 font-mono font-bold text-slate-900 dark:text-white">
                            {slot.yard_slot_code}
                          </td>
                          <td className="px-4 py-3 font-mono text-slate-600 dark:text-slate-400">
                            R{slot.yard_slot_row}
                          </td>
                          <td className="px-4 py-3 font-mono text-slate-600 dark:text-slate-400">
                            B{slot.yard_slot_bay}
                          </td>
                          <td className="px-4 py-3 font-mono text-slate-600 dark:text-slate-400">
                            T{slot.yard_slot_tier}
                          </td>
                          <td className="px-4 py-3">
                            {getSlotStatusBadge(slot.yard_slot_status)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                id={`slot-edit-btn-${slot.yard_slot_id}`}
                                onClick={() => openEditSlotModal(slot)}
                                className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                                title="Edit Slot"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                id={`slot-toggle-btn-${slot.yard_slot_id}`}
                                onClick={() => handleToggleSlotStatus(slot)}
                                disabled={slot.yard_slot_status === 'OCCUPIED'}
                                className={`p-1 rounded ${
                                  slot.yard_slot_status === 'OCCUPIED'
                                    ? 'text-slate-300 dark:text-slate-600 cursor-not-allowed opacity-50'
                                    : 'text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 cursor-pointer'
                                }`}
                                title={
                                  slot.yard_slot_status === 'OCCUPIED'
                                    ? 'Slot is OCCUPIED by an active container. Relocate or release container first.'
                                    : 'Toggle Slot Available / Blocked'
                                }
                              >
                                <Power className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ======================================================================== */}
      {/* ADD / EDIT YARD MODAL */}
      {/* ======================================================================== */}
      {isYardModalOpen && (
        <div id="yard-modal" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden animate-scale-up">
            <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <Warehouse className="w-5 h-5" />
                </div>
                <h3 className="font-black text-lg text-slate-900 dark:text-white">
                  {editingYard ? 'Edit Yard Configuration' : 'Add New Storage Yard'}
                </h3>
              </div>
              <button
                id="yard-modal-close-btn"
                onClick={() => setIsYardModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveYard} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                  Yard Name <span className="text-rose-500">*</span>
                </label>
                <input
                  id="yard-name-input"
                  type="text"
                  required
                  placeholder="e.g., North Container Yard"
                  value={yardForm.yard_name}
                  onChange={e => setYardForm({ ...yardForm, yard_name: e.target.value })}
                  className={`w-full px-3.5 py-2 text-sm rounded-xl bg-slate-50 dark:bg-slate-800 border ${
                    formErrors.yard_name ? 'border-rose-500' : 'border-slate-200 dark:border-slate-700'
                  } text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-amber-500/40`}
                />
                {formErrors.yard_name && (
                  <p className="text-xs text-rose-500 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> {formErrors.yard_name}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                    Yard Code <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="yard-code-input"
                    type="text"
                    required
                    placeholder="e.g., CY-NORTH"
                    value={yardForm.yard_code}
                    onChange={e => setYardForm({ ...yardForm, yard_code: e.target.value.toUpperCase() })}
                    className={`w-full px-3.5 py-2 text-sm font-mono rounded-xl bg-slate-50 dark:bg-slate-800 border ${
                      formErrors.yard_code ? 'border-rose-500' : 'border-slate-200 dark:border-slate-700'
                    } text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-amber-500/40`}
                  />
                  {formErrors.yard_code && (
                    <p className="text-xs text-rose-500 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> {formErrors.yard_code}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                    Yard Type <span className="text-rose-500">*</span>
                  </label>
                  <select
                    id="yard-type-select"
                    value={yardForm.yard_type}
                    onChange={e => setYardForm({ ...yardForm, yard_type: e.target.value as YardType })}
                    className="w-full px-3.5 py-2 text-sm rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-amber-500/40"
                  >
                    <option value="CONTAINER_YARD">Container Yard</option>
                    <option value="EMPTY_CONTAINER_YARD">Empty Container Yard</option>
                    <option value="REEFER_YARD">Reefer Yard</option>
                    <option value="GENERAL_STORAGE">General Storage</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                    Total Capacity (TEU) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="yard-capacity-input"
                    type="number"
                    min="1"
                    required
                    value={yardForm.yard_capacity}
                    onChange={e => setYardForm({ ...yardForm, yard_capacity: parseInt(e.target.value) || 0 })}
                    className={`w-full px-3.5 py-2 text-sm font-mono rounded-xl bg-slate-50 dark:bg-slate-800 border ${
                      formErrors.yard_capacity ? 'border-rose-500' : 'border-slate-200 dark:border-slate-700'
                    } text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-amber-500/40`}
                  />
                  {formErrors.yard_capacity && (
                    <p className="text-xs text-rose-500 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> {formErrors.yard_capacity}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                    Occupied Capacity
                  </label>
                  <input
                    id="yard-occupied-input"
                    type="number"
                    min="0"
                    value={yardForm.yard_occupied}
                    onChange={e => setYardForm({ ...yardForm, yard_occupied: parseInt(e.target.value) || 0 })}
                    className={`w-full px-3.5 py-2 text-sm font-mono rounded-xl bg-slate-50 dark:bg-slate-800 border ${
                      formErrors.yard_occupied ? 'border-rose-500' : 'border-slate-200 dark:border-slate-700'
                    } text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-amber-500/40`}
                  />
                  {formErrors.yard_occupied && (
                    <p className="text-xs text-rose-500 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> {formErrors.yard_occupied}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                  Yard Operational Status
                </label>
                <select
                  id="yard-status-select"
                  value={yardForm.yard_status}
                  onChange={e => setYardForm({ ...yardForm, yard_status: e.target.value as YardStatus })}
                  className="w-full px-3.5 py-2 text-sm rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-hidden"
                >
                  <option value="ACTIVE">Active (Available for Operations)</option>
                  <option value="INACTIVE">Inactive (Under Maintenance / Closed)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  id="yard-cancel-btn"
                  type="button"
                  onClick={() => setIsYardModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  id="yard-submit-btn"
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl text-sm font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {isSubmitting && <RefreshCw className="w-4 h-4 animate-spin" />}
                  {editingYard ? 'Update Yard' : 'Create Yard'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================================== */}
      {/* ADD / EDIT YARD BLOCK MODAL */}
      {/* ======================================================================== */}
      {isBlockModalOpen && selectedYard && (
        <div id="block-modal" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden animate-scale-up">
            <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <Layers className="w-5 h-5" />
                </div>
                <h3 className="font-black text-lg text-slate-900 dark:text-white">
                  {editingBlock ? 'Edit Yard Block' : `Add Block to ${selectedYard.yard_code}`}
                </h3>
              </div>
              <button
                id="block-modal-close-btn"
                onClick={() => setIsBlockModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveBlock} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                  Block Name <span className="text-rose-500">*</span>
                </label>
                <input
                  id="block-name-input"
                  type="text"
                  required
                  placeholder="e.g., Block A01 Standard"
                  value={blockForm.yard_block_name}
                  onChange={e => setBlockForm({ ...blockForm, yard_block_name: e.target.value })}
                  className={`w-full px-3.5 py-2 text-sm rounded-xl bg-slate-50 dark:bg-slate-800 border ${
                    formErrors.yard_block_name ? 'border-rose-500' : 'border-slate-200 dark:border-slate-700'
                  } text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-amber-500/40`}
                />
                {formErrors.yard_block_name && (
                  <p className="text-xs text-rose-500 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> {formErrors.yard_block_name}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                    Block Code <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="block-code-input"
                    type="text"
                    required
                    placeholder="e.g., A01"
                    value={blockForm.yard_block_code}
                    onChange={e => setBlockForm({ ...blockForm, yard_block_code: e.target.value.toUpperCase() })}
                    className={`w-full px-3.5 py-2 text-sm font-mono rounded-xl bg-slate-50 dark:bg-slate-800 border ${
                      formErrors.yard_block_code ? 'border-rose-500' : 'border-slate-200 dark:border-slate-700'
                    } text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-amber-500/40`}
                  />
                  {formErrors.yard_block_code && (
                    <p className="text-xs text-rose-500 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> {formErrors.yard_block_code}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                    Block Type <span className="text-rose-500">*</span>
                  </label>
                  <select
                    id="block-type-select"
                    value={blockForm.yard_block_type}
                    onChange={e => setBlockForm({ ...blockForm, yard_block_type: e.target.value as BlockType })}
                    className="w-full px-3.5 py-2 text-sm rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-hidden"
                  >
                    <option value="STANDARD">Standard Container Block</option>
                    <option value="REEFER">Reefer Block</option>
                    <option value="EMPTY">Empty Container Block</option>
                    <option value="HAZMAT">Hazardous Materials Block</option>
                    <option value="GENERAL">General Cargo Block</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                    Block Capacity (TEU) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="block-capacity-input"
                    type="number"
                    min="1"
                    required
                    value={blockForm.yard_block_capacity}
                    onChange={e => setBlockForm({ ...blockForm, yard_block_capacity: parseInt(e.target.value) || 0 })}
                    className={`w-full px-3.5 py-2 text-sm font-mono rounded-xl bg-slate-50 dark:bg-slate-800 border ${
                      formErrors.yard_block_capacity ? 'border-rose-500' : 'border-slate-200 dark:border-slate-700'
                    } text-slate-900 dark:text-white focus:outline-hidden`}
                  />
                  {formErrors.yard_block_capacity && (
                    <p className="text-xs text-rose-500 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> {formErrors.yard_block_capacity}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                    Occupied Capacity
                  </label>
                  <input
                    id="block-occupied-input"
                    type="number"
                    min="0"
                    value={blockForm.yard_block_occupied}
                    onChange={e => setBlockForm({ ...blockForm, yard_block_occupied: parseInt(e.target.value) || 0 })}
                    className={`w-full px-3.5 py-2 text-sm font-mono rounded-xl bg-slate-50 dark:bg-slate-800 border ${
                      formErrors.yard_block_occupied ? 'border-rose-500' : 'border-slate-200 dark:border-slate-700'
                    } text-slate-900 dark:text-white focus:outline-hidden`}
                  />
                  {formErrors.yard_block_occupied && (
                    <p className="text-xs text-rose-500 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> {formErrors.yard_block_occupied}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                  Block Operational Status
                </label>
                <select
                  id="block-status-select"
                  value={blockForm.yard_block_status}
                  onChange={e => setBlockForm({ ...blockForm, yard_block_status: e.target.value as BlockStatus })}
                  className="w-full px-3.5 py-2 text-sm rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-hidden"
                >
                  <option value="ACTIVE">Active (Available)</option>
                  <option value="INACTIVE">Inactive (Under Maintenance)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  id="block-cancel-btn"
                  type="button"
                  onClick={() => setIsBlockModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  id="block-submit-btn"
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl text-sm font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {isSubmitting && <RefreshCw className="w-4 h-4 animate-spin" />}
                  {editingBlock ? 'Update Block' : 'Create Block'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================================== */}
      {/* ADD / EDIT YARD SLOT MODAL */}
      {/* ======================================================================== */}
      {isSlotModalOpen && selectedBlock && (
        <div id="slot-modal" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden animate-scale-up">
            <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <Grid className="w-5 h-5" />
                </div>
                <h3 className="font-black text-lg text-slate-900 dark:text-white">
                  {editingSlot ? 'Edit Yard Slot' : `Add Slot in Block ${selectedBlock.yard_block_code}`}
                </h3>
              </div>
              <button
                id="slot-modal-close-btn"
                onClick={() => setIsSlotModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSlot} className="p-6 space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                    Row <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="slot-row-input"
                    type="number"
                    min="1"
                    required
                    readOnly={!!editingSlot && editingSlot.yard_slot_status === 'OCCUPIED'}
                    value={slotForm.yard_slot_row}
                    onChange={e => setSlotForm({ ...slotForm, yard_slot_row: parseInt(e.target.value) || 0 })}
                    className={`w-full px-3 py-2 text-sm font-mono rounded-xl bg-slate-50 dark:bg-slate-800 border ${
                      formErrors.yard_slot_row ? 'border-rose-500' : 'border-slate-200 dark:border-slate-700'
                    } text-slate-900 dark:text-white focus:outline-hidden ${
                      editingSlot && editingSlot.yard_slot_status === 'OCCUPIED' ? 'opacity-70 cursor-not-allowed bg-slate-100 dark:bg-slate-800/80' : ''
                    }`}
                  />
                  {formErrors.yard_slot_row && (
                    <p className="text-xs text-rose-500 mt-1">{formErrors.yard_slot_row}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                    Bay <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="slot-bay-input"
                    type="number"
                    min="1"
                    required
                    readOnly={!!editingSlot && editingSlot.yard_slot_status === 'OCCUPIED'}
                    value={slotForm.yard_slot_bay}
                    onChange={e => setSlotForm({ ...slotForm, yard_slot_bay: parseInt(e.target.value) || 0 })}
                    className={`w-full px-3 py-2 text-sm font-mono rounded-xl bg-slate-50 dark:bg-slate-800 border ${
                      formErrors.yard_slot_bay ? 'border-rose-500' : 'border-slate-200 dark:border-slate-700'
                    } text-slate-900 dark:text-white focus:outline-hidden ${
                      editingSlot && editingSlot.yard_slot_status === 'OCCUPIED' ? 'opacity-70 cursor-not-allowed bg-slate-100 dark:bg-slate-800/80' : ''
                    }`}
                  />
                  {formErrors.yard_slot_bay && (
                    <p className="text-xs text-rose-500 mt-1">{formErrors.yard_slot_bay}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                    Tier <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="slot-tier-input"
                    type="number"
                    min="1"
                    required
                    readOnly={!!editingSlot && editingSlot.yard_slot_status === 'OCCUPIED'}
                    value={slotForm.yard_slot_tier}
                    onChange={e => setSlotForm({ ...slotForm, yard_slot_tier: parseInt(e.target.value) || 0 })}
                    className={`w-full px-3 py-2 text-sm font-mono rounded-xl bg-slate-50 dark:bg-slate-800 border ${
                      formErrors.yard_slot_tier ? 'border-rose-500' : 'border-slate-200 dark:border-slate-700'
                    } text-slate-900 dark:text-white focus:outline-hidden ${
                      editingSlot && editingSlot.yard_slot_status === 'OCCUPIED' ? 'opacity-70 cursor-not-allowed bg-slate-100 dark:bg-slate-800/80' : ''
                    }`}
                  />
                  {formErrors.yard_slot_tier && (
                    <p className="text-xs text-rose-500 mt-1">{formErrors.yard_slot_tier}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                  {editingSlot ? 'Slot Code' : 'Slot Code (Optional - auto-generated if blank)'}
                </label>
                <input
                  id="slot-code-input"
                  type="text"
                  placeholder={`e.g., ${selectedBlock.yard_block_code}-R01-B01-T01`}
                  readOnly={!!editingSlot && editingSlot.yard_slot_status === 'OCCUPIED'}
                  value={slotForm.yard_slot_code}
                  onChange={e => setSlotForm({ ...slotForm, yard_slot_code: e.target.value.toUpperCase() })}
                  className={`w-full px-3.5 py-2 text-sm font-mono rounded-xl bg-slate-50 dark:bg-slate-800 border ${
                    formErrors.yard_slot_code ? 'border-rose-500' : 'border-slate-200 dark:border-slate-700'
                  } text-slate-900 dark:text-white focus:outline-hidden ${
                    editingSlot && editingSlot.yard_slot_status === 'OCCUPIED' ? 'opacity-70 cursor-not-allowed bg-slate-100 dark:bg-slate-800/80' : ''
                  }`}
                />
                {formErrors.yard_slot_code && (
                  <p className="text-xs text-rose-500 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> {formErrors.yard_slot_code}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                  {editingSlot ? 'Slot Status' : 'Initial Slot Status'}
                </label>
                <select
                  id="slot-status-select"
                  disabled={!!editingSlot && editingSlot.yard_slot_status === 'OCCUPIED'}
                  value={slotForm.yard_slot_status}
                  onChange={e => setSlotForm({ ...slotForm, yard_slot_status: e.target.value as SlotStatus })}
                  className={`w-full px-3.5 py-2 text-sm rounded-xl bg-slate-50 dark:bg-slate-800 border ${
                    formErrors.yard_slot_status ? 'border-rose-500' : 'border-slate-200 dark:border-slate-700'
                  } text-slate-900 dark:text-white focus:outline-hidden ${
                    editingSlot && editingSlot.yard_slot_status === 'OCCUPIED' ? 'opacity-60 cursor-not-allowed' : ''
                  }`}
                >
                  <option value="AVAILABLE">Available</option>
                  {editingSlot && editingSlot.yard_slot_status === 'OCCUPIED' && (
                    <option value="OCCUPIED">Occupied (Active Container Allocated)</option>
                  )}
                  <option value="RESERVED">Reserved</option>
                  <option value="BLOCKED">Blocked</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
                {editingSlot && editingSlot.yard_slot_status === 'OCCUPIED' && (
                  <p className="text-[11px] text-amber-500 mt-1 flex items-center gap-1 font-medium">
                    <Info className="w-3.5 h-3.5 shrink-0" />
                    Slot is occupied by an active container. Relocate or release container to change status.
                  </p>
                )}
                {formErrors.yard_slot_status && (
                  <p className="text-xs text-rose-500 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> {formErrors.yard_slot_status}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  id="slot-cancel-btn"
                  type="button"
                  onClick={() => setIsSlotModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  id="slot-submit-btn"
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl text-sm font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {isSubmitting && <RefreshCw className="w-4 h-4 animate-spin" />}
                  {editingSlot ? 'Update Slot' : 'Create Slot'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
