import React from 'react';
import { 
  FileCheck,
  Users,
  Shield,
  ArrowRight,
  Anchor
} from 'lucide-react';
import { AdminUserManagement } from './admin/AdminUserManagement';
import { CompanyApprovals } from './admin/CompanyApprovals';
import { AdminAuditLogs } from './admin/AdminAuditLogs';
import { AdminBerthManagement } from './admin/AdminBerthManagement';
import { AdminGatePassMonitoring } from './admin/AdminGatePassMonitoring';
import { AdminAnalytics } from './admin/AdminAnalytics';
import { MasterDataModule } from '../common/MasterDataModule';
import { Truck, BarChart3, Sliders } from 'lucide-react';

interface AdminDashboardProps {
  activeTab?: string;
  onNavigate?: (tab: string) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ activeTab = 'overview', onNavigate }) => {
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

  // Render specific view selected from Sidebar
  if (activeTab === 'analytics') {
    return <AdminAnalytics />;
  }

  if (activeTab === 'master-data' || activeTab === 'master_data' || activeTab === 'config') {
    return <MasterDataModule />;
  }

  if (activeTab === 'berths' || activeTab === 'berth-management') {
    return <AdminBerthManagement />;
  }

  if (activeTab === 'company-approvals' || activeTab === 'company_approvals') {
    return <CompanyApprovals />;
  }

  if (activeTab === 'users') {
    return <AdminUserManagement />;
  }

  if (activeTab === 'gate-passes' || activeTab === 'gate_passes') {
    return <AdminGatePassMonitoring />;
  }

  if (activeTab === 'audit') {
    return <AdminAuditLogs />;
  }

  // Default / Overview view
  return (
    <div className="space-y-6 font-sans selection:bg-[#D49A24] selection:text-white animate-fade-in">
      
      {/* 1. WELCOME CARD */}
      <div className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 space-y-2 shadow-xs">
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
          Welcome, Port Administrator
        </h1>
        <p className="text-sm font-bold text-slate-900 dark:text-slate-200">
          PORTIDE — Enterprise Maritime Port Operations Intelligence Platform.
        </p>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-normal max-w-4xl">
          Manage platform access, organization approvals, user roles, and administrative oversight across port operations.
        </p>
      </div>

      {/* 2. QUICK ACCESS SECTION */}
      <div className="space-y-3">
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
