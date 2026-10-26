import { QueryClient } from '@tanstack/react-query';

import { ApiError } from './api';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 10 * 60_000,
      retry: (count, err) => {
        // Don't retry auth/validation failures; retry network blips once.
        if (err instanceof ApiError && err.status >= 400 && err.status < 500) return false;
        return count < 1;
      },
      refetchOnWindowFocus: false,
    },
  },
});

export const qk = {
  feed: (filter: string, search: string) => ['feed', filter, search] as const,
  issue: (id: string) => ['issue', id] as const,
  comments: (id: string) => ['issue', id, 'comments'] as const,
  reports: (id: string) => ['issue', id, 'reports'] as const,
  explain: (id: string) => ['issue', id, 'explain'] as const,
  map: ['map'] as const,
  profile: ['profile'] as const,
  myReports: (uid: string) => ['my-reports', uid] as const,
  notifications: ['notifications'] as const,
  unread: ['notifications', 'unread'] as const,
  leaderboard: ['leaderboard'] as const,
  achievements: ['achievements'] as const,
  stats: ['stats'] as const,
  pages: (q: string) => ['pages', q] as const,
  page: (id: string) => ['page', id] as const,
  pagePosts: (id: string) => ['page', id, 'posts'] as const,
  tasks: (uid: string) => ['tasks', uid] as const,
};
