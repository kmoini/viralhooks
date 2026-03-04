import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  SafeAreaView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Audio } from 'expo-av';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import type { MusicInfo } from '../types/music';
import api from '../services/api';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'MusicPicker'>;
type Tab = 'catalog' | 'extract' | 'upload';

const TABS: { key: Tab; label: string }[] = [
  { key: 'catalog', label: 'Free Music' },
  { key: 'extract', label: 'From Video' },
  { key: 'upload', label: 'Upload Audio' },
];

const MusicPickerScreen: React.FC = () => {
  const route = useRoute();
  const navigation = useNavigation<NavProp>();
  const params = route.params as { templateId: string };
  const templateId = params?.templateId ?? '';

  const [tab, setTab] = useState<Tab>('catalog');
  const [catalog, setCatalog] = useState<MusicInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selected, setSelected] = useState<MusicInfo | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);

  const soundRef = useRef<Audio.Sound | null>(null);

  // Load catalog on mount
  useEffect(() => {
    loadCatalog();
    return () => {
      stopPreview();
    };
  }, []);

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/music/list');
      setCatalog(res.data.music || []);
    } catch (err) {
      console.warn('[MUSIC] Failed to load catalog:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const stopPreview = useCallback(async () => {
    if (soundRef.current) {
      try {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
      } catch (_) { /* ignore */ }
      soundRef.current = null;
    }
    setPlayingId(null);
  }, []);

  const togglePreview = useCallback(async (music: MusicInfo) => {
    if (playingId === music.musicId) {
      await stopPreview();
      return;
    }

    await stopPreview();

    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri: music.audioUrl || music.previewUrl },
        { shouldPlay: true },
      );
      soundRef.current = sound;
      setPlayingId(music.musicId);

      sound.setOnPlaybackStatusUpdate((status) => {
        if ('didJustFinish' in status && status.didJustFinish) {
          setPlayingId(null);
          soundRef.current = null;
        }
      });
    } catch (err) {
      console.warn('[MUSIC] Preview playback failed:', err);
      Alert.alert('Playback Error', 'Could not play this track. URL may be a placeholder.');
    }
  }, [playingId, stopPreview]);

  const handleSelect = useCallback((music: MusicInfo) => {
    setSelected(music);
  }, []);

  const handleContinue = useCallback(async () => {
    await stopPreview();
    navigation.navigate('Generate', {
      templateId,
      ...(selected ? { music: selected } : {}),
    });
  }, [navigation, templateId, selected, stopPreview]);

  const handleSkip = useCallback(async () => {
    await stopPreview();
    navigation.navigate('Generate', { templateId });
  }, [navigation, templateId, stopPreview]);

  // --- Extract audio from video ---
  const handleExtractFromVideo = useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Permission to access media library is required.');
        return;
      }

      const mediaType =
        (ImagePicker as any).MediaType?.Videos ??
        (ImagePicker as any).MediaTypeOptions?.Videos ??
        undefined;

      const result = await ImagePicker.launchImageLibraryAsync({
        ...(mediaType ? { mediaTypes: mediaType } : {}),
        allowsEditing: false,
        quality: 0.8,
      });

      if ((result as any).canceled) return;
      const asset = (result as any).assets?.[0];
      if (!asset?.uri) return;

      setUploading(true);
      const formData = new FormData();
      formData.append('file', {
        uri: asset.uri,
        name: asset.fileName || 'video.mp4',
        type: asset.mimeType || 'video/mp4',
      } as any);

      const res = await api.post('/api/music/extract-from-video', formData, {
        timeout: 120000,
      });

      const music = res.data as MusicInfo;
      setSelected(music);
      // Add to catalog list for display
      setCatalog((prev) => [music, ...prev.filter((m) => m.musicId !== music.musicId)]);
      setTab('catalog');
      Alert.alert('Audio Extracted', `"${music.title}" — ${music.bpm} BPM (${music.bpmDetected ? 'detected' : 'estimated'})`);
    } catch (err: any) {
      console.warn('[MUSIC] Extract failed:', err);
      Alert.alert('Error', 'Failed to extract audio from video.');
    } finally {
      setUploading(false);
    }
  }, []);

  // --- Upload audio file ---
  const handleUploadAudio = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'audio/*',
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;
      const file = result.assets?.[0];
      if (!file?.uri) return;

      setUploading(true);
      const formData = new FormData();
      formData.append('file', {
        uri: file.uri,
        name: file.name || 'audio.mp3',
        type: file.mimeType || 'audio/mpeg',
      } as any);

      const res = await api.post('/api/music/upload-audio', formData, {
        timeout: 120000,
      });

      const music = res.data as MusicInfo;
      setSelected(music);
      setCatalog((prev) => [music, ...prev.filter((m) => m.musicId !== music.musicId)]);
      setTab('catalog');
      Alert.alert('Audio Uploaded', `"${music.title}" — ${music.bpm} BPM (${music.bpmDetected ? 'detected' : 'estimated'})`);
    } catch (err: any) {
      console.warn('[MUSIC] Upload failed:', err);
      Alert.alert('Error', 'Failed to upload audio file.');
    } finally {
      setUploading(false);
    }
  }, []);

  // --- Render a catalog item ---
  const renderMusicItem = useCallback(({ item }: { item: MusicInfo }) => {
    const isSelected = selected?.musicId === item.musicId;
    const isPlaying = playingId === item.musicId;

    return (
      <TouchableOpacity
        style={[styles.musicItem, isSelected && styles.musicItemSelected]}
        onPress={() => handleSelect(item)}
        activeOpacity={0.7}
      >
        <View style={styles.musicItemLeft}>
          <TouchableOpacity
            style={styles.playBtn}
            onPress={() => togglePreview(item)}
          >
            <Text style={styles.playIcon}>{isPlaying ? '⏸' : '▶'}</Text>
          </TouchableOpacity>
          <View style={styles.musicMeta}>
            <Text style={styles.musicTitle} numberOfLines={1}>{item.title}</Text>
            <Text style={styles.musicArtist} numberOfLines={1}>{item.artist}</Text>
          </View>
        </View>
        <View style={styles.musicItemRight}>
          <Text style={styles.musicBpm}>{item.bpm} BPM</Text>
          {item.source !== 'catalog' && (
            <Text style={styles.musicSource}>{item.source}</Text>
          )}
        </View>
      </TouchableOpacity>
    );
  }, [selected, playingId, handleSelect, togglePreview]);

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>{'< Back'}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Pick Music</Text>
        <Text style={styles.subtitle}>Choose a track to sync with your dance</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        {TABS.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, tab === t.key && styles.tabActive]}
            onPress={() => setTab(t.key)}
          >
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Uploading overlay */}
      {uploading && (
        <View style={styles.uploadingOverlay}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.uploadingText}>Processing audio...</Text>
        </View>
      )}

      {/* Tab content */}
      {tab === 'catalog' && (
        <FlatList
          data={catalog}
          keyExtractor={(item) => item.musicId}
          renderItem={renderMusicItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            loading ? (
              <ActivityIndicator size="small" color="#666" style={{ marginTop: 40 }} />
            ) : (
              <Text style={styles.emptyText}>No music available</Text>
            )
          }
        />
      )}

      {tab === 'extract' && !uploading && (
        <View style={styles.actionArea}>
          <TouchableOpacity style={styles.actionBtn} onPress={handleExtractFromVideo}>
            <Text style={styles.actionBtnIcon}>🎬</Text>
            <Text style={styles.actionBtnText}>Select Video</Text>
            <Text style={styles.actionBtnSub}>We'll extract the audio track and detect BPM</Text>
          </TouchableOpacity>
        </View>
      )}

      {tab === 'upload' && !uploading && (
        <View style={styles.actionArea}>
          <TouchableOpacity style={styles.actionBtn} onPress={handleUploadAudio}>
            <Text style={styles.actionBtnIcon}>🎵</Text>
            <Text style={styles.actionBtnText}>Select Audio File</Text>
            <Text style={styles.actionBtnSub}>MP3, M4A, WAV, or other audio formats</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Bottom bar */}
      <View style={styles.bottomBar}>
        {selected && (
          <View style={styles.selectedBadge}>
            <Text style={styles.selectedText} numberOfLines={1}>
              Selected: {selected.title} ({selected.bpm} BPM)
            </Text>
          </View>
        )}
        <TouchableOpacity
          style={[styles.continueBtn, !selected && styles.continueBtnDisabled]}
          disabled={!selected}
          onPress={handleContinue}
        >
          <Text style={styles.continueBtnText}>Continue with Music</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.skipBtn} onPress={handleSkip}>
          <Text style={styles.skipBtnText}>Skip — Use Trending Sound</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#111' },
  header: { paddingHorizontal: 20, paddingTop: 12 },
  backText: { color: '#888', fontSize: 14, marginBottom: 8 },
  title: { color: '#fff', fontSize: 22, fontWeight: '800' },
  subtitle: { color: '#888', fontSize: 13, marginTop: 2, marginBottom: 12 },

  // Tabs
  tabRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 4 },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#2a2a2a',
    alignItems: 'center',
  },
  tabActive: { backgroundColor: '#fff' },
  tabText: { color: '#999', fontSize: 12, fontWeight: '600' },
  tabTextActive: { color: '#111' },

  // Music list
  list: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 180 },
  musicItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  musicItemSelected: { borderColor: '#ff2d55' },
  musicItemLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 },
  playBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2a2a2a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playIcon: { fontSize: 14, color: '#fff' },
  musicMeta: { flex: 1 },
  musicTitle: { color: '#fff', fontSize: 14, fontWeight: '600' },
  musicArtist: { color: '#888', fontSize: 12, marginTop: 2 },
  musicItemRight: { alignItems: 'flex-end', marginLeft: 8 },
  musicBpm: { color: '#aaa', fontSize: 12, fontWeight: '600' },
  musicSource: { color: '#ff2d55', fontSize: 10, marginTop: 2 },

  // Action area (extract / upload tabs)
  actionArea: { flex: 1, justifyContent: 'center', paddingHorizontal: 32 },
  actionBtn: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
  },
  actionBtnIcon: { fontSize: 48, marginBottom: 12 },
  actionBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  actionBtnSub: { color: '#888', fontSize: 12, marginTop: 6, textAlign: 'center' },

  // Uploading overlay
  uploadingOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadingText: { color: '#ccc', fontSize: 14, marginTop: 12 },

  // Empty state
  emptyText: { color: '#666', fontSize: 14, textAlign: 'center', marginTop: 40 },

  // Bottom bar
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#111',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: '#222',
  },
  selectedBadge: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
  },
  selectedText: { color: '#ff2d55', fontSize: 12, fontWeight: '600' },
  continueBtn: {
    backgroundColor: '#fff',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  continueBtnDisabled: { opacity: 0.3 },
  continueBtnText: { color: '#111', fontSize: 16, fontWeight: '700' },
  skipBtn: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  skipBtnText: { color: '#666', fontSize: 13 },
});

export default MusicPickerScreen;
