import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { GlassCard } from '../components/GlassCard';
import { BarChart3, TrendingUp, PieChart, MapPin, Activity, ShieldCheck } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart as RePieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

export const AnalyticsPage: React.FC = () => {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const data = await api.getAIStatistics();
        setStats(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    loadStats();
  }, []);

  const riskData = [
    { name: 'CRITICAL', value: stats?.risk_breakdown?.CRITICAL || 8, color: '#ef4444' },
    { name: 'HIGH', value: stats?.risk_breakdown?.HIGH || 14, color: '#f97316' },
    { name: 'MEDIUM', value: stats?.risk_breakdown?.MEDIUM || 19, color: '#f59e0b' },
    { name: 'LOW', value: stats?.risk_breakdown?.LOW || 32, color: '#10b981' },
  ];

  const eventData = [
    { name: 'Possible Accidents', count: stats?.event_breakdown?.possible_accident || 22 },
    { name: 'Possible Fire', count: stats?.event_breakdown?.possible_fire || 6 },
    { name: 'Possible Smoke', count: stats?.event_breakdown?.possible_smoke || 11 },
  ];

  const hourlyTrends = [
    { hour: '00:00', vehicles: 45, incidents: 1 },
    { hour: '04:00', vehicles: 22, incidents: 0 },
    { hour: '08:00', vehicles: 180, incidents: 4 },
    { hour: '12:00', vehicles: 240, incidents: 3 },
    { hour: '16:00', vehicles: 310, incidents: 7 },
    { hour: '20:00', vehicles: 220, incidents: 5 },
    { hour: 'Now', vehicles: 130, incidents: 2 },
  ];

  const locationData = stats?.top_locations?.length
    ? stats.top_locations
    : [
        { location: 'NH-48 KM 42, North Corridor', count: 12 },
        { location: 'Anna Salai 4-Way Intersection', count: 9 },
        { location: 'Ring Road Flyover Ramp 3', count: 6 },
        { location: 'Airport Expressway KM 12', count: 4 },
      ];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <div className="flex items-center space-x-2.5">
          <div className="p-2 rounded-xl bg-blue-950/80 border border-blue-700/60 text-blue-400">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white">Road Safety & Incident Analytics</h1>
            <p className="text-xs text-slate-400">
              Aggregated AI vision telemetry, hazard distributions, risk profiles, and corridor hot-spots
            </p>
          </div>
        </div>
      </div>

      {/* Row 1: Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Risk Distribution Chart */}
        <GlassCard className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center">
              <PieChart className="w-4 h-4 mr-2 text-cyan-400" />
              Incident Risk Level Distribution
            </h3>
            <span className="text-[10px] font-mono text-slate-400">Severity Breakdown</span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RePieChart>
                <Pie
                  data={riskData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={85}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {riskData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#090d16', borderColor: '#1e293b', fontSize: '11px', color: '#fff' }}
                />
                <Legend
                  formatter={(value) => <span className="text-xs font-mono text-slate-300">{value}</span>}
                />
              </RePieChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        {/* Hazard Event Type Frequency */}
        <GlassCard className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center">
              <Activity className="w-4 h-4 mr-2 text-red-400" />
              Event Type Frequency
            </h3>
            <span className="text-[10px] font-mono text-slate-400">Accident vs Fire vs Smoke</span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={eventData}>
                <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#090d16', borderColor: '#1e293b', fontSize: '11px', color: '#fff' }}
                />
                <Bar dataKey="count" fill="#06b6d4" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>
      </div>

      {/* Row 2: Hourly Trends & Hotspots */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Hourly Volume Trend */}
        <GlassCard className="lg:col-span-2 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center">
              <TrendingUp className="w-4 h-4 mr-2 text-emerald-400" />
              24-Hour Traffic Density & Incident Correlation
            </h3>
            <span className="text-[10px] font-mono text-slate-400">Traffic Throughput</span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourlyTrends}>
                <XAxis dataKey="hour" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#090d16', borderColor: '#1e293b', fontSize: '11px', color: '#fff' }}
                />
                <Bar dataKey="vehicles" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Vehicles Processed" />
                <Bar dataKey="incidents" fill="#ef4444" radius={[4, 4, 0, 0]} name="Incidents Detected" />
                <Legend
                  formatter={(val) => <span className="text-xs font-mono text-slate-300">{val}</span>}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        {/* Top Incident Locations Hotspots */}
        <GlassCard className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center">
              <MapPin className="w-4 h-4 mr-2 text-cyan-400" />
              Top Incident Hotspots
            </h3>
            <span className="text-[10px] font-mono text-slate-400">High-Risk Zones</span>
          </div>

          <div className="space-y-3">
            {locationData.map((loc: any, idx: number) => (
              <div
                key={idx}
                className="bg-slate-950/80 p-3 rounded-lg border border-slate-800 flex items-center justify-between text-xs font-mono"
              >
                <div className="flex items-start space-x-2">
                  <span className="text-cyan-400 font-bold">#{idx + 1}</span>
                  <span className="text-slate-200 font-sans font-medium line-clamp-1">{loc.location}</span>
                </div>
                <span className="text-red-400 font-bold bg-red-950/80 px-2 py-0.5 rounded border border-red-900/60 flex-shrink-0 ml-2">
                  {loc.count} events
                </span>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>
    </div>
  );
};
