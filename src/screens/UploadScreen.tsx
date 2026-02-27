import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Alert, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { startAnimateWithImage } from '../services/jobs';

type UploadNavProp = NativeStackNavigationProp<RootStackParamList, 'Upload'>;

const UploadScreen: React.FC = () => {
  const route = useRoute();
  const navigation = useNavigation<UploadNavProp>();
  const template = (route.params as any)?.template;

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const pickImage = async () => {
    try {
      console.log('pickImage: requesting permission');
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      console.log('pickImage: permission status', status);
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Permission to access photos is required.');
        return;
      }

      console.log('pickImage: launching image library');
      // Support multiple expo-image-picker versions: prefer MediaType, fall back to MediaTypeOptions
      const mediaTypesOption = (ImagePicker as any).MediaType?.Images ?? (ImagePicker as any).MediaTypeOptions?.Images ?? undefined;
      const result = await ImagePicker.launchImageLibraryAsync({
        ...(mediaTypesOption ? { mediaTypes: mediaTypesOption } : {}),
        allowsEditing: false,
        quality: 0.8,
      });

      console.log('PICKER RESULT:', result);

      // new API: result.canceled and result.assets
      if ((result as any).canceled) {
        console.log('User cancelled image picker');
        return;
      }

      const uri = (result as any).assets?.[0]?.uri ?? null;
      if (uri) {
        console.log('Picked URI:', uri);
        setImageUri(uri);
      } else {
        console.log('No URI found in picker result');
        Alert.alert('No image', 'No image URI returned by the picker.');
      }
    } catch (e) {
      console.warn(e);
      Alert.alert('Error', 'Could not pick image');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>{template?.title ?? 'Upload'}</Text>

      <Text style={styles.info}>Clip length: 5 seconds</Text>

      <TouchableOpacity style={styles.button} onPress={pickImage}>
        <Text style={styles.buttonText}>Pick Photo</Text>
      </TouchableOpacity>

      <View style={styles.previewWrapper}>
        {imageUri ? (
          <Image
            source={{ uri: imageUri }}
            style={{ width: '100%', height: 300, borderRadius: 16 }}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderText}>No photo selected</Text>
          </View>
        )}
      </View>

      {imageUri && (
        <TouchableOpacity
          style={[styles.button, { marginTop: 12, opacity: submitting ? 0.6 : 1 }]}
          disabled={submitting}
          onPress={async () => {
            setSubmitting(true);
            try {
              const templateId = template?.id ?? '1';
              const taskId = await startAnimateWithImage(templateId, imageUri!);
              navigation.navigate('Generating', { clipLength: 5, taskId });
            } catch (e: any) {
              console.warn('Animate error:', e);
              Alert.alert('Error', 'Could not reach the server. Is it running?');
            } finally {
              setSubmitting(false);
            }
          }}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Animate</Text>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  header: { fontSize: 22, fontWeight: '700', marginBottom: 8 },
  info: { color: '#666', marginBottom: 12 },
  button: { backgroundColor: '#111', padding: 12, borderRadius: 8, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '600' },
  previewWrapper: { marginTop: 16, overflow: 'hidden', borderRadius: 16 },
  placeholder: { height: 300, backgroundColor: '#f0f0f0', alignItems: 'center', justifyContent: 'center' },
  placeholderText: { color: '#999' },
});

export default UploadScreen;
