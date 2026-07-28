import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { TrendingUp, LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion } from '../../../MotionShim';

interface StatCardProps {
  title: string;
  value: string;
  subValue?: string;
  icon: LucideIcon;
  description?: string;
  trend?: "up" | "down";
  trendLabel?: string;
  delay?: number;
}

export const StatCard: React.FC<StatCardProps> = ({ 
  title, 
  value, 
  subValue,
  icon: Icon, 
  description, 
  trend, 
  trendLabel,
  delay = 0
}) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay }}
  >
    <Card className="h-full min-w-0 border-l-4 border-l-brand-primary bg-white shadow-sm transition-shadow duration-300 hover:shadow-md">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 p-4 pb-2 sm:p-6 sm:pb-2">
        <CardTitle className="pr-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 sm:text-sm">{title}</CardTitle>
        <div className="p-1.5 sm:p-2 bg-brand-secondary/20 rounded-lg shrink-0">
          <Icon className="h-4 w-4 text-brand-dark sm:h-5 sm:w-5" />
        </div>
      </CardHeader>
      <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
        <div className="mt-1 break-words text-2xl font-bold text-brand-dark sm:mt-2 sm:text-3xl">{value}</div>
        {subValue && (
          <div className="text-[11px] sm:text-sm font-medium text-slate-400 mt-0.5 sm:mt-1">{subValue}</div>
        )}
        {(description || trendLabel) && (
          <p className="text-[10px] sm:text-xs text-slate-500 mt-2 flex items-center gap-1.5 font-medium">
            {trend === "up" && <TrendingUp className="h-3.5 w-3.5 text-brand-primary" />}
            <span className={cn(trend === "up" ? "text-brand-primary" : "")}>{trendLabel}</span>
            <span className="opacity-80">{description}</span>
          </p>
        )}
      </CardContent>
    </Card>
  </motion.div>
);
