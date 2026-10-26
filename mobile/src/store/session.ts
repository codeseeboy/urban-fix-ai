import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

import type { AuthResponse, Role, SessionUser } from '@/api/types';
import { configureAuth } from '@/lib/api';

const KEY = 'urbanfix.session.v2';

type SessionState = {
  hydrated: boolean;
  token: string | null;
  user: SessionUser | null;
  hydrate: () => Promise<void>;
  signIn: (auth: AuthResponse) => Promise<void>;
  patchUser: (patch: Partial<SessionUser>) => void;
  signOut: () => Promise<void>;
};

export const useSession = create<SessionState>((set, get) => ({
  hydrated: false,
  token: null,
  user: null,

  hydrate: async () => {
    try {
      const raw = await SecureStore.getItemAsync(KEY);
      if (raw) {
        const { token, user } = JSON.parse(raw) as { token: string; user: SessionUser };
        set({ token, user });
      }
    } catch {
      // Corrupt entry — start signed out.
    } finally {
      set({ hydrated: true });
    }
  },

  signIn: async ({ token, ...user }) => {
    const sessionUser: SessionUser = {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      points: user.points ?? 0,
      avatar: user.avatar ?? null,
      username: user.username ?? null,
      city: user.city ?? null,
      ward: user.ward ?? null,
    };
    set({ token, user: sessionUser });
    await SecureStore.setItemAsync(KEY, JSON.stringify({ token, user: sessionUser }));
  },

  patchUser: (patch) => {
    const { user, token } = get();
    if (!user || !token) return;
    const next = { ...user, ...patch };
    set({ user: next });
    SecureStore.setItemAsync(KEY, JSON.stringify({ token, user: next })).catch(() => {});
  },

  signOut: async () => {
    set({ token: null, user: null });
    await SecureStore.deleteItemAsync(KEY).catch(() => {});
  },
}));

configureAuth({
  getToken: () => useSession.getState().token,
  onUnauthorized: () => {
    if (useSession.getState().token) useSession.getState().signOut();
  },
});

export const isWorker = (role?: Role | null) => role === 'field_worker';
export const isAdmin = (role?: Role | null) => role === 'admin' || role === 'super_admin' || role === 'department_admin';
