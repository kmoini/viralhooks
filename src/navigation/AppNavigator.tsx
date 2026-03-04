import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import TemplateGridScreen from '../screens/TemplateGridScreen';
import MusicPickerScreen from '../screens/MusicPickerScreen';
import GenerateScreen from '../screens/GenerateScreen';
import ResultScreen from '../screens/ResultScreen';
import type { MusicInfo } from '../types/music';

export type SoundInfo = {
  soundId: string;
  soundName: string;
  bpm: number;
  dropTimeSec: number;
  tiktokUrl: string;
  energyType?: string;
};

export { MusicInfo };

export type RootStackParamList = {
  TemplateGrid: undefined;
  MusicPicker: { templateId: string };
  Generate: {
    templateId: string;
    music?: MusicInfo;
  };
  Result: {
    videoUrl: string;
    templateId: string;
    sound?: SoundInfo;
    music?: MusicInfo;
    mixMode?: 'withMusic' | 'mute';
  };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const AppNavigator: React.FC = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator id="RootStack" screenOptions={{ headerShown: false }}>
        <Stack.Screen name="TemplateGrid" component={TemplateGridScreen} />
        <Stack.Screen name="MusicPicker" component={MusicPickerScreen} />
        <Stack.Screen name="Generate" component={GenerateScreen} />
        <Stack.Screen name="Result" component={ResultScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;
