import React, { useState, useEffect } from 'react';
import { BackendBerth } from '../../../types';
import { useApp } from '../../../context/AppContext';
import { Modal } from '../../common/Modal';
import { 
  Anchor, 
  Search, 
  RefreshCw, 
  Plus, 
  Edit3, 
  Power, 
  Trash2, 
  CheckCircle2, 
  XCircle, 
  Wrench, 
  Building2, 
  Ruler, 
  AlertTriangle,
  Layers,
  Clock,
  Eye,
  Ship
} from 'lucide-react';

export const AdminBerthManagement: React.FC = () => {
  const { currentUser, addToast } = useApp();

  const [berths, setBerths] = useState<BackendBerth[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  // Selected Berth Modal for Viewing Details
  const [selectedBerthDetails, setSelectedBerthDetails] = useState<BackendBerth | null>(null);

  // Add / Edit Modal state
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingBerth, setEditingBerth] = useState<BackendBerth | null>(null);

  // Form State
  const [formName, setFormName] = useState<string>('');
  const [formCode, setFormCode] = useState<string>('');
  const [formType, setFormType] = useState<string>('CONTAINER_TERMINAL');
  const [formMaxLength, setFormMaxLength] = useState<string>('300.00');
  const [formMaxDraft, setFormMaxDraft] = useState<string>('14.50');
  const [formStatus, setFormStatus] = useState<string>('AVAILABLE');
  const [formIsActive, setFormIsActive] = useState<boolean>(true);
  const [formError, setFormError] = useState<string>('');
  const [formLoading, setFormLoading] = useState<boolean>(false);

  // Deactivate Modal state
  const [toggleBerth, setToggleBerth] = useState<BackendBerth | null>(null);
  const [toggleLoading, setToggleLoading] = useState<boolean>(false);

  // Delete Modal state
  const [deleteBerth, setDeleteBerth] = useState<BackendBerth | null>(null);
  const [deleteLoading, setDeleteLoading] = useState<boolean>(false);
  const [deleteError, setDeleteError] = useState<string>('');

  const fetchMasterBerths = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('http://127.0.0.1:8000/api/admin/berths/', {
        headers: {
          'X-User-Email': currentUser?.email || '',
          'X-User-Role': 'port_administrator',
          'X-User-Id': currentUser?.id || ''
        }
      });
      const resJson = await response.json();
      if (response.ok && resJson.status === 'success') {
        setBerths(resJson.data || []);
      } else {
        setError(resJson.message || 'Failed to fetch berth master data.');
      }
    } catch (err) {
      setError('Unable to connect to backend server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMasterBerths();
  }, []);

  const openAddModal = () => {
    setEditingBerth(null);
    setFormName('');
    setFormCode('');
    setFormType('CONTAINER_TERMINAL');
    setFormMaxLength('300.00');
    setFormMaxDraft('14.50');
    setFormStatus('AVAILABLE');
    setFormIsActive(true);
    setFormError('');
    setIsModalOpen(true);
  };

  const openEditModal = (berth: BackendBerth) => {
    setEditingBerth(berth);
    setFormName(berth.berth_name);
    setFormCode(berth.berth_code || '');
    setFormType(berth.berth_type || 'CONTAINER_TERMINAL');
    setFormMaxLength(String(berth.berth_max_length || '300.00'));
    setFormMaxDraft(String(berth.berth_max_draft));
    setFormStatus(berth.berth_status);
    setFormIsActive(berth.berth_is_active !== false);
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSaveBerth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      setFormError('Berth name is required.');
      return;
    }
    if (!formCode.trim()) {
      setFormError('Berth code is required.');
      return;
    }
    const lenVal = parseFloat(formMaxLength);
    if (isNaN(lenVal) || lenVal <= 0) {
      setFormError('Maximum vessel length must be greater than 0 meters.');
      return;
    }
    const draftVal = parseFloat(formMaxDraft);
    if (isNaN(draftVal) || draftVal <= 0) {
      setFormError('Maximum draft must be greater than 0 meters.');
      return;
    }

    setFormError('');
    setFormLoading(true);

    try {
      const url = editingBerth
        ? `http://127.0.0.1:8000/api/admin/berths/${editingBerth.berth_id}/`
        : 'http://127.0.0.1:8000/api/admin/berths/';

      const method = editingBerth ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-User-Email': currentUser?.email || '',
          'X-User-Role': 'port_administrator',
          'X-User-Id': currentUser?.id || ''
        },
        body: JSON.stringify({
          berth_name: formName.trim(),
          berth_code: formCode.trim().toUpperCase(),
          berth_type: formType,
          berth_max_length: lenVal,
          berth_max_draft: draftVal,
          berth_status: formIsActive ? formStatus : 'INACTIVE',
          berth_is_active: formIsActive
        })
      });

      const resJson = await response.json();
      setFormLoading(false);

      if (response.ok && resJson.status === 'success') {
        addToast(
          'success', 
          editingBerth ? 'Berth Updated' : 'Berth Configured', 
          resJson.message || `Berth '${formName}' saved successfully.`
        );
        setIsModalOpen(false);
        fetchMasterBerths();
      } else {
        setFormError(resJson.message || 'Validation error creating berth.');
      }
    } catch (err) {
      setFormLoading(false);
      setFormError('Network connection error.');
    }
  };

  const handleToggleActivation = async () => {
    if (!toggleBerth) return;
    setToggleLoading(true);
    const newActiveState = !toggleBerth.berth_is_active;

    try {
      const response = await fetch(`http://127.0.0.1:8000/api/admin/berths/${toggleBerth.berth_id}/`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Email': currentUser?.email || '',
          'X-User-Role': 'port_administrator',
          'X-User-Id': currentUser?.id || ''
        },
        body: JSON.stringify({
          berth_is_active: newActiveState,
          berth_status: newActiveState ? 'AVAILABLE' : 'INACTIVE'
        })
      });

      const resJson = await response.json();
      setToggleLoading(false);

      if (response.ok && resJson.status === 'success') {
        addToast(
          'info',
          newActiveState ? 'Berth Activated' : 'Berth Deactivated',
          `${toggleBerth.berth_name} has been ${newActiveState ? 'activated' : 'deactivated'}.`
        );
        setToggleBerth(null);
        fetchMasterBerths();
      } else {
        addToast('error', 'Update Failed', resJson.message || 'Failed to update berth activation status.');
      }
    } catch (err) {
      setToggleLoading(false);
      addToast('error', 'Network Error', 'Unable to connect to backend server.');
    }
  };

  const handleDeleteBerth = async () => {
    if (!deleteBerth) return;
    setDeleteLoading(true);
    setDeleteError('');

    try {
      const response = await fetch(`http://127.0.0.1:8000/api/admin/berths/${deleteBerth.berth_id}/`, {
        method: 'DELETE',
        headers: {
          'X-User-Email': currentUser?.email || '',
          'X-User-Role': 'port_administrator',
          'X-User-Id': currentUser?.id || ''
        }
      });

      const resJson = await response.json();
      setDeleteLoading(false);

      if (response.ok && resJson.status === 'success') {
        addToast('success', 'Berth Deleted', `Unused berth '${deleteBerth.berth_name}' removed.`);
        setDeleteBerth(null);
        fetchMasterBerths();
      } else {
        setDeleteError(resJson.message || 'Deletion failed.');
      }
    } catch (err) {
      setDeleteLoading(false);
      setDeleteError('Network error connecting to backend server.');
    }
  };

  const filteredBerths = berths.filter(b => {
    const q = searchQuery.toLowerCase().trim();
    const matchesQuery = !q ||
      b.berth_name.toLowerCase().includes(q) ||
      (b.berth_code && b.berth_code.toLowerCase().includes(q));

    const matchesStatus = statusFilter === 'all' || b.berth_status === statusFilter;
    const matchesType = typeFilter === 'all' || b.berth_type === typeFilter;

    return matchesQuery && matchesStatus && matchesType;
  });

  const totalBerths = berths.length;
  const activeCount = berths.filter(b => b.berth_is_active !== false && b.berth_status !== 'INACTIVE').length;
  const inactiveCount = berths.filter(b => b.berth_is_active === false || b.berth_status === 'INACTIVE').length;
  const maintenanceCount = berths.filter(b => b.berth_status === 'MAINTENANCE').length;

  return (
    <div className="space-y-6 font-sans selection:bg-[#D49A24] selection:text-white animate-fade-in">
      {/* HEADER BANNER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400 mb-1">
            <Anchor className="w-4 h-4" />
            <span>PORT INFRASTRUCTURE MASTER DATA</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            Berth Master Management
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">
            Configure berth specifications, vessel size limits, draft constraints, and operational statuses.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={fetchMasterBerths}
            disabled={loading}
            className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all cursor-pointer border border-slate-200 dark:border-slate-700 flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh Data</span>
          </button>
          <button
            onClick={openAddModal}
            className="px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Berth</span>
          </button>
        </div>
      </div>

      {/* KPI METRIC CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Configured Berths</span>
            <Anchor className="w-4 h-4 text-sky-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">{totalBerths}</div>
          <div className="text-[11px] font-medium text-slate-500">Port Master Infrastructure</div>
        </div>

        <div className="p-4 rounded-2xl bg-emerald-500/5 dark:bg-emerald-950/20 border border-emerald-500/20 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Active Berths</span>
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{activeCount}</div>
          <div className="text-[11px] font-medium text-emerald-600/70">Operational & Available</div>
        </div>

        <div className="p-4 rounded-2xl bg-purple-500/5 dark:bg-purple-950/20 border border-purple-500/20 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-purple-600 dark:text-purple-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Maintenance</span>
            <Wrench className="w-4 h-4" />
          </div>
          <div className="text-2xl font-black text-purple-600 dark:text-purple-400">{maintenanceCount}</div>
          <div className="text-[11px] font-medium text-purple-600/70">Under Maintenance</div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-500/5 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Inactive</span>
            <Power className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-black text-slate-500 dark:text-slate-400">{inactiveCount}</div>
          <div className="text-[11px] font-medium text-slate-500">Deactivated Facilities</div>
        </div>
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search master berths by name or code..."
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            <option value="all">All Operational Statuses</option>
            <option value="AVAILABLE">AVAILABLE</option>
            <option value="RESERVED">RESERVED</option>
            <option value="OCCUPIED">OCCUPIED</option>
            <option value="MAINTENANCE">MAINTENANCE</option>
            <option value="INACTIVE">INACTIVE</option>
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            <option value="all">All Berth Types</option>
            <option value="CONTAINER_TERMINAL">Container Terminal</option>
            <option value="BULK_CARGO">Bulk Cargo</option>
            <option value="OIL_TANKER">Oil & Liquid Tanker</option>
            <option value="GENERAL_CARGO">General Cargo</option>
            <option value="RO_RO">Ro-Ro Berth</option>
            <option value="MULTI_PURPOSE">Multi-Purpose</option>
          </select>
        </div>
      </div>

      {/* MASTER DATA TABLE */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto shadow-xs">
        {loading ? (
          <div className="py-16 text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-sky-500 animate-spin mx-auto" />
            <p className="text-xs font-semibold text-slate-500">Loading berth master data from PostgreSQL...</p>
          </div>
        ) : filteredBerths.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <Anchor className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto" />
            <div className="text-sm font-bold text-slate-800 dark:text-slate-200">No berths match criteria</div>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">Create a new berth or clear your search filters.</p>
          </div>
        ) : (
          <table className="w-full text-left text-xs min-w-[900px]">
            <thead>
              <tr className="border-b border-slate-200/80 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-slate-400 uppercase tracking-wider font-bold">
                <th className="py-3.5 px-4">Berth Name</th>
                <th className="py-3.5 px-4">Code</th>
                <th className="py-3.5 px-4">Berth Type</th>
                <th className="py-3.5 px-4">Max Length</th>
                <th className="py-3.5 px-4">Max Draft</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Activation</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300 font-medium">
              {filteredBerths.map((b) => (
                <tr key={b.berth_id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="py-3.5 px-4">
                    <div 
                      onClick={() => setSelectedBerthDetails(b)}
                      className="font-black text-slate-900 dark:text-white flex items-center gap-2 cursor-pointer hover:text-[#D49A24] dark:hover:text-[#D49A24] transition-colors group"
                      title="Click to view berth facility specifications and live assignment"
                    >
                      <Anchor className="w-4 h-4 text-sky-500 shrink-0 group-hover:scale-110 transition-transform" />
                      <span className="group-hover:underline">{b.berth_name}</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 font-mono font-bold text-sky-600 dark:text-sky-400">
                    {b.berth_code || '—'}
                  </td>
                  <td className="py-3.5 px-4 font-semibold text-slate-800 dark:text-slate-200">
                    {b.berth_type_display || b.berth_type}
                  </td>
                  <td className="py-3.5 px-4 font-semibold">{b.berth_max_length ? `${b.berth_max_length} m` : '—'}</td>
                  <td className="py-3.5 px-4 font-semibold">{b.berth_max_draft} m</td>
                  <td className="py-3.5 px-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      b.berth_status === 'AVAILABLE' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
                      b.berth_status === 'RESERVED' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' :
                      b.berth_status === 'OCCUPIED' ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400' :
                      b.berth_status === 'MAINTENANCE' ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400' :
                      'bg-slate-500/10 text-slate-500'
                    }`}>
                      {b.berth_status}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    {b.berth_is_active !== false ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400">
                        <XCircle className="w-3.5 h-3.5" />
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={(e) => { e.stopPropagation(); setSelectedBerthDetails(b); }}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-sky-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        title="View Berth Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      <button
                        onClick={(e) => { e.stopPropagation(); openEditModal(b); }}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-sky-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        title="Edit Configuration"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>

                      <button
                        onClick={(e) => { e.stopPropagation(); setToggleBerth(b); }}
                        className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                          b.berth_is_active !== false
                            ? 'text-slate-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30'
                            : 'text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
                        }`}
                        title={b.berth_is_active !== false ? 'Deactivate Berth' : 'Activate Berth'}
                      >
                        <Power className="w-4 h-4" />
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteBerth(b);
                          setDeleteError('');
                        }}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                        title="Delete Berth"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ADD / EDIT BERTH MODAL */}
      {isModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsModalOpen(false)}
          title={editingBerth ? `Edit Berth Configuration — ${editingBerth.berth_name}` : 'Configure New Port Berth'}
        >
          <form onSubmit={handleSaveBerth} className="space-y-4">
            {formError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300">Berth Name *</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Berth 05"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300">Berth Code *</label>
                <input
                  type="text"
                  required
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                  placeholder="e.g. B-05"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
            </div>

            <div className="space-y-1 text-xs">
              <label className="font-bold text-slate-700 dark:text-slate-300">Berth Facility Type *</label>
              <select
                value={formType}
                onChange={(e) => setFormType(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                <option value="CONTAINER_TERMINAL">Container Terminal</option>
                <option value="BULK_CARGO">Bulk Cargo Terminal</option>
                <option value="OIL_TANKER">Oil & Liquid Tanker</option>
                <option value="GENERAL_CARGO">General Cargo Berth</option>
                <option value="RO_RO">Ro-Ro Berth</option>
                <option value="MULTI_PURPOSE">Multi-Purpose Berth</option>
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300">Maximum Vessel Length (m) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={formMaxLength}
                  onChange={(e) => setFormMaxLength(e.target.value)}
                  placeholder="e.g. 300.00"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
                <p className="text-[10px] text-slate-400">Maximum vessel length that can be accommodated at this berth.</p>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300">Maximum Draft (m) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={formMaxDraft}
                  onChange={(e) => setFormMaxDraft(e.target.value)}
                  placeholder="e.g. 14.50"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
                <p className="text-[10px] text-slate-400">Maximum vessel draft that can be safely accommodated at this berth.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-2">
              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300">Initial Operational Status</label>
                <select
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  <option value="AVAILABLE">AVAILABLE</option>
                  <option value="MAINTENANCE">MAINTENANCE</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
              </div>

              <div className="flex items-center gap-2 pt-6">
                <input
                  type="checkbox"
                  id="berthActive"
                  checked={formIsActive}
                  onChange={(e) => setFormIsActive(e.target.checked)}
                  className="w-4 h-4 text-sky-600 rounded focus:ring-sky-500"
                />
                <label htmlFor="berthActive" className="font-bold text-slate-800 dark:text-slate-200 cursor-pointer">
                  Facility Active in Port Master Data
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                disabled={formLoading}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={formLoading}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-700 text-white shadow-xs flex items-center gap-2 cursor-pointer"
              >
                {formLoading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving Berth...</span>
                  </>
                ) : (
                  <span>{editingBerth ? 'Save Berth Configuration' : 'Create Berth Facility'}</span>
                )}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* TOGGLE ACTIVATION CONFIRMATION MODAL */}
      {toggleBerth && (
        <Modal
          isOpen={true}
          onClose={() => setToggleBerth(null)}
          title={`Confirm Activation Status Change`}
        >
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-xs space-y-1">
              <div className="font-bold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <span>Berth Master Status Toggle</span>
              </div>
              <p>
                You are about to {toggleBerth.berth_is_active !== false ? 'DEACTIVATE' : 'ACTIVATE'}{' '}
                <strong>{toggleBerth.berth_name}</strong>.
              </p>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400">
              {toggleBerth.berth_is_active !== false
                ? 'Deactivating this berth hides it from new vessel allocation options. All historical schedule and occupancy records remain completely preserved in the database.'
                : 'Activating this berth makes it immediately available for vessel scheduling by Port Operations Officers.'}
            </p>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setToggleBerth(null)}
                disabled={toggleLoading}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleToggleActivation}
                disabled={toggleLoading}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-xs flex items-center gap-2 cursor-pointer"
              >
                {toggleLoading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Updating Status...</span>
                  </>
                ) : (
                  <span>Confirm Status Change</span>
                )}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteBerth && (
        <Modal
          isOpen={true}
          onClose={() => {
            setDeleteBerth(null);
            setDeleteError('');
          }}
          title={`Delete Berth — ${deleteBerth.berth_name}`}
        >
          <div className="space-y-4">
            {deleteError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{deleteError}</span>
              </div>
            )}

            <p className="text-xs text-slate-600 dark:text-slate-400">
              Are you sure you want to delete <strong>{deleteBerth.berth_name}</strong>? Hard deletion is only permitted if this berth has no dependent historical vessel schedule or operational records.
            </p>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setDeleteBerth(null);
                  setDeleteError('');
                }}
                disabled={deleteLoading}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteBerth}
                disabled={deleteLoading}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-xs flex items-center gap-2 cursor-pointer"
              >
                {deleteLoading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <span>Delete Unused Berth</span>
                )}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* VIEW BERTH DETAILS MODAL */}
      {selectedBerthDetails && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedBerthDetails(null)}
          title={`Berth Details — ${selectedBerthDetails.berth_name}`}
          subtitle={`Master Code: ${selectedBerthDetails.berth_code || 'N/A'}`}
          icon={<Anchor className="w-4 h-4 text-sky-500" />}
          maxWidth="2xl"
        >
          <div className="space-y-4 font-sans text-xs">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Berth Name</span>
                <div className="font-bold text-slate-900 dark:text-white text-sm mt-0.5">{selectedBerthDetails.berth_name}</div>
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Berth Code</span>
                <div className="font-mono font-bold text-sky-600 dark:text-sky-400 text-sm mt-0.5">{selectedBerthDetails.berth_code || '—'}</div>
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Operational Status</span>
                <div className="mt-0.5">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                    selectedBerthDetails.berth_status === 'AVAILABLE' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
                    selectedBerthDetails.berth_status === 'RESERVED' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' :
                    selectedBerthDetails.berth_status === 'OCCUPIED' ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400' :
                    selectedBerthDetails.berth_status === 'MAINTENANCE' ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400' :
                    'bg-slate-500/10 text-slate-500'
                  }`}>
                    {selectedBerthDetails.berth_status}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Facility Type</span>
                <div className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">{selectedBerthDetails.berth_type_display || selectedBerthDetails.berth_type}</div>
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Maximum Vessel Length</span>
                <div className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">{selectedBerthDetails.berth_max_length ? `${selectedBerthDetails.berth_max_length} m` : '—'}</div>
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Maximum Draft</span>
                <div className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">{selectedBerthDetails.berth_max_draft} m</div>
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Activation Status</span>
                <div className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                  {selectedBerthDetails.berth_is_active !== false ? 'Active' : 'Inactive'}
                </div>
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Created At</span>
                <div className="text-slate-500 mt-0.5">{selectedBerthDetails.berth_created_at ? new Date(selectedBerthDetails.berth_created_at).toLocaleDateString() : 'N/A'}</div>
              </div>
            </div>

            {/* Current Vessel Assignment Info */}
            {selectedBerthDetails.current_vessel ? (
              <div className="p-4 rounded-xl bg-sky-500/5 border border-sky-500/20 space-y-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400 flex items-center gap-1.5">
                  <Ship className="w-4 h-4" />
                  <span>Current Vessel Assignment</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <span className="text-slate-400 font-medium">Vessel Name</span>
                    <div className="font-bold text-slate-900 dark:text-white">{selectedBerthDetails.current_vessel.vessel_name}</div>
                  </div>
                  <div>
                    <span className="text-slate-400 font-medium">IMO Number</span>
                    <div className="font-mono font-bold text-[#D49A24]">{selectedBerthDetails.current_vessel.vessel_imo_number}</div>
                  </div>
                  <div>
                    <span className="text-slate-400 font-medium">Shipping Line</span>
                    <div className="font-semibold text-slate-800 dark:text-slate-200">{selectedBerthDetails.current_vessel.company_name}</div>
                  </div>
                  <div>
                    <span className="text-slate-400 font-medium">Vessel Type</span>
                    <div className="font-semibold text-slate-800 dark:text-slate-200">{selectedBerthDetails.current_vessel.vessel_type}</div>
                  </div>
                  <div>
                    <span className="text-slate-400 font-medium">Cargo Type</span>
                    <div className="font-semibold text-slate-800 dark:text-slate-200">{selectedBerthDetails.current_vessel.cargo_type}</div>
                  </div>
                  <div>
                    <span className="text-slate-400 font-medium">Cargo Quantity</span>
                    <div className="font-semibold text-slate-800 dark:text-slate-200">{selectedBerthDetails.current_vessel.cargo_quantity} MT</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-slate-500 text-center font-medium">
                No vessel currently occupying or assigned to this berth.
              </div>
            )}

            <div className="flex justify-end pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setSelectedBerthDetails(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 font-bold text-xs cursor-pointer"
              >
                Close Details
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
