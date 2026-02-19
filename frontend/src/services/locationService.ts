import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Linking, Platform } from 'react-native';
import logger from '../utils/logger';

// ─────────────────────────────────────────────────────────────────────────────
// 🌍 LOCATION SERVICE — Production-grade GPS with retry, fallback, persistence
// ─────────────────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'userLocation';
const MAX_RETRIES = 3;

export interface UserLocation {
    latitude: number;
    longitude: number;
    address: string;
    city?: string;
    ward?: string;
    accuracy?: number; // GPS accuracy in meters
    timestamp?: number;
}

// ─── GET CURRENT LOCATION (with retry + accuracy fallback) ────────────────────
export async function getCurrentLocation(): Promise<UserLocation | null> {
    // 1. Check permissions
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
        logger.error('Location', 'Permission denied');
        showLocationSettingsPrompt();
        return null;
    }

    // 2. Try to get location with decreasing accuracy
    const accuracies = [
        Location.Accuracy.High,
        Location.Accuracy.Balanced,
        Location.Accuracy.Low,
    ];

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        const accuracy = accuracies[Math.min(attempt, accuracies.length - 1)];
        logger.info('Location', `Attempt ${attempt + 1}/${MAX_RETRIES} (accuracy: ${accuracy})`);

        try {
            const loc = await Promise.race([
                Location.getCurrentPositionAsync({ accuracy }),
                new Promise<never>((_, reject) =>
                    setTimeout(() => reject(new Error('GPS timeout')), 10000)
                ),
            ]);

            const coords = {
                latitude: loc.coords.latitude,
                longitude: loc.coords.longitude,
            };

            // 3. Reverse geocode for address
            const geo = await reverseGeocode(coords.latitude, coords.longitude);

            const result: UserLocation = {
                latitude: coords.latitude,
                longitude: coords.longitude,
                address: geo.address,
                city: geo.city,
                ward: geo.ward,
                accuracy: loc.coords.accuracy ?? undefined,
                timestamp: Date.now(),
            };

            // 4. Cache the successful location
            await saveLocation(result);
            logger.success('Location', `Got GPS: ${result.address} (±${result.accuracy?.toFixed(0)}m)`);
            return result;

        } catch (err) {
            logger.error('Location', `Attempt ${attempt + 1} failed: ${err}`);
            if (attempt === MAX_RETRIES - 1) {
                // All retries failed — try cached location
                const cached = await getStoredLocation();
                if (cached) {
                    logger.info('Location', 'Using cached location as fallback');
                    return cached;
                }
                return null;
            }
            // Wait before retry
            await new Promise(r => setTimeout(r, 1000));
        }
    }

    return null;
}

// ─── REVERSE GEOCODE ──────────────────────────────────────────────────────────
export async function reverseGeocode(
    latitude: number,
    longitude: number
): Promise<{ address: string; city?: string; ward?: string }> {
    try {
        const results = await Location.reverseGeocodeAsync({ latitude, longitude });
        if (results.length > 0) {
            const geo = results[0];
            const parts = [
                geo.name,
                geo.street,
                geo.district || geo.subregion,
                geo.city,
            ].filter(Boolean);

            return {
                address: parts.join(', ') || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
                city: geo.city || geo.subregion || undefined,
                ward: geo.district || geo.subregion || undefined,
            };
        }
    } catch (err) {
        logger.error('Location', 'Reverse geocode failed', err);
    }

    return {
        address: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
    };
}

// ─── PERSIST / RETRIEVE LOCATION ─────────────────────────────────────────────
export async function saveLocation(location: UserLocation): Promise<void> {
    try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(location));
        logger.info('Location', 'Saved to storage');
    } catch (err) {
        logger.error('Location', 'Failed to save location', err);
    }
}

export async function getStoredLocation(): Promise<UserLocation | null> {
    try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
            const parsed = JSON.parse(stored) as UserLocation;
            logger.info('Location', `Loaded cached: ${parsed.address}`);
            return parsed;
        }
    } catch (err) {
        logger.error('Location', 'Failed to load stored location', err);
    }
    return null;
}

export async function clearStoredLocation(): Promise<void> {
    await AsyncStorage.removeItem(STORAGE_KEY);
}

// ─── WATCH LOCATION (for future worker module) ───────────────────────────────
export async function watchLocation(
    callback: (location: UserLocation) => void,
    intervalMs: number = 5000
): Promise<Location.LocationSubscription | null> {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;

    return await Location.watchPositionAsync(
        {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: intervalMs,
            distanceInterval: 10, // meters
        },
        async (loc) => {
            const geo = await reverseGeocode(loc.coords.latitude, loc.coords.longitude);
            callback({
                latitude: loc.coords.latitude,
                longitude: loc.coords.longitude,
                address: geo.address,
                city: geo.city,
                ward: geo.ward,
                accuracy: loc.coords.accuracy ?? undefined,
                timestamp: Date.now(),
            });
        }
    );
}

// ─── PERMISSION HELPERS ──────────────────────────────────────────────────────
export function showLocationSettingsPrompt() {
    Alert.alert(
        'Location Services Required',
        'UrbanFix AI needs your location to pinpoint civic issues accurately. Please enable Location Services in your device settings.',
        [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Open Settings',
                onPress: () => {
                    if (Platform.OS === 'ios') {
                        Linking.openURL('app-settings:');
                    } else {
                        Linking.openSettings();
                    }
                },
            },
        ]
    );
}

export async function checkLocationPermission(): Promise<boolean> {
    const { status } = await Location.getForegroundPermissionsAsync();
    return status === 'granted';
}

// ─── EXTRACT EXIF GPS FROM IMAGE (for Report Issue) ──────────────────────────
export function extractExifGps(exif: any): { latitude: number; longitude: number } | null {
    if (!exif) return null;

    // Try standard EXIF GPS fields
    const lat = exif.GPSLatitude ?? exif.gps?.Latitude ?? exif.latitude;
    const lon = exif.GPSLongitude ?? exif.gps?.Longitude ?? exif.longitude;

    if (typeof lat === 'number' && typeof lon === 'number' && lat !== 0 && lon !== 0) {
        return { latitude: lat, longitude: lon };
    }

    return null;
}
