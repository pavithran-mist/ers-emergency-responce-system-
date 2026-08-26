import React, { useState } from 'react';
import { Camera, CameraTelemetry } from '../types';
import { GlassCard } from './GlassCard';
import { StatusBadge } from './StatusBadge';
import { RiskBadge } from './RiskBadge';
import { Video, Maximize2, MapPin, Radio, Car, Activity } from 'lucide-react';

interface CameraCardProps {
  camera: Camera;
  telemetry?: CameraTelemetry;
  onOpenStreamModal: (camera: Camera) => void;
  onOpenLocationModal: (camera: Camera) => void;
}

export const CameraCard: React.FC<CameraCardProps> = ({
  camera,
  telemetry,
  onOpenStreamModal,
  onOpenLocationModal,
}) => {
  const [streamError, setStreamError] = useState(false);
  const streamUrl = `/api/v1/stream/${camera.camera_id}/live`;

  const isOnline = camera.status === 'ONLINE' || telemetry?.status === 'ONLINE';
  const riskLevel = telemetry?.risk_level || 'LOW';
  const vehicleCount = telemetry?.vehicle_count ?? 0;
  const fps = telemetry?.fps ?? 0;
  const latestHazard = telemetry?.hazards?.[0];

  React.useEffect(() => {
    if (isOnline) {
      setStreamError(false);
    }
  }, [isOnline, camera.camera_id]);

  return (
    <GlassCard
      glow={riskLevel === 'CRITICAL' ? 'red' : riskLevel === 'HIGH' ? 'amber' : 'none'}
      className="flex flex-col overflow-hidden p-0 border border-slate-800/90 group"
    >
      {/* Stream Video Container */}
      <div className="relative aspect-video bg-slate-950 flex items-center justify-center overflow-hidden">
        {isOnline && !streamError ? (
          <img
            src={streamUrl}
            alt={camera.name}
            onError={() => setStreamError(true)}
            className="w-full h-full object-cover select-none"
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-slate-500 p-6 text-center">
            <Video className="w-10 h-10 mb-2 opacity-50" />
            <p className="text-xs font-mono">FEED UNAVAILABLE / OFFLINE</p>
            <span className="text-[10px] text-slate-600 mt-1">{camera.url}</span>
          </div>
        )}

        {/* Top Overlay Badges */}
        <div className="absolute top-2 left-2 flex items-center space-x-1.5 z-10">
          <span className="flex items-center text-[10px] font-bold px-2 py-0.5 rounded bg-black/70 backdrop-blur-sm text-emerald-400 border border-emerald-500/40">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5 animate-pulse" />
            LIVE
          </span>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-black/70 backdrop-blur-sm text-cyan-400 border border-cyan-500/40 font-mono">
            AI: ACTIVE
          </span>
        </div>

        {/* Top Right Controls & FPS */}
        <div className="absolute top-2 right-2 flex items-center space-x-1.5 z-10">
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-black/70 backdrop-blur-sm text-slate-300 border border-slate-700">
            {fps} FPS
          </span>
          <button
            onClick={() => onOpenStreamModal(camera)}
            className="p-1 rounded bg-black/70 backdrop-blur-sm text-slate-300 hover:text-cyan-400 border border-slate-700 hover:border-cyan-500 transition-colors"
            title="Expand Fullscreen Inspector"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Bottom Left Hazard Notice if present */}
        {latestHazard && (
          <div className="absolute bottom-2 left-2 right-2 bg-red-950/90 border border-red-500/80 px-2.5 py-1 rounded backdrop-blur-md flex items-center justify-between text-xs z-10 animate-pulse">
            <span className="font-bold text-red-200 uppercase truncate">
              🚨 {latestHazard.event_type.replace('_', ' ')}
            </span>
            <span className="text-[10px] font-mono text-red-300">
              {Math.round(latestHazard.confidence * 100)}% ({latestHazard.backend})
            </span>
          </div>
        )}
      </div>

      {/* Card Info & Details */}
      <div className="p-4 flex flex-col justify-between flex-grow space-y-3 bg-slate-900/60">
        <div>
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-mono font-bold text-cyan-400">{camera.camera_id}</span>
                <StatusBadge status={camera.status} />
              </div>
              <h3 className="text-sm font-semibold text-slate-100 mt-1 line-clamp-1">{camera.name}</h3>
            </div>
            <RiskBadge risk={riskLevel} />
          </div>

          <p className="text-xs text-slate-400 flex items-center mt-2 line-clamp-1">
            <MapPin className="w-3.5 h-3.5 mr-1 text-slate-500 flex-shrink-0" />
            {camera.location}
          </p>
        </div>

        {/* Telemetry Footer */}
        <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono text-slate-400">
          <div className="flex items-center space-x-1 text-slate-300">
            <Car className="w-3.5 h-3.5 text-cyan-400" />
            <span>{vehicleCount} Vehicles</span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => onOpenLocationModal(camera)}
              className="text-[11px] text-slate-400 hover:text-cyan-400 transition-colors flex items-center"
            >
              <MapPin className="w-3 h-3 mr-0.5" /> Map
            </button>
            <button
              onClick={() => onOpenStreamModal(camera)}
              className="text-[11px] bg-cyan-950/60 text-cyan-300 hover:bg-cyan-900/60 border border-cyan-800/50 px-2 py-1 rounded transition-colors"
            >
              Inspect
            </button>
          </div>
        </div>
      </div>
    </GlassCard>
  );
};
