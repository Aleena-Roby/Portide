import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Settings, 
  Layers, 
  Anchor, 
  Boxes, 
  CheckCircle2, 
  Plus, 
  Sliders, 
  ShieldCheck, 
  Save,
  Radio,
  FileCheck2
} from 'lucide-react';

export const MasterDataModule: React.FC = () => {
  const { berths, addToast } = useApp();

  const [activeTab, setActiveTab] = useState<'master' | 'config' | 'equipment'>('master');

  // Port Configuration state
  const [portName, setPortName] = useState('Portide International Deepwater Terminal');
  const [maxChannelDraft, setMaxChannelDraft] = useState('18.5');
  const [autoClearanceThreshold, setAutoClearanceThreshold] = useState('500000');
  const [gatePassSlaMins, setGatePassSlaMins] = useState('15');

  // Master Data: Cargo Types
  const [cargoTypes, setCargoTypes] = useState([
    { id: '1', name: 'Containerized (TEU/FEU)', category: 'General Freight', hazardousPermit: false, activeStatus: 'Active' },
    { id: '2', name: 'Bulk Dry Cargo (Ore, Grain)', category: 'Bulk Freight', hazardousPermit: false, activeStatus: 'Active' },
    { id: '3', name: 'Petroleum & Liquid Gas', category: 'Tanker Freight', hazardousPermit: true, activeStatus: 'Active' },
    { id: '4', name: 'Ro-Ro Vehicles & Machinery', category: 'Automotive', hazardousPermit: false, activeStatus: 'Active' },
    { id: '5', name: 'Class 3 Flammable Liquids', category: 'Dangerous Goods', hazardousPermit: true, activeStatus: 'Active' }
  ]);

  // Master Data: Equipment Fleet
  const [equipmentList, setEquipmentList] = useState([
    { id: 'EQ-101', name: 'STS Gantry Crane #01', type: 'Super Post-Panamax Crane', terminal: 'Container Terminal 1', status: 'Operational' },
    { id: 'EQ-102', name: 'STS Gantry Crane #02', type: 'Super Post-Panamax Crane', terminal: 'Container Terminal 1', status: 'Operational' },
    { id: 'EQ-201', name: 'Reach Stacker Kalmar #05', type: 'Container Stacker 45T', terminal: 'Yard Zone A', status: 'Operational' },
    { id: 'EQ-301', name: 'Harbour Tugboat Titan', type: 'Bollard Pull 80T Tugboat', terminal: 'Deepwater Channel', status: 'Operational' },
    { id: 'EQ-401', name: 'RFID Gate OCR Scanner #03', type: 'Automated Gate Optical Reader', terminal: 'Gate Lane 3', status: 'Maintenance' }
  ]);

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    addToast('success', 'Master Data Updated', 'Port configurations and master data rules saved successfully.');
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
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'master' ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            Cargo & Berths
          </button>
          <button
            onClick={() => setActiveTab('equipment')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'equipment' ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            Equipment Fleet
          </button>
          <button
            onClick={() => setActiveTab('config')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
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
              <button 
                onClick={() => addToast('info', 'Master Data', 'Cargo category creation modal active.')}
                className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add Cargo Type
              </button>
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
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Master Quay Berths Registry</h3>
            <div className="space-y-3">
              {berths.map(b => (
                <div key={b.id} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-xs flex items-center justify-between">
                  <div>
                    <div className="font-bold text-slate-900 dark:text-white">{b.name}</div>
                    <div className="text-[10px] text-slate-400">{b.terminal} • Max Draft: {b.maxDraftMeters}m</div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-sky-600 dark:text-sky-400">{b.cranesAvailable} Cranes</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      {activeTab === 'equipment' && (
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Port Equipment & Heavy Asset Registry</h3>
            <button 
              onClick={() => addToast('info', 'Equipment Registry', 'New STS Crane / Reach Stacker registered.')}
              className="px-3.5 py-1.5 rounded-xl bg-sky-600 text-white text-xs font-bold flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Register Equipment
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {equipmentList.map(eq => (
              <div key={eq.id} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sky-600 dark:text-sky-400 font-bold">{eq.id}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    eq.status === 'Operational' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                  }`}>
                    {eq.status}
                  </span>
                </div>
                <div className="font-extrabold text-slate-900 dark:text-white text-sm">{eq.name}</div>
                <div className="text-slate-500">{eq.type}</div>
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700/60 text-[11px] text-slate-400">
                  Assigned: {eq.terminal}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'config' && (
        <form onSubmit={handleSaveSettings} className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6 max-w-3xl">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Port Operational Parameters & System Rules</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">Port Name</label>
              <input
                type="text"
                value={portName}
                onChange={(e) => setPortName(e.target.value)}
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
              <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">Gate Pass Appointment SLA (Minutes)</label>
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
            className="px-6 py-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow-md shadow-sky-600/30 flex items-center gap-2"
          >
            <Save className="w-4 h-4" /> Save System Settings
          </button>
        </form>
      )}

    </div>
  );
};
