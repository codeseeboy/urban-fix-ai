import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import logger from '../utils/logger';

// ─────────────────────────────────────────────────────────────────────────────
// 🔧 NETWORK CONFIGURATION
//
// STATUS 0 / "JSON Parse error" = the device can't reach the server.
//
// Choose the right BASE URL for your setup:
//
//   OPTION A — Android Emulator (default):
//     'http://10.0.2.2:5000'
//
//   OPTION B — iOS Simulator (default):
//     'http://localhost:5000'
//
//   OPTION C — Physical device (phone on same WiFi as your PC):
//     Replace with your PC's LAN IP, e.g. 'http://192.168.1.42:5000'
//     Run: ipconfig (Windows) or ifconfig (Mac/Linux) to find your IP.
//
// ─────────────────────────────────────────────────────────────────────────────

// ← CHANGE THIS to your PC's LAN IP if using a physical device
const LAN_IP = '192.168.0.102'; // ← Your PC's LAN IP (auto-detected)
const PROD_URL = 'https://urban-fix-ai.onrender.com';

const BASE = __DEV__
    ? Platform.select({
        android: `http://${LAN_IP}:5000`,   // Physical Android device
        ios: `http://${LAN_IP}:5000`,   // Physical iOS device
        default: 'http://localhost:5000',
    })
    : PROD_URL;

// Uncomment below to use emulator instead:
// const BASE = Platform.OS === 'android' ? 'http://10.0.2.2:5000' : 'http://localhost:5000';

logger.info('API', `Base URL: ${BASE}`);

const api = axios.create({ baseURL: BASE + '/api', timeout: 10000 });

// ── Request Interceptor: log + attach token ──
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;

  logger.apiReq(
    config.method || 'GET',
    config.url || '',
    config.data ? (typeof config.data === 'string' ? JSON.parse(config.data) : config.data) : undefined
  );
  return config;
});

// ── Response Interceptor: log success and errors ──
api.interceptors.response.use(
  (response) => {
    logger.apiRes(
      response.config.method || 'GET',
      response.config.url || '',
      response.status,
      response.data
    );
    return response;
  },
  (error) => {
    const status = error.response?.status || 0;
    const url = error.config?.url || '';
    const method = error.config?.method || 'GET';
    const msg = error.response?.data?.message || error.message;

    if (status === 0 || error.code === 'ECONNREFUSED' || error.message?.includes('Network Error')) {
      logger.error('API', `🔴 NETWORK ERROR — Cannot reach server at ${BASE}`);
      logger.error('API', `💡 If using a physical device, update LAN_IP in src/services/api.ts`);
      logger.error('API', `   Run 'ipconfig' on your PC and use the IPv4 address`);
    } else {
      logger.apiRes(method, url, status, { error: msg });
    }
    return Promise.reject(error);
  }
);

export interface User {
  _id: string;
  name: string;
  email: string;
  role: 'citizen' | 'admin' | 'field_worker';
  points: number;
  badges: string[];
  reportsCount: number;
  reportsResolved: number;
  impactScore?: number;
  region?: string;
  avatar?: string | null;
  username?: string;
  city?: string;
  ward?: string;
  interests?: string[];
  department?: string;
  levelInfo?: {
    level: number;
    name: string;
    currentXp: number;
    nextLevelXp: number;
    progress: number;
  };
}

// ── AUTH ──
export const authAPI = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  register: (name: string, email: string, password: string) =>
    api.post('/auth/register', { name, email, password }),
  supabaseLogin: (token: string) =>
    api.post('/auth/supabase-login', { token }),
};

// ── ISSUES ──
export const issuesAPI = {
  getFeed: (filter?: string, userId?: string, municipalPageId?: string, authorType?: 'MunicipalPage' | 'User') =>
    api.get('/issues', { params: { filter, userId, municipalPageId, authorType } }),
  getMunicipalFeed: (filter?: string, limit?: number) =>
    api.get('/issues/municipal-feed', { params: { filter, limit } }),
  markMunicipalSeen: (id: string) =>
    api.post(`/issues/${id}/seen`),
  getById: (id: string) =>
    api.get(`/issues/${id}`),
  create: async (data: { title: string; description?: string; image?: string; video?: string; location?: any; category?: string; anonymous?: boolean; emergency?: boolean }) => {
    const formData = new FormData();
    formData.append('title', data.title);
    if (data.description) formData.append('description', data.description);
    if (data.category) formData.append('category', data.category);
    if (data.anonymous !== undefined) formData.append('anonymous', String(data.anonymous));
    if (data.emergency !== undefined) formData.append('emergency', String(data.emergency));
    if (data.location) formData.append('location', JSON.stringify(data.location));

    if (data.image) {
      // @ts-ignore
      formData.append('image', {
        uri: data.image,
        name: 'issue_image.jpg',
        type: 'image/jpeg',
      });
    }

    if (data.video) {
        // @ts-ignore
        formData.append('video', {
            uri: data.video,
            name: 'issue_video.mp4',
            type: 'video/mp4',
        });
    }

    return api.post('/issues', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  upvote: (id: string) =>
    api.put(`/issues/${id}/upvote`),
  downvote: (id: string) =>
    api.put(`/issues/${id}/downvote`),
  followIssue: (id: string) =>
    api.put(`/issues/${id}/follow`),
  getComments: (id: string) =>
    api.get(`/issues/${id}/comments`),
  addComment: (id: string, text: string) =>
    api.post(`/issues/${id}/comments`, { text }),
  seedNearby: (latitude: number, longitude: number) =>
    api.post('/issues/seed-nearby', { latitude, longitude }),
};

// ── WORKFLOWS (Admin) ──
export const workflowAPI = {
  updateStatus: (issueId: string, status: string, comment?: string) =>
    api.put(`/workflows/${issueId}/status`, { status, comment }),
  assign: (issueId: string, data: { departmentTag?: string; assignedTo?: string; deadline?: string }) =>
    api.put(`/workflows/${issueId}/assign`, data),
  workerUpdate: (issueId: string, data: { status?: string; proofImage?: string; comment?: string }) =>
    api.put(`/workflows/${issueId}/worker-update`, data),
  getAssigned: (workerId: string) =>
    api.get(`/workflows/assigned/${workerId}`),
};

// ── NOTIFICATIONS ──
export const notificationsAPI = {
  getAll: () => api.get('/notifications'),
  getUnreadCount: () => api.get('/notifications/unread-count'),
  markAllRead: () => api.put('/notifications/read-all'),
  markRead: (id: string) => api.put(`/notifications/${id}/read`),
  deleteOne: (id: string) => api.delete(`/notifications/${id}`),
  deleteAll: () => api.delete('/notifications'),
};

// ── USER PROFILE ──
export const userAPI = {
  getProfile: () => api.get('/users/profile'),
  updateProfile: (data: { 
    name?: string; 
    region?: string; 
    avatar?: string | null;
    username?: string;
    city?: string;
    ward?: string;
    interests?: string[];
  }) => api.put('/users/profile', data),
  checkUsername: (username: string) => 
    api.get(`/users/check-username/${encodeURIComponent(username)}`),
  registerPushToken: (token: string, deviceType: string) =>
    api.post('/users/push-token', { token, deviceType }),
};

// ── GAMIFICATION ──
export const gamificationAPI = {
  getLeaderboard: () => api.get('/gamification/leaderboard'),
  getBadges: () => api.get('/gamification/badges'),
  getStats: () => api.get('/gamification/stats'),
};

export default api;
