import React from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ToggleBtnProps {
  active: boolean;
  onClick: () => void;
  icon?: LucideIcon;
  label: string;
}

export const ToggleBtn: React.FC<ToggleBtnProps> = ({ active, onClick, icon: Icon, label }) => (
  <button
    onClick={onClick}
    className={cn(
      "px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-lg flex items-center gap-2 outline-none focus:outline-none transition-all",
      active
        ? "bg-white text-brand-dark shadow-sm"
        : "text-slate-500 hover:text-brand-dark hover:bg-slate-200/50"
    )}
  >
    {Icon && <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
    {label}
  </button>
);
