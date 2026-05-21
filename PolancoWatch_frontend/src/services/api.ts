import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5246';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

export const authService = {
  login: async (username: string, password: string) => {
    const response = await api.post('/api/auth/login', { username, password });
    if (response.data.token) {
      localStorage.setItem('token', response.data.token);
    }
    return response.data;
  },
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
  },
  forgotPassword: async (email?: string, username?: string) => {
    const response = await api.post('/api/auth/forgot-password', { email, username });
    return response.data;
  },
  resetPassword: async (token: string, newPassword: string) => {
    const response = await api.post('/api/auth/reset-password', { token, newPassword });
    return response.data;
  },
  isAuthenticated: () => {
    return !!localStorage.getItem('token');
  },
  updateProfile: async (currentPassword: string, newUsername?: string, newPassword?: string) => {
    const response = await api.post('/api/auth/profile', { currentPassword, newUsername, newPassword });
    if (response.data.token) {
      localStorage.setItem('token', response.data.token);
    }
    if (response.data.username) {
        localStorage.setItem('username', response.data.username);
    }
    return response.data;
  }
};

export const dockerService = {
  startContainer: async (id: string) => {
    const response = await api.post(`/api/docker/container/${id}/start`);
    return response.data;
  },
  stopContainer: async (id: string) => {
    const response = await api.post(`/api/docker/container/${id}/stop`);
    return response.data;
  },
  restartContainer: async (id: string) => {
    const response = await api.post(`/api/docker/container/${id}/restart`);
    return response.data;
  }
};

export const alertsService = {
  getRules: async () => {
    const response = await api.get('/api/alerts/rules');
    return response.data;
  },
  updateRule: async (rule: any) => {
    const response = await api.post('/api/alerts/rules', rule);
    return response.data;
  },
  getHistory: async () => {
    const response = await api.get('/api/alerts/history');
    return response.data;
  }
};

export const metricsService = {
  getHistory: async (durationHours: number = 24) => {
    const response = await api.get(`/api/metrics/history?durationHours=${durationHours}`);
    return response.data;
  }
};

export const settingsService = {
  getNotificationSettings: async () => {
    const response = await api.get('/api/settings/notifications');
    return response.data;
  },
  updateNotificationSettings: async (settings: any) => {
    const response = await api.put('/api/settings/notifications', settings);
    return response.data;
  }
};

export interface WebMonitor {
  id: number;
  name: string;
  url: string;
  checkIntervalSeconds: number;
  isActive: boolean;
  lastCheckTime?: string;
  lastStatusUp: boolean;
  status: number;
  lastLatencyMs: number;
  slowThresholdMs: number;
  notifyOnSlow: boolean;
  notify: boolean;
}

export interface WebCheck {
  id: number;
  webMonitorId: number;
  timestamp: string;
  isUp: boolean;
  latencyMs: number;
  isSlow: boolean;
  statusCode: number;
  errorMessage?: string;
}

export interface WebMonitorDailyStats {
  id: number;
  webMonitorId: number;
  date: string;
  upPercentage: number;
  downPercentage: number;
  slowPercentage: number;
  averageLatencyMs: number;
  totalChecks: number;
  upCount: number;
  downCount: number;
  slowCount: number;
}

export const webMonitorService = {
  getMonitors: () => api.get<WebMonitor[]>('/api/webmonitors').then(res => res.data),
  getMonitor: (id: number) => api.get<WebMonitor>(`/api/webmonitors/${id}`).then(res => res.data),
  getHistory: (id: number, limit = 50) => api.get<WebCheck[]>(`/api/webmonitors/${id}/history?limit=${limit}`).then(res => res.data),
  createMonitor: (monitor: Partial<WebMonitor>) => api.post<WebMonitor>('/api/webmonitors', monitor).then(res => res.data),
  updateMonitor: (id: number, data: Partial<WebMonitor>) => api.put(`/api/webmonitors/${id}`, data).then(res => res.data),
  deleteMonitor: (id: number) => api.delete(`/api/webmonitors/${id}`),
  toggleMonitor: (id: number) => api.post<{ isActive: boolean }>(`/api/webmonitors/${id}/toggle`).then(res => res.data),
  toggleNotify: (id: number) => api.post<{ notify: boolean }>(`/api/webmonitors/${id}/toggle-notify`).then(res => res.data),
  getStats: (id: number, days = 15) => api.get<WebMonitorDailyStats[]>(`/api/webmonitors/${id}/stats?days=${days}`).then(res => res.data),
};

export interface BackupSchedule {
  id: string;
  name: string;
  type: number;
  target?: string;
  format: number;
  intervalMinutes: number;
  isActive: boolean;
  syncToCloud: boolean;
  keepLocal: boolean;
  useCron: boolean;
  cronExpression?: string;
  cloudFolderId?: string;
  retentionCount: number;
  sendTelegram: boolean;
  lastRun?: string;
  nextRun?: string;
}

export interface BackupService {
  getBackups: () => Promise<any[]>;
  triggerDatabaseBackup: (format: string, target: string | undefined, syncToCloud: boolean, cloudFolderId?: string, backupName?: string, keepLocal?: boolean, retentionCount?: number, sendTelegram?: boolean) => Promise<any>;
  triggerVolumeBackup: (target: string, format: string, syncToCloud: boolean, cloudFolderId?: string, backupName?: string, keepLocal?: boolean, retentionCount?: number, sendTelegram?: boolean) => Promise<any>;
  getSchedules: () => Promise<BackupSchedule[]>;
  createSchedule: (schedule: Partial<BackupSchedule>) => Promise<BackupSchedule>;
  updateSchedule: (id: string, schedule: Partial<BackupSchedule>) => Promise<void>;
  deleteSchedule: (id: string) => Promise<void>;
  executeSchedule: (id: string) => Promise<any>;
  deleteBackup: (id: string) => Promise<any>;
  downloadBackup: (id: string, fileName: string) => Promise<void>;
  getAllowedPaths?: () => Promise<string[]>; // Deprecated
  getAvailableVolumes: () => Promise<{ name: string, path: string }[]>;
  getAvailableContainers: () => Promise<{ id: string, name: string, state: string, image: string }[]>;
  getContainerDatabases: (containerId: string, user?: string, pass?: string) => Promise<string[]>;
  getDriveStatus: () => Promise<{ isAuthenticated: boolean }>;
  getDriveAuthUrl: () => Promise<{ url: string }>;
  revokeDriveAuth: () => Promise<any>;
}

export const backupService: BackupService = {
  getBackups: () => api.get('/api/backups').then(res => res.data),
  triggerDatabaseBackup: (format = 'Zip', target?: string, syncToCloud = false, cloudFolderId?: string, backupName?: string, keepLocal = true, retentionCount = 0, sendTelegram = false) => {
    const params = new URLSearchParams({
      format,
      syncToCloud: String(syncToCloud),
      keepLocal: String(keepLocal),
      retentionCount: String(retentionCount),
      sendTelegram: String(sendTelegram),
    });
    if (target) params.set('target', target);
    if (cloudFolderId) params.set('cloudFolderId', cloudFolderId);
    if (backupName) params.set('backupName', backupName);
    return api.post(`/api/backups/database?${params.toString()}`).then(res => res.data);
  },
  triggerVolumeBackup: (target: string, format = 'Zip', syncToCloud = false, cloudFolderId?: string, backupName?: string, keepLocal = true, retentionCount = 0, sendTelegram = false) => {
    const params = new URLSearchParams({
      target,
      format,
      syncToCloud: String(syncToCloud),
      keepLocal: String(keepLocal),
      retentionCount: String(retentionCount),
      sendTelegram: String(sendTelegram),
    });
    if (cloudFolderId) params.set('cloudFolderId', cloudFolderId);
    if (backupName) params.set('backupName', backupName);
    return api.post(`/api/backups/volume?${params.toString()}`).then(res => res.data);
  },
  getSchedules: () => api.get<BackupSchedule[]>('/api/backups/schedules').then(res => res.data),
  createSchedule: (schedule) => api.post<BackupSchedule>('/api/backups/schedules', schedule).then(res => res.data),
  updateSchedule: (id, schedule) => api.put(`/api/backups/schedules/${id}`, schedule).then(res => res.data),
  deleteSchedule: (id) => api.delete(`/api/backups/schedules/${id}`).then(res => res.data),
  executeSchedule: (id) => api.post(`/api/backups/schedules/${id}/execute`).then(res => res.data),
  deleteBackup: (id: string) => api.delete(`/api/backups/${id}`),
  downloadBackup: (id: string, fileName: string) => 
    api.get(`/api/backups/${id}/download`, { responseType: 'blob' }).then(res => {
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    }),
  getAvailableVolumes: () => api.get<{ name: string, path: string }[]>('/api/backups/config/volumes').then(res => res.data),
  getAvailableContainers: () => api.get<{ id: string, name: string, state: string, image: string }[]>('/api/backups/config/containers').then(res => res.data),
  getContainerDatabases: (containerId: string, user?: string, pass?: string) => {
    return api.post<string[]>(`/api/backups/config/containers/${containerId}/databases`, {
      user,
      pass,
    }).then(res => res.data);
  },
  getDriveStatus: () => api.get<{ isAuthenticated: boolean }>('/api/backups/drive/status').then(res => res.data),
  getDriveAuthUrl: () => api.get<{ url: string }>('/api/backups/drive/auth-url').then(res => res.data),
  revokeDriveAuth: () => api.delete('/api/backups/drive/auth').then(res => res.data),
};

export default api;
