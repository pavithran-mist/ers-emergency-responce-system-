import React from 'react';
import { clsx } from 'clsx';

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  glow?: 'none' | 'red' | 'amber' | 'cyan' | 'emerald';
}

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  className,
  glow = 'none',
  ...props
}) => {
  const glowStyles = {
    none: 'border-slate-800/80 shadow-black/40',
    red: 'border-red-500/40 shadow-red-950/30',
    amber: 'border-amber-500/40 shadow-amber-950/30',
    cyan: 'border-cyan-500/40 shadow-cyan-950/30',
    emerald: 'border-emerald-500/40 shadow-emerald-950/30',
  };

  return (
    <div
      className={clsx(
        'bg-slate-900/80 backdrop-blur-md border rounded-xl p-5 shadow-lg transition-all duration-200',
        glowStyles[glow],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};
