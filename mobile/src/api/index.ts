/** Typed wrappers over the UrbanFix REST API. One function per endpoint. */
import { http } from '@/lib/api';
import { filePart } from '@/lib/media';

import type {
  Achievement,
  AssistantReply,
  AuthResponse,
  CityStats,
  Comment,
  DuplicateCheck,
  FeedFilter,
  GroupReport,
  ImageAnalysis,
  Issue,
  IssueExplanation,
  LeaderboardEntry,
  MapCollection,
  MunicipalPage,
  Notification,
  Profile,
  SessionUser,
} from './types';

export * from './types';

const data = <T>(p: Promise<{ data: T }>) => p.then((r) => r.data);

export type ReportLocation = { latitude: number; longitude: number; accuracy: number | null; address: string };

const locationJson = (l: ReportLocation) =>
  JSON.stringify({
    coordinates: [l.longitude, l.latitude],
    address: l.address,
    accuracy_meters: l.accuracy ?? undefined,
    location_source: 'gps',
  });

export const authApi = {
  login: (email: string, password: string) => data<AuthResponse>(http.post('/auth/login', { email, password })),
  register: (body: { name: string; email: string; password: string; username?: string }) => data<AuthResponse>(http.post('/auth/register', body)),
};

export const usersApi = {
  profile: () => data<Profile>(http.get('/users/profile')),
  update: (body: Partial<Pick<SessionUser, 'name' | 'username' | 'city' | 'ward'>>) => data<SessionUser>(http.put('/users/profile', body)),
  uploadAvatar: (uri: string) => {
    const fd = new FormData();
    fd.append('avatar', filePart(uri, 'avatar.jpg'));
    return data<{ avatar: string }>(http.post('/users/avatar', fd, { headers: { 'Content-Type': 'multipart/form-data' } }));
  },
  checkUsername: (u: string) => data<{ available: boolean; message?: string }>(http.get(`/users/check-username/${encodeURIComponent(u)}`)),
  registerPushToken: (token: string, deviceType: string) => data(http.post('/users/push-token', { token, deviceType })),
};

export type FeedParams = {
  filter?: FeedFilter;
  userId?: string;
  limit?: number;
  offset?: number;
  search?: string;
  assignedTo?: string;
  authorType?: 'User' | 'MunicipalPage';
  municipalPageId?: string;
};

export const issuesApi = {
  feed: (p: FeedParams) => data<Issue[]>(http.get('/issues', { params: { limit: 15, ...p } })),
  get: (id: string) => data<Issue>(http.get(`/issues/${id}`)),
  geojson: () =>
    data<MapCollection>(
      http.get('/issues/geojson'),
    ),
  analyzeImage: (uri: string, note?: string) => {
    const fd = new FormData();
    fd.append('image', filePart(uri));
    if (note) fd.append('note', note);
    return data<ImageAnalysis>(http.post('/issues/analyze-image', fd, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 45000 }));
  },
  duplicateCheck: (body: { title: string; description: string; category: string; location: ReportLocation }) =>
    data<DuplicateCheck>(http.post('/issues/duplicate-check', { ...body, location: JSON.parse(locationJson(body.location)) })),
  create: (body: { title: string; description: string; category: string; anonymous: boolean; emergency: boolean; location: ReportLocation; imageUri: string }) => {
    const fd = new FormData();
    fd.append('title', body.title);
    fd.append('description', body.description);
    fd.append('category', body.category);
    fd.append('anonymous', String(body.anonymous));
    fd.append('emergency', String(body.emergency));
    fd.append('location', locationJson(body.location));
    fd.append('image', filePart(body.imageUri));
    return data<Issue>(http.post('/issues', fd, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 60000 }));
  },
  joinReport: (groupId: string, body: { title: string; description: string; category: string; anonymous: boolean; location: ReportLocation; imageUri: string }) => {
    const fd = new FormData();
    fd.append('title', body.title);
    fd.append('description', body.description);
    fd.append('category', body.category);
    fd.append('anonymous', String(body.anonymous));
    fd.append('location', locationJson(body.location));
    fd.append('image', filePart(body.imageUri));
    return data<{ message?: string }>(http.post(`/issues/${groupId}/add-report`, fd, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 60000 }));
  },
  reports: (id: string) => data<{ reports: GroupReport[] }>(http.get(`/issues/${id}/reports`)).then((r) => r.reports || []),
  upvote: (id: string) => data<{ upvotes: string[]; upvoted: boolean }>(http.put(`/issues/${id}/upvote`)),
  follow: (id: string) => data<{ followers: string[]; following: boolean }>(http.put(`/issues/${id}/follow`)),
  comments: (id: string) => data<Comment[]>(http.get(`/issues/${id}/comments`)),
  addComment: (id: string, text: string) => data<Comment>(http.post(`/issues/${id}/comments`, { text })),
};

export const aiApi = {
  refine: (body: { title: string; description: string; category: string }) => data<{ title: string; description: string }>(http.post('/ai/refine', body)),
  explain: (body: { title: string; category: string; severity: string; status: string; department?: string | null }) =>
    data<IssueExplanation>(http.post('/ai/explain', body)),
};

export const assistantApi = {
  send: (body: { message: string; history: { role: 'user' | 'assistant'; text: string }[]; location?: { latitude: number; longitude: number } | null }) =>
    data<AssistantReply>(http.post('/chatbot/message', body, { timeout: 45000 })),
  quickActions: () => data<{ actions: { id: string; label: string; prompt: string; icon?: string }[] }>(http.get('/chatbot/quick-actions')),
};

export const notificationsApi = {
  list: () => data<{ notifications: Notification[]; unreadCount: number }>(http.get('/notifications')),
  unreadCount: () => data<{ unreadCount: number }>(http.get('/notifications/unread-count')).then((r) => r.unreadCount),
  markRead: (id: string) => data(http.put(`/notifications/${id}/read`)),
  markAllRead: () => data(http.put('/notifications/read-all')),
  remove: (id: string) => data(http.delete(`/notifications/${id}`)),
};

export const gamificationApi = {
  leaderboard: () => data<LeaderboardEntry[]>(http.get('/gamification/leaderboard')),
  achievements: () => data<Achievement[]>(http.get('/gamification/badges')),
  stats: () => data<CityStats>(http.get('/gamification/stats')),
};

export const municipalApi = {
  search: (q = '') => data<MunicipalPage[]>(http.get('/municipal/search', { params: { q } })),
  get: (id: string) => data<MunicipalPage>(http.get(`/municipal/${id}`)),
  follow: (id: string) => data(http.post(`/municipal/${id}/follow`)),
  unfollow: (id: string) => data(http.post(`/municipal/${id}/unfollow`)),
};

export const workerApi = {
  update: (id: string, body: { status: 'InProgress' | 'Resolved'; comment?: string; imageUri?: string }) => {
    const fd = new FormData();
    fd.append('status', body.status);
    if (body.comment) fd.append('comment', body.comment);
    if (body.imageUri) fd.append('image', filePart(body.imageUri, 'after.jpg'));
    return data<Issue>(http.put(`/workflows/${id}/worker-update`, fd, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 60000 }));
  },
};
