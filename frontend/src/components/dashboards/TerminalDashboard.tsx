import React, { useState, useEffect, useCallback } from 'react';
import { ReadOnlyCargoDirectory } from '../common/ReadOnlyCargoDirectory';
import { DeliveryTracking } from './terminal/DeliveryTracking';
import { YardMaster } from './terminal/YardMaster';
import { YardAllocation } from './terminal/YardAllocation';
import { YardOperations } from './terminal/YardOperations';
import { UnloadingOperations } from './terminal/UnloadingOperations';
import { LoadingOperations } from './terminal/LoadingOperations';
import { apiFetch } from '../../services/api';
import { 
  Boxes, 
  RefreshCw, 
  Loader2, 
  BarChart3, 
  MapPin, 
  Ship
} from 'lucide-react';

interface TerminalDashboardProps {
  activeTab?: string;
  onNavigate?: (tab: string) => void;
}

export const TerminalDashboard: React.FC<TerminalDashboardProps> = ({ activeTab = 'overview', onNavigate }) => {
  const [statsData, setStatsData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/dashboard/stats/');
      if (res.ok) {
        const json = await res.json();
        if (json.status === 'success' && json.data) {
          setStatsData(json.data);
        }
      }
    } catch {
      // Graceful error fallback
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'overview') {
      fetchStats();
    }
  }, [activeTab, fetchStats]);

  if (activeTab === 'direct-transfer' || activeTab === 'direct_transfer' || activeTab === 'ship-to-truck') {
    return <UnloadingOperations initialTab="discharge" onNavigate={onNavigate} />;
  }

  if (activeTab === 'crane-management' || activeTab === 'cranes' || activeTab === 'crane') {
    return <TerminalDashboard activeTab="overview" onNavigate={onNavigate} />;
  }

  if (activeTab === 'unloading-operations' || activeTab === 'unloading' || activeTab === 'discharge') {
    return <UnloadingOperations onNavigate={onNavigate} />;
  }

  if (activeTab === 'loading-operations' || activeTab === 'loading' || activeTab === 'stowage') {
    return <LoadingOperations onNavigate={onNavigate} />;
  }

  if (activeTab === 'yard-master' || activeTab === 'yards' || activeTab === 'yard') {
    return <YardMaster />;
  }

  if (activeTab === 'yard-allocation' || activeTab === 'allocation' || activeTab === 'yard-allocations') {
    return <YardAllocation />;
  }

  if (activeTab === 'yard-operations' || activeTab === 'operations' || activeTab === 'yard-ops') {
    return <YardOperations />;
  }

  if (activeTab === 'delivery-tracking' || activeTab === 'delivery') {
    return <DeliveryTracking />;
  }

  if (activeTab === 'containers' || activeTab === 'cargo') {
    return (
      <ReadOnlyCargoDirectory
        title="Terminal Cargo Operations Directory"
        subtitle="Freight manifest inventory and vessel consignment overview — Container Terminal Operations"
        roleBadgeText="Terminal & Logistics Operator"
      />
    );
  }

  const kpis = statsData?.kpis || {};

  return (
    <div className="space-y-6 font-sans selection:bg-[#D49A24] selection:text-white animate-fade-in">
      
      {/* 1. WELCOME & REFRESH BANNER */}
      <div className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
            <Boxes className="w-4 h-4" />
            <span>Terminal & Yard Logistics Control Center</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            Welcome, Terminal & Logistics Operator
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium max-w-3xl">
            Oversee yard slot allocations, container receiving from berthed vessels, direct transfer handling, and container storage density.
          </p>
        </div>

        <button
          onClick={fetchStats}
          disabled={loading}
          className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center gap-2 transition-all shrink-0 cursor-pointer border border-slate-200 dark:border-slate-700"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
          ) : (
            <RefreshCw className="w-4 h-4 text-amber-500" />
          )}
          <span>{loading ? 'Refreshing...' : 'Refresh Yard Telemetry'}</span>
        </button>
      </div>

      {/* 2. REAL DATABASE OPERATIONAL YARD KPI CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div 
          onClick={() => onNavigate?.('yard-master')}
          className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 hover:border-amber-500/60 shadow-xs space-y-2 cursor-pointer transition-all group"
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider group-hover:text-amber-500 transition-colors">Yard Occupancy</span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
              <BarChart3 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-amber-600 dark:text-amber-400">
            {kpis.yard_occupancy_rate ?? 0}%
          </div>
          <div className="text-[11px] font-medium text-slate-500">
            {kpis.yard_occupied ?? 0} of {kpis.yard_capacity ?? 0} Total Slots
          </div>
        </div>

        <div 
          onClick={() => onNavigate?.('yard-allocation')}
          className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 hover:border-emerald-500/60 shadow-xs space-y-2 cursor-pointer transition-all group"
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider group-hover:text-emerald-500 transition-colors">Active Allocations</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
              <MapPin className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400">
            {kpis.active_allocations ?? 0}
          </div>
          <div className="text-[11px] font-medium text-slate-500">
            Positioned in Physical Yard Blocks
          </div>
        </div>

        <div 
          onClick={() => onNavigate?.('unloading-operations')}
          className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 hover:border-sky-500/60 shadow-xs space-y-2 cursor-pointer transition-all group"
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider group-hover:text-sky-500 transition-colors">Discharged Cargo</span>
            <div className="w-8 h-8 rounded-xl bg-sky-500/10 text-sky-600 flex items-center justify-center font-bold">
              <Ship className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-sky-600 dark:text-sky-400">
            {kpis.discharged_movements ?? 0}
          </div>
          <div className="text-[11px] font-medium text-slate-500">
            Inbound Containers Unloaded
          </div>
        </div>

        <div 
          onClick={() => onNavigate?.('loading-operations')}
          className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 hover:border-indigo-500/60 shadow-xs space-y-2 cursor-pointer transition-all group"
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider group-hover:text-indigo-500 transition-colors">Loaded / Stowed</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center font-bold">
              <Boxes className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-indigo-600 dark:text-indigo-400">
            {kpis.loading_movements ?? 0}
          </div>
          <div className="text-[11px] font-medium text-slate-500">
            Export Containers Stowed
          </div>
        </div>
      </div>

      {/* 3. QUICK MODULE LAUNCHPAD */}
      <div className="space-y-3 pt-2">
        <h2 className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
          TERMINAL OPERATIONS & MODULE LAUNCHPAD
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          <div 
            onClick={() => onNavigate?.('unloading-operations')}
            className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-amber-500/50 hover:shadow-md transition-all cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
              <span className="font-bold text-lg">🚢</span>
            </div>
            <h3 className="font-black text-base text-slate-900 dark:text-white mb-1 group-hover:text-amber-500 transition-colors">
              Unloading Operations
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Discharge inbound containers from berthed vessels directly to yard storage coordinates.
            </p>
          </div>

          <div 
            onClick={() => onNavigate?.('loading-operations')}
            className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-500/50 hover:shadow-md transition-all cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
              <span className="font-bold text-lg">📤</span>
            </div>
            <h3 className="font-black text-base text-slate-900 dark:text-white mb-1 group-hover:text-emerald-500 transition-colors">
              Loading Operations
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Hoist export containers from yard storage coordinates and stow aboard berthed carrier vessels.
            </p>
          </div>

          <div 
            onClick={() => onNavigate?.('yard-master')}
            className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-amber-500/50 hover:shadow-md transition-all cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
              <span className="font-bold text-lg">🏭</span>
            </div>
            <h3 className="font-black text-base text-slate-900 dark:text-white mb-1 group-hover:text-amber-500 transition-colors">
              Yard Master Management
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Manage terminal yards, operational container blocks, and individual coordinate slots (Row, Bay, Tier) with capacity tracking.
            </p>
          </div>

          <div 
            onClick={() => onNavigate?.('yard-allocation')}
            className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-amber-500/50 hover:shadow-md transition-all cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-[#D49A24] flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
              <span className="font-bold text-lg">📍</span>
            </div>
            <h3 className="font-black text-base text-slate-900 dark:text-white mb-1 group-hover:text-[#D49A24] transition-colors">
              Yard Allocation & Storage
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Allocate pending containers to available storage slots, track occupied coordinates, and maintain movement history.
            </p>
          </div>

          <div 
            onClick={() => onNavigate?.('yard-operations')}
            className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-[#D49A24]/60 hover:shadow-md transition-all cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-[#D49A24] flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
              <span className="font-bold text-lg">🔄</span>
            </div>
            <h3 className="font-black text-base text-slate-900 dark:text-white mb-1 group-hover:text-[#D49A24] transition-colors">
              Yard Operations
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Search container locations, inspect simple yard position codes (Y001, Y002), and monitor block and yard capacity utilization.
            </p>
          </div>

          <div 
            onClick={() => onNavigate?.('delivery-tracking')}
            className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-500/50 hover:shadow-md transition-all cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
              <span className="font-bold text-lg">🚚</span>
            </div>
            <h3 className="font-black text-base text-slate-900 dark:text-white mb-1 group-hover:text-blue-500 transition-colors">
              Container Delivery Tracking
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Monitor container lifecycle progression from gate clearance through final transit and consignee delivery.
            </p>
          </div>

          <div 
            onClick={() => onNavigate?.('containers')}
            className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-500/50 hover:shadow-md transition-all cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
              <span className="font-bold text-lg">📦</span>
            </div>
            <h3 className="font-black text-base text-slate-900 dark:text-white mb-1 group-hover:text-emerald-500 transition-colors">
              Cargo & Manifest Directory
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Inspect incoming vessel manifests, freight consignment weights, and terminal receiving schedules.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
