import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { Linking } from 'react-native';
import {
    registerForPushNotificationsAsync,
    unregisterPushNotificationsAsync,
} from './notificationService';

export const SETTINGS_KEYS = {
    NOTIFICATIONS: 'setting_notifications',
    LOCATION_UPDATES: 'setting_location_updates',
};

export async function getBoolSetting(key: string, fallback = true): Promise<boolean> {
    const value = await AsyncStorage.getItem(key);
    if (value === null) return fallback;
    return value === 'true';
}

export async function setBoolSetting(key: string, value: boolean): Promise<void> {
    await AsyncStorage.setItem(key, String(value));
}

export async function arePushEnabled(): Promise<boolean> {
    return getBoolSetting(SETTINGS_KEYS.NOTIFICATIONS, true);
}

export async function applyNotificationPreference(enabled: boolean): Promise<{ ok: boolean; message?: string }> {
    await setBoolSetting(SETTINGS_KEYS.NOTIFICATIONS, enabled);
    if (enabled) {
        const token = await registerForPushNotificationsAsync();
        if (!token) {
            return {
                ok: false,
                message: 'Allow notifications in system settings to get live issue alerts.',
            };
        }
        return { ok: true };
    }
    await unregisterPushNotificationsAsync();
    return { ok: true };
}

export async function applyLocationPreference(enabled: boolean): Promise<{ ok: boolean; message?: string }> {
    await setBoolSetting(SETTINGS_KEYS.LOCATION_UPDATES, enabled);
    if (!enabled) return { ok: true };

    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
        return {
            ok: false,
            message: 'Location permission is off. Enable it in system settings to attach GPS to reports.',
        };
    }
    return { ok: true };
}

export function openSystemAppSettings() {
    Linking.openSettings().catch(() => {});
}
