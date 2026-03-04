import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { openSoundPage } from '../utils/shareToTikTok';

type ResultRouteProp = RouteProp<RootStackParamList, 'Result'>;
type ResultNavProp = NativeStackNavigationProp<RootStackParamList, 'Result'>;

type ActionState = 'idle' | 'downloading' | 'opening_tiktok' | 'sharing' | 'saving';

const ResultScreen: React.FC = () => {
  const route = useRoute<ResultRouteProp>();
  const navigation = useNavigation<ResultNavProp>();
  const params = route.params ?? ({} as any);
  const videoUrl: string = params.videoUrl ?? '';
  const templateId: string = params.templateId ?? '';
  const sound = params.sound ?? null;
  const music = params.music ?? null;
  const mixMode = params.mixMode ?? null;

  const hasTikTokSound = !!sound?.tiktokUrl;
  const hasMusic = !!music;

  // DEBUG: log received params on mount
  useEffect(() => {
    console.log('[RESULT PARAMS]', JSON.stringify(route.params));
  }, [route.params]);

  const player = useVideoPlayer(videoUrl, (p) => {
    p.loop = true;
    p.play();
  });

  const [localUri, setLocalUri] = useState<string | null>(null);
  const [actionState, setActionState] = useState<ActionState>('idle');

  const isBusy = actionState !== 'idle';

  // --- Ensure we have a local file:// path for the video ---
  const ensureLocalVideo = useCallback(async (url: string): Promise<string | null> => {
    // Already a local file — reuse it
    if (localUri) return localUri;
    if (url.startsWith('file://')) {
      setLocalUri(url);
      return url;
    }
    try {
      const filename = `snapdance_${Date.now()}.mp4`;
      const dest = FileSystem.cacheDirectory + filename;
      const { uri } = await FileSystem.downloadAsync(url, dest);
      setLocalUri(uri);
      return uri;
    } catch (e) {
      console.warn('ensureLocalVideo download error:', e);
      return null;
    }
  }, [localUri]);

  // --- Save to camera roll ---
  const handleSave = useCallback(async () => {
    setActionState('saving');
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Permission to access media library is required to save video.');
        return;
      }
      const uri = await ensureLocalVideo(videoUrl);
      if (!uri) throw new Error('Download failed');
      await MediaLibrary.saveToLibraryAsync(uri);
      Alert.alert('Saved', 'Video saved to camera roll.');
    } catch (e) {
      console.warn('handleSave error:', e);
      Alert.alert('Error', 'Could not save video.');
    } finally {
      setActionState('idle');
    }
  }, [videoUrl, ensureLocalVideo]);

  // --- Open TikTok sound page ---
  const handleOpenSound = useCallback(async () => {
    if (!sound?.tiktokUrl) return;
    await openSoundPage(sound.tiktokUrl);
  }, [sound]);

  // --- Post to TikTok workflow ---
  // Downloads video (reuses cached local file) then opens native share sheet.
  // Never opens TikTok sound page — that's the separate "Open Sound" button.
  const handlePostToTikTok = useCallback(async () => {
    setActionState('downloading');
    try {
      const uri = await ensureLocalVideo(videoUrl);
      if (!uri) {
        Alert.alert('Download failed', 'Could not download the video. Check your connection and try again.');
        return;
      }

      setActionState('sharing');

      const available = await Sharing.isAvailableAsync();
      if (!available) {
        Alert.alert('Sharing unavailable', 'Could not open share sheet.');
        return;
      }

      await Sharing.shareAsync(uri, {
        mimeType: 'video/mp4',
        dialogTitle: 'Post to TikTok',
        UTI: 'public.mpeg-4',
      });
    } catch (e) {
      console.warn('handlePostToTikTok error:', e);
      Alert.alert('Share failed', 'Could not open share sheet.');
    } finally {
      setActionState('idle');
    }
  }, [videoUrl, ensureLocalVideo]);

  // --- Status label while busy ---
  const statusLabel: Record<ActionState, string> = {
    idle: '',
    downloading: 'Downloading video...',
    opening_tiktok: 'Opening TikTok...',
    sharing: 'Opening share sheet...',
    saving: 'Saving to camera roll...',
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.header}>Your SnapDance</Text>

        {/* Video preview */}
        <View style={styles.videoWrapper}>
          <VideoView
            player={player}
            contentFit="cover"
            nativeControls
            style={styles.video}
          />
        </View>

        {/* Music info badge (when user selected music) */}
        {hasMusic && (
          <View style={styles.soundBadge}>
            <Text style={styles.soundIcon}>{'♪'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.soundText}>
                Beat-synced to: <Text style={styles.soundName}>{music.title}</Text>
              </Text>
              <Text style={styles.musicDetail}>
                {music.artist} — {music.bpm} BPM{!music.bpmDetected ? ' (est.)' : ''} — {mixMode === 'withMusic' ? 'Audio included' : 'Mute'}
              </Text>
            </View>
          </View>
        )}

        {/* Sound info badge (only for viral renders with TikTok sound) */}
        {!hasMusic && sound && (
          <View style={styles.soundBadge}>
            <Text style={styles.soundIcon}>{'♪'}</Text>
            <Text style={styles.soundText}>
              Optimized for: <Text style={styles.soundName}>{sound.soundName}</Text>
            </Text>
            <Text style={styles.soundBpm}>{sound.bpm} BPM</Text>
          </View>
        )}

        {/* Busy indicator */}
        {isBusy && (
          <View style={styles.busyRow}>
            <ActivityIndicator size="small" color="#fff" />
            <Text style={styles.busyText}>{statusLabel[actionState]}</Text>
          </View>
        )}

        {/* Action buttons */}
        <View style={styles.actions}>
          {/* Save Video (with or without music depending on mixMode) */}
          <TouchableOpacity
            style={[styles.secondary, isBusy && styles.btnDisabled]}
            disabled={isBusy}
            onPress={handleSave}
          >
            <Text style={styles.secondaryText}>
              {actionState === 'saving' ? 'Saving...' : hasMusic && mixMode === 'withMusic' ? 'Save Video (with music)' : 'Save Video'}
            </Text>
          </TouchableOpacity>

          {/* Post to TikTok — always available */}
          <TouchableOpacity
            style={[styles.tiktokBtn, isBusy && styles.btnDisabled]}
            disabled={isBusy}
            onPress={handlePostToTikTok}
          >
            <Text style={styles.tiktokBtnText}>Post to TikTok</Text>
          </TouchableOpacity>

          {/* Open Sound (only when TikTok sound URL exists) */}
          {hasTikTokSound && (
            <TouchableOpacity
              style={[styles.secondary, isBusy && styles.btnDisabled]}
              disabled={isBusy}
              onPress={handleOpenSound}
            >
              <Text style={styles.secondaryText}>Open Sound</Text>
            </TouchableOpacity>
          )}

          {/* Navigation buttons */}
          <View style={styles.navRow}>
            <TouchableOpacity
              style={styles.navBtn}
              onPress={() => navigation.navigate('Generate', { templateId })}
            >
              <Text style={styles.navBtnText}>Regenerate</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.navBtn}
              onPress={() => navigation.navigate('TemplateGrid')}
            >
              <Text style={styles.navBtnText}>Try Another</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#111' },
  scroll: { padding: 20, paddingBottom: 60 },
  header: { color: '#fff', fontSize: 22, fontWeight: '800', marginBottom: 16 },
  videoWrapper: {
    height: 320,
    backgroundColor: '#000',
    borderRadius: 12,
    overflow: 'hidden',
  },
  video: { width: '100%', height: '100%' },

  // Sound badge
  soundBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 12,
    gap: 8,
  },
  soundIcon: { color: '#ff2d55', fontSize: 16 },
  soundText: { color: '#aaa', fontSize: 13, flex: 1 },
  soundName: { color: '#fff', fontWeight: '700' },
  soundBpm: { color: '#666', fontSize: 12, fontWeight: '600' },
  musicDetail: { color: '#666', fontSize: 11, marginTop: 2 },

  // Busy indicator
  busyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    gap: 8,
  },
  busyText: { color: '#aaa', fontSize: 13 },

  // Action buttons
  actions: { marginTop: 20, gap: 12 },
  tiktokBtn: {
    backgroundColor: '#ff2d55',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  tiktokBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  secondary: {
    backgroundColor: '#2a2a2a',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  secondaryText: { color: '#ccc', fontWeight: '600', fontSize: 14 },
  btnDisabled: { opacity: 0.4 },

  // Navigation row
  navRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  navBtn: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  navBtnText: { color: '#888', fontWeight: '600', fontSize: 13 },
});

export default ResultScreen;
