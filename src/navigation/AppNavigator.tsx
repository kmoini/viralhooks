import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from '../screens/HomeScreen';
import UploadScreen from '../screens/UploadScreen';
import GeneratingScreen from '../screens/GeneratingScreen';
import ResultScreen from '../screens/ResultScreen';
import { DanceTemplate } from '../types/DanceTemplate';

export type RootStackParamList = {
  Home: undefined;
  Upload: { template: DanceTemplate } | undefined;
  Generating: { clipLength: number; taskId: string } | undefined;
  Result: { videoUrl: string; clipLength: number } | undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const AppNavigator: React.FC = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Upload" component={UploadScreen} />
        <Stack.Screen name="Generating" component={GeneratingScreen} />
        <Stack.Screen name="Result" component={ResultScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;
