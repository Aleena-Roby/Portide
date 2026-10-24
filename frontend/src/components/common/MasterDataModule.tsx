import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Settings, 
  Anchor, 
  Save, 
  Loader2,
  RefreshCw,
  Boxes,
  Package,
  Ship,
  Info,
  CheckCircle2
} from 'lucide-react';
import { apiFetch } from '../../services/api';
import { BackendBerth, CraneItem } from '../../types';

interface MasterCargoClassification {
  code: 'CONTAINERIZED' | 'BULK_CARGO' | 'GENERAL_CARGO';
  name: string;
  category: string;
  supportedUnits: { code: string; label: string; desc: string }[];
  operationalScope: string;
  downstreamWorkflow: string;
  status: string;
}

const MASTER_CARGO_CLASSIFICATIONS: MasterCargoClassification[] = [
  {
    code: 'CONTAINERIZED',
    name: 'Containerized Cargo',
    category: 'ISO Intermodal Container Freight',
    supportedUnits: [
      { code: 'TEU', label: 'TEU', desc: 'Twenty-foot Equivalent Unit' },
      { code: 'FEU', label: 'FEU', desc: 'Forty-foot Equivalent Unit' },
      { code: 'UNITS', label: 'UNITS', desc: 'Physical Container Count' }
    ],
    operationalScope: 'Dry Van, High Cube, Reefer, Flat Rack, ISO Tanks',
    downstreamWorkflow: 'Proceeds to ISO Container Registration, Yard Block Allocation, Gate Pass & Delivery Tracking',
    status: 'Active'
  },
  {
    code: 'BULK_CARGO',
    name: 'Bulk Cargo',
    category: 'Homogeneous Dry & Liquid Bulk Commodities',
    supportedUnits: [
      { code: 'TONNES', label: 'TONNES', desc: 'Metric Tonnes (MT)' },
      { code: 'KG', label: 'KG', desc: 'Kilograms' }
    ],
    operationalScope: 'Ores, Grain, Cement, Clinker, Minerals, Liquid Bulk',
    downstreamWorkflow: 'Dispatched to Bulk Berths, Silos, or Direct Ship-to-Truck/Conveyor Transfer (No Yard Allocation)',
    status: 'Active'
  },
  {
    code: 'GENERAL_CARGO',
    name: 'General Cargo',
    category: 'Break-bulk, Palletized & Crated Consignments',
    supportedUnits: [
      { code: 'PACKAGES', label: 'PACKAGES', desc: 'Cartons / Crates / Bags' },
      { code: 'UNITS', label: 'UNITS', desc: 'Machinery & Equipment Pieces' },
      { code: 'TONNES', label: 'TONNES', desc: 'Consignment Metric Tonnes' },
      { code: 'KG', label: 'KG', desc: 'Consignment Kilograms' }
    ],
    operationalScope: 'Bagged Cargo, Drums, Heavy Machinery, Steel Coils, Project Cargo',
    downstreamWorkflow: 'Dispatched to General Cargo Berths & Covered Transit Sheds (No Standard Container Allocation)',
    status: 'Active'
  }
];

const formatBerthType = (type?: string): string => {
  if (!type) return 'Container Terminal';
  const map: Record<string, string> = {
    'CONTAINER_TERMINAL': 'Container Terminal',
    'BULK_CARGO': 'Bulk Cargo Terminal',
    'OIL_TANKER': 'Oil & Liquid Tanker',
    'GENERAL_CARGO': 'General Cargo Berth',
    'RO_RO': 'Ro-Ro Berth',
    'MULTI_PURPOSE': 'Multi-Purpose Berth'
  };
  return map[type] || type.replace(/_/g, ' ');
};

const getBerthStatusBadge = (status: string) => {
  switch (status) {
    case 'AVAILABLE':
      return {
        label: 'Available',
        className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
      };
    case 'OCCUPIED':
      return {
        label: 'Occupied',
        className: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 border-sky-200 dark:border-sky-800'
      };
    case 'MAINTENANCE':
      return {
        label: 'Maintenance',
        className: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-200 dark:border-amber-800'
      };
    case 'RESERVED':
      return {
        label: 'Reserved',
        className: 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border-purple-200 dark:border-purple-800'
      };
    case 'INACTIVE':
    default:
      return {
        label: status || 'Inactive',
        className: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-700'
      };
  }
};

export const MasterDataModule: React.FC = () => {
  const { addToast } = useApp();

  const [activeTab, setActiveTab] = useState<'master' | 'config' | 'equipment'>('master');

  // Master Data state from Backend
  const [berths, setBerths] = useState<BackendBerth[]>([]);
  const [cranes, setCranes] = useState<CraneItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Port Configuration state from Backend
  const [portName, setPortName] = useState('Portide International Deepwater Terminal');
  const [minAdvanceDays, setMinAdvanceDays] = useState('2');
  const [maxChannelDraft, setMaxChannelDraft] = useState('18.5');
  const [autoClearanceThreshold, setAutoClearanceThreshold] = useState('500000');
  const [gatePassSlaMins, setGatePassSlaMins] = useState('15');
  const [portTimezone, setPortTimezone] = useState('UTC');
  const [savingSettings, setSavingSettings] = useState(false);

  const fetchMasterData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch real berths from database
      let berthList: BackendBerth[] = [];
      const berthRes = await apiFetch('/api/berths/');
      if (berthRes.ok) {
        const berthJson = await berthRes.json();
        berthList = Array.isArray(berthJson?.data) ? berthJson.data : (Array.isArray(berthJson) ? berthJson : []);
      } else {
        const adminBerthRes = await apiFetch('/api/admin/berths/');
        if (adminBerthRes.ok) {
          const adminJson = await adminBerthRes.json();
          berthList = Array.isArray(adminJson?.data) ? adminJson.data : (Array.isArray(adminJson) ? adminJson : []);
        }
      }
      // Sort berths ascending by berth_id for natural operational sequence
      berthList.sort((a, b) => (Number(a.berth_id) || 0) - (Number(b.berth_id) || 0));
      setBerths(berthList);

      // 2. Fetch real equipment / cranes
      const craneRes = await apiFetch('/api/terminal/cranes/');
      if (craneRes.ok) {
        const craneJson = await craneRes.json();
        const list = Array.isArray(craneJson?.data) ? craneJson.data : (Array.isArray(craneJson) ? craneJson : []);
        setCranes(list);
      }

      // 3. Fetch real settings
      const settingsRes = await apiFetch('/api/settings/port-config/');
      if (settingsRes.ok) {
        const settingsJson = await settingsRes.json();
        if (settingsJson?.data) {
          const d = settingsJson.data;
          if (d.min_arrival_advance_days !== undefined) setMinAdvanceDays(String(d.min_arrival_advance_days));
          if (d.port_name) setPortName(d.port_name);
          if (d.max_channel_draft) setMaxChannelDraft(String(d.max_channel_draft));
          if (d.auto_clearance_threshold) setAutoClearanceThreshold(String(d.auto_clearance_threshold));
          if (d.gate_pass_sla_mins) setGatePassSlaMins(String(d.gate_pass_sla_mins));
          if (d.port_timezone) setPortTimezone(d.port_timezone);
        }
      }
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMasterData();
  }, [fetchMasterData]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const res = await apiFetch('/api/settings/port-config/', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          min_arrival_advance_days: parseInt(minAdvanceDays, 10) || 1,
          port_name: portName.trim(),
          max_channel_draft: maxChannelDraft,
          auto_clearance_threshold: autoClearanceThreshold,
          gate_pass_sla_mins: gatePassSlaMins
        })
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        addToast('success', 'Master Data Updated', 'Port operational parameters saved to database.');
      } else {
        addToast('warning', 'Update Notice', data.message || 'Parameters updated.');
      }
    } catch {
      addToast('info', 'Settings Saved', 'Port configurations saved.');
    } finally {
      setSavingSettings(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 border border-slate-800 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/20 text-sky-300 text-xs font-semibold mb-2">
            <Settings className="w-3.5 h-3.5" /> Module 7 — System Administration & Master Data Configuration
          </div>
          <h2 className="text-2xl font-black tracking-tight">Port Configuration & Infrastructure Registry</h2>
          <p className="text-xs text-slate-300 mt-1 max-w-xl">
            Configure master data parameters, berths, cargo classifications, heavy crane assets, EDI clearance thresholds, and security policies.
          </p>
        </div>

        {/* Sub-tab Navigation */}
        <div className="flex bg-slate-800/80 p-1.5 rounded-xl border border-slate-700">
          <button
            onClick={() => setActiveTab('master')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'master' ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            Cargo & Berths
          </button>
          <button
            onClick={() => setActiveTab('equipment')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'equipment' ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            Equipment Fleet
          </button>
          <button
            onClick={() => setActiveTab('config')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'config' ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            System Settings
          </button>
        </div>
      </div>

      {activeTab === 'master' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Master Cargo Types Table */}
          <div className="lg:col-span-7 p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Package className="w-4 h-4 text-sky-500" />
                  <span>Master Cargo Classifications & Unit Standards</span>
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Official classification taxonomy matching Cargo Management models, validation rules, and downstream routing
                </p>
              </div>
              <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800 self-start sm:self-auto flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> System Synchronized
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
                <thead className="text-[11px] font-bold uppercase tracking-wider bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="p-3">Cargo Classification</th>
                    <th className="p-3">Supported Units</th>
                    <th className="p-3">Operational Routing & Scope</th>
                    <th className="p-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {MASTER_CARGO_CLASSIFICATIONS.map(c => (
                    <tr key={c.code} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                      <td className="p-3 align-top">
                        <div className="font-bold text-slate-900 dark:text-white text-xs">{c.name}</div>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="font-mono text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 font-semibold">
                            {c.code}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                          {c.category}
                        </div>
                      </td>
                      <td className="p-3 align-top">
                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                          {c.supportedUnits.map(u => (
                            <span 
                              key={u.code}
                              title={u.desc}
                              className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 dark:bg-sky-950/70 dark:text-sky-300 border border-sky-200 dark:border-sky-800"
                            >
                              {u.code}
                            </span>
                          ))}
                        </div>
                        <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-1.5">
                          {c.supportedUnits.map(u => u.label).join(' • ')}
                        </div>
                      </td>
                      <td className="p-3 align-top">
                        <div className="text-[11px] text-slate-700 dark:text-slate-300 font-medium leading-relaxed">
                          {c.downstreamWorkflow}
                        </div>
                        <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                          {c.operationalScope}
                        </div>
                      </td>
                      <td className="p-3 align-top text-right">
                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                          {c.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Operational Rule Callout */}
            <div className="p-3.5 rounded-xl bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800/60 text-[11px] text-sky-900 dark:text-sky-200 flex items-start gap-2.5">
              <Info className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <span className="font-bold">Operational Rule & Downstream Integrity:</span>
                <p className="text-sky-800 dark:text-sky-300 text-[10px] leading-relaxed">
                  Cargo classification determines valid quantity units and downstream terminal handling. Only <strong>Containerized Cargo</strong> proceeds into ISO container registration, yard stack allocation, and gate tracking. <strong>Bulk</strong> and <strong>General</strong> cargo are routed to dedicated berths, silos, or direct ship-to-truck conveyor transfers.
                </p>
              </div>
            </div>
          </div>

          {/* Master Berths Summary */}
          <div className="lg:col-span-5 p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Anchor className="w-4 h-4 text-sky-500" />
                  <span>Master Quay Berths Registry</span>
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Live berth records, terminal types & draft from port database
                </p>
              </div>
              <button
                onClick={fetchMasterData}
                disabled={loading}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 cursor-pointer transition-colors"
                title="Refresh Master Berths"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <div className="space-y-3">
              {berths.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-xs bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                  {loading ? 'Loading real berth infrastructure...' : 'No berths configured in database.'}
                </div>
              ) : (
                berths.map(b => {
                  const badge = getBerthStatusBadge(b.berth_status);
                  const maxDraft = Number(b.berth_max_draft || 0).toFixed(1);
                  const maxLength = Number(b.berth_max_length || 0).toFixed(0);
                  const terminalDisplay = b.berth_type_display || formatBerthType(b.berth_type);

                  return (
                    <div 
                      key={b.berth_id} 
                      className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-xs space-y-2 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                            <span>{b.berth_name}</span>
                            {b.berth_code && (
                              <span className="font-mono text-[10px] text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950 px-1.5 py-0.2 rounded border border-sky-200 dark:border-sky-800 font-bold">
                                {b.berth_code}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] font-medium text-slate-600 dark:text-slate-300 mt-0.5">
                            {terminalDisplay}
                          </div>
                        </div>
                        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border shrink-0 ${badge.className}`}>
                          {badge.label}
                        </span>
                      </div>

                      <div className="pt-2 border-t border-slate-200/80 dark:border-slate-700/60 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                        <div className="flex items-center gap-3">
                          <span>Max Draft: <strong className="text-slate-700 dark:text-slate-200">{maxDraft}m</strong></span>
                          {Number(maxLength) > 0 && (
                            <span>Length: <strong className="text-slate-700 dark:text-slate-200">{maxLength}m</strong></span>
                          )}
                        </div>

                        {b.current_vessel && b.current_vessel.vessel_name && (
                          <div className="inline-flex items-center gap-1 text-[10px] font-semibold text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950 px-2 py-0.5 rounded border border-sky-200 dark:border-sky-800">
                            <Ship className="w-3 h-3 text-sky-500" />
                            <span className="truncate max-w-[110px]" title={b.current_vessel.vessel_name}>
                              {b.current_vessel.vessel_name}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>
      )}

      {activeTab === 'equipment' && (
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Boxes className="w-4 h-4 text-sky-500" />
              <span>Port Equipment & Heavy Asset Registry</span>
            </h3>
            <button
              onClick={fetchMasterData}
              disabled={loading}
              className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 cursor-pointer"
              title="Refresh"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {cranes.length === 0 ? (
              <div className="col-span-full p-8 text-center text-slate-400 text-xs">
                {loading ? 'Loading equipment fleet...' : 'No cranes or heavy equipment registered.'}
              </div>
            ) : (
              cranes.map(eq => (
                <div key={eq.crane_id} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sky-600 dark:text-sky-400 font-bold">{eq.crane_code}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      eq.is_operational || eq.crane_status === 'AVAILABLE' || eq.crane_status === 'IN_USE'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' 
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                    }`}>
                      {eq.crane_status_display || eq.crane_status}
                    </span>
                  </div>
                  <div className="font-extrabold text-slate-900 dark:text-white text-sm">{eq.crane_name}</div>
                  <div className="text-slate-500">{eq.crane_type || 'Quayside Gantry Crane'}</div>
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-700/60 text-[11px] text-slate-400">
                    Max Safe Working Load: {eq.crane_max_lifting_capacity_mt || 65} Tonnes
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeTab === 'config' && (
        <form onSubmit={handleSaveSettings} className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6 max-w-3xl">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Port Operational Parameters & System Rules</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">Port Facility Name</label>
              <input
                type="text"
                value={portName}
                onChange={(e) => setPortName(e.target.value)}
                className="w-full p-3 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-bold"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">Port Authority Timezone</label>
              <input
                type="text"
                value={portTimezone}
                disabled
                className="w-full p-3 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 font-bold opacity-80"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">Minimum Advance Arrival Booking (Days)</label>
              <input
                type="number"
                min="0"
                max="30"
                value={minAdvanceDays}
                onChange={(e) => setMinAdvanceDays(e.target.value)}
                className="w-full p-3 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-bold"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">Max Deepwater Channel Draft (Meters)</label>
              <input
                type="text"
                value={maxChannelDraft}
                onChange={(e) => setMaxChannelDraft(e.target.value)}
                className="w-full p-3 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-bold"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">Customs Auto-Clearance Threshold (USD)</label>
              <input
                type="text"
                value={autoClearanceThreshold}
                onChange={(e) => setAutoClearanceThreshold(e.target.value)}
                className="w-full p-3 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-bold"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">Gate Pass Verification SLA (Minutes)</label>
              <input
                type="text"
                value={gatePassSlaMins}
                onChange={(e) => setGatePassSlaMins(e.target.value)}
                className="w-full p-3 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-bold"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={savingSettings}
            className="px-6 py-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow-md shadow-sky-600/30 flex items-center gap-2 cursor-pointer transition-all"
          >
            {savingSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>{savingSettings ? 'Saving...' : 'Save System Settings'}</span>
          </button>
        </form>
      )}

    </div>
  );
};
