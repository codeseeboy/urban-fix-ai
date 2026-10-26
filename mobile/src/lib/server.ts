/**
 * Backend discovery. Candidates are probed in parallel against /api/health and
 * the highest-priority one that answers wins:
 *   1. an address the user saved in Settings,
 *   2. the public servers in config/servers.ts (work from any network),
 *   3. the LAN address baked in at build time (EXPO_PUBLIC_API_URL),
 *   4. 127.0.0.1 — works over USB after `adb reverse tcp:5000 tcp:5000`.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { REMOTE_SERVERS } from '@/config/servers';

const OVERRIDE_KEY = 'urbanfix.serverOverride';
const BUILD_URL = process.env.EXPO_PUBLIC_API_URL?.replace(/\/+$/, '') || '';
const USB_URL = 'http://127.0.0.1:5000';

export type Health = { ok: boolean; db: 'up' | 'down'; dbLatencyMs?: number; ai?: { provider?: string; project?: string | null; authError?: string | null; chatModels?: string[] } };

let current: string | null = null;
const listeners = new Set<(url: string | null) => void>();

export const server = {
  get url() {
    return current;
  },
  subscribe(fn: (url: string | null) => void) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};

function setCurrent(url: string | null) {
  current = url;
  listeners.forEach((fn) => fn(url));
}

export const normaliseServerUrl = (raw: string) => {
  let v = raw.trim().replace(/\/+$/, '').replace(/\/api$/, '');
  if (v && !/^https?:\/\//i.test(v)) v = `http://${v}`;
  if (v && !/:\d+$/.test(v) && !/^https:/i.test(v)) v = `${v}:5000`;
  return v;
};

export async function probe(url: string, timeoutMs = 3000): Promise<Health | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${url}/api/health`, { signal: ctrl.signal });
    const body = (await res.json().catch(() => null)) as Health | null;
    return body && typeof body.ok === 'boolean' ? body : null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

export async function getOverride() {
  return (await AsyncStorage.getItem(OVERRIDE_KEY).catch(() => null)) || '';
}

export async function setOverride(url: string) {
  const v = normaliseServerUrl(url);
  if (v) await AsyncStorage.setItem(OVERRIDE_KEY, v);
  else await AsyncStorage.removeItem(OVERRIDE_KEY);
}

export function candidates(override: string) {
  return Array.from(new Set([override, ...REMOTE_SERVERS, BUILD_URL, USB_URL].filter(Boolean)));
}

/** Races all candidates; prefers the earliest in priority order that answers. */
export async function discoverServer(): Promise<string | null> {
  const list = candidates(await getOverride());
  // Remote hosts get longer: a sleeping Render instance takes up to a minute to wake.
  const probes = list.map((u) => probe(u, u.startsWith('https://') ? 25000 : 3000));
  for (let i = 0; i < list.length; i++) {
    if (await probes[i]) {
      setCurrent(list[i]);
      return list[i];
    }
  }
  setCurrent(null);
  return null;
}

export const buildServerUrl = BUILD_URL;
