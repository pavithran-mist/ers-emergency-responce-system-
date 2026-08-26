import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Clock, ShieldAlert, ArrowLeft, CheckCircle2 } from 'lucide-react';

export const PendingApprovalPage: React.FC = () => {
  const location = useLocation();
  const state = location.state as { email?: string; name?: string } | undefined;

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-6 relative overflow-hidden">
      <div className="w-full max-w-md bg-slate-900/80 border border-slate-800 backdrop-blur-xl p-8 rounded-2xl shadow-2xl z-10 text-center space-y-6">
        <div className="inline-flex p-4 rounded-2xl bg-amber-950/80 border border-amber-600/50 text-amber-400 shadow-xl shadow-amber-950/30 animate-pulse">
          <Clock className="w-10 h-10" />
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-bold text-white">Registration Application Submitted</h1>
          <p className="text-xs text-slate-400">
            Welcome, <span className="text-slate-200 font-semibold">{state?.name || 'Applicant'}</span>. Your registration for{' '}
            <span className="text-cyan-400 font-mono">{state?.email || 'your account'}</span> is currently pending administrator review.
          </p>
        </div>

        {/* Status Tracker Steps */}
        <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 text-left space-y-3 text-xs font-mono">
          <div className="flex items-center space-x-2.5 text-emerald-400">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>1. Registration Form Submitted</span>
          </div>
          <div className="flex items-center space-x-2.5 text-amber-400">
            <Clock className="w-4 h-4 flex-shrink-0 animate-spin" />
            <span>2. Administrator Verification (In Progress)</span>
          </div>
          <div className="flex items-center space-x-2.5 text-slate-600">
            <div className="w-4 h-4 rounded-full border border-slate-700 flex items-center justify-center text-[10px]">3</div>
            <span>3. Account Activated for Platform Login</span>
          </div>
        </div>

        <p className="text-[11px] text-slate-500 font-mono">
          Once your system administrator approves your profile from the User Approval dashboard, you can log in immediately.
        </p>

        <Link
          to="/login"
          className="inline-flex items-center justify-center space-x-2 w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to Login Page</span>
        </Link>
      </div>
    </div>
  );
};
