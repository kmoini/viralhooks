import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import type { MusicInfo } from '../types/music';
import { DANCE_TEMPLATES } from '../templates/templates';
import DifficultyBadge from '../components/DifficultyBadge';
import DurationSelector from '../components/DurationSelector';
import { startAnimateWithImage, startViralRender, startMusicRender, getTask } from '../services/jobs';
import type { EnergyType } from '../services/jobs';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'Generate'>;

type Phase = 'setup' | 'uploading' | 'generating' | 'finalizing';

const STYLE_OPTIONS = ['Funny', 'Cool', 'Dramatic'] as const;
type StyleOption = (typeof STYLE_OPTIONS)[number];

const ENERGY_OPTIONS: EnergyType[] = ['hype', 'smooth', 'meme'];

const MAX_POLL_ATTEMPTS = 200;

const GenerateScreen: React.FC = () => {
  const route = useRoute();
  const navigation = useNavigation<NavProp>();
  const params = route.params as { templateId: string; music?: MusicInfo } | undefined;
  const templateId = params?.templateId ?? '';
  const music = params?.music ?? null;
  const template = DANCE_TEMPLATES.find((t) => t.id === templateId);

  // Server only accepts durationSeconds=5 for now
  const [duration, setDuration] = useState(5);
  const [style, setStyle] = useState<StyleOption>('Cool');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('setup');
  const [isViral, setIsViral] = useState(false);
  const [energyType, setEnergyType] = useState<EnergyType>('hype');
  const [mixMode, setMixMode] = useState<'withMusic' | 'mute'>('withMusic');

  // If music is provided, default to music mode (not viral)
  const hasMusic = !!music;

  // Polling refs
  const doneRef = useRef(false);
  const attemptsRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      doneRef.current = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const pickImage = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Permission to access photos is required.');
      return;
    }
    const mediaTypesOption =
      (ImagePicker as any).MediaType?.Images ??
      (ImagePicker as any).MediaTypeOptions?.Images ??
      undefined;
    const result = await ImagePicker.launchImageLibraryAsync({
      ...(mediaTypesOption ? { mediaTypes: mediaTypesOption } : {}),
      allowsEditing: false,
      quality: 0.8,
    });
    if ((result as any).canceled) return;
    const uri = (result as any).assets?.[0]?.uri ?? null;
    if (uri) setImageUri(uri);
  }, []);

  const startPolling = useCallback(
    (taskId: string) => {
      doneRef.current = false;
      attemptsRef.current = 0;
      setPhase('generating');

      intervalRef.current = setInterval(async () => {
        if (doneRef.current) return;
        try {
          attemptsRef.current += 1;
          if (attemptsRef.current >= MAX_POLL_ATTEMPTS && !doneRef.current) {
            doneRef.current = true;
            if (intervalRef.current) clearInterval(intervalRef.current);
            Alert.alert('Timed out', 'Generation took too long. Please try again.');
            setPhase('setup');
            return;
          }

          const result = await getTask(taskId);

          if (result.status === 'SUCCEEDED' && result.videoUrl && !doneRef.current) {
            doneRef.current = true;
            if (intervalRef.current) clearInterval(intervalRef.current);
            setPhase('finalizing');
            // DEBUG: log what the backend returned
            console.log('[NAV TO RESULT] sound:', JSON.stringify(result.sound));
            console.log('[NAV TO RESULT] timingsApplied:', JSON.stringify(result.timingsApplied));
            // Small delay so the user sees "Finalizing" before transition
            setTimeout(() => {
              navigation.navigate('Result', {
                videoUrl: result.videoUrl!,
                templateId: result.templateId ?? templateId,
                ...(result.sound ? { sound: result.sound } : {}),
                ...(result.music ? { music: result.music as MusicInfo } : music ? { music } : {}),
                ...(result.mixMode ? { mixMode: result.mixMode } : {}),
              });
            }, 600);
          }

          if (result.status === 'FAILED' && !doneRef.current) {
            doneRef.current = true;
            if (intervalRef.current) clearInterval(intervalRef.current);
            Alert.alert('Generation failed', 'The server reported an error.');
            setPhase('setup');
          }
        } catch (e: any) {
          const isTimeout =
            e?.code === 'ECONNABORTED' || e?.message?.includes('timeout');
          if (isTimeout) return; // silent retry

          const is404 =
            e?.response?.status === 404 ||
            e?.response?.data?.error?.includes('Task not found') ||
            e?.message?.includes('404');
          if (is404 && !doneRef.current) {
            doneRef.current = true;
            if (intervalRef.current) clearInterval(intervalRef.current);
            Alert.alert('Task not found', 'The server was restarted. Please try again.');
            setPhase('setup');
          }
        }
      }, 2000);
    },
    [navigation, templateId],
  );

  const handleGenerate = useCallback(async () => {
    if (!imageUri || !template) return;
    setPhase('uploading');
    try {
      let taskId: string;
      if (hasMusic) {
        // Music-synced render (new flow)
        console.log('[MUSIC] Starting music render, musicId:', music!.musicId, 'mixMode:', mixMode);
        taskId = await startMusicRender(imageUri, templateId, music!.musicId, mixMode, 8);
      } else if (isViral) {
        console.log('[VIRAL] Starting viral render, energyType:', energyType);
        taskId = await startViralRender(imageUri, energyType, 8);
      } else {
        taskId = await startAnimateWithImage(
          templateId,
          imageUri,
          duration,
          style,
        );
      }
      startPolling(taskId);
    } catch (e: any) {
      console.warn('Generate error:', e);
      const msg = hasMusic
        ? 'Music render failed. Check that the server is running.'
        : isViral
        ? 'Viral render failed. Try turning Viral Mode off, or check that the server is running.'
        : 'Could not reach the server. Is it running?';
      Alert.alert('Error', msg);
      setPhase('setup');
    }
  }, [imageUri, template, templateId, duration, style, isViral, energyType, hasMusic, music, mixMode, startPolling]);

  if (!template) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.errorText}>Template not found</Text>
      </SafeAreaView>
    );
  }

  // --- Generating / progress overlay ---
  if (phase !== 'setup') {
    const phaseLabel: Record<Phase, string> = {
      setup: '',
      uploading: 'Uploading selfie...',
      generating: 'Generating dance...',
      finalizing: 'Finalizing video...',
    };
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.progressContainer}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.progressText}>{phaseLabel[phase]}</Text>
          <Text style={styles.progressSub}>This can take a few minutes</Text>
        </View>
      </SafeAreaView>
    );
  }

  // --- Setup UI ---
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Back button */}
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={styles.backText}>{'< Back'}</Text>
        </TouchableOpacity>

        {/* Template info */}
        <Text style={styles.templateName}>{template.name}</Text>
        <View style={styles.metaRow}>
          <DifficultyBadge difficulty={template.difficulty} />
          <Text style={styles.bpm}>{template.bpm} BPM</Text>
          <Text style={styles.category}>{template.category}</Text>
        </View>

        {/* Selfie picker */}
        <Text style={styles.sectionTitle}>Your selfie</Text>
        <TouchableOpacity style={styles.imagePicker} onPress={pickImage}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.selfieImage} resizeMode="contain" />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Text style={styles.imagePlaceholderText}>Tap to pick a photo</Text>
            </View>
          )}
        </TouchableOpacity>
        {imageUri && (
          <Text style={styles.selfieTip}>Tip: Center your face for best dance results.</Text>
        )}

        {/* Music info (when user picked music) */}
        {hasMusic && (
          <>
            <Text style={styles.sectionTitle}>Music</Text>
            <View style={styles.musicBadge}>
              <Text style={styles.musicIcon}>{'♪'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.musicTitle}>{music!.title}</Text>
                <Text style={styles.musicArtist}>{music!.artist} — {music!.bpm} BPM{!music!.bpmDetected ? ' (est.)' : ''}</Text>
              </View>
            </View>

            {/* Mix mode toggle */}
            <Text style={styles.sectionTitle}>Audio</Text>
            <View style={styles.viralRow}>
              <TouchableOpacity
                style={[styles.viralPill, mixMode === 'withMusic' && styles.viralPillViral]}
                onPress={() => setMixMode('withMusic')}
              >
                <Text style={[styles.viralText, mixMode === 'withMusic' && styles.viralTextViral]}>With Music</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.viralPill, mixMode === 'mute' && styles.viralPillActive]}
                onPress={() => setMixMode('mute')}
              >
                <Text style={[styles.viralText, mixMode === 'mute' && styles.viralTextActive]}>Mute</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.viralHint}>
              {mixMode === 'withMusic'
                ? 'Music will be mixed into the video. Dance is beat-synced.'
                : 'Video will have no audio. Use TikTok\'s own audio when posting.'}
            </Text>
          </>
        )}

        {/* Duration selector (only shown without music) */}
        {!hasMusic && (
          <>
            <Text style={styles.sectionTitle}>Duration</Text>
            <DurationSelector selected={duration} onChange={setDuration} />
          </>
        )}

        {/* Style selector (only shown without music) */}
        {!hasMusic && (
          <>
            <Text style={styles.sectionTitle}>Style</Text>
            <View style={styles.styleRow}>
              {STYLE_OPTIONS.map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[styles.stylePill, style === s && styles.stylePillActive]}
                  onPress={() => setStyle(s)}
                >
                  <Text style={[styles.styleText, style === s && styles.styleTextActive]}>
                    {s}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {/* Viral Mode toggle (only shown without music) */}
        {!hasMusic && (
          <>
            <Text style={styles.sectionTitle}>Mode</Text>
            <View style={styles.viralRow}>
              <TouchableOpacity
                style={[styles.viralPill, !isViral && styles.viralPillActive]}
                onPress={() => setIsViral(false)}
              >
                <Text style={[styles.viralText, !isViral && styles.viralTextActive]}>Normal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.viralPill, isViral && styles.viralPillViral]}
                onPress={() => setIsViral(true)}
              >
                <Text style={[styles.viralText, isViral && styles.viralTextViral]}>Viral</Text>
              </TouchableOpacity>
            </View>
            {isViral && (
              <Text style={styles.viralHint}>
                Matches a trending TikTok sound and syncs the dance to its beat.
              </Text>
            )}
          </>
        )}

        {/* Energy Type picker (only in viral mode without music) */}
        {!hasMusic && isViral && (
          <>
            <Text style={styles.sectionTitle}>Energy</Text>
            <View style={styles.styleRow}>
              {ENERGY_OPTIONS.map((e) => (
                <TouchableOpacity
                  key={e}
                  style={[styles.stylePill, energyType === e && styles.stylePillActive]}
                  onPress={() => setEnergyType(e)}
                >
                  <Text style={[styles.styleText, energyType === e && styles.styleTextActive]}>
                    {e.charAt(0).toUpperCase() + e.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {/* Generate button */}
        <TouchableOpacity
          style={[styles.generateBtn, !imageUri && styles.generateBtnDisabled]}
          disabled={!imageUri}
          onPress={handleGenerate}
        >
          <Text style={styles.generateBtnText}>
            {hasMusic ? 'Generate Beat-Synced Dance' : isViral ? 'Generate Viral Dance' : 'Generate Dance'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#111' },
  scroll: { padding: 20, paddingBottom: 60 },
  back: { marginBottom: 12 },
  backText: { color: '#888', fontSize: 14 },
  templateName: { color: '#fff', fontSize: 22, fontWeight: '800', marginBottom: 8 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 24 },
  bpm: { color: '#aaa', fontSize: 12, fontWeight: '600' },
  category: { color: '#666', fontSize: 12 },
  sectionTitle: { color: '#ccc', fontSize: 14, fontWeight: '600', marginBottom: 8, marginTop: 20 },
  imagePicker: {
    width: '100%',
    height: 260,
    backgroundColor: '#000',
    borderRadius: 12,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selfieImage: { width: '100%', height: '100%' },
  imagePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePlaceholderText: { color: '#666', fontSize: 14 },
  selfieTip: { color: '#888', fontSize: 12, marginTop: 6, textAlign: 'center' },
  styleRow: { flexDirection: 'row', gap: 10 },
  stylePill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#2a2a2a',
  },
  stylePillActive: { backgroundColor: '#fff' },
  styleText: { color: '#999', fontSize: 14, fontWeight: '600' },
  styleTextActive: { color: '#111' },
  viralRow: { flexDirection: 'row', gap: 10 },
  viralPill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#2a2a2a',
    alignItems: 'center',
  },
  viralPillActive: { backgroundColor: '#fff' },
  viralPillViral: { backgroundColor: '#ff2d55' },
  viralText: { color: '#999', fontSize: 14, fontWeight: '600' },
  viralTextActive: { color: '#111' },
  viralTextViral: { color: '#fff' },
  viralHint: { color: '#888', fontSize: 12, marginTop: 6 },
  musicBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    padding: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: '#ff2d55',
  },
  musicIcon: { color: '#ff2d55', fontSize: 20 },
  musicTitle: { color: '#fff', fontSize: 14, fontWeight: '700' },
  musicArtist: { color: '#888', fontSize: 12, marginTop: 2 },
  generateBtn: {
    marginTop: 32,
    backgroundColor: '#fff',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  generateBtnDisabled: { opacity: 0.3 },
  generateBtnText: { color: '#111', fontSize: 16, fontWeight: '700' },
  progressContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  progressText: { color: '#fff', fontSize: 18, fontWeight: '600', marginTop: 16 },
  progressSub: { color: '#666', fontSize: 13, marginTop: 8 },
  errorText: { color: '#e74c3c', fontSize: 16, padding: 20 },
});

export default GenerateScreen;
