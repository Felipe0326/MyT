import React from 'react';

export const SectionTag: React.FC<{ color: 'red' | 'grn' | 'mora' | 'y' | 'indigo' | 'emerald', children: React.ReactNode }> = ({ color, children }) => {
  const bg = {
    red: 'bg-rose-500',
    grn: 'bg-emerald-600',
    mora: 'bg-stone-700',
    indigo: 'bg-emerald-700',
    emerald: 'bg-emerald-700',
    y: 'bg-amber-500',
  }[color] || 'bg-stone-400';

  return (
    <div className="flex items-center gap-3 font-mono text-[10px] tracking-[0.2em] uppercase text-stone-500 mb-4">
      <div className={`w-1.5 h-1.5 rounded-full ${bg}`} />
      {children}
    </div>
  );
};

export const KPI: React.FC<{ label: string; value: React.ReactNode; sub: string; color?: 'r' | 'g' | 'y' | 'm' | 'i' | 'e' }> = ({ label, value, sub, color }) => {
  const colorClass = {
    r: 'text-rose-600',
    g: 'text-emerald-700',
    y: 'text-amber-600',
    m: 'text-stone-700',
    i: 'text-emerald-700',
    e: 'text-emerald-700',
  }[color || ''] || 'text-stone-800';

  return (
    <div className="bg-white p-6">
      <div className="font-mono text-[10px] tracking-wider uppercase text-stone-500 mb-2">{label}</div>
      <div className={`font-sans text-3xl sm:text-4xl font-bold tracking-tight leading-none ${colorClass}`}>{value}</div>
      <div className="text-xs text-stone-400 mt-2 leading-relaxed" dangerouslySetInnerHTML={{ __html: sub }} />
    </div>
  );
};

export const Callout: React.FC<{ children: React.ReactNode; subtitle?: string }> = ({ children, subtitle }) => (
  <div className="bg-stone-100 text-stone-800 p-6 sm:px-7 sm:py-6 rounded-xl my-6 font-medium leading-relaxed border-l-4 border-emerald-700">
    {children}
    {subtitle && <small className="block font-normal text-xs text-stone-500 mt-2">{subtitle}</small>}
  </div>
);

export const Note: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="border-l-4 border-stone-300 bg-stone-50 p-3 sm:px-4 sm:py-3 text-xs text-stone-600 mt-4 rounded-r-xl leading-relaxed">
    <strong className="font-medium text-stone-700">{title}</strong> {children}
  </div>
);
