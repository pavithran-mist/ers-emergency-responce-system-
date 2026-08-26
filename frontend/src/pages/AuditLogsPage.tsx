import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { AuditLog } from '../types';
import { GlassCard } from '../components/GlassCard';
import { FileText, RefreshCw, Filter, Shield } from 'lucide-react';

export const AuditLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [filterAction, setFilterAction] = useState<string>('');
  const [loading, setLoading] = useState(true);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const data = await api.getAuditLogs(150);
      setLogs(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const filteredLogs = logs.filter((log) => {
    if (filterAction && !log.action.includes(filterAction)) return false;
    return true;
  });

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-black text-white">System Security & Audit Trail</h1>
              <p className="text-xs text-slate-400">
                Immutable chronological log of all administrative interventions, user approvals, and triage events
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={loadLogs}
          className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-lg transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center space-x-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800 text-xs font-mono">
        <Filter className="w-3.5 h-3.5 text-slate-400" />
        <span className="text-slate-400">Filter Action:</span>
        <input
          type="text"
          value={filterAction}
          onChange={(e) => setFilterAction(e.target.value.toUpperCase())}
          placeholder="USER_APPROVED, CAMERA_ADDED, INCIDENT..."
          className="bg-slate-950 border border-slate-800 rounded px-3 py-1 text-slate-200 focus:outline-none focus:border-cyan-500 font-mono w-64 uppercase"
        />
        <span className="ml-auto text-slate-500">Showing {filteredLogs.length} audit records</span>
      </div>

      {/* Audit Log Table */}
      <GlassCard className="p-0 overflow-hidden border border-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] border-b border-slate-800">
              <tr>
                <th className="py-3.5 px-4">Log ID</th>
                <th className="py-3.5 px-4">Timestamp (UTC)</th>
                <th className="py-3.5 px-4">Operator / User</th>
                <th className="py-3.5 px-4">Action</th>
                <th className="py-3.5 px-4">Target Type & ID</th>
                <th className="py-3.5 px-4">Audit Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    No audit records match the filter query.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 text-slate-500">#{l.id}</td>
                    <td className="py-3 px-4 text-slate-400">
                      {new Date(l.timestamp).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-cyan-400 font-bold">{l.user_email || 'SYSTEM'}</td>
                    <td className="py-3 px-4">
                      <span className="bg-slate-800 text-slate-200 px-2 py-0.5 rounded text-[11px] font-bold">
                        {l.action}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-300">
                      {l.target_type && <span className="uppercase text-slate-400 font-bold">{l.target_type}: </span>}
                      <span className="text-slate-200">{l.target_id || '-'}</span>
                    </td>
                    <td className="py-3 px-4 text-slate-300 font-sans max-w-md truncate">
                      {l.details || '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  );
};
