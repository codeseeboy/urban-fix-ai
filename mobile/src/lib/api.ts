import axios, { AxiosError } from 'axios';

import { discoverServer, server } from './server';

/** Error carrying the server's human message and HTTP status. */
export class ApiError extends Error {
  status: number;
  code?: string;
  data?: unknown;
  constructor(message: string, status: number, code?: string, data?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

let tokenGetter: () => string | null = () => null;
let onUnauthorized: () => void = () => {};

export function configureAuth(opts: { getToken: () => string | null; onUnauthorized: () => void }) {
  tokenGetter = opts.getToken;
  onUnauthorized = opts.onUnauthorized;
}

export const http = axios.create({ timeout: 25000 });

http.interceptors.request.use(async (config) => {
  const base = server.url ?? (await discoverServer());
  if (!base) throw new ApiError('Can’t reach the UrbanFix server. Check that the backend is running and you are on the same Wi-Fi.', 0, 'OFFLINE');
  config.baseURL = `${base}/api`;
  const token = tokenGetter();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

http.interceptors.response.use(
  (res) => res,
  async (err: AxiosError<{ message?: string; code?: string }>) => {
    if (err instanceof ApiError) throw err;
    const status = err.response?.status ?? 0;
    const body = err.response?.data;
    if (status === 401) onUnauthorized();
    if (!err.response) {
      // Network failure: the address may have changed (Wi-Fi switch) — re-discover next time.
      discoverServer().catch(() => {});
      throw new ApiError(err.code === 'ECONNABORTED' ? 'The server took too long to respond.' : 'Network error — can’t reach the server.', 0, 'NETWORK');
    }
    throw new ApiError(body?.message || `Request failed (${status})`, status, body?.code, body);
  },
);

/** Absolute URL for images the API returns as relative paths (`/public/...`). */
export function mediaUrl(path?: string | null) {
  if (!path) return null;
  if (/^(https?:|file:|data:|content:)/i.test(path)) return path;
  return server.url ? `${server.url}${path.startsWith('/') ? '' : '/'}${path}` : null;
}
