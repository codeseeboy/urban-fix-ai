import axios from "axios";

const IS_LOCAL =
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");

const BASE_URL = IS_LOCAL
  ? "http://localhost:5000/api"
  : (process.env.NEXT_PUBLIC_API_URL || "https://urban-fix-ai.onrender.com/api");

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 60000,
});

api.interceptors.response.use(undefined, async (err) => {
  const config = err.config;
  if (
    config &&
    !config._retried &&
    (err.code === "ECONNABORTED" || err.response?.status >= 500)
  ) {
    config._retried = true;
    return api(config);
  }
  return Promise.reject(err);
});

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("admin_token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && typeof window !== "undefined") {
      localStorage.removeItem("admin_token");
      localStorage.removeItem("admin_user");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

export const authAPI = {
  login: (email: string, password: string) =>
    api.post("/auth/login", { email, password }),
};

export const issuesAPI = {
  getFeed: (params?: Record<string, unknown>) => api.get("/issues", { params }),
  getById: (id: string) => api.get(`/issues/${id}`),
  updateStatus: (id: string, status: string, comment?: string) =>
    api.put(`/workflows/${id}/status`, { status, comment }),
  assign: (
    id: string,
    data: { departmentTag?: string; assignedTo?: string; deadline?: string }
  ) => api.put(`/workflows/${id}/assign`, data),
  getComments: (id: string) => api.get(`/issues/${id}/comments`),
};

export const workflowAPI = {
  getAssigned: (workerId: string) =>
    api.get(`/workflows/assigned/${workerId}`),
};

export const notificationsAPI = {
  getAll: () => api.get("/notifications"),
  getUnreadCount: () => api.get("/notifications/unread-count"),
  markAllRead: () => api.put("/notifications/read-all"),
};

export const usersAPI = {
  getProfile: () => api.get("/users/profile"),
};

export const gamificationAPI = {
  getLeaderboard: () => api.get("/gamification/leaderboard"),
  getStats: () => api.get("/gamification/stats"),
  getBadges: () => api.get("/gamification/badges"),
};

export const municipalAPI = {
  search: (q?: string) => api.get("/municipal/search", { params: { q } }),
  suggested: () => api.get("/municipal/suggested"),
  getById: (id: string) => api.get(`/municipal/${id}`),
  create: (data: Record<string, unknown>) => api.post("/municipal/create", data),
  update: (id: string, data: Record<string, unknown>) =>
    api.patch(`/municipal/${id}`, data),
  createPost: (id: string, data: Record<string, unknown>) =>
    api.post(`/municipal/${id}/post`, data),
  getPosts: (id: string) => api.get(`/municipal/${id}/posts`),
};

export default api;
