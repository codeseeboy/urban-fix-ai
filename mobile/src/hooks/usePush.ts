/**
 * Native FCM push: asks permission, registers the device token with the backend
 * (which sends through Firebase Admin), and opens the related issue on tap.
 */
import { useQueryClient } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { usersApi } from '@/api';
import { qk } from '@/lib/query';
import { palette } from '@/theme/tokens';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

function openFrom(data: Record<string, unknown> | undefined) {
  const issueId = typeof data?.issueId === 'string' ? data.issueId : null;
  if (issueId) router.push(`/issue/${issueId}`);
}

export function usePush(userId: string | undefined) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!userId || Platform.OS !== 'android') return;
    let cancelled = false;

    (async () => {
      try {
        // Channel id must match the backend's FCM `channelId`.
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Issue updates',
          importance: Notifications.AndroidImportance.HIGH,
          lightColor: palette.blue500,
          vibrationPattern: [0, 200, 120, 200],
        });
        let perm = await Notifications.getPermissionsAsync();
        if (!perm.granted && perm.canAskAgain) perm = await Notifications.requestPermissionsAsync();
        if (!perm.granted || cancelled) return;
        const token = await Notifications.getDevicePushTokenAsync();
        if (!cancelled && typeof token.data === 'string') await usersApi.registerPushToken(token.data, 'android');
      } catch {
        // Push is best-effort; in-app alerts still work without it.
      }
    })();

    const received = Notifications.addNotificationReceivedListener(() => {
      qc.invalidateQueries({ queryKey: qk.notifications });
    });
    const tapped = Notifications.addNotificationResponseReceivedListener((r) => openFrom(r.notification.request.content.data));
    const last = Notifications.getLastNotificationResponse();
    if (last) openFrom(last.notification.request.content.data);

    return () => {
      cancelled = true;
      received.remove();
      tapped.remove();
    };
  }, [userId, qc]);
}
