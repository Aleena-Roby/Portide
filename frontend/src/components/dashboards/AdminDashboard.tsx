import React, { useState, useEffect, useCallback } from 'react';
import { 
  FileCheck,
  Users,
  Shield,
  ArrowRight,
  Anchor,
  Ship,
  Boxes,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Loader2,
  Truck,
  BarChart3,
  Sliders,
  ShieldCheck
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid 
} from 'recharts';
import { apiFetch } from '../../services/api';
import { AdminUserManagement } from './admin/AdminUserManagement';
import { CompanyApprovals } from './admin/CompanyApprovals';
import { AdminAuditLogs } from './admin/AdminAuditLogs';
import { AdminBerthManagement } from './admin/AdminBerthManagement';
import { AdminGatePassMonitoring } from './admin/AdminGatePassMonitoring';
import { AdminAnalytics } from './admin/AdminAnalytics';
import { MasterDataModule } from '../common/MasterDataModule';

interface AdminDashboardProps {
  activeTab?: string;
  onNavigate?: (tab: string) => void;
}

const CHART_COLORS = ['#38BDF8', '#10B981', '#F59E0B', '#F43F5E', '#8B5CF6'];

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ activeTab = 'overview', onNavigate }) => {
  const [statsData, setStatsData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchDashboardStats = useCallback(async () => {
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
      // Graceful fallback
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'overview') {
      fetchDashboardStats();
    }
  }, [activeTab, fetchDashboardStats]);

  const quickAccessCards = [
    {
      id: 'analytics',
      title: 'Operational Telemetry & Analytics',
      description: 'Real-time telemetry, vessel turn-around velocity, berth utilization metrics, and quay throughput.',
      icon: BarChart3
    },
    {
      id: 'berths',
      title: 'Berth Master Management',
      description: 'Configure port berth infrastructure, draft & length specifications, and operational status.',
      icon: Anchor
    },
    {
      id: 'master-data',
      title: 'Port Master Infrastructure Registry',
      description: 'Configure port facility parameters, cargo classifications, terminal storage parameters, and security thresholds.',
      icon: Sliders
    },
    {
      id: 'company-approvals',
      title: 'Shipping Company Approvals',
      description: 'Review registration requests, verify license documents, and approve or reject shipping company access.',
      icon: FileCheck
    },
    {
      id: 'users',
      title: 'User & Registration Management',
      description: 'Create internal staff accounts, assign operational roles, and manage user activations.',
      icon: Users
    },
    {
      id: 'gate-passes',
      title: 'Digital Gate Passes Monitor',
      description: 'Real-time audit log of all port gate movement authorizations, transport trucks, assigned drivers, and barrier releases.',
      icon: Truck
    },
    {
      id: 'audit',
      title: 'Security & Audit Logs',
      description: 'Review real-time system audit logs, user activity trails, and platform events.',
      icon: Shield
    }
  ];

  // Specific Sub-modules
  if (activeTab === 'analytics') return <AdminAnalytics />;
  if (activeTab === 'master-data' || activeTab === 'master_data' || activeTab === 'config') return <MasterDataModule />;
  if (activeTab === 'berths' || activeTab === 'berth-management') return <AdminBerthManagement />;
  if (activeTab === 'company-approvals' || activeTab === 'company_approvals') return <CompanyApprovals />;
  if (activeTab === 'users') return <AdminUserManagement />;
  if (activeTab === 'gate-passes' || activeTab === 'gate_passes') return <AdminGatePassMonitoring />;
  if (activeTab === 'audit') return <AdminAuditLogs />;

  const kpis = statsData?.kpis || {};
  const charts = statsData?.charts || {};

  const cargoClassificationData = (charts.cargo_classification || []).filter((d: any) => d.value > 0);
  const cargoDirectionData = (charts.cargo_direction || []).filter((d: any) => d.value > 0);
  const containerStatusData = (charts.container_status_distribution || []).filter((d: any) => d.value > 0);
  const berthUtilizationData = (charts.berth_utilization || []).filter((d: any) => d.value > 0);

  // Overview
  return (
    <div className="space-y-6 font-sans selection:bg-[#D49A24] selection:text-white animate-fade-in">
      
      {/* 1. WELCOME & REFRESH BANNER */}
      <div className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#D49A24]">
            <Shield className="w-4 h-4" />
            <span>Port Operations Command & Control</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            Welcome, Port Administrator
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium max-w-3xl">
            Live operational intelligence across vessels, berth quayside occupancy, freight cargo manifestations, customs pipeline, and gate movements.
          </p>
        </div>

        <button
          onClick={fetchDashboardStats}
          disabled={loading}
          className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center gap-2 transition-all shrink-0 cursor-pointer border border-slate-200 dark:border-slate-700"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin text-[#D49A24]" />
          ) : (
            <RefreshCw className="w-4 h-4 text-[#D49A24]" />
          )}
          <span>{loading ? 'Refreshing...' : 'Refresh Telemetry'}</span>
        </button>
      </div>

      {/* 2. REAL DATABASE OPERATIONAL KPI CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Vessels */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Registered Fleet</span>
            <div className="w-8 h-8 rounded-xl bg-[#D49A24]/10 text-[#D49A24] flex items-center justify-center font-bold">
              <Ship className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-slate-900 dark:text-white">
            {kpis.total_vessels ?? 0}
          </div>
          <div className="text-[11px] font-medium text-slate-500">
            Active Registered Vessels
          </div>
        </div>

        {/* Pending Arrival Requests */}
        <div 
          onClick={() => onNavigate && onNavigate('analytics')}
          className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 hover:border-amber-500/60 shadow-xs space-y-2 cursor-pointer group transition-all"
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider group-hover:text-amber-500 transition-colors">Pending Arrivals</span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
              <Clock className="w-4 h-4 animate-pulse" />
            </div>
          </div>
          <div className="text-3xl font-black text-amber-600 dark:text-amber-400">
            {kpis.pending_arrival_requests ?? 0}
          </div>
          <div className="text-[11px] font-medium text-slate-500">
            {kpis.approved_arrival_requests ?? 0} Approved for Scheduling
          </div>
        </div>

        {/* Berth Occupancy */}
        <div 
          onClick={() => onNavigate && onNavigate('berths')}
          className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 hover:border-cyan-500/60 shadow-xs space-y-2 cursor-pointer group transition-all"
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider group-hover:text-cyan-500 transition-colors">Quay Utilization</span>
            <div className="w-8 h-8 rounded-xl bg-cyan-500/10 text-cyan-600 flex items-center justify-center font-bold">
              <Anchor className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-cyan-600 dark:text-cyan-400">
            {kpis.berth_occupancy_rate ?? 0}%
          </div>
          <div className="text-[11px] font-medium text-slate-500">
            {kpis.occupied_berths ?? 0} of {kpis.total_berths ?? 0} Quays Active ({kpis.available_berths ?? 0} Available)
          </div>
        </div>

        {/* Total Cargo & Containers */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Cargo & Containers</span>
            <div className="w-8 h-8 rounded-xl bg-sky-500/10 text-sky-600 flex items-center justify-center font-bold">
              <Boxes className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-slate-900 dark:text-white">
            {kpis.total_containers ?? 0}
          </div>
          <div className="text-[11px] font-medium text-slate-500">
            Across {kpis.total_cargo ?? 0} Consignment Records
          </div>
        </div>

        {/* Customs Workload */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Customs Status</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400">
            {kpis.customs_cleared ?? 0}
          </div>
          <div className="text-[11px] font-medium text-slate-500">
            Cleared ({kpis.customs_pending ?? 0} Pending • {kpis.customs_hold ?? 0} Hold)
          </div>
        </div>

        {/* Yard Storage Occupancy */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Yard Storage</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center font-bold">
              <BarChart3 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-indigo-600 dark:text-indigo-400">
            {kpis.yard_occupancy_rate ?? 0}%
          </div>
          <div className="text-[11px] font-medium text-slate-500">
            {kpis.yard_occupied ?? 0} of {kpis.yard_capacity ?? 0} Slots Occupied
          </div>
        </div>

        {/* Pending Company Approvals */}
        <div 
          onClick={() => onNavigate && onNavigate('company-approvals')}
          className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 hover:border-purple-500/60 shadow-xs space-y-2 cursor-pointer group transition-all"
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider group-hover:text-purple-500 transition-colors">Org Approvals</span>
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center font-bold">
              <FileCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-purple-600 dark:text-purple-400">
            {kpis.pending_registrations ?? 0}
          </div>
          <div className="text-[11px] font-medium text-slate-500">
            Companies Awaiting Verification →
          </div>
        </div>

        {/* Active Digital Gate Passes */}
        <div 
          onClick={() => onNavigate && onNavigate('gate-passes')}
          className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 hover:border-teal-500/60 shadow-xs space-y-2 cursor-pointer group transition-all"
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider group-hover:text-teal-500 transition-colors">Active Gate Passes</span>
            <div className="w-8 h-8 rounded-xl bg-teal-500/10 text-teal-600 flex items-center justify-center font-bold">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-teal-600 dark:text-teal-400">
            {kpis.active_gate_passes ?? 0}
          </div>
          <div className="text-[11px] font-medium text-slate-500">
            Active Digital Passes in Port →
          </div>
        </div>
      </div>

      {/* 3. OPERATIONAL DISTRIBUTION VISUALIZATIONS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Cargo Classification Breakdown */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                Cargo Classification Breakdown
              </h3>
              <p className="text-xs text-slate-500">Distribution by Containerized, Bulk, and General freight records</p>
            </div>
            <Boxes className="w-4 h-4 text-[#D49A24]" />
          </div>

          {cargoClassificationData.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-slate-400 text-xs space-y-1">
              <Boxes className="w-8 h-8 text-slate-300 dark:text-slate-600" />
              <p className="font-semibold text-slate-500">No registered cargo records yet</p>
              <p className="text-[11px] text-slate-400">Manifest entries will appear here upon submission.</p>
            </div>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={cargoClassificationData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#D49A24" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Chart 2: Cargo Direction (Import vs Export) */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                Import vs Export Distribution
              </h3>
              <p className="text-xs text-slate-500">Consignment movement trade flow balance</p>
            </div>
            <BarChart3 className="w-4 h-4 text-sky-500" />
          </div>

          {cargoDirectionData.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-slate-400 text-xs space-y-1">
              <BarChart3 className="w-8 h-8 text-slate-300 dark:text-slate-600" />
              <p className="font-semibold text-slate-500">No active cargo trade flow</p>
              <p className="text-[11px] text-slate-400">Import/Export records will display here.</p>
            </div>
          ) : (
            <div className="h-64 w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={cargoDirectionData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {cargoDirectionData.map((_: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Chart 3: Container Status Distribution */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                Container Operational Lifecycle
              </h3>
              <p className="text-xs text-slate-500">Containers across terminal, inspection, customs & gate exit</p>
            </div>
            <Boxes className="w-4 h-4 text-emerald-500" />
          </div>

          {containerStatusData.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-slate-400 text-xs space-y-1">
              <Boxes className="w-8 h-8 text-slate-300 dark:text-slate-600" />
              <p className="font-semibold text-slate-500">No container lifecycle records</p>
              <p className="text-[11px] text-slate-400">Container statuses will populate as cargo moves through port.</p>
            </div>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={containerStatusData} layout="vertical" margin={{ top: 10, right: 20, left: 20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={100} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#10B981" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Chart 4: Berth Utilization */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                Quayside Berth Availability
              </h3>
              <p className="text-xs text-slate-500">Port quays available vs occupied vs maintenance</p>
            </div>
            <Anchor className="w-4 h-4 text-cyan-500" />
          </div>

          {berthUtilizationData.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-slate-400 text-xs space-y-1">
              <Anchor className="w-8 h-8 text-slate-300 dark:text-slate-600" />
              <p className="font-semibold text-slate-500">No berths registered</p>
              <p className="text-[11px] text-slate-400">Configure berths in Berth Master Management.</p>
            </div>
          ) : (
            <div className="h-64 w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={berthUtilizationData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {berthUtilizationData.map((_: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[(index + 2) % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* 4. QUICK ACCESS SECTION */}
      <div className="space-y-3 pt-2">
        <h2 className="text-xs font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-400">
          ADMINISTRATIVE CONTROL & MODULE ACCESS
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {quickAccessCards.map((card) => {
            const IconComp = card.icon;
            return (
              <div
                key={card.id}
                onClick={() => onNavigate && onNavigate(card.id)}
                className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 shadow-xs cursor-pointer h-full group"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center font-bold">
                      <IconComp className="w-5 h-5 group-hover:scale-105 transition-transform" />
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-400 dark:text-slate-500 group-hover:text-slate-900 dark:group-hover:text-white group-hover:translate-x-1 transition-all" />
                  </div>

                  <h3 className="text-base font-black text-slate-900 dark:text-white group-hover:text-[#D49A24] dark:group-hover:text-[#D49A24] transition-colors mb-1">
                    {card.title}
                  </h3>

                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-normal">
                    {card.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
};
