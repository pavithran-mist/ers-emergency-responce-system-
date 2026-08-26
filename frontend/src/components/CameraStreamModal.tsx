import React from 'react';
import { Camera, CameraTelemetry } from '../types';
import { RiskBadge } from './RiskBadge';
import { StatusBadge } from './StatusBadge';
import { X, ShieldAlert, Car, MapPin, Activity, Cpu, Eye } from 'lucide-react';

interface CameraStreamModalProps {
  camera: Camera | null;
  telemetry?: CameraTelemetry;
  onClose: () => void;
  onOpenLocationModal: (camera: Camera) => void;
}

export const CameraStreamModal: React.FC<CameraStreamModalProps> = ({
  camera,
  telemetry,
  onClose,
  onOpenLocationModal,
}) => {
  if (!camera) return null;

  const streamUrl = `/api/v1/stream/${camera.camera_id}/live`;
  const riskLevel = telemetry?.risk_level || 'LOW';
  const vehicles = telemetry?.vehicles || [];
  const hazards = telemetry?.hazards || [];
  const fps = telemetry?.fps || 0;
  const [streamError, setStreamError] = React.useState(false);

  React.useEffect(() => {
    setStreamError(false);
  }, [camera.camera_id]);

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 lg:p-8">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl shadow-cyan-950/30 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="text-sm font-mono font-bold text-cyan-400 bg-cyan-950/60 px-2.5 py-1 rounded border border-cyan-800/50">
              {camera.camera_id}
            </span>
            <div>
              <h2 className="text-base font-bold text-white flex items-center">
                {camera.name}
                <span className="ml-3">
                  <StatusBadge status={camera.status} />
                </span>
              </h2>
              <p className="text-xs text-slate-400 flex items-center mt-0.5">
                <MapPin className="w-3.5 h-3.5 mr-1 text-slate-500" />
                {camera.location} {camera.landmark ? `(${camera.landmark})` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <RiskBadge risk={riskLevel} />
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body: Split Screen */}
        <div className="grid grid-cols-1 lg:grid-cols-3 flex-grow overflow-hidden">
          {/* Main Video Stream Frame */}
          <div className="lg:col-span-2 bg-black flex items-center justify-center relative min-h-[350px] lg:min-h-[480px]">
            {!streamError ? (
              <img
                src={streamUrl}
                alt={camera.name}
                onError={() => setStreamError(true)}
                className="w-full h-full object-contain select-none"
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-slate-500 p-8 text-center">
                <ShieldAlert className="w-12 h-12 mb-3 text-slate-600" />
                <p className="text-sm font-mono font-bold text-slate-300">STREAM FEED OFFLINE / INITIALIZING</p>
                <p className="text-xs text-slate-500 mt-1">{camera.url}</p>
                <button
                  onClick={() => setStreamError(false)}
                  className="mt-4 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-400 rounded text-xs font-mono"
                >
                  Retry Stream Connection
                </button>
              </div>
            )}
            {/* Live stream watermark */}
            {!streamError && (
              <div className="absolute top-4 left-4 flex items-center space-x-2">
                <span className="flex items-center text-xs font-bold px-2.5 py-1 rounded bg-black/80 text-emerald-400 border border-emerald-500/40">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 mr-2 animate-pulse" />
                  LIVE STREAM
                </span>
                <span className="text-xs font-mono px-2 py-1 rounded bg-black/80 text-slate-300 border border-slate-700">
                  {fps} FPS
                </span>
              </div>
            )}
          </div>

          {/* Real-time AI Telemetry & Detections Inspector */}
          <div className="bg-slate-950/70 p-5 border-t lg:border-t-0 lg:border-l border-slate-800 flex flex-col space-y-4 overflow-y-auto max-h-[480px]">
            <div>
              <div className="text-xs font-mono uppercase tracking-wider text-slate-400 font-bold mb-2 flex items-center justify-between">
                <span className="flex items-center">
                  <Cpu className="w-3.5 h-3.5 mr-1.5 text-cyan-400" />
                  AI Vision Pipeline
                </span>
                <span className="text-[10px] text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/40">
                  ACTIVE
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800">
                  <div className="text-[10px] text-slate-500">DETECTOR</div>
                  <div className="font-bold text-cyan-300">YOLO11n</div>
                </div>
                <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800">
                  <div className="text-[10px] text-slate-500">ACCIDENT MODEL</div>
                  <div className="font-bold text-amber-300">{telemetry?.ai_backend?.accident || 'heuristic'}</div>
                </div>
                <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800">
                  <div className="text-[10px] text-slate-500">FIRE/SMOKE MODEL</div>
                  <div className="font-bold text-orange-300">{telemetry?.ai_backend?.fire_smoke || 'heuristic'}</div>
                </div>
                <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800">
                  <div className="text-[10px] text-slate-500">SCENE RISK</div>
                  <div className="font-bold text-red-400">{telemetry?.risk_score || 0}/100</div>
                </div>
              </div>
            </div>

            {/* Active Hazard Alerts in Feed */}
            <div>
              <div className="text-xs font-mono uppercase tracking-wider text-slate-400 font-bold mb-2 flex items-center">
                <ShieldAlert className="w-3.5 h-3.5 mr-1.5 text-red-400" />
                Active Scene Hazards ({hazards.length})
              </div>

              {hazards.length > 0 ? (
                <div className="space-y-2">
                  {hazards.map((h, idx) => (
                    <div
                      key={idx}
                      className="bg-red-950/60 border border-red-500/50 p-3 rounded-lg text-xs space-y-1 animate-pulse"
                    >
                      <div className="flex items-center justify-between font-bold text-red-300 uppercase">
                        <span>🚨 {h.event_type.replace('_', ' ')}</span>
                        <RiskBadge risk={h.risk} />
                      </div>
                      <div className="text-slate-300">
                        Reason: <span className="font-mono text-cyan-300">{h.reason}</span>
                      </div>
                      <div className="flex justify-between text-[11px] text-slate-400 font-mono">
                        <span>Confidence: {Math.round(h.confidence * 100)}%</span>
                        <span>Backend: {h.backend}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800/80 text-xs text-slate-400 text-center font-mono">
                  No active emergency anomalies detected in current frame.
                </div>
              )}
            </div>

            {/* Vehicle Tracks Telemetry */}
            <div>
              <div className="text-xs font-mono uppercase tracking-wider text-slate-400 font-bold mb-2 flex items-center justify-between">
                <span className="flex items-center">
                  <Car className="w-3.5 h-3.5 mr-1.5 text-emerald-400" />
                  Tracked Vehicles ({vehicles.length})
                </span>
              </div>

              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {vehicles.map((v) => (
                  <div
                    key={v.track_id}
                    className="bg-slate-900/80 p-2 rounded border border-slate-800 flex items-center justify-between text-xs font-mono"
                  >
                    <div className="flex items-center space-x-2">
                      <span className="text-cyan-400 font-bold">#{v.track_id}</span>
                      <span className="text-slate-200 capitalize">{v.class_name}</span>
                    </div>
                    <div className="text-slate-400 text-[11px]">
                      {v.speed > 0 ? `${v.speed.toFixed(1)} px/f` : 'Stopped'} | {Math.round(v.confidence * 100)}%
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Location Link */}
            <div className="pt-2 border-t border-slate-800">
              <button
                onClick={() => onOpenLocationModal(camera)}
                className="w-full py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 flex items-center justify-center space-x-1.5 transition-colors"
              >
                <MapPin className="w-3.5 h-3.5 text-cyan-400" />
                <span>View Registered Location Map</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
