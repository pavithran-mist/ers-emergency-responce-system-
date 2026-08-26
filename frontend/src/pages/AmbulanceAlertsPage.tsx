import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Incident } from '../types';
import { GlassCard } from '../components/GlassCard';
import { RiskBadge } from '../components/RiskBadge';
import { StatusBadge } from '../components/StatusBadge';
import { IncidentActionModal } from '../components/IncidentActionModal';
import { LocationMapModal } from '../components/LocationMapModal';
import { Ambulance, ShieldAlert, MapPin, RefreshCw, AlertTriangle, PhoneCall } from 'lucide-react';

export const AmbulanceAlertsPage: React.FC = () => {
  const [alerts, setAlerts] = useState<Incident[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [loading, setLoading] = useState(true);

  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [locationIncident, setLocationIncident] = useState<Incident | null>(null);

  const loadAlerts = async () => {
    setLoading(true);
    try {
      const data = await api.getAmbulanceAlerts(statusFilter || undefined);
      setAlerts(data);
    } catch (err) {
      console.error('Failed to load ambulance alerts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAlerts();
  }, [statusFilter]);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-red-950/80 border border-red-700/60 text-red-400">
              <Ambulance className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-black text-white">Emergency Medical & Ambulance Dispatch Queue</h1>
              <p className="text-xs text-slate-400">
                Triage queue for high-risk vehicular collisions, multi-vehicle crashes, and severe impact incidents
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <div className="bg-red-950/60 border border-red-800/60 px-3 py-1.5 rounded-lg text-xs font-mono text-red-300 flex items-center space-x-1.5">
            <PhoneCall className="w-3.5 h-3.5" />
            <span>EMS Ambulance Hotline: 108 / 102</span>
          </div>
          <button
            onClick={loadAlerts}
            className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Safety Mandatory Notice */}
      <div className="bg-slate-950/90 border border-red-900/60 p-4 rounded-xl flex items-start space-x-3 text-xs text-slate-300">
        <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
        <div>
          <span className="font-bold text-red-300 font-mono uppercase">Medical Response Triage Notice: </span>
          ASTRA AI provides visual collision impact assessments. It is a decision-support platform and does NOT autonomously dispatch medical units or ambulances.
        </div>
      </div>

      {/* Ambulance Alerts Table */}
      <GlassCard className="p-0 overflow-hidden border border-slate-800">
        <div className="p-4 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between">
          <div className="text-xs font-mono font-bold text-slate-300 uppercase">
            Ambulance Dispatch Queue ({alerts.length})
          </div>

          <div className="flex items-center space-x-2 text-xs font-mono">
            {['', 'NEW', 'ACKNOWLEDGED', 'RESOLVED'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 rounded text-xs transition-colors ${
                  statusFilter === st
                    ? 'bg-red-600 text-white font-bold'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                }`}
              >
                {st || 'ALL'}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] border-b border-slate-800">
              <tr>
                <th className="py-3.5 px-4">Incident ID</th>
                <th className="py-3.5 px-4">Camera & Exact Location</th>
                <th className="py-3.5 px-4">Collision Event</th>
                <th className="py-3.5 px-4">Risk</th>
                <th className="py-3.5 px-4">Confidence</th>
                <th className="py-3.5 px-4">Reason / Backend</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Time</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {alerts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500">
                    No active high-risk collisions requiring medical dispatch in queue.
                  </td>
                </tr>
              ) : (
                alerts.map((inc) => (
                  <tr key={inc.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-red-400">{inc.incident_id}</td>
                    <td className="py-3.5 px-4 text-slate-300 font-sans">
                      <div className="font-semibold text-slate-100">{inc.camera_name}</div>
                      <div className="text-[11px] text-slate-400 flex items-center">
                        <MapPin className="w-3 h-3 mr-0.5 text-red-400 flex-shrink-0" />
                        <span>{inc.location}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-red-300 font-sans font-bold uppercase">
                      🚑 {inc.event_type.replace('_', ' ')}
                    </td>
                    <td className="py-3.5 px-4">
                      <RiskBadge risk={inc.risk} />
                    </td>
                    <td className="py-3.5 px-4 text-slate-300">
                      {Math.round(inc.confidence * 100)}%
                    </td>
                    <td className="py-3.5 px-4 text-slate-300 font-sans">
                      <div>{inc.reason}</div>
                      <div className="text-[10px] font-mono text-slate-500">Backend: {inc.backend}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={inc.status} />
                    </td>
                    <td className="py-3.5 px-4 text-slate-400 text-[11px]">
                      {new Date(inc.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-3.5 px-4 text-right space-x-2">
                      <button
                        onClick={() => setLocationIncident(inc)}
                        className="px-2 py-1 bg-slate-900 hover:bg-slate-800 text-red-400 border border-slate-800 rounded text-xs transition-colors"
                      >
                        <MapPin className="w-3 h-3 inline mr-1" /> View Map
                      </button>
                      <button
                        onClick={() => setSelectedIncident(inc)}
                        className="px-2.5 py-1 bg-red-950 text-red-300 hover:bg-red-900 border border-red-800/60 rounded text-xs font-semibold transition-colors"
                      >
                        Triage
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {/* Modals */}
      <IncidentActionModal
        incident={selectedIncident}
        onClose={() => setSelectedIncident(null)}
        onUpdated={() => {
          loadAlerts();
          setSelectedIncident(null);
        }}
        onOpenLocationModal={(inc) => setLocationIncident(inc)}
      />

      <LocationMapModal
        incident={locationIncident}
        onClose={() => setLocationIncident(null)}
      />
    </div>
  );
};
