export type UserRole = 'ADMIN' | 'OPERATOR';
export type UserStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'DISABLED';
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type IncidentStatus = 'NEW' | 'REVIEWING' | 'ACKNOWLEDGED' | 'RESOLVED';
export type Department = 'POLICE' | 'FIRE' | 'AMBULANCE' | 'GENERAL';

export interface User {
  id: number;
  email: string;
  full_name: string;
  role: UserRole;
  status: UserStatus;
  created_at: string;
}

export interface Camera {
  id: number;
  camera_id: string;
  name: string;
  url: string;
  camera_type: 'synthetic' | 'rtsp' | 'ip_stream' | 'webcam' | 'video_file' | 'phone_stream';
  location: string;
  latitude?: number;
  longitude?: number;
  landmark?: string;
  zone?: string;
  description?: string;
  username?: string;
  password?: string;
  status: string;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface Incident {
  id: number;
  incident_id: string;
  camera_id: string;
  camera_name: string;
  event_type: string;
  risk: RiskLevel;
  confidence: number;
  reason: string;
  backend: string;
  status: IncidentStatus;
  department: Department;
  location: string;
  latitude?: number;
  longitude?: number;
  landmark?: string;
  zone?: string;
  bounding_box?: string;
  notes?: string;
  acknowledged_by?: string;
  resolved_by?: string;
  created_at: string;
  updated_at: string;
}

export interface SystemSetting {
  id: number;
  key: string;
  value: string;
  description?: string;
  category: string;
  updated_at: string;
}

export interface AuditLog {
  id: number;
  user_id?: number;
  user_email?: string;
  action: string;
  target_type?: string;
  target_id?: string;
  details?: string;
  ip_address?: string;
  timestamp: string;
}

export interface CameraTelemetry {
  camera_id: string;
  camera_name: string;
  status: string;
  fps: number;
  vehicle_count: number;
  vehicles: Array<{
    track_id: number;
    class_name: string;
    confidence: number;
    bbox: number[];
    speed: number;
    heading_angle: number;
  }>;
  risk_level: RiskLevel;
  risk_score: number;
  hazards: Array<{
    event_type: string;
    confidence: number;
    reason: string;
    backend: string;
    risk: string;
  }>;
  ai_backend: {
    detector: string;
    accident: string;
    fire_smoke: string;
  };
  timestamp: number;
}

export interface AIStatus {
  ai_status: string;
  total_cameras: number;
  active_workers: number;
  detector_backend: string;
  accident_backend: string;
  fire_smoke_backend: string;
  global_fps: number;
  total_vehicles_detected: number;
  active_hazards: number;
}
