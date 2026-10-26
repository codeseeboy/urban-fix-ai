import * as Location from 'expo-location';

export type Fix = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  address: string;
};

export async function ensureLocationPermission() {
  const current = await Location.getForegroundPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const res = await Location.requestForegroundPermissionsAsync();
  return res.granted;
}

/** Last known position immediately (may be null) — for maps and "near me" without a wait. */
export async function quickPosition() {
  try {
    const p = await Location.getLastKnownPositionAsync({ maxAge: 10 * 60_000 });
    return p ? { latitude: p.coords.latitude, longitude: p.coords.longitude } : null;
  } catch {
    return null;
  }
}

export async function reverseGeocode(latitude: number, longitude: number) {
  try {
    const [p] = await Location.reverseGeocodeAsync({ latitude, longitude });
    if (!p) return '';
    const parts = [p.name && p.name !== p.street ? p.name : null, p.street, p.district || p.subregion, p.city].filter(Boolean) as string[];
    return Array.from(new Set(parts)).join(', ');
  } catch {
    return '';
  }
}

/** Accurate fix for a report: high accuracy, with a short refine pass if the first fix is coarse. */
export async function currentFix(): Promise<Fix> {
  const ok = await ensureLocationPermission();
  if (!ok) throw new Error('Location permission is needed to pin the issue on the map.');
  let pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
  if ((pos.coords.accuracy ?? 999) > 30) {
    const again = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.BestForNavigation }).catch(() => null);
    if (again && (again.coords.accuracy ?? 999) < (pos.coords.accuracy ?? 999)) pos = again;
  }
  const { latitude, longitude, accuracy } = pos.coords;
  const address = (await reverseGeocode(latitude, longitude)) || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
  return { latitude, longitude, accuracy: accuracy ?? null, address };
}
