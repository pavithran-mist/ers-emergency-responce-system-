import { User, Camera, Incident, SystemSetting, AuditLog, AIStatus } from '../types';

// Dynamically resolve API base from environment or current host
export const API_BASE =
  (import.meta.env.VITE_API_BASE as string) ||
  (import.meta.env.VITE_API_URL as string) ||
  '/api/v1';

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('astra_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

/**
 * Reusable, robust API response handler:
 * 1. Checks HTTP status
 * 2. Inspects Content-Type header
 * 3. Safely parses JSON without throwing on empty/HTML responses
 * 4. Extracts meaningful error details
 * 5. Returns typed payload or actionable error message
 */
async function handleResponse<T>(res: Response): Promise<T> {
  const contentType = res.headers.get('content-type') || '';
  let data: any = null;

  if (contentType.includes('application/json')) {
    try {
      data = await res.json();
    } catch {
      data = null;
    }
  } else {
    try {
      const text = await res.text();
      data = text && !text.startsWith('<!DOCTYPE') ? { detail: text.slice(0, 300) } : null;
    } catch {
      data = null;
    }
  }

  if (!res.ok) {
    let errorMsg = data?.detail || data?.message;
    if (!errorMsg) {
      if (res.status === 401) {
        errorMsg = 'Invalid email or password.';
      } else if (res.status === 403) {
        errorMsg = 'Access restricted: account pending approval or deactivated.';
      } else if (res.status === 404) {
        errorMsg = `API service endpoint not found (HTTP 404). Please verify backend status.`;
      } else if (res.status >= 500) {
        errorMsg = 'ASTRA AI server encountered an internal error. Please try again.';
      } else {
        errorMsg = `Request failed with HTTP status ${res.status}.`;
      }
    }
    throw new Error(errorMsg);
  }

  if (data === null) {
    // If response was 204 No Content, return empty object
    if (res.status === 204) {
      return {} as T;
    }
    throw new Error('Server returned an empty or unparseable response.');
  }

  return data as T;
}

/** Safe fetch wrapper with network error catch */
async function safeFetch(url: string, options?: RequestInit): Promise<Response> {
  try {
    return await fetch(url, options);
  } catch (err: any) {
    console.error('ASTRA Network Fetch Error:', err);
    throw new Error(
      'Unable to connect to the ASTRA AI authentication server. Please verify backend service connectivity.'
    );
  }
}

export const api = {
  // Auth
  async login(email: string, password: string) {
    const res = await safeFetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    return handleResponse<{ access_token: string; token_type: string; user: User }>(res);
  },

  async register(email: string, password: string, full_name: string) {
    const res = await safeFetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, full_name }),
    });
    return handleResponse<User>(res);
  },

  async getMe(): Promise<User> {
    const res = await safeFetch(`${API_BASE}/auth/me`, {
      headers: getAuthHeaders(),
    });
    return handleResponse<User>(res);
  },

  async logout() {
    const res = await safeFetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    return handleResponse<{ message: string }>(res);
  },

  // Admin Users
  async getUsers(): Promise<User[]> {
    const res = await safeFetch(`${API_BASE}/admin/users`, { headers: getAuthHeaders() });
    return handleResponse<User[]>(res);
  },

  async getPendingUsers(): Promise<User[]> {
    const res = await safeFetch(`${API_BASE}/admin/users/pending`, { headers: getAuthHeaders() });
    return handleResponse<User[]>(res);
  },

  async approveUser(userId: number): Promise<User> {
    const res = await safeFetch(`${API_BASE}/admin/users/${userId}/approve`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    return handleResponse<User>(res);
  },

  async rejectUser(userId: number): Promise<User> {
    const res = await safeFetch(`${API_BASE}/admin/users/${userId}/reject`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    return handleResponse<User>(res);
  },

  async disableUser(userId: number): Promise<User> {
    const res = await safeFetch(`${API_BASE}/admin/users/${userId}/disable`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    return handleResponse<User>(res);
  },

  async enableUser(userId: number): Promise<User> {
    const res = await safeFetch(`${API_BASE}/admin/users/${userId}/enable`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    return handleResponse<User>(res);
  },

  async changeUserRole(userId: number, role: 'ADMIN' | 'OPERATOR'): Promise<User> {
    const res = await safeFetch(`${API_BASE}/admin/users/${userId}/role`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ role }),
    });
    return handleResponse<User>(res);
  },

  // Cameras
  async getCameras(): Promise<Camera[]> {
    const res = await safeFetch(`${API_BASE}/cameras`, { headers: getAuthHeaders() });
    return handleResponse<Camera[]>(res);
  },

  async getCamera(id: string): Promise<Camera> {
    const res = await safeFetch(`${API_BASE}/cameras/${id}`, { headers: getAuthHeaders() });
    return handleResponse<Camera>(res);
  },

  async createCamera(camera: Partial<Camera>): Promise<Camera> {
    const res = await safeFetch(`${API_BASE}/cameras`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(camera),
    });
    return handleResponse<Camera>(res);
  },

  async updateCamera(id: string, camera: Partial<Camera>): Promise<Camera> {
    const res = await safeFetch(`${API_BASE}/cameras/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(camera),
    });
    return handleResponse<Camera>(res);
  },

  async deleteCamera(id: string): Promise<{ message: string }> {
    const res = await safeFetch(`${API_BASE}/cameras/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    return handleResponse<{ message: string }>(res);
  },

  async testCamera(id: string): Promise<{ camera_id: string; status: string; is_connected: boolean; message: string }> {
    const res = await safeFetch(`${API_BASE}/cameras/${id}/test`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    return handleResponse<{ camera_id: string; status: string; is_connected: boolean; message: string }>(res);
  },

  async startCamera(id: string) {
    const res = await safeFetch(`${API_BASE}/cameras/${id}/start`, { method: 'POST', headers: getAuthHeaders() });
    return handleResponse<{ message: string }>(res);
  },

  async stopCamera(id: string) {
    const res = await safeFetch(`${API_BASE}/cameras/${id}/stop`, { method: 'POST', headers: getAuthHeaders() });
    return handleResponse<{ message: string }>(res);
  },

  // Incidents
  async getIncidents(params?: { risk?: string; department?: string; status?: string; camera_id?: string; limit?: number }): Promise<Incident[]> {
    const query = new URLSearchParams();
    if (params?.risk) query.append('risk', params.risk);
    if (params?.department) query.append('department', params.department);
    if (params?.status) query.append('status', params.status);
    if (params?.camera_id) query.append('camera_id', params.camera_id);
    if (params?.limit) query.append('limit', String(params.limit));

    const res = await safeFetch(`${API_BASE}/incidents?${query.toString()}`, { headers: getAuthHeaders() });
    return handleResponse<Incident[]>(res);
  },

  async getIncidentSummary() {
    const res = await safeFetch(`${API_BASE}/incidents/summary`, { headers: getAuthHeaders() });
    return handleResponse<{
      total_incidents: number;
      new_incidents: number;
      acknowledged_incidents: number;
      resolved_incidents: number;
      critical_incidents: number;
      high_risk_incidents: number;
      police_alerts: number;
      fire_alerts: number;
      ambulance_alerts: number;
    }>(res);
  },

  async getIncident(id: string): Promise<Incident> {
    const res = await safeFetch(`${API_BASE}/incidents/${id}`, { headers: getAuthHeaders() });
    return handleResponse<Incident>(res);
  },

  async acknowledgeIncident(id: string): Promise<Incident> {
    const res = await safeFetch(`${API_BASE}/incidents/${id}/acknowledge`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    return handleResponse<Incident>(res);
  },

  async resolveIncident(id: string): Promise<Incident> {
    const res = await safeFetch(`${API_BASE}/incidents/${id}/resolve`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    return handleResponse<Incident>(res);
  },

  async addIncidentNotes(id: string, notes: string): Promise<Incident> {
    const res = await safeFetch(`${API_BASE}/incidents/${id}/notes`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ notes }),
    });
    return handleResponse<Incident>(res);
  },

  // Department alerts
  async getPoliceAlerts(status?: string): Promise<Incident[]> {
    const q = status ? `?status=${status}` : '';
    const res = await safeFetch(`${API_BASE}/alerts/police${q}`, { headers: getAuthHeaders() });
    return handleResponse<Incident[]>(res);
  },

  async getFireAlerts(status?: string): Promise<Incident[]> {
    const q = status ? `?status=${status}` : '';
    const res = await safeFetch(`${API_BASE}/alerts/fire${q}`, { headers: getAuthHeaders() });
    return handleResponse<Incident[]>(res);
  },

  async getAmbulanceAlerts(status?: string): Promise<Incident[]> {
    const q = status ? `?status=${status}` : '';
    const res = await safeFetch(`${API_BASE}/alerts/ambulance${q}`, { headers: getAuthHeaders() });
    return handleResponse<Incident[]>(res);
  },

  // AI & Analytics
  async getAIStatus(): Promise<AIStatus> {
    const res = await safeFetch(`${API_BASE}/ai/status`, { headers: getAuthHeaders() });
    return handleResponse<AIStatus>(res);
  },

  async getAIDetections() {
    const res = await safeFetch(`${API_BASE}/ai/detections`, { headers: getAuthHeaders() });
    return handleResponse<any[]>(res);
  },

  async getAIStatistics() {
    const res = await safeFetch(`${API_BASE}/ai/statistics`, { headers: getAuthHeaders() });
    return handleResponse<any>(res);
  },

  // Settings & CMS
  async getSettings(): Promise<SystemSetting[]> {
    const res = await safeFetch(`${API_BASE}/admin/settings`, { headers: getAuthHeaders() });
    return handleResponse<SystemSetting[]>(res);
  },

  async updateSettings(settings: Record<string, string>): Promise<SystemSetting[]> {
    const res = await safeFetch(`${API_BASE}/admin/settings`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ settings }),
    });
    return handleResponse<SystemSetting[]>(res);
  },

  // Audit Logs
  async getAuditLogs(limit: number = 100): Promise<AuditLog[]> {
    const res = await safeFetch(`${API_BASE}/admin/audit-logs?limit=${limit}`, { headers: getAuthHeaders() });
    return handleResponse<AuditLog[]>(res);
  },
};
