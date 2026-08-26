import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Sparkles, 
  TrendingUp, 
  Clock, 
  AlertTriangle, 
  Ship, 
  Anchor, 
  BarChart3, 
  CloudRain, 
  Wind, 
  CheckCircle2, 
  Layers, 
  Zap,
  ArrowRight,
  Filter,
  RefreshCw
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  BarChart, 
  Bar, 
  LineChart, 
  Line 
} from 'recharts';

export const AIPredictiveModule: React.FC = () => {
  const { vessels, berths, addToast } = useApp();

  const [selectedVesselId, setSelectedVesselId] = useState(vessels[0]?.id || 'V-001');
  const [simulationWeather, setSimulationWeather] = useState<'Clear' | 'Rain' | 'High Winds'>('Clear');
  const [craneEfficiency, setCraneEfficiency] = useState<number>(92);
  const [isRecalculating, setIsRecalculating] = useState(false);

  // Selected Vessel Data
  const selectedVessel = vessels.find(v => v.id === selectedVesselId) || vessels[0];

  // Simulated 72-Hour Congestion Prediction Data
  const CONGESTION_FORECAST = [
    { time: '00:00', congestion: 42, waitingHours: 1.2, vesselsInRoadstead: 3, riskLevel: 'Low' },
    { time: '04:00', congestion: 48, waitingHours: 1.8, vesselsInRoadstead: 4, riskLevel: 'Low' },
    { time: '08:00', congestion: 78, waitingHours: 4.1, vesselsInRoadstead: 9, riskLevel: 'High' },
    { time: '12:00', congestion: 89, waitingHours: 5.8, vesselsInRoadstead: 12, riskLevel: 'Critical' },
    { time: '16:00', congestion: 82, waitingHours: 4.9, vesselsInRoadstead: 10, riskLevel: 'High' },
    { time: '20:00', congestion: 64, waitingHours: 2.8, vesselsInRoadstead: 6, riskLevel: 'Medium' },
    { time: '24:00 (+1d)', congestion: 52, waitingHours: 2.1, vesselsInRoadstead: 5, riskLevel: 'Low' },
    { time: '06:00 (+1d)', congestion: 61, waitingHours: 2.5, vesselsInRoadstead: 6, riskLevel: 'Medium' },
    { time: '12:00 (+1d)', congestion: 74, waitingHours: 3.8, vesselsInRoadstead: 8, riskLevel: 'High' },
    { time: '18:00 (+1d)', congestion: 58, waitingHours: 2.3, vesselsInRoadstead: 5, riskLevel: 'Medium' },
  ];

  // Turnaround Prediction calculation
  const baseTurnaroundHours = (selectedVessel?.cargoVolumeTonnes || 20000) / 1200; // ~ 16 to 30 hours
  const weatherImpactMultiplier = simulationWeather === 'High Winds' ? 1.35 : simulationWeather === 'Rain' ? 1.15 : 1.0;
  const craneImpactMultiplier = (100 - craneEfficiency) * 0.008 + 0.92;
  const predictedTurnaround = (baseTurnaroundHours * weatherImpactMultiplier * craneImpactMultiplier).toFixed(1);
  const estimatedDelayHours = simulationWeather !== 'Clear' ? (parseFloat(predictedTurnaround) * 0.2).toFixed(1) : '0.4';

  const handleRunSimulation = () => {
    setIsRecalculating(true);
    setTimeout(() => {
      setIsRecalculating(false);
      addToast('success', 'AI Prediction Engine Re-calculated', `Updated forecasts for ${selectedVessel.name} based on ${simulationWeather} & ${craneEfficiency}% crane speed.`);
    }, 600);
  };

  return (
    <div className="space-y-6">
      
      {/* Header Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-950 via-teal-950 to-slate-900 border border-teal-800/60 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/20 text-teal-300 text-xs font-semibold mb-2 border border-teal-500/40">
            <Sparkles className="w-3.5 h-3.5 text-teal-400 animate-pulse" /> Phase 2 AI Predictive Intelligence Engine
          </div>
          <h2 className="text-2xl font-black tracking-tight text-white">Port Congestion & Vessel Turnaround Analytics</h2>
          <p className="text-xs text-slate-300 mt-1 max-w-2xl">
            Neural network models analyzing historical vessel movements, berth occupancy, weather dynamics, cargo volume, customs clearance rate, and crane availability.
          </p>
        </div>

        <button
          onClick={handleRunSimulation}
          disabled={isRecalculating}
          className="px-5 py-3 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs shadow-lg shadow-teal-600/30 flex items-center gap-2 transition-all shrink-0"
        >
          <RefreshCw className={`w-4 h-4 ${isRecalculating ? 'animate-spin' : ''}`} />
          <span>{isRecalculating ? 'Running Model...' : 'Run AI Prediction Model'}</span>
        </button>
      </div>

      {/* Module 1: Port Congestion Prediction Section */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">
              Module 1 — Port Congestion Prediction
            </div>
            <h3 className="text-lg font-black text-slate-900 dark:text-white">
              72-Hour Port Congestion Level & Peak Traffic Forecast
            </h3>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs font-semibold bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 px-3 py-1.5 rounded-xl border border-rose-200 dark:border-rose-800">
              <AlertTriangle className="w-4 h-4" />
              <span>Peak Risk: 12:00 (89% Congestion)</span>
            </div>
          </div>
        </div>

        {/* 4 Congestion KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-1">
            <div className="text-xs font-bold text-slate-500 uppercase">Current Congestion Index</div>
            <div className="text-2xl font-black text-slate-900 dark:text-white flex items-baseline gap-2">
              <span>68.4%</span>
              <span className="text-xs font-bold text-amber-500 uppercase">Moderate</span>
            </div>
            <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden mt-2">
              <div className="h-full bg-amber-500 rounded-full" style={{ width: '68.4%' }} />
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-1">
            <div className="text-xs font-bold text-slate-500 uppercase">Est. Vessel Waiting Time</div>
            <div className="text-2xl font-black text-slate-900 dark:text-white">
              3.4 <span className="text-xs font-semibold text-slate-400">Hours Avg</span>
            </div>
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">↓ -0.8 hrs vs yesterday</p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-1">
            <div className="text-xs font-bold text-slate-500 uppercase">Roadstead Anchored Queue</div>
            <div className="text-2xl font-black text-slate-900 dark:text-white">
              7 <span className="text-xs font-semibold text-slate-400">Vessels</span>
            </div>
            <p className="text-[11px] text-sky-600 dark:text-sky-400 font-medium">Berth allocation in progress</p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-1">
            <div className="text-xs font-bold text-slate-500 uppercase">Peak Traffic Window</div>
            <div className="text-2xl font-black text-slate-900 dark:text-white">
              10:00 - 15:00
            </div>
            <p className="text-[11px] text-rose-500 font-semibold">High tidal swell expected</p>
          </div>

        </div>

        {/* 72-Hour Forecast Chart */}
        <div className="space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="font-bold text-slate-700 dark:text-slate-300">Congestion Rate (%) vs Estimated Waiting Hours</span>
            <div className="flex gap-4 text-[11px] text-slate-500 font-medium">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-teal-500" /> Congestion Level (%)</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Waiting Hours</span>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={CONGESTION_FORECAST}>
                <defs>
                  <linearGradient id="colorCongestion" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0D9488" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#0D9488" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.15} />
                <XAxis dataKey="time" stroke="#94A3B8" fontSize={11} />
                <YAxis stroke="#94A3B8" fontSize={11} />
                <Tooltip contentStyle={{ backgroundColor: '#0F172A', borderRadius: '12px', color: '#fff', fontSize: '12px' }} />
                <Area type="monotone" dataKey="congestion" name="Congestion (%)" stroke="#0D9488" fillOpacity={1} fill="url(#colorCongestion)" />
                <Line type="monotone" dataKey="waitingHours" name="Wait Time (hrs)" stroke="#F59E0B" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Congestion Risk Mitigation AI Alerts */}
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-3">
          <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-500" />
            AI Congestion Mitigation Recommendations
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
              <span className="font-bold text-teal-600 dark:text-teal-400">1. Optimize Quay Berth B-03 Slot Assignment</span>
              <p className="text-slate-600 dark:text-slate-300">
                Shift vessel <strong className="text-slate-900 dark:text-white">Maersk Mc-Kinney</strong> arrival by 45 mins to avoid peak tidal bottleneck at Channel 02.
              </p>
            </div>
            <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
              <span className="font-bold text-amber-600 dark:text-amber-400">2. Gate Pass Staggering Request</span>
              <p className="text-slate-600 dark:text-slate-300">
                Disperse 35 container pickup appointments from 13:00 to 15:30 slot to reduce E-Gate queue wait time by 18 minutes.
              </p>
            </div>
          </div>
        </div>

      </div>

      {/* Module 2: Vessel Turnaround Time Prediction Section */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">
              Module 2 — Vessel Turnaround Time Prediction
            </div>
            <h3 className="text-lg font-black text-slate-900 dark:text-white">
              Vessel-Specific Turnaround Time, Delay Risk & Efficiency Analyzer
            </h3>
          </div>

          {/* Controls */}
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Select Vessel</label>
              <select
                value={selectedVesselId}
                onChange={(e) => setSelectedVesselId(e.target.value)}
                className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white"
              >
                {vessels.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({v.type})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Weather Factor</label>
              <select
                value={simulationWeather}
                onChange={(e) => setSimulationWeather(e.target.value as any)}
                className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white"
              >
                <option value="Clear">Clear Weather (1.0x)</option>
                <option value="Rain">Moderate Rain (1.15x)</option>
                <option value="High Winds">High Winds / Swell (1.35x)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Selected Vessel Prediction Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          
          {/* Left Summary Box */}
          <div className="lg:col-span-5 p-5 rounded-2xl bg-gradient-to-br from-teal-950 via-slate-900 to-slate-950 border border-teal-800 text-white space-y-4 shadow-md">
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Ship className="w-5 h-5 text-teal-400" />
                <span className="font-extrabold text-sm">{selectedVessel.name}</span>
              </div>
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30">
                IMO: {selectedVessel.imo}
              </span>
            </div>

            <div className="space-y-1">
              <div className="text-xs text-slate-400">AI Estimated Turnaround Duration</div>
              <div className="text-4xl font-black text-teal-400">
                {predictedTurnaround} <span className="text-sm font-semibold text-slate-300">Hours</span>
              </div>
              <p className="text-xs text-slate-300">
                Baseline SLA: {baseTurnaroundHours.toFixed(1)} hrs • Predicted Delay: <span className="font-bold text-amber-400">+{estimatedDelayHours} hrs</span>
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Cargo Volume:</span>
                <span className="font-bold text-white">{selectedVessel.cargoVolumeTonnes.toLocaleString()} Tonnes</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Assigned Quay Berth:</span>
                <span className="font-bold text-teal-300">{selectedVessel.assignedBerthName || 'Berth B-02'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Target ETD:</span>
                <span className="font-bold text-white">{selectedVessel.etd}</span>
              </div>
            </div>

          </div>

          {/* Right Factors Chart */}
          <div className="lg:col-span-7 space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Operational Impact Factor Breakdown (%)
            </h4>

            <div className="space-y-3">
              {[
                { name: 'Quay Crane Unloading Rate', score: craneEfficiency, color: 'bg-teal-500', note: `${craneEfficiency}% speed rating` },
                { name: 'e-Customs Manifest Clearance', score: 94, color: 'bg-emerald-500', note: 'Cleared without inspection hold' },
                { name: 'Yard Reach Stacker Availability', score: 88, color: 'bg-indigo-500', note: '12 active reach stackers' },
                { name: 'Weather & Tidal Swell', score: simulationWeather === 'Clear' ? 100 : simulationWeather === 'Rain' ? 75 : 55, color: simulationWeather === 'Clear' ? 'bg-sky-500' : 'bg-amber-500', note: `${simulationWeather} status` }
              ].map((f, i) => (
                <div key={i} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-bold text-slate-800 dark:text-slate-200">{f.name}</span>
                    <span className="text-slate-500 text-[11px]">{f.note} ({f.score}%)</span>
                  </div>
                  <div className="h-2 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div className={`h-full ${f.color} rounded-full`} style={{ width: `${f.score}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
