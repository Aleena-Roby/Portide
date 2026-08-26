import React from 'react';

export const CustomsDashboard: React.FC = () => {
  return (
    <div className="space-y-6 font-sans selection:bg-[#D49A24] selection:text-white animate-fade-in">
      {/* WELCOME DASHBOARD CARD FOR CUSTOMS AUTHORITY */}
      <div className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 space-y-2 shadow-sm">
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
          Welcome, Customs Authority
        </h1>
        <p className="text-sm font-bold text-slate-900 dark:text-slate-200">
          Welcome to PORTIDE - Intelligent Maritime Port Operations Management Platform.
        </p>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-normal max-w-4xl">
          Manage vessel scheduling, berth allocation, cargo operations, shipping organizations, and port services through one centralized enterprise platform.
        </p>
      </div>
    </div>
  );
};

