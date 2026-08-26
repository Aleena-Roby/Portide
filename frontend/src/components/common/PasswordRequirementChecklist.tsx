import React from 'react';
import { Check } from 'lucide-react';
import { checkPasswordRequirements } from '../../utils/passwordValidation';

interface PasswordRequirementChecklistProps {
  password: string;
  className?: string;
}

export const PasswordRequirementChecklist: React.FC<PasswordRequirementChecklistProps> = ({
  password,
  className = ''
}) => {
  const reqs = checkPasswordRequirements(password);

  const items = [
    { label: 'At least 8 characters', met: reqs.minLength },
    { label: 'One uppercase letter (A-Z)', met: reqs.hasUpper },
    { label: 'One lowercase letter (a-z)', met: reqs.hasLower },
    { label: 'One number (0-9)', met: reqs.hasNumber },
    { label: 'One special character (e.g. !@#$%)', met: reqs.hasSpecial },
  ];

  return (
    <div className={`p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-1.5 ${className}`}>
      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
        Password requirements:
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
        {items.map((item, index) => (
          <div
            key={index}
            className={`flex items-center gap-1.5 font-medium transition-colors ${
              item.met
                ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                : 'text-slate-400 dark:text-slate-500'
            }`}
          >
            {item.met ? (
              <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 stroke-[3]" />
            ) : (
              <span className="w-3.5 h-3.5 flex items-center justify-center text-[10px] text-slate-400 shrink-0 font-bold">•</span>
            )}
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
