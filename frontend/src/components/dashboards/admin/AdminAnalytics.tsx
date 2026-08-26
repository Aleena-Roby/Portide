import React from 'react';
import { useApp } from '../../../context/AppContext';
import { BarChart3, TrendingUp, Ship, Anchor, Boxes, Clock, CheckCircle2, AlertCircle } from 'lucide-react';

export const AdminAnalytics: React.FC = () => {
  const { vessels, berths, containers } = useApp();

  const occupiedBerths = berths.filter(b => b.status === 'Occupied').length;
  const occupancyRate = berths.length > 0 ? Math.round((occupiedBerths / berths.length) * 100) : 0;

  return (
    <div className="space-y-6 animate-fade-in font-sans">
      {/* Header */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
            <BarChart3 className="w-6 h-6 text-[#D49A24]" />
            <span>Port Performance & Operational Analytics</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium pt-1">
            Real-time telemetry, vessel turn-around velocity, berth utilization metrics, and quay throughput.
          </p>
        </div>
      </div>

      {/* Analytics KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Berth Occupancy</span>
            <Anchor className="w-5 h-5 text-cyan-600" />
          </div>
          <div className="text-3xl font-black text-slate-900 dark:text-white">{occupancyRate}%</div>
          <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
            <div className="bg-cyan-500 h-full rounded-full" style={{ width: `${occupancyRate}%` }} />
          </div>
          <p className="text-[11px] text-slate-500 font-medium">{occupiedBerths} of {berths.length} Quays Active</p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Vessels Managed</span>
            <Ship className="w-5 h-5 text-[#D49A24]" />
          </div>
          <div className="text-3xl font-black text-slate-900 dark:text-white">{vessels.length}</div>
          <div className="text-xs text-emerald-600 font-bold flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>+14% vs last month</span>
          </div>
          <p className="text-[11px] text-slate-500 font-medium">Commercial fleet active in port</p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Yard Inventory</span>
            <Boxes className="w-5 h-5 text-indigo-500" />
          </div>
          <div className="text-3xl font-black text-slate-900 dark:text-white">{containers.length} TEUs</div>
          <div className="text-xs text-slate-500 font-medium">92% Yard Stacking Efficiency</div>
          <p className="text-[11px] text-slate-500 font-medium">Tracked in Yard Zones A-D</p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Avg Anchorage Wait</span>
            <Clock className="w-5 h-5 text-emerald-500" />
          </div>
          <div className="text-3xl font-black text-slate-900 dark:text-white">2.4 hrs</div>
          <div className="text-xs text-emerald-600 font-bold flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Optimal Turnaround Velocity</span>
          </div>
          <p className="text-[11px] text-slate-500 font-medium">35% reduction in anchorage delay</p>
        </div>
      </div>

      {/* Quay Capacity Breakdown */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <h3 className="text-base font-bold text-slate-900 dark:text-white">Berth Operational Distribution</h3>
        <div className="space-y-3 text-xs">
          {berths.length === 0 ? (
            <div className="p-4 text-center text-slate-500 font-medium">
              No berths configured.
            </div>
          ) : (
            berths.map(berth => (
              <div key={berth.id} className="space-y-1">
                <div className="flex justify-between font-bold text-slate-800 dark:text-slate-200">
                  <span>{berth.name} ({berth.code})</span>
                  <span>{berth.status} • {berth.occupancyPercent || 0}%</span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-300 ${
                      berth.status === 'Occupied' ? 'bg-[#D49A24]' : 'bg-emerald-500'
                    }`} 
                    style={{ width: `${berth.occupancyPercent || 15}%` }} 
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
