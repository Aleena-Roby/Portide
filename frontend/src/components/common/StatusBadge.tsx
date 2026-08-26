import React from 'react';

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md' | 'lg';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  const norm = status.toLowerCase().trim();

  let styles = 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
  let dotColor = 'bg-slate-400';

  if (
    norm.includes('approved') || 
    norm.includes('cleared') || 
    norm.includes('active') || 
    norm.includes('completed') || 
    norm.includes('at berth') ||
    norm.includes('available')
  ) {
    styles = 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800';
    dotColor = 'bg-emerald-500';
  } else if (
    norm.includes('pending') || 
    norm.includes('anchored') || 
    norm.includes('berth assigned') || 
    norm.includes('reserved') || 
    norm.includes('in terminal') ||
    norm.includes('scheduled')
  ) {
    styles = 'bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800';
    dotColor = 'bg-sky-500';
  } else if (
    norm.includes('occupied') || 
    norm.includes('in yard') || 
    norm.includes('generated') || 
    norm.includes('loading') || 
    norm.includes('unloading')
  ) {
    styles = 'bg-indigo-50 text-indigo-800 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800';
    dotColor = 'bg-indigo-500';
  } else if (
    norm.includes('hold') || 
    norm.includes('flagged') || 
    norm.includes('delayed') || 
    norm.includes('maintenance') || 
    norm.includes('inspection')
  ) {
    styles = 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800';
    dotColor = 'bg-amber-500';
  } else if (
    norm.includes('rejected') || 
    norm.includes('suspended') || 
    norm.includes('expired')
  ) {
    styles = 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800';
    dotColor = 'bg-rose-500';
  }

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5 font-medium',
    lg: 'text-sm px-3 py-1.5 gap-2 font-medium'
  }[size];

  return (
    <span className={`inline-flex items-center rounded-full border whitespace-nowrap ${sizeClasses} ${styles}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
      {status}
    </span>
  );
};
