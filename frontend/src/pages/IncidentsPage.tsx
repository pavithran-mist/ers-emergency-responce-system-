import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Incident } from '../types';
import { GlassCard } from '../components/GlassCard';
import { RiskBadge } from '../components/RiskBadge';
import { StatusBadge } from '../components/StatusBadge';
import { IncidentActionModal } from '../components/IncidentActionModal';
import { LocationMapModal } from '../components/LocationMapModal';
import { AlertOctagon, MapPin, Filter, RefreshCw, CheckCircle, Clock } from 'lucide-react';

export const IncidentsPage: React.FC = () => {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [riskFilter, setRiskFilter] = useState<string>('');
  const [deptFilter, setDeptFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [loading, setLoading] = useState(true);

  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [locationIncident, setLocationIncident] = useState<Incident | null>(null);

  const loadIncidents = async () => {
    setLoading(true);
    try {
      const data = await api.getIncidents({
        risk: riskFilter || undefined,
        department: deptFilter || undefined,
        status: statusFilter || undefined,
        limit: 100,
      });
      setIncidents(data);
    } catch (err) {
      console.error('Failed to load incidents:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadIncidents();
  }, [riskFilter, deptFilter, statusFilter]);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <AlertOctagon className="w-5 h-5 text-red-400" />
            <h1 className="text-xl font-black text-white">Emergency Incident Registry</h1>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Verified AI detection events, accident kinematics, hazard classifications and operator lifecycle actions
          </p>
        </div>

        <button
          onClick={loadIncidents}
          className="p-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-lg transition-colors flex items-center space-x-2 text-xs font-mono"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800/80 text-xs font-mono">
        <div className="flex items-center space-x-1.5 text-slate-400 pr-3 border-r border-slate-800">
          <Filter className="w-3.5 h-3.5" />
          <span>Filter By:</span>
        </div>

        {/* Risk Dropdown */}
        <select
          value={riskFilter}
          onChange={(e) => setRiskFilter(e.target.value)}
          className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-slate-200 focus:outline-none focus:border-cyan-500"
        >
          <option value="">All Risks</option>
          <option value="CRITICAL">CRITICAL</option>
          <option value="HIGH">HIGH</option>
          <option value="MEDIUM">MEDIUM</option>
          <option value="LOW">LOW</option>
        </select>

        {/* Department Dropdown */}
        <select
          value={deptFilter}
          onChange={(e) => setDeptFilter(e.target.value)}
          className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-slate-200 focus:outline-none focus:border-cyan-500"
        >
          <option value="">All Departments</option>
          <option value="POLICE">POLICE</option>
          <option value="FIRE">FIRE</option>
          <option value="AMBULANCE">AMBULANCE</option>
          <option value="GENERAL">GENERAL</option>
        </select>

        {/* Status Dropdown */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-slate-200 focus:outline-none focus:border-cyan-500"
        >
          <option value="">All Statuses</option>
          <option value="NEW">NEW</option>
          <option value="REVIEWING">REVIEWING</option>
          <option value="ACKNOWLEDGED">ACKNOWLEDGED</option>
          <option value="RESOLVED">RESOLVED</option>
        </select>

        <div className="ml-auto text-slate-500">
          Total Incidents: {incidents.length}
        </div>
      </div>

      {/* Incident Table */}
      <GlassCard className="p-0 overflow-hidden border border-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] border-b border-slate-800">
              <tr>
                <th className="py-3.5 px-4">Incident ID</th>
                <th className="py-3.5 px-4">Event Type</th>
                <th className="py-3.5 px-4">Camera & Registered Location</th>
                <th className="py-3.5 px-4">Risk Level</th>
                <th className="py-3.5 px-4">Confidence</th>
                <th className="py-3.5 px-4">Reason / Backend</th>
                <th className="py-3.5 px-4">Department</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Time</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {incidents.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-500">
                    No incident records match the filter criteria.
                  </td>
                </tr>
              ) : (
                incidents.map((inc) => (
                  <tr key={inc.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-cyan-400">
                      {inc.incident_id}
                    </td>
                    <td className="py-3.5 px-4 text-slate-200 font-sans font-bold uppercase">
                      {inc.event_type.replace('_', ' ')}
                    </td>
                    <td className="py-3.5 px-4 text-slate-300 font-sans">
                      <div className="font-semibold text-slate-100">{inc.camera_name}</div>
                      <div className="text-[11px] text-slate-400 flex items-center">
                        <MapPin className="w-3 h-3 mr-0.5 text-cyan-400 flex-shrink-0" />
                        <span>{inc.location}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <RiskBadge risk={inc.risk} />
                    </td>
                    <td className="py-3.5 px-4 text-slate-300">
                      {Math.round(inc.confidence * 100)}%
                    </td>
                    <td className="py-3.5 px-4 text-slate-300 font-sans">
                      <div className="font-medium text-slate-200">{inc.reason}</div>
                      <div className="text-[10px] font-mono text-slate-500">Backend: {inc.backend}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300 uppercase">
                        {inc.department}
                      </span>
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
                        className="p-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-cyan-400 rounded transition-colors inline-flex items-center"
                        title="View Map Location"
                      >
                        <MapPin className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setSelectedIncident(inc)}
                        className="px-2.5 py-1.5 bg-cyan-950 text-cyan-300 hover:bg-cyan-900 border border-cyan-800/60 rounded text-[11px] font-semibold transition-colors"
                      >
                        Manage
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
          loadIncidents();
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
