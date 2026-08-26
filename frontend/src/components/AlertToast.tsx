import React from 'react';
import { useSocket } from '../context/SocketContext';
import { RiskBadge } from './RiskBadge';
import { AlertOctagon, X, MapPin, Navigation, Siren } from 'lucide-react';

interface AlertToastProps {
  onSelectIncident: (incident: any) => void;
  onOpenLocation: (incident: any) => void;
}

const serviceName = (department: string) => {
  const names: Record<string, string> = {
    POLICE: 'Police Control Room',
    FIRE: 'Fire & Rescue Control',
    AMBULANCE: 'Ambulance / EMS Desk',
    GENERAL: 'Emergency Coordination Desk',
  };
  return names[department] || 'Emergency Coordination Desk';
};

export const AlertToast: React.FC<AlertToastProps> = ({ onSelectIncident, onOpenLocation }) => {
  const { activeAlerts, dismissAlert } = useSocket();

  if (activeAlerts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col space-y-3 max-w-sm w-full pointer-events-none">
      {activeAlerts.slice(0, 3).map((incident) => (
        <div
          key={incident.incident_id}
          className="alert-toast pointer-events-auto bg-slate-900/95 border border-red-500/80 rounded-xl p-4 shadow-2xl shadow-red-950/60 backdrop-blur-md transition-all hover:scale-[1.02]"
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-2">
              <div className="alert-beacon p-1.5 rounded-lg bg-red-950/80 border border-red-800/80 text-red-400">
                <AlertOctagon className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] font-mono font-bold text-red-400 uppercase tracking-wider">
                  NEW EMERGENCY DETECTED
                </span>
                <h4 className="text-xs font-bold text-white uppercase">
                  {incident.event_type.replace('_', ' ')}
                </h4>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <RiskBadge risk={incident.risk} />
              <button
                onClick={() => dismissAlert(incident.incident_id)}
                className="text-slate-400 hover:text-white p-1 rounded transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <p className="text-xs text-slate-300 flex items-center mt-2 font-mono">
            <MapPin className="w-3.5 h-3.5 mr-1 text-slate-500 flex-shrink-0" />
            <span className="truncate">{incident.camera_name} ({incident.location})</span>
          </p>

          <div className="mt-2 flex items-center gap-1.5 text-[10px] font-mono text-amber-300">
            <Siren className="w-3.5 h-3.5" />
            <span>ROUTED TO: {serviceName(incident.department).toUpperCase()}</span>
          </div>

          <div className="mt-3 pt-2 border-t border-slate-800 flex items-center justify-between gap-2 text-xs">
            <span className="text-[11px] font-mono text-slate-400">
              {Math.round(incident.confidence * 100)}% ({incident.backend})
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => onOpenLocation(incident)}
                className="px-2 py-1 rounded bg-slate-800 text-cyan-300 hover:bg-slate-700 border border-slate-700 text-xs font-semibold transition-colors"
                title="Open incident location"
              >
                <Navigation className="w-3 h-3" />
              </button>
              <button
                onClick={() => onSelectIncident(incident)}
                className="px-2.5 py-1 rounded bg-red-950 text-red-300 hover:bg-red-900 border border-red-800/60 text-xs font-semibold transition-colors"
              >
                Review →
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
