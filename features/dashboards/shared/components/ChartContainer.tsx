import React from 'react';
import { motion } from '@/components/ui/MotionShim';

interface ChartContainerProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  controls?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  delay?: number;
}

export const ChartContainer: React.FC<ChartContainerProps> = ({
  title,
  description,
  icon,
  controls,
  children,
  className,
  delay = 0
}) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ duration: 0.5, delay }}
    className={`w-full min-w-0 ${className ?? ''}`}
  >
    <section className="flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border-0 bg-white text-slate-950 shadow-lg ring-1 ring-black/5">
      <header className="border-b border-slate-100 bg-slate-50/50 p-4 sm:p-5">
        <div className="flex min-w-0 flex-col justify-between gap-3 sm:flex-row sm:items-center sm:gap-4">
          <div className="flex min-w-0 items-start gap-2">
            {icon}
            <div>
              <h3 className="text-base font-semibold leading-tight tracking-tight text-brand-dark sm:text-xl">{title}</h3>
              {description && <p className="mt-1 text-xs leading-relaxed text-slate-500 sm:text-sm">{description}</p>}
            </div>
          </div>
          {controls && <div className="flex w-full flex-wrap gap-2 sm:w-auto">{controls}</div>}
        </div>
      </header>
      <div className="min-w-0 flex-1 p-3 pt-5 sm:p-5 sm:pt-7">
        {children}
      </div>
    </section>
  </motion.div>
);
