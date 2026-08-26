import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import {
  LayoutDashboard,
  Video,
  AlertOctagon,
  Flame,
  Ambulance,
  Activity,
  Cpu,
  BarChart3,
  Users,
  Camera,
  Sliders,
  FileText,
  ShieldAlert,
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const { isAdmin } = useAuth();
  const { activeAlerts } = useSocket();

  const policeAlertsCount = activeAlerts.filter((a) => a.department === 'POLICE' || a.department === 'GENERAL').length;
  const fireAlertsCount = activeAlerts.filter((a) => a.department === 'FIRE').length;
  const ambulanceAlertsCount = activeAlerts.filter((a) => a.department === 'AMBULANCE').length;

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
      isActive
        ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 shadow-md shadow-cyan-950/20'
        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
    }`;

  return (
    <aside className="w-64 bg-slate-950/90 border-r border-slate-800/80 flex flex-col h-[calc(100vh-4rem)] p-4 space-y-6 overflow-y-auto">
      {/* SECTION 1: OPERATIONS */}
      <div>
        <div className="text-[11px] font-mono uppercase tracking-wider text-slate-500 font-bold px-3 mb-2">
          Operations
        </div>
        <nav className="space-y-1">
          <NavLink to="/" className={navClass}>
            <div className="flex items-center">
              <LayoutDashboard className="w-4 h-4 mr-3 text-cyan-400" />
              <span>Dashboard</span>
            </div>
          </NavLink>

          <NavLink to="/cameras" className={navClass}>
            <div className="flex items-center">
              <Video className="w-4 h-4 mr-3 text-emerald-400" />
              <span>Live Cameras</span>
            </div>
          </NavLink>

          <NavLink to="/incidents" className={navClass}>
            <div className="flex items-center">
              <AlertOctagon className="w-4 h-4 mr-3 text-red-400" />
              <span>Incidents</span>
            </div>
            {activeAlerts.length > 0 && (
              <span className="bg-red-950 text-red-400 border border-red-800/80 text-[10px] font-bold px-2 py-0.5 rounded-full font-mono">
                {activeAlerts.length}
              </span>
            )}
          </NavLink>

          <NavLink to="/ai-vision" className={navClass}>
            <div className="flex items-center">
              <Cpu className="w-4 h-4 mr-3 text-purple-400" />
              <span>AI Vision Engine</span>
            </div>
          </NavLink>

          <NavLink to="/analytics" className={navClass}>
            <div className="flex items-center">
              <BarChart3 className="w-4 h-4 mr-3 text-blue-400" />
              <span>Analytics</span>
            </div>
          </NavLink>
        </nav>
      </div>

      {/* SECTION 2: EMERGENCY ALERT CENTRES */}
      <div>
        <div className="text-[11px] font-mono uppercase tracking-wider text-slate-500 font-bold px-3 mb-2 flex items-center justify-between">
          <span>Alert Management</span>
          <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
        </div>
        <nav className="space-y-1">
          <NavLink to="/alerts/police" className={navClass}>
            <div className="flex items-center">
              <Activity className="w-4 h-4 mr-3 text-cyan-400" />
              <span>Police Alerts</span>
            </div>
            {policeAlertsCount > 0 && (
              <span className="bg-cyan-950 text-cyan-400 border border-cyan-800 text-[10px] font-bold px-2 py-0.5 rounded-full font-mono">
                {policeAlertsCount}
              </span>
            )}
          </NavLink>

          <NavLink to="/alerts/fire" className={navClass}>
            <div className="flex items-center">
              <Flame className="w-4 h-4 mr-3 text-orange-400" />
              <span>Fire Station Alerts</span>
            </div>
            {fireAlertsCount > 0 && (
              <span className="bg-orange-950 text-orange-400 border border-orange-800 text-[10px] font-bold px-2 py-0.5 rounded-full font-mono">
                {fireAlertsCount}
              </span>
            )}
          </NavLink>

          <NavLink to="/alerts/ambulance" className={navClass}>
            <div className="flex items-center">
              <Ambulance className="w-4 h-4 mr-3 text-red-400" />
              <span>Ambulance Alerts</span>
            </div>
            {ambulanceAlertsCount > 0 && (
              <span className="bg-red-950 text-red-400 border border-red-800 text-[10px] font-bold px-2 py-0.5 rounded-full font-mono">
                {ambulanceAlertsCount}
              </span>
            )}
          </NavLink>
        </nav>
      </div>

      {/* SECTION 3: ADMINISTRATION (Admin Only) */}
      {isAdmin && (
        <div>
          <div className="text-[11px] font-mono uppercase tracking-wider text-slate-500 font-bold px-3 mb-2">
            Administration
          </div>
          <nav className="space-y-1">
            <NavLink to="/admin/users" className={navClass}>
              <div className="flex items-center">
                <Users className="w-4 h-4 mr-3 text-indigo-400" />
                <span>User Approvals</span>
              </div>
            </NavLink>

            <NavLink to="/admin/cameras" className={navClass}>
              <div className="flex items-center">
                <Camera className="w-4 h-4 mr-3 text-teal-400" />
                <span>Camera Manager</span>
              </div>
            </NavLink>

            <NavLink to="/admin/settings" className={navClass}>
              <div className="flex items-center">
                <Sliders className="w-4 h-4 mr-3 text-amber-400" />
                <span>System Settings</span>
              </div>
            </NavLink>

            <NavLink to="/admin/audit-logs" className={navClass}>
              <div className="flex items-center">
                <FileText className="w-4 h-4 mr-3 text-slate-400" />
                <span>Audit Logs</span>
              </div>
            </NavLink>
          </nav>
        </div>
      )}

      {/* Safety Notice Footer */}
      <div className="mt-auto pt-4 border-t border-slate-800/80 text-[11px] text-slate-500 font-mono">
        <p className="leading-tight">
          ASTRA Decision Support System. Autonomous emergency dispatch is disabled for human verification.
        </p>
      </div>
    </aside>
  );
};
