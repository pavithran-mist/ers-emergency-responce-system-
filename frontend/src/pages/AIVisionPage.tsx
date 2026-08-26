import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { AIStatus } from '../types';
import { GlassCard } from '../components/GlassCard';
import { Cpu, Zap, ShieldCheck, CheckCircle2, Sliders, Activity, Layers, Terminal } from 'lucide-react';

export const AIVisionPage: React.FC = () => {
  const [aiStatus, setAIStatus] = useState<AIStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const data = await api.getAIStatus();
        setAIStatus(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-purple-950/80 border border-purple-700/60 text-purple-400">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-black text-white">ASTRA AI Vision Engine Diagnostics</h1>
              <p className="text-xs text-slate-400">
                Multi-stage neural pipeline, model loading states, kinematic heuristics, and verification thresholds
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800 font-mono text-xs text-slate-300">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>ENGINE STATUS: {aiStatus?.ai_status || 'ACTIVE'}</span>
        </div>
      </div>

      {/* Primary 4 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <GlassCard className="p-4 flex items-center space-x-3.5">
          <div className="p-3 rounded-xl bg-cyan-950/80 border border-cyan-800 text-cyan-400">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[10px] font-mono uppercase text-slate-400">Vehicle Detector</div>
            <div className="text-sm font-bold text-white font-mono">YOLO11n (COCO-5)</div>
            <div className="text-[11px] text-cyan-400">Cars, Trucks, Buses, Bikes</div>
          </div>
        </GlassCard>

        <GlassCard className="p-4 flex items-center space-x-3.5">
          <div className="p-3 rounded-xl bg-amber-950/80 border border-amber-800 text-amber-400">
            <Zap className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[10px] font-mono uppercase text-slate-400">Accident Backend</div>
            <div className="text-sm font-bold text-white font-mono">{aiStatus?.accident_backend || 'heuristic'}</div>
            <div className="text-[11px] text-amber-400">IoU & Vector Kinematics</div>
          </div>
        </GlassCard>

        <GlassCard className="p-4 flex items-center space-x-3.5">
          <div className="p-3 rounded-xl bg-orange-950/80 border border-orange-800 text-orange-400">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[10px] font-mono uppercase text-slate-400">Fire/Smoke Backend</div>
            <div className="text-sm font-bold text-white font-mono">{aiStatus?.fire_smoke_backend || 'heuristic'}</div>
            <div className="text-[11px] text-orange-400">HSV & Chrominance</div>
          </div>
        </GlassCard>

        <GlassCard className="p-4 flex items-center space-x-3.5">
          <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-800 text-emerald-400">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[10px] font-mono uppercase text-slate-400">Global AI Throughput</div>
            <div className="text-sm font-bold text-white font-mono">{aiStatus?.global_fps ?? 0} FPS</div>
            <div className="text-[11px] text-emerald-400">{aiStatus?.active_workers ?? 0} Active Camera Threads</div>
          </div>
        </GlassCard>
      </div>

      {/* Dual Backend Architecture Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Accident Engine Architecture */}
        <GlassCard className="p-6 space-y-4">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-5 h-5 text-cyan-400" />
            <h3 className="text-base font-bold text-white">Dual-Backend Accident Architecture</h3>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            ASTRA AI guarantees road safety detection by coupling trained convolutional/transformer models with rigorous motion kinematics.
          </p>

          <div className="space-y-3 font-mono text-xs">
            <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between text-cyan-300 font-bold">
                <span>1. Custom YOLO Model (`models/road_accident.pt`)</span>
                <span className="text-[10px] bg-cyan-950 px-2 py-0.5 rounded border border-cyan-800">PRIMARY</span>
              </div>
              <p className="text-[11px] text-slate-400 font-sans">
                Fine-tuned YOLO detector trained specifically on road crash datasets (Class 0: accident). High confidence direct bounding box inference.
              </p>
            </div>

            <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between text-amber-300 font-bold">
                <span>2. Kinematic Motion & Overlap Engine</span>
                <span className="text-[10px] bg-amber-950 px-2 py-0.5 rounded border border-amber-800">HEURISTIC FALLBACK</span>
              </div>
              <ul className="text-[11px] text-slate-400 font-sans list-disc list-inside space-y-1">
                <li><span className="font-mono text-slate-200">Vehicle Overlap (IoU &gt; 0.15):</span> Intersecting tracked vehicle bounds.</li>
                <li><span className="font-mono text-slate-200">Rapid Convergence:</span> Relative velocity dot product approaching rapidly.</li>
                <li><span className="font-mono text-slate-200">Sudden Deceleration:</span> Abrupt drop in speed from &gt; 15 px/f to &lt; 2 px/f.</li>
                <li><span className="font-mono text-slate-200">Abnormal Trajectory:</span> Sharp heading deviation &gt; 55 degrees within 3 frames.</li>
              </ul>
            </div>
          </div>
        </GlassCard>

        {/* Pipeline Stages & Verification */}
        <GlassCard className="p-6 space-y-4">
          <div className="flex items-center space-x-2">
            <Sliders className="w-5 h-5 text-purple-400" />
            <h3 className="text-base font-bold text-white">Pipeline Stages & Verification</h3>
          </div>

          <div className="space-y-3 font-mono text-xs">
            <div className="flex items-start space-x-3 p-3 rounded-lg bg-slate-950/80 border border-slate-800">
              <div className="w-6 h-6 rounded-full bg-cyan-950 border border-cyan-700 text-cyan-400 flex items-center justify-center font-bold text-xs flex-shrink-0">
                1
              </div>
              <div>
                <div className="font-bold text-slate-200">Frame Ingestion & Preprocessing</div>
                <div className="text-[11px] text-slate-400 font-sans">Multi-threaded frame buffer grab from RTSP/Webcam/Synthetic feeds at 30 FPS.</div>
              </div>
            </div>

            <div className="flex items-start space-x-3 p-3 rounded-lg bg-slate-950/80 border border-slate-800">
              <div className="w-6 h-6 rounded-full bg-blue-950 border border-blue-700 text-blue-400 flex items-center justify-center font-bold text-xs flex-shrink-0">
                2
              </div>
              <div>
                <div className="font-bold text-slate-200">Multi-Vehicle Centroid Tracker</div>
                <div className="text-[11px] text-slate-400 font-sans">Associates tracks across 30-frame history window with speed & acceleration calculation.</div>
              </div>
            </div>

            <div className="flex items-start space-x-3 p-3 rounded-lg bg-slate-950/80 border border-slate-800">
              <div className="w-6 h-6 rounded-full bg-amber-950 border border-amber-700 text-amber-400 flex items-center justify-center font-bold text-xs flex-shrink-0">
                3
              </div>
              <div>
                <div className="font-bold text-slate-200">Temporal Verification & Debounce</div>
                <div className="text-[11px] text-slate-400 font-sans">Requires 3 hits in 6 frames to eliminate camera glitch false alarms with 6s cooldown filter.</div>
              </div>
            </div>

            <div className="flex items-start space-x-3 p-3 rounded-lg bg-slate-950/80 border border-slate-800">
              <div className="w-6 h-6 rounded-full bg-red-950 border border-red-700 text-red-400 flex items-center justify-center font-bold text-xs flex-shrink-0">
                4
              </div>
              <div>
                <div className="font-bold text-slate-200">Multi-Factor Risk Engine & Dispatch Routing</div>
                <div className="text-[11px] text-slate-400 font-sans">Scores 0-100 (LOW/MEDIUM/HIGH/CRITICAL) and routes alerts to Police, Fire, or Ambulance desks.</div>
              </div>
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  );
};
