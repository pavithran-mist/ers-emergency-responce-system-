import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useSocket } from '../context/SocketContext';
import { Camera } from '../types';
import { CameraCard } from '../components/CameraCard';
import { CameraStreamModal } from '../components/CameraStreamModal';
import { LocationMapModal } from '../components/LocationMapModal';
import { Video, Plus, RefreshCw, Filter } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const LiveCamerasPage: React.FC = () => {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [loading, setLoading] = useState(true);

  const [selectedCamera, setSelectedCamera] = useState<Camera | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<{ camera?: Camera } | null>(null);

  const { telemetryMap } = useSocket();
  const { isAdmin } = useAuth();
  const navigate = useNavigate();

  const loadCameras = async () => {
    try {
      const list = await api.getCameras();
      setCameras(list);
    } catch (err) {
      console.error('Failed to load cameras:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCameras();
  }, []);

  const filteredCameras = cameras.filter((c) => {
    const isOnline = c.status === 'ONLINE' || telemetryMap[c.camera_id]?.status === 'ONLINE';
    if (filterStatus === 'ONLINE' && !isOnline) return false;
    if (filterStatus === 'OFFLINE' && isOnline) return false;
    if (filterType !== 'ALL' && c.camera_type !== filterType.toLowerCase()) return false;
    return true;
  });

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Video className="w-5 h-5 text-emerald-400" />
            <h1 className="text-xl font-black text-white">Live Camera Surveillance Grid</h1>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time multi-source video ingestion with active AI vehicle tracking & hazard classification
          </p>
        </div>

        <div className="flex items-center space-x-3 w-full sm:w-auto">
          <button
            onClick={loadCameras}
            className="p-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-lg transition-colors"
            title="Refresh Feeds"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {isAdmin && (
            <button
              onClick={() => navigate('/admin/cameras')}
              className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all shadow-md shadow-cyan-950/40"
            >
              <Plus className="w-4 h-4" />
              <span>Add / Manage Cameras</span>
            </button>
          )}
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800/80 text-xs font-mono">
        <div className="flex items-center space-x-1.5 text-slate-400 pr-3 border-r border-slate-800">
          <Filter className="w-3.5 h-3.5" />
          <span>Filters:</span>
        </div>

        <div className="flex items-center space-x-1">
          {['ALL', 'ONLINE', 'OFFLINE'].map((st) => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className={`px-3 py-1 rounded-md transition-colors ${
                filterStatus === st
                  ? 'bg-cyan-600 text-white font-bold'
                  : 'bg-slate-950 text-slate-400 hover:text-slate-200'
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        <div className="flex items-center space-x-1 pl-3 border-l border-slate-800">
          {['ALL', 'SYNTHETIC', 'RTSP', 'IP_STREAM', 'WEBCAM'].map((tp) => (
            <button
              key={tp}
              onClick={() => setFilterType(tp)}
              className={`px-3 py-1 rounded-md transition-colors uppercase ${
                filterType === tp
                  ? 'bg-blue-600 text-white font-bold'
                  : 'bg-slate-950 text-slate-400 hover:text-slate-200'
              }`}
            >
              {tp}
            </button>
          ))}
        </div>

        <div className="ml-auto text-slate-500">
          Showing {filteredCameras.length} of {cameras.length} cameras
        </div>
      </div>

      {/* Camera Matrix Grid */}
      {loading ? (
        <div className="p-12 text-center text-slate-500 font-mono">Loading camera feeds...</div>
      ) : filteredCameras.length === 0 ? (
        <div className="p-12 text-center bg-slate-900/40 rounded-2xl border border-slate-800 text-slate-500 font-mono space-y-2">
          <Video className="w-8 h-8 mx-auto opacity-40" />
          <p>No cameras match the selected filter criteria.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredCameras.map((cam) => (
            <CameraCard
              key={cam.camera_id}
              camera={cam}
              telemetry={telemetryMap[cam.camera_id]}
              onOpenStreamModal={(c) => setSelectedCamera(c)}
              onOpenLocationModal={(c) => setSelectedLocation({ camera: c })}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      <CameraStreamModal
        camera={selectedCamera}
        telemetry={selectedCamera ? telemetryMap[selectedCamera.camera_id] : undefined}
        onClose={() => setSelectedCamera(null)}
        onOpenLocationModal={(c) => setSelectedLocation({ camera: c })}
      />

      <LocationMapModal
        camera={selectedLocation?.camera}
        onClose={() => setSelectedLocation(null)}
      />
    </div>
  );
};
