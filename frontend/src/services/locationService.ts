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

function rationalToNumber(v: any): number | null {
    // Common EXIF rational formats:
    // - [numerator, denominator]
    // - { numerator, denominator }
    // - string/number already representing decimal
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string') {
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
    }
    if (Array.isArray(v) && v.length >= 2) {
        const num = Number(v[0]);
        const den = Number(v[1]);
        if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0) return null;
        return num / den;
    }
    if (v && typeof v === 'object') {
        const num = Number(v.numerator ?? v.num ?? v[0]);
        const den = Number(v.denominator ?? v.den ?? v[1]);
        if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0) return null;
        return num / den;
    }
    return null;
}

function dmsToDecimal(dms: any, ref?: string): number | null {
    // dms is expected as [deg, min, sec] where each element may be rational.
    if (!Array.isArray(dms) || dms.length < 3) return null;
    const deg = rationalToNumber(dms[0]);
    const min = rationalToNumber(dms[1]);
    const sec = rationalToNumber(dms[2]);
    if (deg == null || min == null || sec == null) return null;
    let dec = deg + min / 60 + sec / 3600;
    const r = (ref || '').toUpperCase();
    if (r === 'S' || r === 'W') dec = -dec;
    return Number.isFinite(dec) ? dec : null;
}

// ─── GET CURRENT LOCATION (with retry + accuracy fallback) ────────────────────
export async function getCurrentLocation(
    options?: { allowCachedFallback?: boolean; accuracyLevels?: Location.LocationAccuracy[]; maxRetries?: number }
): Promise<UserLocation | null> {
    // 1. Check permissions
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
        logger.error('Location', 'Permission denied');
        showLocationSettingsPrompt();
        return null;
    }

    // 2. Try to get location with decreasing accuracy
    const allowCachedFallback = options?.allowCachedFallback ?? true;
    const maxRetries = options?.maxRetries ?? MAX_RETRIES;
    const accuracyLevels = options?.accuracyLevels ?? [
        Location.Accuracy.High,
        Location.Accuracy.Balanced,
        Location.Accuracy.Low,
    ];

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        const accuracy = accuracyLevels[Math.min(attempt, accuracyLevels.length - 1)];
        logger.info('Location', `Attempt ${attempt + 1}/${maxRetries} (accuracy: ${accuracy})`);

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
            if (attempt === maxRetries - 1) {
                if (allowCachedFallback) {
                    // All retries failed — try cached location
                    const cached = await getStoredLocation();
                    if (cached) {
                        logger.info('Location', 'Using cached location as fallback');
                        return cached;
                    }
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
        'UrbanFix needs your location to pinpoint civic issues accurately. Please enable Location Services in your device settings.',
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

    // Common EXIF shapes from camera libraries:
    // - GPSLatitude: [deg, min, sec], GPSLatitudeRef: 'N' | 'S'
    // - GPSLongitude: [deg, min, sec], GPSLongitudeRef: 'E' | 'W'
    // - Sometimes nested under gps: { Latitude, Longitude }
    const latRaw = exif.GPSLatitude ?? exif.gps?.Latitude ?? exif.latitude;
    const lonRaw = exif.GPSLongitude ?? exif.gps?.Longitude ?? exif.longitude;
    const latRef = exif.GPSLatitudeRef ?? exif.gps?.LatitudeRef ?? exif.latitudeRef;
    const lonRef = exif.GPSLongitudeRef ?? exif.gps?.LongitudeRef ?? exif.longitudeRef;

    // If we already got decimal numbers, accept directly.
    if (typeof latRaw === 'number' && typeof lonRaw === 'number' && latRaw !== 0 && lonRaw !== 0) {
        return { latitude: latRaw, longitude: lonRaw };
    }
    if (typeof latRaw === 'string' && typeof lonRaw === 'string') {
        const latNum = Number(latRaw);
        const lonNum = Number(lonRaw);
        if (Number.isFinite(latNum) && Number.isFinite(lonNum) && latNum !== 0 && lonNum !== 0) {
            return { latitude: latNum, longitude: lonNum };
        }
    }

    const latDec = dmsToDecimal(latRaw, latRef);
    const lonDec = dmsToDecimal(lonRaw, lonRef);
    if (latDec == null || lonDec == null) return null;
    if (!Number.isFinite(latDec) || !Number.isFinite(lonDec)) return null;
    if (latDec === 0 || lonDec === 0) return null;

    return { latitude: latDec, longitude: lonDec };
}
