import React from 'react';
import { clsx } from 'clsx';

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className }) => {
  const normStatus = status.toUpperCase();

  const getStyle = () => {
    switch (normStatus) {
      case 'ONLINE':
      case 'APPROVED':
      case 'RESOLVED':
        return 'bg-emerald-950/80 text-emerald-400 border-emerald-600/40';
      case 'OFFLINE':
      case 'DISABLED':
      case 'REJECTED':
        return 'bg-rose-950/80 text-rose-400 border-rose-600/40';
      case 'PENDING':
      case 'REVIEWING':
        return 'bg-amber-950/80 text-amber-400 border-amber-600/40 animate-pulse';
      case 'NEW':
        return 'bg-red-950/80 text-red-400 border-red-600/50 animate-pulse';
      case 'ACKNOWLEDGED':
        return 'bg-cyan-950/80 text-cyan-400 border-cyan-600/40';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  return (
    <span
      className={clsx(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider border',
        getStyle(),
        className
      )}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5" />
      {normStatus}
    </span>
  );
};
