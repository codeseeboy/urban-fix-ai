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
const USE_LOCAL_IN_PROD = false; // Set true if you want APK to hit local LAN IP
const USE_PROD_ON_WEB = true;

const LOCAL_BASE = Platform.select({
  android: `http://${LAN_IP}:5000`,   // Physical Android device
  ios: `http://${LAN_IP}:5000`,       // Physical iOS device
  default: 'http://localhost:5000',
});

const BASE = (Platform.OS === 'web' && USE_PROD_ON_WEB)
  ? PROD_URL
  : ((__DEV__ || USE_LOCAL_IN_PROD) ? LOCAL_BASE : PROD_URL);

// Uncomment below to use emulator instead:
// const BASE = Platform.OS === 'android' ? 'http://10.0.2.2:5000' : 'http://localhost:5000';

logger.info('API', `Base URL: ${BASE}`);

const api = axios.create({ baseURL: BASE + '/api', timeout: 20000 });

let authTokenCache: string | null = null;
let authTokenLoadPromise: Promise<string | null> | null = null;

async function getAuthTokenCached() {
  if (authTokenCache) return authTokenCache;
  if (authTokenLoadPromise) return authTokenLoadPromise;

  authTokenLoadPromise = AsyncStorage.getItem('token')
    .then((token) => {
      authTokenCache = token;
      return token;
    })
    .finally(() => {
      authTokenLoadPromise = null;
    });

  return authTokenLoadPromise;
}

export function setApiAuthToken(token: string | null) {
  authTokenCache = token;
}

// ── Request Interceptor: log + attach token ──
api.interceptors.request.use(async (config) => {
  const token = await getAuthTokenCached();
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
  getFeed: (filter?: string, userId?: string, municipalPageId?: string, authorType?: 'MunicipalPage' | 'User', limit?: number, offset?: number) =>
    api.get('/issues', { params: { filter, userId, municipalPageId, authorType, limit, offset } }),
  getMunicipalFeed: (filter?: string, limit?: number, offset?: number) =>
    api.get('/issues/municipal-feed', { params: { filter, limit, offset } }),
  markMunicipalSeen: (id: string) =>
    api.post(`/issues/${id}/seen`),
  getById: (id: string) =>
    api.get(`/issues/${id}`),
  getReports: (id: string) =>
    api.get(`/issues/${id}/reports`),
  getUpvoters: (id: string) =>
    api.get(`/issues/${id}/upvoters`),
  getDownvoters: (id: string) =>
    api.get(`/issues/${id}/downvoters`),
  duplicateCheck: (data: { title: string; description?: string; category?: string; emergency?: boolean; anonymous?: boolean; location: any }) =>
    api.post('/issues/duplicate-check', data),
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
  addReport: async (id: string, data: { title: string; description?: string; image?: string; video?: string; location?: any; category?: string; anonymous?: boolean; emergency?: boolean }) => {
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

    return api.post(`/issues/${id}/add-report`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  analyzeImage: async (imageUri: string) => {
    const formData = new FormData();
    // @ts-ignore — React Native FormData accepts objects with uri/name/type
    formData.append('image', {
      uri: imageUri,
      name: 'capture.jpg',
      type: 'image/jpeg',
    });
    return api.post('/issues/analyze-image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000, // AI models on CPU can take up to 60s
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

// ── CHATBOT ──
export const chatbotAPI = {
  sendMessage: (message: string, location?: { latitude: number; longitude: number }) =>
    api.post('/chatbot/message', { message, location }),
  getQuickActions: () => api.get('/chatbot/quick-actions'),
};

// ── AI LLM FEATURES ──
export const llmAPI = {
  refineIssue: (payload: {
    detected_issue: string;
    category: string;
    user_title: string;
    user_description: string;
  }) => api.post('/ai/refine', payload),
  explainIssue: (payload: {
    category: string;
    label: string;
    severity: string;
    location: string;
    status: string;
  }) => api.post('/ai/explain', payload),
};

export default api;
