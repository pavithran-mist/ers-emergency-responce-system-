import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { SystemSetting } from '../types';
import { GlassCard } from '../components/GlassCard';
import { Sliders, Save, RefreshCw, CheckCircle2, Shield, Phone, Sparkles } from 'lucide-react';

export const AdminSettingsPage: React.FC = () => {
  const [settingsList, setSettingsList] = useState<SystemSetting[]>([]);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const data = await api.getSettings();
      setSettingsList(data);
      const initialForm: Record<string, string> = {};
      data.forEach((s) => {
        initialForm[s.key] = s.value;
      });
      setFormData(initialForm);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleChange = (key: string, val: string) => {
    setFormData((prev) => ({ ...prev, [key]: val }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccess(null);
    try {
      await api.updateSettings(formData);
      setSuccess('System configuration parameters saved to database.');
      loadSettings();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-amber-950/80 border border-amber-700/60 text-amber-400">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-black text-white">System Settings & Dynamic CMS</h1>
              <p className="text-xs text-slate-400">
                Configure platform branding, emergency dispatch contact numbers, and AI detection sensitivity
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={loadSettings}
          className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-lg transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {success && (
        <div className="bg-emerald-950/80 border border-emerald-500/50 p-3 rounded-lg text-xs text-emerald-300 flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{success}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* SECTION 1: BRANDING & CMS LABELS */}
        <GlassCard className="p-6 space-y-4">
          <div className="flex items-center space-x-2 text-sm font-bold text-white uppercase font-mono">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <span>Platform Branding & Public CMS Labels</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono uppercase text-slate-400 mb-1">Site Title</label>
              <input
                type="text"
                value={formData['site_title'] || ''}
                onChange={(e) => handleChange('site_title', e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-mono uppercase text-slate-400 mb-1">Organization Name</label>
              <input
                type="text"
                value={formData['organization_name'] || ''}
                onChange={(e) => handleChange('organization_name', e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-mono uppercase text-slate-400 mb-1">Main Dashboard Heading</label>
              <input
                type="text"
                value={formData['dashboard_main_heading'] || ''}
                onChange={(e) => handleChange('dashboard_main_heading', e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>
          </div>
        </GlassCard>

        {/* SECTION 2: EMERGENCY HOTLINES */}
        <GlassCard className="p-6 space-y-4">
          <div className="flex items-center space-x-2 text-sm font-bold text-white uppercase font-mono">
            <Phone className="w-4 h-4 text-red-400" />
            <span>Emergency Dispatch Contact Information</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-mono uppercase text-slate-400 mb-1">Police PCR Number</label>
              <input
                type="text"
                value={formData['police_emergency_phone'] || ''}
                onChange={(e) => handleChange('police_emergency_phone', e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-cyan-300 focus:outline-none focus:border-cyan-500 font-mono font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-mono uppercase text-slate-400 mb-1">Fire Rescue Hotline</label>
              <input
                type="text"
                value={formData['fire_emergency_phone'] || ''}
                onChange={(e) => handleChange('fire_emergency_phone', e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-orange-300 focus:outline-none focus:border-cyan-500 font-mono font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-mono uppercase text-slate-400 mb-1">Ambulance EMS Hotline</label>
              <input
                type="text"
                value={formData['ambulance_emergency_phone'] || ''}
                onChange={(e) => handleChange('ambulance_emergency_phone', e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-red-300 focus:outline-none focus:border-cyan-500 font-mono font-bold"
              />
            </div>
          </div>
        </GlassCard>

        {/* SECTION 3: AI SENSITIVITY THRESHOLDS */}
        <GlassCard className="p-6 space-y-4">
          <div className="flex items-center space-x-2 text-sm font-bold text-white uppercase font-mono">
            <Sliders className="w-4 h-4 text-purple-400" />
            <span>AI Vision Sensitivity & Hazard Thresholds</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono uppercase text-slate-400 mb-1">
                YOLO Object Confidence Threshold (0.10 - 0.90)
              </label>
              <input
                type="number"
                step="0.05"
                min="0.1"
                max="0.9"
                value={formData['detection_sensitivity'] || '0.40'}
                onChange={(e) => handleChange('detection_sensitivity', e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-xs font-mono uppercase text-slate-400 mb-1">
                Accident Overlap IoU Threshold (0.05 - 0.50)
              </label>
              <input
                type="number"
                step="0.05"
                min="0.05"
                max="0.5"
                value={formData['accident_iou_threshold'] || '0.15'}
                onChange={(e) => handleChange('accident_iou_threshold', e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-xs font-mono uppercase text-slate-400 mb-1">
                Convergence Velocity Threshold
              </label>
              <input
                type="number"
                step="1.0"
                value={formData['convergence_threshold'] || '8.0'}
                onChange={(e) => handleChange('convergence_threshold', e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-xs font-mono uppercase text-slate-400 mb-1">
                Fire/Smoke Chromatic Sensitivity
              </label>
              <input
                type="number"
                step="0.05"
                value={formData['fire_sensitivity'] || '0.45'}
                onChange={(e) => handleChange('fire_sensitivity', e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>
        </GlassCard>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-3 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white rounded-xl text-sm font-semibold flex items-center space-x-2 transition-all shadow-lg shadow-amber-950/50"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving Parameters...' : 'Save Configuration Changes'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
