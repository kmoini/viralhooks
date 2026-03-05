import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  ActivityIndicator,
  ScrollView,
  Animated,
  TextInput,
  Switch,
  FlatList,
  Modal,
  Pressable,
  Dimensions,
} from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import * as Clipboard from 'expo-clipboard';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { openSoundPage } from '../utils/shareToTikTok';
import { generateCaption } from '../utils/generateCaption';
import { renderVideoWithOverlay } from '../services/jobs';
import OVERLAY_TEMPLATES, { type OverlayTemplate } from '../constants/overlayTemplates';

type ResultRouteProp = RouteProp<RootStackParamList, 'Result'>;
type ResultNavProp = NativeStackNavigationProp<RootStackParamList, 'Result'>;

type ActionState = 'idle' | 'downloading' | 'opening_tiktok' | 'sharing' | 'saving' | 'rendering_overlay';

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

  // Base video URL — the exact URL from generation, before any overlay
  const baseVideoUrl = videoUrl;

  // Override URL: set after overlay render to visually preview the overlaid video
  const [overrideVideoUrl, setOverrideVideoUrl] = useState<string | null>(null);
  const currentVideoUrl = overrideVideoUrl ?? baseVideoUrl;

  // DEBUG: log received params on mount
  useEffect(() => {
    console.log('[RESULT PARAMS]', JSON.stringify(route.params));
    console.log('[RESULT] baseVideoUrl:', baseVideoUrl);
  }, [route.params, baseVideoUrl]);

  // Log whenever the preview URL changes
  console.log('[RESULT] preview video url:', currentVideoUrl);

  const player = useVideoPlayer(currentVideoUrl, (p) => {
    p.loop = true;
    p.play();
  });

  // When currentVideoUrl changes (e.g. after overlay render), update the player source
  const prevUrlRef = useRef(currentVideoUrl);
  useEffect(() => {
    if (player && currentVideoUrl !== prevUrlRef.current) {
      console.log('[RESULT] replacing player source:', currentVideoUrl);
      prevUrlRef.current = currentVideoUrl;
      player.replace(currentVideoUrl);
      player.play();
    }
  }, [currentVideoUrl, player]);

  const [localUri, setLocalUri] = useState<string | null>(null);
  const [actionState, setActionState] = useState<ActionState>('idle');

  const isBusy = actionState !== 'idle';

  // --- Overlay state ---
  const [overlaysEnabled, setOverlaysEnabled] = useState(true);
  const [selectedOverlayId, setSelectedOverlayId] = useState('beat_drop');
  const [overlayText, setOverlayText] = useState(OVERLAY_TEMPLATES[0].defaultText);
  const [overlayRenderedUrl, setOverlayRenderedUrl] = useState<string | null>(null);

  const selectedOverlay = useMemo(
    () => OVERLAY_TEMPLATES.find((t) => t.id === selectedOverlayId) ?? OVERLAY_TEMPLATES[0],
    [selectedOverlayId],
  );

  const handleSelectOverlay = useCallback((template: OverlayTemplate) => {
    setSelectedOverlayId(template.id);
    setOverlayText(template.defaultText);
    setOverlayRenderedUrl(null); // invalidate cache
  }, []);

  const handleOverlayTextChange = useCallback((text: string) => {
    setOverlayText(text);
    setOverlayRenderedUrl(null); // invalidate cache
  }, []);

  const handleToggleOverlays = useCallback((value: boolean) => {
    setOverlaysEnabled(value);
    if (!value) {
      setOverlayRenderedUrl(null);
    }
  }, []);

  // --- How-to modal state ---
  const [howToVisible, setHowToVisible] = useState(false);

  // --- Get the effective video URL (overlay or original) ---
  const getEffectiveVideoUrl = useCallback(async (): Promise<string> => {
    if (!overlaysEnabled) return baseVideoUrl;
    if (overlayRenderedUrl) return overlayRenderedUrl;

    // Render overlay on backend — always use baseVideoUrl (original generation output)
    const rendered = await renderVideoWithOverlay(baseVideoUrl, selectedOverlayId, overlayText);
    setOverlayRenderedUrl(rendered);
    return rendered;
  }, [overlaysEnabled, overlayRenderedUrl, baseVideoUrl, selectedOverlayId, overlayText]);

  // --- Toast state ---
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const toastOpacity = useRef(new Animated.Value(0)).current;

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    setToastVisible(true);
    Animated.timing(toastOpacity, { toValue: 1, duration: 250, useNativeDriver: true }).start();
    const timer = setTimeout(() => {
      Animated.timing(toastOpacity, { toValue: 0, duration: 400, useNativeDriver: true }).start(() => {
        setToastVisible(false);
      });
    }, 3500);
    return () => clearTimeout(timer);
  }, [toastOpacity]);

  // --- Ensure we have a local file:// path for the video ---
  const ensureLocalVideo = useCallback(async (url: string): Promise<string | null> => {
    if (url.startsWith('file://')) return url;
    try {
      const filename = `snapdance_${Date.now()}.mp4`;
      const dest = FileSystem.cacheDirectory + filename;
      const { uri } = await FileSystem.downloadAsync(url, dest);
      return uri;
    } catch (e) {
      console.warn('ensureLocalVideo download error:', e);
      return null;
    }
  }, []);

  // --- Save to camera roll ---
  const handleSave = useCallback(async () => {
    setActionState('saving');
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Permission to access media library is required to save video.');
        return;
      }

      let urlToSave = currentVideoUrl;
      if (overlaysEnabled && !overlayRenderedUrl) {
        setActionState('rendering_overlay');
        urlToSave = await getEffectiveVideoUrl();
      }

      setActionState('saving');
      const uri = await ensureLocalVideo(urlToSave);
      if (!uri) throw new Error('Download failed');
      await MediaLibrary.saveToLibraryAsync(uri);
      Alert.alert('Saved', overlaysEnabled ? 'Video with overlay saved to camera roll.' : 'Video saved to camera roll.');
    } catch (e) {
      console.warn('handleSave error:', e);
      Alert.alert('Error', 'Could not save video.');
    } finally {
      setActionState('idle');
    }
  }, [currentVideoUrl, ensureLocalVideo, overlaysEnabled, overlayRenderedUrl, getEffectiveVideoUrl]);

  // --- Open TikTok sound page ---
  const handleOpenSound = useCallback(async () => {
    if (!sound?.tiktokUrl) return;
    await openSoundPage(sound.tiktokUrl);
  }, [sound]);

  // --- Post to TikTok workflow ---
  const handlePostToTikTok = useCallback(async () => {
    setActionState('downloading');
    try {
      // Generate and copy caption
      const musicName = music?.title;
      const caption = generateCaption(templateId, musicName);
      await Clipboard.setStringAsync(caption);

      let urlToShare = currentVideoUrl;
      if (overlaysEnabled && !overlayRenderedUrl) {
        setActionState('rendering_overlay');
        urlToShare = await getEffectiveVideoUrl();
      }

      setActionState('downloading');
      const uri = await ensureLocalVideo(urlToShare);
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

      // Show toast BEFORE opening share sheet so user sees it immediately
      if (overlaysEnabled) {
        showToast('\u2705 Overlay applied. Posting to TikTok\u2026\nTap "Add description" \u2192 Paste caption');
      } else {
        showToast('\uD83D\uDD25 Caption copied\nIn TikTok, tap "Add description" \u2192 Paste');
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
  }, [currentVideoUrl, ensureLocalVideo, templateId, music, showToast, overlaysEnabled, overlayRenderedUrl, getEffectiveVideoUrl]);

  // --- Status label while busy ---
  const statusLabel: Record<ActionState, string> = {
    idle: '',
    downloading: 'Downloading video...',
    opening_tiktok: 'Opening TikTok...',
    sharing: 'Opening share sheet...',
    saving: 'Saving to camera roll...',
    rendering_overlay: 'Burning overlay onto video...',
  };

  // --- DEV: Test overlay endpoint directly ---
  const handleTestOverlay = useCallback(async () => {
    setActionState('rendering_overlay');
    try {
      console.log('[DEV] Testing overlay endpoint...');
      console.log('[RESULT] baseVideoUrl:', baseVideoUrl);
      const overlayUrl = await renderVideoWithOverlay(baseVideoUrl, selectedOverlayId, overlayText);
      console.log('[RESULT] overlay applied url:', overlayUrl);
      setOverrideVideoUrl(overlayUrl);
      setOverlayRenderedUrl(overlayUrl);
      console.log('[RESULT] preview video url:', overlayUrl);
      showToast('Overlay applied — preview updated');
    } catch (e: any) {
      console.warn('[DEV] Test overlay error:', e);
      Alert.alert('Overlay failed', e?.message ?? 'Unknown error');
    } finally {
      setActionState('idle');
    }
  }, [baseVideoUrl, selectedOverlayId, overlayText, showToast]);

  // --- Render overlay pill ---
  const renderOverlayPill = useCallback(({ item }: { item: OverlayTemplate }) => {
    const isSelected = item.id === selectedOverlayId;
    return (
      <TouchableOpacity
        style={[styles.overlayPill, isSelected && styles.overlayPillSelected]}
        onPress={() => handleSelectOverlay(item)}
        activeOpacity={0.7}
      >
        <Text style={[styles.overlayPillText, isSelected && styles.overlayPillTextSelected]}>
          {item.title}
        </Text>
      </TouchableOpacity>
    );
  }, [selectedOverlayId, handleSelectOverlay]);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.header}>Your SnapDance</Text>

        {/* Video preview — 9:16 aspect ratio to match final export */}
        <View style={styles.videoWrapper}>
          <VideoView
            key={currentVideoUrl}
            player={player}
            contentFit="contain"
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

        {/* ── Overlay section ── */}
        <View style={styles.overlaySection}>
          <View style={styles.overlayToggleRow}>
            <Text style={styles.overlayLabel}>On-video overlays</Text>
            <Switch
              value={overlaysEnabled}
              onValueChange={handleToggleOverlays}
              trackColor={{ false: '#333', true: '#ff2d55' }}
              thumbColor="#fff"
            />
          </View>

          {overlaysEnabled && (
            <>
              {/* Horizontal template picker */}
              <FlatList
                data={OVERLAY_TEMPLATES}
                renderItem={renderOverlayPill}
                keyExtractor={(item) => item.id}
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.overlayList}
                contentContainerStyle={styles.overlayListContent}
              />

              {/* Text input */}
              <TextInput
                style={styles.overlayInput}
                value={overlayText}
                onChangeText={handleOverlayTextChange}
                placeholder="Overlay text..."
                placeholderTextColor="#555"
                maxLength={200}
                multiline={false}
              />
              <Text style={styles.overlayHelper}>This will appear ON the video.</Text>
            </>
          )}
        </View>

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
          <View style={styles.tiktokRow}>
            <TouchableOpacity
              style={[styles.tiktokBtn, isBusy && styles.btnDisabled]}
              disabled={isBusy}
              onPress={handlePostToTikTok}
            >
              <Text style={styles.tiktokBtnText}>Post to TikTok</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.infoBtn}
              onPress={() => setHowToVisible(true)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.infoBtnText}>?</Text>
            </TouchableOpacity>
          </View>

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

          {/* DEV: Test overlay endpoint */}
          {__DEV__ && (
            <TouchableOpacity
              style={[styles.devBtn, isBusy && styles.btnDisabled]}
              disabled={isBusy}
              onPress={handleTestOverlay}
            >
              <Text style={styles.devBtnText}>
                {actionState === 'rendering_overlay' ? 'Rendering...' : 'TEST OVERLAY'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* How-to modal */}
      <Modal
        visible={howToVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setHowToVisible(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setHowToVisible(false)}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>How to post</Text>

            <View style={styles.modalStep}>
              <Text style={styles.modalStepNum}>1</Text>
              <Text style={styles.modalStepText}>Tap <Text style={styles.modalBold}>Post to TikTok</Text></Text>
            </View>
            <View style={styles.modalStep}>
              <Text style={styles.modalStepNum}>2</Text>
              <Text style={styles.modalStepText}>In TikTok, tap <Text style={styles.modalBold}>"Add description..."</Text></Text>
            </View>
            <View style={styles.modalStep}>
              <Text style={styles.modalStepNum}>3</Text>
              <Text style={styles.modalStepText}><Text style={styles.modalBold}>Paste</Text> {'\u2192'} Post</Text>
            </View>

            <Text style={styles.modalFooter}>Caption is auto-copied to your clipboard.</Text>

            <TouchableOpacity style={styles.modalClose} onPress={() => setHowToVisible(false)}>
              <Text style={styles.modalCloseText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* Toast overlay */}
      {toastVisible && (
        <Animated.View style={[styles.toast, { opacity: toastOpacity }]}>
          <Text style={styles.toastText}>{toastMessage}</Text>
        </Animated.View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#111' },
  scroll: { padding: 20, paddingBottom: 60 },
  header: { color: '#fff', fontSize: 22, fontWeight: '800', marginBottom: 16 },
  videoWrapper: {
    width: Dimensions.get('window').width - 40, // full width minus scroll padding
    height: (Dimensions.get('window').width - 40) * (16 / 9), // 9:16 aspect ratio
    backgroundColor: '#000',
    borderRadius: 12,
    overflow: 'hidden',
    alignSelf: 'center',
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

  // Overlay section
  overlaySection: {
    marginTop: 16,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 14,
  },
  overlayToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  overlayLabel: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  overlayList: {
    marginTop: 12,
  },
  overlayListContent: {
    gap: 8,
  },
  overlayPill: {
    backgroundColor: '#2a2a2a',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#333',
  },
  overlayPillSelected: {
    backgroundColor: '#ff2d55',
    borderColor: '#ff2d55',
  },
  overlayPillText: {
    color: '#aaa',
    fontSize: 13,
    fontWeight: '600',
  },
  overlayPillTextSelected: {
    color: '#fff',
  },
  overlayInput: {
    marginTop: 12,
    backgroundColor: '#222',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#333',
  },
  overlayHelper: {
    color: '#666',
    fontSize: 11,
    marginTop: 6,
  },

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
  tiktokRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  tiktokBtn: {
    flex: 1,
    backgroundColor: '#ff2d55',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  tiktokBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  infoBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2a2a2a',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#444',
  },
  infoBtnText: {
    color: '#aaa',
    fontSize: 16,
    fontWeight: '700',
  },
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

  // DEV button
  devBtn: {
    backgroundColor: '#333',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#ff0',
    borderStyle: 'dashed',
  },
  devBtnText: { color: '#ff0', fontWeight: '700', fontSize: 13 },

  // How-to modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  modalCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 320,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalStep: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 12,
  },
  modalStepNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#ff2d55',
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 28,
    overflow: 'hidden',
  },
  modalStepText: {
    color: '#ccc',
    fontSize: 14,
    flex: 1,
  },
  modalBold: {
    color: '#fff',
    fontWeight: '700',
  },
  modalFooter: {
    color: '#666',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
  },
  modalClose: {
    marginTop: 20,
    backgroundColor: '#ff2d55',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalCloseText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },

  // Toast
  toast: {
    position: 'absolute',
    bottom: 60,
    left: 20,
    right: 20,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ff2d55',
  },
  toastText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default ResultScreen;
