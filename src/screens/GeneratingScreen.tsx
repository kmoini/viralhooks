import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { getTask } from '../services/jobs';

type GenNavProp = NativeStackNavigationProp<RootStackParamList, 'Generating'>;

const GeneratingScreen: React.FC = () => {
  const navigation = useNavigation<GenNavProp>();
  const route = useRoute();
  const params = route.params as { clipLength: number; taskId: string };
  const taskId = params?.taskId ?? '';

  // useRef to track whether we already navigated away
  const doneRef = useRef(false);

  useEffect(() => {
    if (!taskId) {
      Alert.alert('Error', 'No taskId provided');
      return;
    }

    // Poll the backend every 2 seconds
    const interval = setInterval(async () => {
      try {
        const result = await getTask(taskId);
        console.log('Poll result:', result);

        if (result.status === 'SUCCEEDED' && result.videoUrl && !doneRef.current) {
          doneRef.current = true;
          clearInterval(interval);
          navigation.navigate('Result', {
            videoUrl: result.videoUrl,
            clipLength: params.clipLength ?? 5,
          });
        }

        if (result.status === 'FAILED' && !doneRef.current) {
          doneRef.current = true;
          clearInterval(interval);
          Alert.alert('Generation failed', 'The server reported an error.');
          navigation.goBack();
        }
      } catch (e) {
        console.warn('Polling error:', e);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [taskId, navigation, params.clipLength]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#111" />
      <Text style={styles.text}>Generating your 5s SnapDance…</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  text: { marginTop: 12, fontSize: 16, color: '#333' },
});

export default GeneratingScreen;
