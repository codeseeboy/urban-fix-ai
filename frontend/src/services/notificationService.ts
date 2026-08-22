import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { userAPI } from './api';
import logger from '../utils/logger';

// Configure behavior/handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerForPushNotificationsAsync() {
  let token;

  const pref = await AsyncStorage.getItem('setting_notifications');
  if (pref === 'false') {
    logger.info('Notifications', 'Push disabled in app settings — skip register');
    return;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('civic', {
      name: 'Issue updates',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#007AFF',
    });
    await Notifications.setNotificationChannelAsync('default', {
      name: 'UrbanFix',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#007AFF',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      logger.warn('Notifications', 'Failed to get push token for push notification!');
      return;
    }
    
    try {
      // Get the token that uniquely identifies this device
      // We use getDevicePushTokenAsync to get the native FCM token for direct Firebase usage
      const tokenResponse = await Notifications.getDevicePushTokenAsync();
      token = tokenResponse.data;

      if (!token || token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken[')) {
        logger.warn('Notifications', `Invalid native push token received (type: ${tokenResponse.type || 'unknown'})`);
        return;
      }

      logger.info('Notifications', `Device Push Token (${tokenResponse.type || 'unknown'}): ${token}`);

      // Register with backend
      const deviceType = Platform.OS === 'android' ? 'android' : Platform.OS === 'ios' ? 'ios' : 'web';
      await userAPI.registerPushToken(token, deviceType);

    } catch (e) {
      logger.error('Notifications', `Error getting push token: ${e}`);
    }
  } else {
    logger.info('Notifications', 'Must use physical device for Push Notifications');
  }

  return token;
}

export async function unregisterPushNotificationsAsync() {
  try {
    if (Platform.OS === 'web') {
      await userAPI.removePushToken().catch(() => {});
      return;
    }
    if (!Device.isDevice) return;

    const timed = Promise.race([
      Notifications.getDevicePushTokenAsync(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('push token timeout')), 2000)),
    ]);

    try {
      const tokenResponse = await timed;
      const token = tokenResponse?.data;
      await userAPI.removePushToken(typeof token === 'string' ? token : undefined);
    } catch {
      await userAPI.removePushToken().catch(() => {});
    }
    logger.info('Notifications', 'Push token removed from server');
  } catch (e) {
    logger.error('Notifications', `Error removing push token: ${e}`);
  }
}
