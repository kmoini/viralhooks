import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Linking, Alert, Platform } from 'react-native';

/**
 * Downloads the video from a remote URL to a local cache file.
 * Returns the local URI, or null on failure.
 */
export async function downloadVideo(videoUrl: string): Promise<string | null> {
  try {
    const filename = `snapdance_${Date.now()}.mp4`;
    const localPath = FileSystem.cacheDirectory + filename;
    const { uri } = await FileSystem.downloadAsync(videoUrl, localPath);
    return uri;
  } catch (e) {
    console.warn('downloadVideo error:', e);
    return null;
  }
}

/**
 * Opens the TikTok sound page URL in the browser / TikTok app.
 */
export async function openSoundPage(tiktokUrl: string): Promise<boolean> {
  try {
    const supported = await Linking.canOpenURL(tiktokUrl);
    if (!supported) {
      Alert.alert('Cannot open link', 'Unable to open TikTok sound page on this device.');
      return false;
    }
    await Linking.openURL(tiktokUrl);
    return true;
  } catch (e) {
    console.warn('openSoundPage error:', e);
    Alert.alert('Error', 'Could not open TikTok sound page.');
    return false;
  }
}

/**
 * Opens the native share sheet with the local video file.
 * Returns true if sharing was initiated, false on error.
 */
export async function shareVideoFile(localUri: string): Promise<boolean> {
  try {
    const available = await Sharing.isAvailableAsync();
    if (!available) {
      Alert.alert('Sharing not available', 'Sharing is not supported on this device.');
      return false;
    }
    await Sharing.shareAsync(localUri, {
      mimeType: 'video/mp4',
      UTI: 'public.mpeg-4', // iOS UTI for mp4
    });
    return true;
  } catch (e) {
    console.warn('shareVideoFile error:', e);
    return false;
  }
}

export type PostToTikTokResult =
  | { success: true }
  | { success: false; reason: 'download_failed' | 'share_failed' | 'sound_failed' };

/**
 * Full "Post to TikTok" workflow:
 * 1. Download the video to local cache (if not already cached)
 * 2. If a TikTok sound URL is provided, try to open it (best-effort, won't block sharing)
 * 3. Open the share sheet with the video so user can pick TikTok as a share target
 *
 * @param videoUrl   Remote URL of the mp4
 * @param tiktokUrl  Optional TikTok sound page URL (empty string = skip)
 * @param cachedUri  Optional already-downloaded local URI
 * @returns Object with result and the local URI for caching
 */
export async function postToTikTok(
  videoUrl: string,
  tiktokUrl: string,
  cachedUri: string | null,
): Promise<{ result: PostToTikTokResult; localUri: string | null }> {
  // 1. Download if needed
  let localUri = cachedUri;
  if (!localUri) {
    localUri = await downloadVideo(videoUrl);
  }
  if (!localUri) {
    return { result: { success: false, reason: 'download_failed' }, localUri: null };
  }

  // 2. Optionally open the TikTok sound page (best-effort — don't block sharing)
  if (tiktokUrl) {
    const soundOpened = await openSoundPage(tiktokUrl);
    if (soundOpened) {
      await delay(800);
    }
  }

  // 3. Open share sheet
  const shared = await shareVideoFile(localUri);
  if (!shared) {
    return { result: { success: false, reason: 'share_failed' }, localUri };
  }

  return { result: { success: true }, localUri };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
