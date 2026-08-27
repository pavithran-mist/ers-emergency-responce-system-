import React, { useRef, useEffect, useState } from 'react';
import { api } from '../services/api';
import { Smartphone, X, RefreshCw, AlertTriangle } from 'lucide-react';

interface MobileCameraModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MobileCameraModal: React.FC<MobileCameraModalProps> = ({ isOpen, onClose }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detections, setDetections] = useState<any[]>([]);
  const [hazards, setHazards] = useState<any[]>([]);
  const [fps, setFps] = useState<number>(0);
  const [vehicleCount, setVehicleCount] = useState<number>(0);

  const streamRef = useRef<MediaStream | null>(null);
  const isProcessingRef = useRef(false);

  const startCamera = async (mode: 'environment' | 'user') => {
    setError(null);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: mode },
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setIsStreaming(true);
    } catch (err: any) {
      console.error('Camera access error:', err);
      setError(err.message || 'Unable to access device camera. Please check camera permissions.');
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

  // Inference loop
  useEffect(() => {
    let lastTime = performance.now();
    let frameCount = 0;

    const interval = setInterval(async () => {
      if (!isStreaming || !videoRef.current || !canvasRef.current || isProcessingRef.current) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video.readyState !== 4) return;

      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Draw current video frame to hidden canvas to export base64
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const base64 = canvas.toDataURL('image/jpeg', 0.65);

      isProcessingRef.current = true;
      try {
        const res = await api.detectFrame(base64);
        if (res && res.status === 'success') {
          setDetections(res.detections || []);
          setHazards(res.hazards || []);
          setVehicleCount(res.vehicle_count || 0);

          // Calculate FPS
          frameCount++;
          const now = performance.now();
          if (now - lastTime >= 1000) {
            setFps(Math.round((frameCount * 1000) / (now - lastTime)));
            frameCount = 0;
            lastTime = now;
          }
        }
      } catch (e) {
        // Ignore frame network drop
      } finally {
        isProcessingRef.current = false;
      }
    }, 150);

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
              <h2 className="text-sm font-bold text-white">Live Phone Camera AI Scanner</h2>
              <p className="text-[11px] text-slate-400 font-mono">Real-time mobile YOLO neural detection</p>
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

        {/* Video Viewport with AR Bounding Boxes */}
        <div className="relative bg-black flex-1 min-h-[320px] sm:min-h-[400px] flex items-center justify-center overflow-hidden">
          {error ? (
            <div className="p-6 text-center text-red-400 space-y-2">
              <AlertTriangle className="w-10 h-10 mx-auto" />
              <p className="text-sm font-semibold">{error}</p>
              <p className="text-xs text-slate-400">Please grant camera permission in your browser.</p>
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
                  <span>LIVE ({fps} FPS)</span>
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
                    STATUS: NOMINAL
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
                        left: `${(bbox[0] / 640) * 100}%`,
                        top: `${(bbox[1] / 480) * 100}%`,
                        width: `${((bbox[2] - bbox[0]) / 640) * 100}%`,
                        height: `${((bbox[3] - bbox[1]) / 480) * 100}%`,
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
        <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs font-mono text-slate-400">
          <span>Point your phone camera at vehicles, traffic, or objects.</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-sans font-semibold"
          >
            Close Scanner
          </button>
        </div>
      </div>
    </div>
  );
};
