import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { Shield, Radio, Phone, LogOut, UserCircle, AlertTriangle, Volume2, VolumeX } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const { isConnected, activeAlerts, isMuted, toggleMute } = useSocket();
  const [time, setTime] = useState<string>(new Date().toLocaleTimeString());

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="h-16 bg-slate-950/90 border-b border-slate-800/80 px-6 flex items-center justify-between sticky top-0 z-40 backdrop-blur-md">
      {/* Brand & System Mode */}
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2.5">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-950/50">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-black tracking-wider text-white flex items-center">
              ASTRA <span className="text-cyan-400 ml-1 font-mono font-normal text-sm">AI v2.0</span>
            </h1>
            <p className="text-[10px] text-slate-400 font-medium tracking-tight -mt-1">
              Visual Road Safety & Emergency Platform
            </p>
          </div>
        </div>

        <div className="hidden lg:flex items-center space-x-2 pl-4 border-l border-slate-800">
          <span className="flex items-center text-xs text-slate-300 font-mono bg-slate-900 px-2.5 py-1 rounded border border-slate-800">
            <Radio className={`w-3.5 h-3.5 mr-1.5 ${isConnected ? 'text-emerald-400 animate-pulse' : 'text-rose-400'}`} />
            WS: {isConnected ? 'LIVE FEED' : 'OFFLINE'}
          </span>

          {activeAlerts.length > 0 && (
            <span className="flex items-center text-xs font-bold text-red-400 bg-red-950/80 px-2.5 py-1 rounded border border-red-800/60 animate-bounce">
              <AlertTriangle className="w-3.5 h-3.5 mr-1.5 text-red-400" />
              {activeAlerts.length} ACTIVE ALERT{activeAlerts.length > 1 ? 'S' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Emergency Hotlines & Time & Audio & User */}
      <div className="flex items-center space-x-4">
        {/* Hotlines info */}
        <div className="hidden xl:flex items-center space-x-3 text-xs font-mono text-slate-400 bg-slate-900/60 px-3 py-1.5 rounded-lg border border-slate-800/60">
          <span className="text-slate-500 flex items-center"><Phone className="w-3 h-3 mr-1" /> HOTLINES:</span>
          <span className="text-cyan-400 font-bold">POLICE 112</span>
          <span className="text-slate-600">|</span>
          <span className="text-red-400 font-bold">FIRE 101</span>
          <span className="text-slate-600">|</span>
          <span className="text-amber-400 font-bold">MED 108</span>
        </div>

        {/* Audio Mute/Unmute Toggle */}
        <button
          onClick={toggleMute}
          title={isMuted ? 'Alert Sound is Muted (Click to Unmute)' : 'Alert Sound is Active (Click to Mute)'}
          className={`p-2 rounded-lg border transition-colors flex items-center space-x-1 text-xs font-mono ${
            isMuted
              ? 'bg-slate-900 text-slate-500 border-slate-800 hover:text-slate-300'
              : 'bg-cyan-950/60 text-cyan-400 border-cyan-800/60 hover:bg-cyan-900/60'
          }`}
        >
          {isMuted ? <VolumeX className="w-4 h-4 text-slate-500" /> : <Volume2 className="w-4 h-4 text-cyan-400" />}
          <span className="hidden sm:inline">{isMuted ? 'MUTED' : 'AUDIO ON'}</span>
        </button>

        {/* Live Clock */}
        <div className="hidden md:block text-xs font-mono text-cyan-300/90 bg-cyan-950/30 px-3 py-1.5 rounded border border-cyan-800/30">
          {time}
        </div>

        {/* User Info & Logout */}
        <div className="flex items-center space-x-3 pl-3 border-l border-slate-800">
          <div className="flex items-center space-x-2 text-right">
            <UserCircle className="w-8 h-8 text-slate-400" />
            <div className="hidden sm:block text-left">
              <div className="text-xs font-semibold text-slate-200">{user?.full_name || user?.email}</div>
              <div className="text-[10px] font-mono uppercase text-cyan-400">{user?.role}</div>
            </div>
          </div>

          <button
            onClick={() => logout()}
            title="Sign Out"
            className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-800/80 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
