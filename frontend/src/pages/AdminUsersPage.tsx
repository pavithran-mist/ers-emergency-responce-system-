import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { User, UserRole, UserStatus } from '../types';
import { GlassCard } from '../components/GlassCard';
import { StatusBadge } from '../components/StatusBadge';
import { Users, CheckCircle, XCircle, Ban, ShieldCheck, UserCheck, RefreshCw, AlertCircle } from 'lucide-react';

export const AdminUsersPage: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getUsers();
      setUsers(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load user accounts.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleApprove = async (id: number) => {
    try {
      await api.approveUser(id);
      setSuccess('User approved successfully.');
      loadUsers();
    } catch (err: any) {
      setError(err.message || 'Approval failed.');
    }
  };

  const handleReject = async (id: number) => {
    try {
      await api.rejectUser(id);
      setSuccess('User registration rejected.');
      loadUsers();
    } catch (err: any) {
      setError(err.message || 'Rejection failed.');
    }
  };

  const handleDisable = async (id: number) => {
    try {
      await api.disableUser(id);
      setSuccess('User account deactivated.');
      loadUsers();
    } catch (err: any) {
      setError(err.message || 'Action failed.');
    }
  };

  const handleEnable = async (id: number) => {
    try {
      await api.enableUser(id);
      setSuccess('User account enabled.');
      loadUsers();
    } catch (err: any) {
      setError(err.message || 'Action failed.');
    }
  };

  const handleRoleChange = async (id: number, newRole: 'ADMIN' | 'OPERATOR') => {
    try {
      await api.changeUserRole(id, newRole);
      setSuccess(`Role updated to ${newRole}.`);
      loadUsers();
    } catch (err: any) {
      setError(err.message || 'Failed to update role.');
    }
  };

  const pendingUsers = users.filter((u) => u.status === 'PENDING');
  const activeUsers = users.filter((u) => u.status !== 'PENDING');

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 rounded-xl bg-indigo-950/80 border border-indigo-700/60 text-indigo-400">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white">Personnel Access & User Approvals</h1>
            <p className="text-xs text-slate-400">
              Role-based access control (RBAC), operator approval queue, and account lifecycle management
            </p>
          </div>
        </div>

        <button
          onClick={loadUsers}
          className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-lg transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
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

      {/* SECTION 1: PENDING APPROVAL QUEUE */}
      <GlassCard className="p-0 overflow-hidden border border-amber-800/60">
        <div className="p-4 bg-amber-950/40 border-b border-amber-800/50 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <UserCheck className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold text-amber-300 uppercase font-mono">
              Pending Access Approval Queue ({pendingUsers.length})
            </h3>
          </div>
          <span className="text-xs font-mono text-amber-400">Requires Admin Verification</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Applicant Name</th>
                <th className="py-3 px-4">Email Address</th>
                <th className="py-3 px-4">Requested Role</th>
                <th className="py-3 px-4">Submitted Date</th>
                <th className="py-3 px-4 text-right">Approval Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {pendingUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500 font-sans">
                    No pending registration applications waiting for review.
                  </td>
                </tr>
              ) : (
                pendingUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-slate-100 font-sans">{u.full_name}</td>
                    <td className="py-3.5 px-4 text-cyan-400">{u.email}</td>
                    <td className="py-3.5 px-4 uppercase text-slate-300">{u.role}</td>
                    <td className="py-3.5 px-4 text-slate-400">{new Date(u.created_at).toLocaleDateString()}</td>
                    <td className="py-3.5 px-4 text-right space-x-2">
                      <button
                        onClick={() => handleReject(u.id)}
                        className="px-3 py-1.5 bg-red-950/80 text-red-400 hover:bg-red-900/80 border border-red-800/60 rounded text-xs font-semibold transition-colors"
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => handleApprove(u.id)}
                        className="px-3 py-1.5 bg-emerald-600 text-white hover:bg-emerald-500 rounded text-xs font-semibold transition-colors shadow-md shadow-emerald-950/40"
                      >
                        Approve User
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {/* SECTION 2: ALL REGISTERED PERSONNEL TABLE */}
      <GlassCard className="p-0 overflow-hidden border border-slate-800">
        <div className="p-4 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-bold text-white uppercase font-mono">
            Active Registered Personnel Directory ({activeUsers.length})
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] border-b border-slate-800">
              <tr>
                <th className="py-3.5 px-4">User ID</th>
                <th className="py-3.5 px-4">Name</th>
                <th className="py-3.5 px-4">Email</th>
                <th className="py-3.5 px-4">Role</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Registered Date</th>
                <th className="py-3.5 px-4 text-right">Account Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {activeUsers.map((u) => (
                <tr key={u.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-3.5 px-4 text-slate-500">#{u.id}</td>
                  <td className="py-3.5 px-4 font-bold text-slate-200 font-sans">{u.full_name}</td>
                  <td className="py-3.5 px-4 text-cyan-400">{u.email}</td>
                  <td className="py-3.5 px-4">
                    <select
                      value={u.role}
                      onChange={(e) => handleRoleChange(u.id, e.target.value as any)}
                      className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-[11px] text-slate-200 focus:outline-none focus:border-cyan-500"
                    >
                      <option value="ADMIN">ADMIN</option>
                      <option value="OPERATOR">OPERATOR</option>
                    </select>
                  </td>
                  <td className="py-3.5 px-4">
                    <StatusBadge status={u.status} />
                  </td>
                  <td className="py-3.5 px-4 text-slate-400">{new Date(u.created_at).toLocaleDateString()}</td>
                  <td className="py-3.5 px-4 text-right space-x-2">
                    {u.status === 'APPROVED' ? (
                      <button
                        onClick={() => handleDisable(u.id)}
                        className="px-2.5 py-1 bg-slate-900 text-rose-400 hover:bg-slate-800 border border-slate-800 rounded text-xs transition-colors"
                      >
                        Deactivate
                      </button>
                    ) : (
                      <button
                        onClick={() => handleEnable(u.id)}
                        className="px-2.5 py-1 bg-emerald-950 text-emerald-400 hover:bg-emerald-900 border border-emerald-800/60 rounded text-xs transition-colors"
                      >
                        Enable
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  );
};
