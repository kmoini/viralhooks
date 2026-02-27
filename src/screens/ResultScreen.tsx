import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Video } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';

type ResultRouteProp = RouteProp<RootStackParamList, 'Result'>;
type ResultNavProp = NativeStackNavigationProp<RootStackParamList, 'Result'>;

const ResultScreen: React.FC = () => {
  const route = useRoute<ResultRouteProp>();
  const navigation = useNavigation<ResultNavProp>();
  const params = route.params ?? {};
  const videoUrl: string = params.videoUrl ?? '';
  const clipLength: number = params.clipLength ?? 5;

  const [localUri, setLocalUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const downloadToLocal = async () => {
    try {
      const filename = `snapdance_${Date.now()}.mp4`;
      const path = FileSystem.cacheDirectory + filename;
      const { uri } = await FileSystem.downloadAsync(videoUrl, path);
      return uri;
    } catch (e) {
      console.warn('download error', e);
      return null;
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Permission to access media library is required to save video.');
        setSaving(false);
        return;
      }

      const uri = localUri ?? (await downloadToLocal());
      if (!uri) throw new Error('Failed to download video');
      setLocalUri(uri);

      console.log('Saving file to library:', uri);
      await MediaLibrary.saveToLibraryAsync(uri);
      console.log('saveToLibraryAsync succeeded');

      Alert.alert('Saved', 'Video saved to camera roll — check your Recents album');
    } catch (e) {
      console.warn(e);
      Alert.alert('Error', 'Could not save video');
    } finally {
      setSaving(false);
    }
  };

  const handleShare = async () => {
    try {
      let uri = localUri;
      if (!uri) {
        uri = await downloadToLocal();
        setLocalUri(uri);
      }
      if (!uri) throw new Error('No file to share');

      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert('Sharing not available', 'Sharing is not available on this device');
        return;
      }

      await Sharing.shareAsync(uri);
    } catch (e) {
      console.warn(e);
      Alert.alert('Error', 'Could not share video');
    }
  };

  useEffect(() => {
    // cleanup if needed
    return () => {};
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Result</Text>
      <Text style={styles.sub}>Clip length: {clipLength}s</Text>

      <View style={styles.videoWrapper}>
        <Video
          source={{ uri: videoUrl }}
          rate={1.0}
          volume={1.0}
          resizeMode="cover"
          useNativeControls
          style={styles.video}
        />
      </View>

      <TouchableOpacity style={styles.primary} onPress={handleSave} disabled={saving}>
        <Text style={styles.primaryText}>{saving ? 'Saving…' : 'Save to Camera Roll'}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.primary} onPress={handleShare}>
        <Text style={styles.primaryText}>Share to Social</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.secondary} onPress={() => navigation.navigate('Home')}>
        <Text style={styles.secondaryText}>Try Another</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  header: { fontSize: 22, fontWeight: '700', marginBottom: 6 },
  sub: { color: '#666', marginBottom: 12 },
  videoWrapper: { height: 260, backgroundColor: '#000', borderRadius: 8, overflow: 'hidden' },
  video: { width: '100%', height: '100%' },
  primary: {
    marginTop: 16,
    backgroundColor: '#111',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryText: { color: '#fff', fontWeight: '600' },
  secondary: { marginTop: 12, alignItems: 'center' },
  secondaryText: { color: '#333' },
});

export default ResultScreen;
