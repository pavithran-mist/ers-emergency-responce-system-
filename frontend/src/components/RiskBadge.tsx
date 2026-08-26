import React from 'react';
import { clsx } from 'clsx';
import { RiskLevel } from '../types';

interface RiskBadgeProps {
  risk: RiskLevel | string;
  className?: string;
  showIcon?: boolean;
}

export const RiskBadge: React.FC<RiskBadgeProps> = ({ risk, className, showIcon = true }) => {
  const normRisk = (risk || 'LOW').toUpperCase();

  const getStyle = () => {
    switch (normRisk) {
      case 'CRITICAL':
        return 'bg-red-950/90 text-red-400 border-red-500 shadow-lg shadow-red-950/50 animate-pulse';
      case 'HIGH':
        return 'bg-orange-950/90 text-orange-400 border-orange-500/80 shadow-md shadow-orange-950/30';
      case 'MEDIUM':
        return 'bg-amber-950/80 text-amber-300 border-amber-500/60';
      case 'LOW':
      default:
        return 'bg-emerald-950/80 text-emerald-400 border-emerald-600/40';
    }
  };

  const getIcon = () => {
    switch (normRisk) {
      case 'CRITICAL':
        return '🔥';
      case 'HIGH':
        return '🚨';
      case 'MEDIUM':
        return '⚠️';
      case 'LOW':
      default:
        return '🛡️';
    }
  };

  return (
    <span
      className={clsx(
        'inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider border font-mono',
        getStyle(),
        className
      )}
    >
      {showIcon && <span className="mr-1.5 text-xs">{getIcon()}</span>}
      {normRisk}
    </span>
  );
};
