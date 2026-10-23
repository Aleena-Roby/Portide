import React from 'react';
import { ReadOnlyCargoDirectory } from '../common/ReadOnlyCargoDirectory';
import { DeliveryTracking } from './terminal/DeliveryTracking';
import { YardMaster } from './terminal/YardMaster';
import { YardAllocation } from './terminal/YardAllocation';
import { YardOperations } from './terminal/YardOperations';
import { CraneManagement } from './terminal/CraneManagement';
import { UnloadingOperations } from './terminal/UnloadingOperations';
import { LoadingOperations } from './terminal/LoadingOperations';

interface TerminalDashboardProps {
  activeTab?: string;
  onNavigate?: (tab: string) => void;
}

export const TerminalDashboard: React.FC<TerminalDashboardProps> = ({ activeTab = 'overview', onNavigate }) => {
  if (activeTab === 'direct-transfer' || activeTab === 'direct_transfer' || activeTab === 'ship-to-truck') {
    return <UnloadingOperations initialTab="discharge" onNavigate={onNavigate} />;
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

  if (activeTab === 'crane-management' || activeTab === 'cranes' || activeTab === 'crane') {
    return <CraneManagement onNavigate={onNavigate} />;
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

  return (
    <div className="space-y-6 font-sans selection:bg-[#D49A24] selection:text-white animate-fade-in">
      {/* WELCOME DASHBOARD CARD FOR TERMINAL & LOGISTICS OPERATOR */}
      <div className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 space-y-2 shadow-sm">
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
          Welcome, Terminal & Logistics Operator
        </h1>
        <p className="text-sm font-bold text-slate-900 dark:text-slate-200">
          Welcome to PORTIDE - Intelligent Maritime Port Operations Management Platform.
        </p>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-normal max-w-4xl">
          Oversee vessel cargo loads, container receiving from berthed vessels, and terminal yard positioning. Manage physical yards, blocks, and storage slots in Yard Master, and allocate inbound containers to yard coordinates in Yard Allocation.
        </p>
      </div>

      {/* QUICK MODULE LAUNCHPAD */}
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
            Discharge inbound containers from berthed vessels via active quay cranes directly to yard storage coordinates.
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
            Hoist export containers from yard storage coordinates and stow aboard berthed carrier vessels via quay cranes.
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
            Search container locations, perform atomic slot relocations, view verified movement history, and inspect block capacity utilization.
          </p>
        </div>

        <div 
          onClick={() => onNavigate?.('crane-management')}
          className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-amber-500/60 hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
            <span className="font-bold text-lg">🏗️</span>
          </div>
          <h3 className="font-black text-base text-slate-900 dark:text-white mb-1 group-hover:text-amber-500 transition-colors">
            Crane Management
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Manage STS and RTG heavy equipment, allocate cranes to scheduled vessels, and coordinate quay lifting operations.
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
  );
};

