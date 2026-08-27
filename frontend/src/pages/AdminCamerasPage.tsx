import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Camera } from '../types';
import { GlassCard } from '../components/GlassCard';
import { StatusBadge } from '../components/StatusBadge';
import { CameraStreamModal } from '../components/CameraStreamModal';
import { LocationMapModal } from '../components/LocationMapModal';
import {
  Camera as CameraIcon,
  Plus,
  Trash2,
  Edit2,
  Radio,
  Play,
  Square,
  MapPin,
  RefreshCw,
  CheckCircle,
  XCircle,
  X,
} from 'lucide-react';

export const AdminCamerasPage: React.FC = () => {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Add / Edit Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCamera, setEditingCamera] = useState<Camera | null>(null);
  const [testResult, setTestResult] = useState<any | null>(null);
  const [testing, setTesting] = useState(false);

  // Form Fields
  const [formData, setFormData] = useState({
    camera_id: '',
    name: '',
    url: 'synthetic',
    camera_type: 'synthetic',
    location: '',
    latitude: '',
    longitude: '',
    landmark: '',
    zone: '',
    description: '',
    username: '',
    password: '',
    is_enabled: true,
  });

  // Modals for preview and map
  const [previewCamera, setPreviewCamera] = useState<Camera | null>(null);
  const [locationCamera, setLocationCamera] = useState<Camera | null>(null);

  const loadCameras = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getCameras();
      setCameras(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load cameras.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCameras();
  }, []);

  const openAddModal = () => {
    setEditingCamera(null);
    setTestResult(null);
    setFormData({
      camera_id: `CAM-00${cameras.length + 1}`,
      name: 'Primary Operations Webcam',
      url: '0',
      camera_type: 'webcam',
      location: 'Command Center - Station 1',
      latitude: '28.6139',
      longitude: '77.2090',
      landmark: 'Main Operations Desk',
      zone: 'Control Room Alpha',
      description: 'Physical optical camera sensor',
      username: '',
      password: '',
      is_enabled: true,
    });
    setIsModalOpen(true);
  };

  const handleTypeChange = (newType: string) => {
    let defaultUrl = formData.url;
    let defaultName = formData.name;

    if (newType === 'webcam') {
      defaultUrl = '0';
      if (!formData.name || formData.name.includes('Simulator') || formData.name.includes('RTSP')) {
        defaultName = 'Primary Operations Webcam';
      }
    } else if (newType === 'rtsp') {
      defaultUrl = 'rtsp://192.168.1.100:554/live';
      defaultName = 'RTSP Corridor Camera';
    } else if (newType === 'video_file') {
      defaultUrl = 'datasets/sample_traffic.mp4';
      defaultName = 'Local Video File Feed';
    } else if (newType === 'ip_stream') {
      defaultUrl = 'http://192.168.1.100:8080/video';
      defaultName = 'IP Network Camera';
    }

    setFormData({
      ...formData,
      camera_type: newType,
      url: defaultUrl,
      name: defaultName,
    });
  };

  const openEditModal = (cam: Camera) => {
    setEditingCamera(cam);
    setTestResult(null);
    setFormData({
      camera_id: cam.camera_id,
      name: cam.name,
      url: cam.url,
      camera_type: cam.camera_type,
      location: cam.location,
      latitude: cam.latitude !== undefined && cam.latitude !== null ? String(cam.latitude) : '',
      longitude: cam.longitude !== undefined && cam.longitude !== null ? String(cam.longitude) : '',
      landmark: cam.landmark || '',
      zone: cam.zone || '',
      description: cam.description || '',
      username: cam.username || '',
      password: cam.password || '',
      is_enabled: cam.is_enabled,
    });
    setIsModalOpen(true);
  };

  const handleSaveCamera = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const payload: Partial<Camera> = {
        camera_id: formData.camera_id.trim().toUpperCase(),
        name: formData.name.trim(),
        url: formData.url.trim(),
        camera_type: formData.camera_type as any,
        location: formData.location.trim(),
        latitude: formData.latitude ? parseFloat(formData.latitude) : undefined,
        longitude: formData.longitude ? parseFloat(formData.longitude) : undefined,
        landmark: formData.landmark.trim() || undefined,
        zone: formData.zone.trim() || undefined,
        description: formData.description.trim() || undefined,
        username: formData.username.trim() || undefined,
        password: formData.password.trim() || undefined,
        is_enabled: formData.is_enabled,
      };

      if (editingCamera) {
        await api.updateCamera(editingCamera.camera_id, payload);
        setSuccess(`Camera ${editingCamera.camera_id} updated successfully.`);
      } else {
        await api.createCamera(payload);
        setSuccess(`Camera ${payload.camera_id} added successfully.`);
      }

      setIsModalOpen(false);
      loadCameras();
    } catch (err: any) {
      setError(err.message || 'Failed to save camera.');
    }
  };

  const handleDelete = async (camId: string) => {
    if (!window.confirm(`Are you sure you want to delete camera ${camId}?`)) return;
    try {
      await api.deleteCamera(camId);
      setSuccess(`Camera ${camId} deleted.`);
      loadCameras();
    } catch (err: any) {
      setError(err.message || 'Failed to delete camera.');
    }
  };

  const handleTestConnection = async (camId: string) => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await api.testCamera(camId);
      setTestResult(res);
    } catch (err: any) {
      setTestResult({ is_connected: false, message: err.message || 'Connection failed' });
    } finally {
      setTesting(false);
    }
  };

  const handleToggleWorker = async (cam: Camera) => {
    try {
      if (cam.is_enabled) {
        await api.stopCamera(cam.camera_id);
      } else {
        await api.startCamera(cam.camera_id);
      }
      loadCameras();
    } catch (err: any) {
      setError(err.message || 'Failed to toggle camera worker.');
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-teal-950/80 border border-teal-700/60 text-teal-400">
              <CameraIcon className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-black text-white">Camera Network Manager</h1>
              <p className="text-xs text-slate-400">
                Register IP, RTSP, Webcam, phone feeds, GPS coordinates, and manage dedicated AI worker processes
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={loadCameras}
            className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={openAddModal}
            className="px-4 py-2 bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all shadow-md shadow-teal-950/40"
          >
            <Plus className="w-4 h-4" />
            <span>Register New Camera</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-950/80 border border-red-500/50 p-3 rounded-lg text-xs text-red-300 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {success && (
        <div className="bg-emerald-950/80 border border-emerald-500/50 p-3 rounded-lg text-xs text-emerald-300 flex items-center justify-between">
          <span>{success}</span>
          <button onClick={() => setSuccess(null)}>✕</button>
        </div>
      )}

      {/* Camera Table */}
      <GlassCard className="p-0 overflow-hidden border border-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] border-b border-slate-800">
              <tr>
                <th className="py-3.5 px-4">Camera ID</th>
                <th className="py-3.5 px-4">Camera Name</th>
                <th className="py-3.5 px-4">Stream Source / URL</th>
                <th className="py-3.5 px-4">Type</th>
                <th className="py-3.5 px-4">Registered Location</th>
                <th className="py-3.5 px-4">GPS (Lat/Lng)</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Worker</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {cameras.map((cam) => (
                <tr key={cam.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-3.5 px-4 font-bold text-cyan-400">{cam.camera_id}</td>
                  <td className="py-3.5 px-4 font-sans font-semibold text-slate-100">{cam.name}</td>
                  <td className="py-3.5 px-4 text-slate-300 max-w-xs truncate">{cam.url}</td>
                  <td className="py-3.5 px-4 uppercase text-slate-400 font-bold">{cam.camera_type}</td>
                  <td className="py-3.5 px-4 text-slate-300 font-sans">
                    <div className="flex items-center space-x-1">
                      <MapPin className="w-3 h-3 text-cyan-400 flex-shrink-0" />
                      <span className="truncate">{cam.location}</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-slate-400 text-[11px]">
                    {cam.latitude && cam.longitude ? `${cam.latitude.toFixed(4)}, ${cam.longitude.toFixed(4)}` : 'N/A'}
                  </td>
                  <td className="py-3.5 px-4">
                    <StatusBadge status={cam.status} />
                  </td>
                  <td className="py-3.5 px-4">
                    <button
                      onClick={() => handleToggleWorker(cam)}
                      className={`px-2 py-1 rounded text-[10px] font-bold flex items-center space-x-1 transition-colors ${
                        cam.is_enabled
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800 hover:bg-emerald-900'
                          : 'bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700'
                      }`}
                    >
                      {cam.is_enabled ? <Square className="w-2.5 h-2.5 fill-current" /> : <Play className="w-2.5 h-2.5" />}
                      <span>{cam.is_enabled ? 'STOP' : 'START'}</span>
                    </button>
                  </td>
                  <td className="py-3.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                    <button
                      onClick={() => setPreviewCamera(cam)}
                      className="p-1.5 bg-slate-900 hover:bg-slate-800 text-cyan-400 rounded border border-slate-800 transition-colors"
                      title="Inspect Video Stream"
                    >
                      <Radio className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setLocationCamera(cam)}
                      className="p-1.5 bg-slate-900 hover:bg-slate-800 text-teal-400 rounded border border-slate-800 transition-colors"
                      title="View Location Map"
                    >
                      <MapPin className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => openEditModal(cam)}
                      className="p-1.5 bg-slate-900 hover:bg-slate-800 text-amber-400 rounded border border-slate-800 transition-colors"
                      title="Edit Camera Details"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(cam.camera_id)}
                      className="p-1.5 bg-slate-900 hover:bg-slate-800 text-red-400 rounded border border-slate-800 transition-colors"
                      title="Delete Camera"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {/* Add / Edit Camera Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
              <h2 className="text-base font-bold text-white flex items-center space-x-2">
                <CameraIcon className="w-4 h-4 text-cyan-400" />
                <span>{editingCamera ? `Edit Camera: ${editingCamera.camera_id}` : 'Register New Surveillance Camera'}</span>
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCamera} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {/* Quick Preset Selector */}
              {!editingCamera && (
                <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800 space-y-2">
                  <div className="text-[11px] font-mono uppercase text-slate-400 font-semibold flex items-center justify-between">
                    <span>⚡ Quick Setup Preset:</span>
                    <span className="text-cyan-400 font-normal">Click to auto-fill</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleTypeChange('webcam')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all ${
                        formData.camera_type === 'webcam'
                          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                          : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                      }`}
                    >
                      <span>📷 Local Webcam (0)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTypeChange('rtsp')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all ${
                        formData.camera_type === 'rtsp'
                          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                          : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                      }`}
                    >
                      <span>🌐 RTSP IP Feed</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTypeChange('video_file')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all ${
                        formData.camera_type === 'video_file'
                          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                          : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                      }`}
                    >
                      <span>📁 Video File</span>
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono uppercase text-slate-400 mb-1">Camera ID *</label>
                  <input
                    type="text"
                    required
                    disabled={!!editingCamera}
                    value={formData.camera_id}
                    onChange={(e) => setFormData({ ...formData, camera_id: e.target.value })}
                    placeholder="CAM-001"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-cyan-300 font-mono focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono uppercase text-slate-400 mb-1">Camera Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Primary Operations Webcam"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono uppercase text-slate-400 mb-1">Camera Type *</label>
                  <select
                    value={formData.camera_type}
                    onChange={(e) => handleTypeChange(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 font-mono"
                  >
                    <option value="webcam">Local Webcam (Index 0, 1)</option>
                    <option value="rtsp">RTSP Stream (rtsp://...)</option>
                    <option value="ip_stream">IP Camera Stream (http://...)</option>
                    <option value="video_file">Local Video File (MP4/AVI)</option>
                    <option value="phone_stream">Phone Camera Stream</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-mono uppercase text-slate-400 mb-1">Stream URL / Path *</label>
                  <input
                    type="text"
                    required
                    value={formData.url}
                    onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                    placeholder="0 OR rtsp://192.168.1.100:554/feed"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-mono uppercase text-slate-400 mb-1">Registered Address / Location *</label>
                  <input
                    type="text"
                    required
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="NH-48 KM 42, North Corridor"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono uppercase text-slate-400 mb-1">Latitude</label>
                  <input
                    type="number"
                    step="any"
                    value={formData.latitude}
                    onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                    placeholder="12.9716"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono uppercase text-slate-400 mb-1">Longitude</label>
                  <input
                    type="number"
                    step="any"
                    value={formData.longitude}
                    onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                    placeholder="77.5946"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono uppercase text-slate-400 mb-1">Landmark / Vicinity</label>
                  <input
                    type="text"
                    value={formData.landmark}
                    onChange={(e) => setFormData({ ...formData, landmark: e.target.value })}
                    placeholder="Near Toll Plaza Gate 4"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono uppercase text-slate-400 mb-1">Department Zone / Sector</label>
                  <input
                    type="text"
                    value={formData.zone}
                    onChange={(e) => setFormData({ ...formData, zone: e.target.value })}
                    placeholder="Highway Sector 4"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              {/* Test Connection Output */}
              {testResult && (
                <div
                  className={`p-3 rounded-lg text-xs font-mono flex items-center space-x-2 ${
                    testResult.is_connected
                      ? 'bg-emerald-950/80 border border-emerald-500 text-emerald-300'
                      : 'bg-red-950/80 border border-red-500 text-red-300'
                  }`}
                >
                  {testResult.is_connected ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                  <span>{testResult.message}</span>
                </div>
              )}

              {/* Modal Buttons */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                {editingCamera && (
                  <button
                    type="button"
                    disabled={testing}
                    onClick={() => handleTestConnection(editingCamera.camera_id)}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-cyan-400 rounded-lg text-xs font-mono font-semibold transition-colors"
                  >
                    {testing ? 'Testing...' : 'Test Connection'}
                  </button>
                )}
                <div className="flex items-center space-x-3 ml-auto">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold shadow-lg shadow-cyan-950/40"
                  >
                    {editingCamera ? 'Save Changes' : 'Create Camera'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Preview Stream Modal */}
      <CameraStreamModal
        camera={previewCamera}
        onClose={() => setPreviewCamera(null)}
        onOpenLocationModal={(c) => setLocationCamera(c)}
      />

      {/* Location Modal */}
      <LocationMapModal
        camera={locationCamera}
        onClose={() => setLocationCamera(null)}
      />
    </div>
  );
};
