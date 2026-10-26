import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

export type PickedImage = { uri: string; width: number; height: number };

/** Downscale + re-encode so uploads are small and fast on mobile data. */
async function compress(uri: string, maxSide = 1600): Promise<PickedImage> {
  const ctx = ImageManipulator.manipulate(uri);
  const probe = await ctx.renderAsync();
  const scale = Math.min(1, maxSide / Math.max(probe.width, probe.height));
  let ref = probe;
  if (scale < 1) {
    ref = await ImageManipulator.manipulate(uri)
      .resize({ width: Math.round(probe.width * scale), height: Math.round(probe.height * scale) })
      .renderAsync();
  }
  const out = await ref.saveAsync({ compress: 0.82, format: SaveFormat.JPEG });
  return { uri: out.uri, width: out.width, height: out.height };
}

export async function capturePhoto(): Promise<PickedImage | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) throw new Error('Camera permission is needed to take a photo.');
  const res = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.9, exif: false });
  if (res.canceled || !res.assets?.[0]) return null;
  return compress(res.assets[0].uri);
}

export async function pickPhoto(): Promise<PickedImage | null> {
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9, exif: false });
  if (res.canceled || !res.assets?.[0]) return null;
  return compress(res.assets[0].uri);
}

/** FormData file part for React Native's fetch/axios. */
export function filePart(uri: string, name = 'photo.jpg') {
  return { uri, name, type: 'image/jpeg' } as unknown as Blob;
}
