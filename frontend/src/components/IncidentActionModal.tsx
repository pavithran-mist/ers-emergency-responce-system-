import React, { useState } from 'react';
import { Incident } from '../types';
import { RiskBadge } from './RiskBadge';
import { StatusBadge } from './StatusBadge';
import { api } from '../services/api';
import { X, CheckCircle, Clock, MapPin, Send, AlertTriangle, Shield } from 'lucide-react';

interface IncidentActionModalProps {
  incident: Incident | null;
  onClose: () => void;
  onUpdated: (updated: Incident) => void;
  onOpenLocationModal: (incident: Incident) => void;
}

export const IncidentActionModal: React.FC<IncidentActionModalProps> = ({
  incident,
  onClose,
  onUpdated,
  onOpenLocationModal,
}) => {
  if (!incident) return null;

  const [noteText, setNoteText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAcknowledge = async () => {
    setLoading(true);
    setError(null);
    try {
      const updated = await api.acknowledgeIncident(incident.incident_id);
      onUpdated(updated);
    } catch (err: any) {
      setError(err.message || 'Failed to acknowledge incident');
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async () => {
    setLoading(true);
    setError(null);
    try {
      const updated = await api.resolveIncident(incident.incident_id);
      onUpdated(updated);
    } catch (err: any) {
      setError(err.message || 'Failed to resolve incident');
    } finally {
      setLoading(false);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteText.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const updated = await api.addIncidentNotes(incident.incident_id, noteText);
      setNoteText('');
      onUpdated(updated);
    } catch (err: any) {
      setError(err.message || 'Failed to add notes');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="font-mono text-sm font-bold text-red-400 bg-red-950/60 px-2.5 py-1 rounded border border-red-800/50">
              {incident.incident_id}
            </span>
            <div>
              <h2 className="text-base font-bold text-white uppercase">
                {incident.event_type.replace('_', ' ')}
              </h2>
              <p className="text-xs text-slate-400">{incident.camera_name}</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <RiskBadge risk={incident.risk} />
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {error && (
            <div className="bg-red-950/70 border border-red-500/50 p-3 rounded-lg text-xs text-red-300">
              {error}
            </div>
          )}

          {/* Key Incident Metadata Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 font-mono text-xs">
            <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
              <div className="text-[10px] text-slate-500 uppercase">STATUS</div>
              <div className="mt-1">
                <StatusBadge status={incident.status} />
              </div>
            </div>

            <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
              <div className="text-[10px] text-slate-500 uppercase">CONFIDENCE</div>
              <div className="text-cyan-300 font-bold mt-1 text-sm">
                {Math.round(incident.confidence * 100)}%
              </div>
            </div>

            <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
              <div className="text-[10px] text-slate-500 uppercase">DEPARTMENT</div>
              <div className="text-amber-300 font-bold mt-1 uppercase">
                {incident.department}
              </div>
            </div>

            <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
              <div className="text-[10px] text-slate-500 uppercase">AI REASON</div>
              <div className="text-slate-200 mt-1 font-sans font-medium">
                {incident.reason}
              </div>
            </div>

            <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
              <div className="text-[10px] text-slate-500 uppercase">AI BACKEND</div>
              <div className="text-slate-300 mt-1 font-bold">
                {incident.backend}
              </div>
            </div>

            <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
              <div className="text-[10px] text-slate-500 uppercase">DETECTED TIME</div>
              <div className="text-slate-300 mt-1 text-[11px]">
                {new Date(incident.created_at).toLocaleTimeString()}
              </div>
            </div>
          </div>

          {/* Location Details Box */}
          <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800 flex items-center justify-between">
            <div className="space-y-1">
              <div className="text-[10px] font-mono uppercase text-slate-500 flex items-center">
                <MapPin className="w-3 h-3 mr-1 text-cyan-400" /> Registered Location
              </div>
              <div className="text-sm font-semibold text-slate-200">{incident.location}</div>
              {incident.landmark && (
                <div className="text-xs text-slate-400">Landmark: {incident.landmark}</div>
              )}
            </div>

            <button
              onClick={() => onOpenLocationModal(incident)}
              className="px-3 py-1.5 bg-cyan-950/80 text-cyan-300 hover:bg-cyan-900 border border-cyan-700/50 rounded-lg text-xs font-semibold flex items-center space-x-1 transition-colors"
            >
              <MapPin className="w-3.5 h-3.5 mr-1" /> View Map
            </button>
          </div>

          {/* Action Buttons: Acknowledge / Resolve */}
          <div className="flex items-center space-x-3 pt-2">
            {incident.status === 'NEW' && (
              <button
                disabled={loading}
                onClick={handleAcknowledge}
                className="flex-1 py-2.5 px-4 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-sm font-semibold flex items-center justify-center space-x-2 transition-all shadow-lg shadow-cyan-950/40"
              >
                <Clock className="w-4 h-4" />
                <span>Acknowledge Incident</span>
              </button>
            )}

            {incident.status !== 'RESOLVED' && (
              <button
                disabled={loading}
                onClick={handleResolve}
                className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-semibold flex items-center justify-center space-x-2 transition-all shadow-lg shadow-emerald-950/40"
              >
                <CheckCircle className="w-4 h-4" />
                <span>Mark as Resolved</span>
              </button>
            )}
          </div>

          {/* Operator Action Notes & Log */}
          <div className="space-y-3 pt-3 border-t border-slate-800">
            <div className="text-xs font-mono uppercase tracking-wider text-slate-400 font-bold">
              Operator Log & Action Notes
            </div>

            {incident.notes && (
              <div className="bg-slate-950/80 p-3 rounded-lg border border-slate-800 text-xs text-slate-300 font-mono whitespace-pre-wrap max-h-32 overflow-y-auto">
                {incident.notes}
              </div>
            )}

            <form onSubmit={handleAddNote} className="flex gap-2">
              <input
                type="text"
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Add operator notes / dispatch action taken..."
                className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-sans"
              />
              <button
                type="submit"
                disabled={loading || !noteText.trim()}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-cyan-400 rounded-lg text-xs font-semibold flex items-center space-x-1 transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>
            </form>
          </div>

          {/* Safety Disclaimer */}
          <div className="bg-slate-950/90 p-3 rounded-lg border border-amber-900/40 flex items-start space-x-2.5 text-[11px] text-amber-300/80 font-mono">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <span>
              ASTRA AI does NOT automatically dispatch emergency services. All alerts must be verified and dispatched by authorized department dispatchers.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
