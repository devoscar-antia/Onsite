export interface UserProfile {
  id: number | string;
  name?: string;
  lastName?: string;
  email: string;
  role: string;
  company?: string;
  createdAt?: string;
}

export interface UserPreferences {
  theme?: string;
  language?: string;
  density?: string;
  [key: string]: unknown;
}

export interface SessionItem {
  id: number | string;
  type?: "desktop" | "mobile";
  device?: string;
  location?: string;
  ip?: string;
  city?: string;
  country?: string;
  lastSeen?: string;
  last_seen?: string;
  isCurrent?: boolean;
  is_current?: boolean;
}

export interface AdminUser {
  id: number | string;
  name?: string;
  email: string;
  role: string;
  status?: string;
  lastSeen?: string;
  initials?: string;
}

export interface AdminStats {
  total: number;
  admins: number;
  active: number;
  pending: number;
}
