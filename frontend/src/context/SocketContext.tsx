import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { Incident, CameraTelemetry } from '../types';

interface SocketContextType {
  isConnected: boolean;
  activeAlerts: Incident[];
  telemetryMap: Record<string, CameraTelemetry>;
  isMuted: boolean;
  toggleMute: () => void;
  dismissAlert: (incidentId: string) => void;
  clearAlerts: () => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [activeAlerts, setActiveAlerts] = useState<Incident[]>([]);
  const [telemetryMap, setTelemetryMap] = useState<Record<string, CameraTelemetry>>({});
  const [isMuted, setIsMuted] = useState<boolean>(() => {
    return localStorage.getItem('astra_alert_muted') === 'true';
  });

  const isMutedRef = useRef(isMuted);
  isMutedRef.current = isMuted;

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<any>(null);

  const toggleMute = () => {
    setIsMuted((prev) => {
      const next = !prev;
      localStorage.setItem('astra_alert_muted', String(next));
      return next;
    });
  };

  // Synthesize warning beep for emergency alerts
  const playAlertSound = (risk: string) => {
    if (isMutedRef.current) return;
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = risk === 'CRITICAL' ? 'sawtooth' : 'sine';
      osc.frequency.setValueAtTime(risk === 'CRITICAL' ? 880 : 660, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.3);

      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch (e) {
      // Audio context might be restricted before user gesture
    }
  };

  const connectWebSocket = () => {
    let wsUrl = import.meta.env.VITE_WS_URL as string | undefined;

    if (!wsUrl) {
      const apiBase = (import.meta.env.VITE_API_BASE as string) || (import.meta.env.VITE_API_URL as string) || '';
      if (apiBase.startsWith('http://')) {
        wsUrl = apiBase.replace('http://', 'ws://').replace(/\/api\/v1\/?$/, '') + '/ws/alerts';
      } else if (apiBase.startsWith('https://')) {
        wsUrl = apiBase.replace('https://', 'wss://').replace(/\/api\/v1\/?$/, '') + '/ws/alerts';
      } else {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const hostname = window.location.hostname;
        const port = window.location.port === '3000' ? '8000' : window.location.port;
        wsUrl = `${protocol}//${hostname}${port ? ':' + port : ''}/ws/alerts`;
      }
    }

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

    ws.onopen = () => {
      console.log('ASTRA WebSocket connected');
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'NEW_INCIDENT' && data.incident) {
          const incident: Incident = data.incident;
          setActiveAlerts((prev) => [incident, ...prev.slice(0, 9)]);
          playAlertSound(incident.risk);
        } else if (data.type === 'CAMERA_TELEMETRY' && data.telemetry) {
          const tel: CameraTelemetry = data.telemetry;
          setTelemetryMap((prev) => ({
            ...prev,
            [tel.camera_id]: tel,
          }));
        }
      } catch (err) {
        console.error('Error parsing WebSocket message:', err);
      }
    };

    ws.onclose = () => {
      console.log('ASTRA WebSocket disconnected. Reconnecting in 3s...');
      setIsConnected(false);
      reconnectTimeoutRef.current = setTimeout(connectWebSocket, 3000);
    };

    ws.onerror = (err) => {
      console.debug('WebSocket error:', err);
      ws.close();
    };
    } catch (err) {
      console.warn('Could not establish WebSocket connection:', err);
      reconnectTimeoutRef.current = setTimeout(connectWebSocket, 5000);
    }
  };

  useEffect(() => {
    connectWebSocket();
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  const dismissAlert = (incidentId: string) => {
    setActiveAlerts((prev) => prev.filter((a) => a.incident_id !== incidentId));
  };

  const clearAlerts = () => {
    setActiveAlerts([]);
  };

  return (
    <SocketContext.Provider
      value={{
        isConnected,
        activeAlerts,
        telemetryMap,
        isMuted,
        toggleMute,
        dismissAlert,
        clearAlerts,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};
