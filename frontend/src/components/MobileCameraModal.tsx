import React, { useRef, useEffect, useState } from 'react';
import { api } from '../services/api';
import { Smartphone, X, RefreshCw, AlertTriangle, ShieldAlert, Navigation, Activity } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface MobileCameraModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MobileCameraModal: React.FC<MobileCameraModalProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detections, setDetections] = useState<any[]>([]);
  const [hazards, setHazards] = useState<any[]>([]);
  const [fps, setFps] = useState<number>(0);
  const [latency, setLatency] = useState<number>(0);
  const [vehicleCount, setVehicleCount] = useState<number>(0);
  const [activeIncident, setActiveIncident] = useState<any | null>(null);
  const [apiStatus, setApiStatus] = useState<'CONNECTING' | 'ACTIVE' | 'ERROR'>('CONNECTING');

  const streamRef = useRef<MediaStream | null>(null);
  const isProcessingRef = useRef(false);

  const startCamera = async (mode: 'environment' | 'user') => {
    setError(null);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }

    try {
      let stream: MediaStream | null = null;

      // Try primary ideal constraints
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: mode },
            width: { ideal: 640, max: 1280 },
            height: { ideal: 480, max: 720 },
          },
          audio: false,
        });
      } catch (errPrimary) {
        // Fallback for PC webcams without environment facingMode
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setIsStreaming(true);
    } catch (err: any) {
      console.error('Camera access error:', err);
      setError(err.message || 'Unable to access device camera. Please allow camera permissions in your browser.');
      setIsStreaming(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      startCamera(facingMode);
    } else {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      setIsStreaming(false);
      setActiveIncident(null);
      setFps(0);
    }
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, [isOpen]);

  const toggleFacingMode = () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
    startCamera(nextMode);
  };

  // Inference loop with optimized 416x312 downscaled frame transfer
  useEffect(() => {
    let lastTime = performance.now();
    let frameCount = 0;

    const interval = setInterval(async () => {
      if (!isStreaming || !videoRef.current || !canvasRef.current || isProcessingRef.current) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video.readyState < 2) return;

      // Downscale to 416x312 for ultra-fast ~15KB transmission over mobile networks
      canvas.width = 416;
      canvas.height = 312;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const base64 = canvas.toDataURL('image/jpeg', 0.50);

      isProcessingRef.current = true;
      const startTime = performance.now();
      try {
        const res = await api.detectFrame(base64);
        const reqLatency = Math.round(performance.now() - startTime);
        setLatency(reqLatency);

        if (res && res.status === 'success') {
          setApiStatus('ACTIVE');
          setDetections(res.detections || []);
          setHazards(res.hazards || []);
          setVehicleCount(res.vehicle_count || 0);

          // Handle newly recorded incidents
          if (res.created_incidents && res.created_incidents.length > 0) {
            const inc = res.created_incidents[0];
            setActiveIncident(inc);

            if (navigator.vibrate) {
              navigator.vibrate([300, 150, 300, 150, 500]);
            }
          }

          // Calculate FPS
          frameCount++;
          const now = performance.now();
          if (now - lastTime >= 1000) {
            setFps(Math.round((frameCount * 1000) / (now - lastTime)));
            frameCount = 0;
            lastTime = now;
          }
        } else {
          setApiStatus('ERROR');
        }
      } catch (e) {
        setApiStatus('ERROR');
      } finally {
        isProcessingRef.current = false;
      }
    }, 120);

    return () => clearInterval(interval);
  }, [isStreaming]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-2 sm:p-4">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col max-h-[95vh]">
        {/* Header */}
        <div className="px-4 py-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Smartphone className="w-5 h-5 text-cyan-400 animate-pulse" />
            <div>
              <h2 className="text-sm font-bold text-white">Mobile Camera AI Incident Detector</h2>
              <p className="text-[11px] text-slate-400 font-mono">Live YOLO Vision + Emergency Dispatch</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={toggleFacingMode}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded-lg text-xs font-mono flex items-center space-x-1"
              title="Switch Front/Rear Camera"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{facingMode === 'environment' ? 'Rear Cam' : 'Front Cam'}</span>
            </button>
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Emergency Incident Banner (Pop-up when detected) */}
        {activeIncident && (
          <div className="bg-gradient-to-r from-red-600 via-rose-600 to-red-700 p-3 text-white shadow-lg animate-pulse flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <ShieldAlert className="w-5 h-5 text-yellow-300 animate-bounce" />
              <div>
                <div className="font-bold text-xs flex items-center space-x-1.5">
                  <span>?? EMERGENCY INCIDENT RECORDED!</span>
                  <span className="bg-black/40 px-1.5 py-0.5 rounded text-[10px] font-mono">{activeIncident.incident_id}</span>
                </div>
                <div className="text-[11px] text-red-100 font-mono">
                  {activeIncident.event_type.toUpperCase().replace('_', ' ')} • DISPATCHED TO {activeIncident.department}
                </div>
              </div>
            </div>
            <button
              onClick={() => {
                onClose();
                navigate('/incidents');
              }}
              className="px-3 py-1 bg-white text-red-600 hover:bg-red-50 rounded-lg text-xs font-bold shadow transition-all font-sans"
            >
              View Report
            </button>
          </div>
        )}

        {/* Video Viewport with AR Bounding Boxes */}
        <div className="relative bg-black flex-1 min-h-[320px] sm:min-h-[400px] flex items-center justify-center overflow-hidden">
          {error ? (
            <div className="p-6 text-center text-red-400 space-y-2">
              <AlertTriangle className="w-10 h-10 mx-auto" />
              <p className="text-sm font-semibold">{error}</p>
              <p className="text-xs text-slate-400">Please tap "Allow" when your browser asks for camera permission.</p>
              <button
                onClick={() => startCamera(facingMode)}
                className="mt-3 px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-bold"
              >
                Retry Camera
              </button>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                playsInline
                muted
                autoPlay
                className="w-full h-full object-contain"
              />
              <canvas ref={canvasRef} className="hidden" />

              {/* Live Overlay HUD */}
              <div className="absolute top-2 left-2 flex flex-wrap gap-1.5 font-mono text-[11px]">
                <span className="px-2 py-0.5 bg-black/70 backdrop-blur-sm rounded border border-emerald-500/40 text-emerald-400 font-bold flex items-center space-x-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <span>LIVE ({fps} FPS • {latency}ms)</span>
                </span>
                <span className="px-2 py-0.5 bg-black/70 backdrop-blur-sm rounded border border-cyan-500/40 text-cyan-300">
                  OBJECTS: {vehicleCount}
                </span>
                {hazards.length > 0 ? (
                  <span className="px-2 py-0.5 bg-red-950/80 backdrop-blur-sm rounded border border-red-500 text-red-300 font-bold animate-bounce">
                    ?? {hazards[0].event_type.toUpperCase().replace('_', ' ')}
                  </span>
                ) : (
                  <span className="px-2 py-0.5 bg-black/70 backdrop-blur-sm rounded border border-slate-700 text-slate-300">
                    STATUS: {apiStatus === 'ACTIVE' ? 'SCANNING ACTIVE' : 'CONNECTING AI...'}
                  </span>
                )}
              </div>

              {/* Render Bounding Boxes on Screen */}
              <div className="absolute inset-0 pointer-events-none">
                {detections.map((d, i) => {
                  const [normX1, normY1, normX2, normY2] = d.norm_bbox || [0, 0, 0, 0];
                  return (
                    <div
                      key={i}
                      style={{
                        left: `${normX1 * 100}%`,
                        top: `${normY1 * 100}%`,
                        width: `${(normX2 - normX1) * 100}%`,
                        height: `${(normY2 - normY1) * 100}%`,
                      }}
                      className="absolute border-2 border-cyan-400 bg-cyan-400/10 rounded transition-all duration-75 flex flex-col justify-start"
                    >
                      <span className="bg-cyan-500 text-black font-bold text-[10px] font-mono px-1 py-0.5 w-max">
                        {d.class_name.toUpperCase()} {Math.round(d.confidence * 100)}%
                      </span>
                    </div>
                  );
                })}

                {/* Render Hazard Alerts */}
                {hazards.map((h, i) => {
                  const bbox = h.bounding_box || [0, 0, 0, 0];
                  return (
                    <div
                      key={`h-${i}`}
                      style={{
                        left: `${(bbox[0] / 416) * 100}%`,
                        top: `${(bbox[1] / 312) * 100}%`,
                        width: `${((bbox[2] - bbox[0]) / 416) * 100}%`,
                        height: `${((bbox[3] - bbox[1]) / 312) * 100}%`,
                      }}
                      className="absolute border-2 border-red-500 bg-red-500/20 rounded animate-pulse"
                    >
                      <span className="bg-red-600 text-white font-bold text-[10px] font-mono px-1 py-0.5 w-max">
                        ?? {h.event_type.toUpperCase()} ({Math.round(h.confidence * 100)}%)
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Footer controls */}
        <div className="p-3 bg-slate-950 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs font-mono text-slate-400">
          <div className="flex items-center space-x-1.5 text-[11px] text-slate-300">
            <Activity className="w-3.5 h-3.5 text-cyan-400" />
            <span>Point camera at cars, people, or hazards to detect in real-time.</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-sans font-semibold w-full sm:w-auto"
          >
            Close Scanner
          </button>
        </div>
      </div>
    </div>
  );
};
