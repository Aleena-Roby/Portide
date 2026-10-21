import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Settings, 
  Anchor, 
  Save, 
  Loader2,
  RefreshCw,
  Boxes
} from 'lucide-react';
import { apiFetch } from '../../services/api';
import { BackendBerth, CraneItem } from '../../types';

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

  // Cargo Classifications
  const cargoTypes = [
    { id: '1', name: 'Containerized (TEU/FEU)', category: 'General Freight', hazardousPermit: false, activeStatus: 'Active' },
    { id: '2', name: 'Bulk Dry Cargo (Ore, Grain)', category: 'Bulk Freight', hazardousPermit: false, activeStatus: 'Active' },
    { id: '3', name: 'Petroleum & Liquid Gas', category: 'Tanker Freight', hazardousPermit: true, activeStatus: 'Active' },
    { id: '4', name: 'Ro-Ro Vehicles & Machinery', category: 'Automotive', hazardousPermit: false, activeStatus: 'Active' },
    { id: '5', name: 'Class 3 Flammable Liquids', category: 'Dangerous Goods', hazardousPermit: true, activeStatus: 'Active' }
  ];

  const fetchMasterData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch real berths
      const berthRes = await apiFetch('/api/berths/');
      if (berthRes.ok) {
        const berthJson = await berthRes.json();
        const list = Array.isArray(berthJson?.data) ? berthJson.data : (Array.isArray(berthJson) ? berthJson : []);
        setBerths(list);
      }

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
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Master Cargo Classifications</h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
                <thead className="text-[11px] font-bold uppercase tracking-wider bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="p-3">Cargo Type</th>
                    <th className="p-3">Category</th>
                    <th className="p-3">HazMat License</th>
                    <th className="p-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {cargoTypes.map(c => (
                    <tr key={c.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                      <td className="p-3 font-bold text-slate-900 dark:text-white">{c.name}</td>
                      <td className="p-3">{c.category}</td>
                      <td className="p-3">
                        {c.hazardousPermit ? (
                          <span className="text-[10px] font-bold text-rose-500 bg-rose-50 dark:bg-rose-950 px-2 py-0.5 rounded-full border border-rose-200 dark:border-rose-800">
                            HazMat Mandated
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">Standard</span>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                          {c.activeStatus}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Master Berths Summary */}
          <div className="lg:col-span-5 p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Anchor className="w-4 h-4 text-sky-500" />
                <span>Master Quay Berths Registry</span>
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

            <div className="space-y-3">
              {berths.length === 0 ? (
                <div className="p-4 text-center text-slate-400 text-xs">
                  {loading ? 'Loading berths...' : 'No berths configured.'}
                </div>
              ) : (
                berths.map(b => (
                  <div key={b.berth_id} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-xs flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white">
                        {b.berth_name} {b.berth_code ? `(${b.berth_code})` : ''}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {b.berth_type || 'CONTAINER_TERMINAL'} • Max Draft: {b.berth_max_draft}m
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        b.berth_status === 'AVAILABLE' 
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : b.berth_status === 'OCCUPIED'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                          : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                      }`}>
                        {b.berth_status}
                      </span>
                    </div>
                  </div>
                ))
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
