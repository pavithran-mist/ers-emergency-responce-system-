import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useSocket } from '../context/SocketContext';
import { Camera, Incident, AIStatus } from '../types';
import { GlassCard } from '../components/GlassCard';
import { CameraCard } from '../components/CameraCard';
import { RiskBadge } from '../components/RiskBadge';
import { StatusBadge } from '../components/StatusBadge';
import { CameraStreamModal } from '../components/CameraStreamModal';
import { LocationMapModal } from '../components/LocationMapModal';
import { IncidentActionModal } from '../components/IncidentActionModal';
import {
  Video,
  AlertOctagon,
  Flame,
  Ambulance,
  Activity,
  Cpu,
  ShieldAlert,
  ArrowRight,
  TrendingUp,
  MapPin,
  Radio,
} from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';

export const DashboardPage: React.FC = () => {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [aiStatus, setAIStatus] = useState<AIStatus | null>(null);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [selectedCamera, setSelectedCamera] = useState<Camera | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<{ camera?: Camera; incident?: Incident } | null>(null);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);

  const { isConnected, activeAlerts, telemetryMap } = useSocket();
  const navigate = useNavigate();

  const loadData = async () => {
    try {
      const [cams, incs, sum, ai] = await Promise.all([
        api.getCameras(),
        api.getIncidents({ limit: 8 }),
        api.getIncidentSummary(),
        api.getAIStatus(),
      ]);
      setCameras(cams);
      setIncidents(incs);
      setSummary(sum);
      setAIStatus(ai);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 6000);
    return () => clearInterval(interval);
  }, []);

  // Synthetic trend points for real-time visual chart
  const trendData = [
    { time: '18:00', vehicles: 45, riskScore: 18 },
    { time: '19:00', vehicles: 78, riskScore: 24 },
    { time: '20:00', vehicles: 92, riskScore: 42 },
    { time: '21:00', vehicles: 110, riskScore: 68 },
    { time: '22:00', vehicles: 85, riskScore: 54 },
    { time: '22:30', vehicles: 62, riskScore: 35 },
    { time: 'Now', vehicles: aiStatus?.total_vehicles_detected || 75, riskScore: 45 },
  ];

  const onlineCameras = cameras.filter((c) => c.status === 'ONLINE' || telemetryMap[c.camera_id]?.status === 'ONLINE').length;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Banner Alert Ticker if active alerts exist */}
      {activeAlerts.length > 0 && (
        <div className="bg-red-950/90 border border-red-500/80 rounded-xl p-4 shadow-xl shadow-red-950/40 flex items-center justify-between backdrop-blur-md animate-pulse">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-red-900 text-red-200">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-mono uppercase font-bold text-red-400">
                CRITICAL WARNING • {activeAlerts.length} EMERGENCY EVENT{activeAlerts.length > 1 ? 'S' : ''} DETECTED
              </div>
              <div className="text-sm font-bold text-white">
                {activeAlerts[0].event_type.replace('_', ' ').toUpperCase()} at {activeAlerts[0].camera_name} ({activeAlerts[0].location})
              </div>
            </div>
          </div>

          <button
            onClick={() => setSelectedIncident(activeAlerts[0])}
            className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all shadow-md shadow-red-950/50"
          >
            <span>Triage Incident</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* METRIC KPI STATS BAR */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <GlassCard className="p-4 flex flex-col justify-between">
          <div className="text-[11px] font-mono uppercase text-slate-400 flex items-center justify-between">
            <span>Online Cams</span>
            <Video className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-white font-mono mt-2">
            {onlineCameras} <span className="text-xs font-normal text-slate-500">/ {cameras.length}</span>
          </div>
        </GlassCard>

        <GlassCard className="p-4 flex flex-col justify-between">
          <div className="text-[11px] font-mono uppercase text-slate-400 flex items-center justify-between">
            <span>Active Hazards</span>
            <AlertOctagon className="w-3.5 h-3.5 text-red-400" />
          </div>
          <div className="text-2xl font-black text-red-400 font-mono mt-2">
            {summary?.new_incidents ?? activeAlerts.length}
          </div>
        </GlassCard>

        <GlassCard className="p-4 flex flex-col justify-between">
          <div className="text-[11px] font-mono uppercase text-slate-400 flex items-center justify-between">
            <span>Critical Risks</span>
            <ShieldAlert className="w-3.5 h-3.5 text-orange-400" />
          </div>
          <div className="text-2xl font-black text-orange-400 font-mono mt-2">
            {summary?.critical_incidents ?? 0}
          </div>
        </GlassCard>

        <GlassCard className="p-4 flex flex-col justify-between">
          <div className="text-[11px] font-mono uppercase text-slate-400 flex items-center justify-between">
            <span>Police Queue</span>
            <Activity className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="text-2xl font-black text-cyan-400 font-mono mt-2">
            {summary?.police_alerts ?? 0}
          </div>
        </GlassCard>

        <GlassCard className="p-4 flex flex-col justify-between">
          <div className="text-[11px] font-mono uppercase text-slate-400 flex items-center justify-between">
            <span>Fire Alerts</span>
            <Flame className="w-3.5 h-3.5 text-orange-400" />
          </div>
          <div className="text-2xl font-black text-orange-400 font-mono mt-2">
            {summary?.fire_alerts ?? 0}
          </div>
        </GlassCard>

        <GlassCard className="p-4 flex flex-col justify-between">
          <div className="text-[11px] font-mono uppercase text-slate-400 flex items-center justify-between">
            <span>Med/Ambulance</span>
            <Ambulance className="w-3.5 h-3.5 text-red-400" />
          </div>
          <div className="text-2xl font-black text-red-400 font-mono mt-2">
            {summary?.ambulance_alerts ?? 0}
          </div>
        </GlassCard>
      </div>

      {/* 2-COLUMN SECTION: LIVE CAMERA MATRIX & AI TELEMETRY CHART */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main 2-Col: Live Video Streams */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <h2 className="text-base font-bold text-white">Live Multi-Camera Matrix</h2>
            </div>
            <button
              onClick={() => navigate('/cameras')}
              className="text-xs text-cyan-400 hover:underline flex items-center space-x-1 font-mono"
            >
              <span>View All Cameras ({cameras.length})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {cameras.slice(0, 4).map((cam) => (
              <CameraCard
                key={cam.camera_id}
                camera={cam}
                telemetry={telemetryMap[cam.camera_id]}
                onOpenStreamModal={(c) => setSelectedCamera(c)}
                onOpenLocationModal={(c) => setSelectedLocation({ camera: c })}
              />
            ))}
          </div>
        </div>

        {/* Right Col: AI Vision Telemetry & Activity Flow */}
        <div className="space-y-6">
          <GlassCard className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Cpu className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-bold text-white">AI Engine Telemetry</h3>
              </div>
              <span className="text-[10px] font-mono bg-cyan-950 text-cyan-400 px-2 py-0.5 rounded border border-cyan-800">
                {aiStatus?.global_fps ?? 0} FPS Global
              </span>
            </div>

            <div className="space-y-2.5 text-xs font-mono">
              <div className="flex justify-between py-1.5 border-b border-slate-800">
                <span className="text-slate-400">Object Detector</span>
                <span className="text-slate-200 font-bold">YOLO11n (COCO-5)</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-800">
                <span className="text-slate-400">Accident Detection</span>
                <span className="text-cyan-300 font-bold">{aiStatus?.accident_backend || 'heuristic'}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-800">
                <span className="text-slate-400">Fire & Smoke Engine</span>
                <span className="text-orange-300 font-bold">{aiStatus?.fire_smoke_backend || 'heuristic'}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-400">Active Camera Workers</span>
                <span className="text-emerald-400 font-bold">{aiStatus?.active_workers ?? 0} Active</span>
              </div>
            </div>

            {/* Micro Chart */}
            <div className="h-32 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData}>
                  <defs>
                    <linearGradient id="colorVehicles" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="time" stroke="#64748b" fontSize={10} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={10} tickLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#090d16', borderColor: '#1e293b', fontSize: '11px' }}
                  />
                  <Area type="monotone" dataKey="vehicles" stroke="#06b6d4" fillOpacity={1} fill="url(#colorVehicles)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>

          {/* Quick Hotlines Summary */}
          <GlassCard className="p-4 space-y-3 bg-slate-950/70 border-slate-800">
            <div className="text-xs font-mono uppercase text-slate-400 font-bold">
              Emergency Services Dispatch Gateways
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between p-2 rounded bg-slate-900 border border-slate-800">
                <span className="text-slate-300">Police PCR Gateway</span>
                <span className="text-cyan-400 font-mono font-bold">112 / 100</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-slate-900 border border-slate-800">
                <span className="text-slate-300">Fire & Rescue Control</span>
                <span className="text-orange-400 font-mono font-bold">101</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-slate-900 border border-slate-800">
                <span className="text-slate-300">Medical EMS Ambulances</span>
                <span className="text-red-400 font-mono font-bold">108 / 102</span>
              </div>
            </div>
          </GlassCard>
        </div>
      </div>

      {/* RECENT INCIDENTS FEED TABLE */}
      <GlassCard className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white">Recent Road Safety Incidents</h3>
            <p className="text-xs text-slate-400">Verified multi-camera emergency events and triage states</p>
          </div>
          <button
            onClick={() => navigate('/incidents')}
            className="text-xs text-cyan-400 hover:underline flex items-center space-x-1 font-mono"
          >
            <span>View All Incidents</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Incident ID</th>
                <th className="py-3 px-4">Event Type</th>
                <th className="py-3 px-4">Camera & Location</th>
                <th className="py-3 px-4">Risk</th>
                <th className="py-3 px-4">Confidence</th>
                <th className="py-3 px-4">Reason / Backend</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {incidents.map((inc) => (
                <tr key={inc.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-3 px-4 font-bold text-cyan-400">{inc.incident_id}</td>
                  <td className="py-3 px-4 text-slate-200 font-sans font-semibold uppercase">
                    {inc.event_type.replace('_', ' ')}
                  </td>
                  <td className="py-3 px-4 text-slate-300 font-sans">
                    <div>{inc.camera_name}</div>
                    <div className="text-[11px] text-slate-500 flex items-center">
                      <MapPin className="w-3 h-3 mr-0.5 text-slate-500" />
                      {inc.location}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <RiskBadge risk={inc.risk} />
                  </td>
                  <td className="py-3 px-4 text-slate-300">
                    {Math.round(inc.confidence * 100)}%
                  </td>
                  <td className="py-3 px-4 text-slate-400">
                    <div className="text-slate-300">{inc.reason}</div>
                    <div className="text-[10px] text-slate-500">({inc.backend})</div>
                  </td>
                  <td className="py-3 px-4">
                    <StatusBadge status={inc.status} />
                  </td>
                  <td className="py-3 px-4 text-right space-x-2">
                    <button
                      onClick={() => setSelectedLocation({ incident: inc })}
                      className="text-slate-400 hover:text-cyan-400 transition-colors"
                      title="View Map"
                    >
                      <MapPin className="w-3.5 h-3.5 inline" />
                    </button>
                    <button
                      onClick={() => setSelectedIncident(inc)}
                      className="px-2.5 py-1 bg-cyan-950 text-cyan-300 hover:bg-cyan-900 border border-cyan-800/60 rounded text-[11px] font-semibold transition-colors"
                    >
                      Review
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {/* Modals */}
      <CameraStreamModal
        camera={selectedCamera}
        telemetry={selectedCamera ? telemetryMap[selectedCamera.camera_id] : undefined}
        onClose={() => setSelectedCamera(null)}
        onOpenLocationModal={(c) => setSelectedLocation({ camera: c })}
      />

      <LocationMapModal
        camera={selectedLocation?.camera}
        incident={selectedLocation?.incident}
        onClose={() => setSelectedLocation(null)}
      />

      <IncidentActionModal
        incident={selectedIncident}
        onClose={() => setSelectedIncident(null)}
        onUpdated={() => {
          loadData();
          setSelectedIncident(null);
        }}
        onOpenLocationModal={(inc) => setSelectedLocation({ incident: inc })}
      />
    </div>
  );
};
