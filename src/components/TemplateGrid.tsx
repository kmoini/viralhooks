import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  Dimensions,
} from 'react-native';
import { danceTemplates } from '../config/danceTemplates';
import { DanceTemplate } from '../types/DanceTemplate';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

const numColumns = 2;
const { width } = Dimensions.get('window');
const CARD_MARGIN = 12;
const CARD_SIZE = (width - CARD_MARGIN * (numColumns + 1)) / numColumns;

const TemplateGrid: React.FC = () => {
  const navigation = useNavigation<NavProp>();

  const renderItem = ({ item }: { item: DanceTemplate }) => (
    <TouchableOpacity
      activeOpacity={0.85}
      style={styles.cardWrapper}
      onPress={() => {
        if (item.enabled) {
          navigation.navigate('Upload', { template: item });
        } else {
          Alert.alert('Coming soon');
        }
      }}
    >
      <View style={styles.card}>
        <Text style={styles.title}>{item.title}</Text>
        {!item.enabled && (
          <View style={styles.overlay} pointerEvents="none">
            <Text style={styles.overlayText}>Coming Soon</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <FlatList
      data={danceTemplates}
      keyExtractor={(t) => String(t.id)}
      renderItem={renderItem}
      numColumns={numColumns}
      contentContainerStyle={styles.list}
      showsVerticalScrollIndicator={false}
    />
  );
};

const styles = StyleSheet.create({
  list: {
    padding: CARD_MARGIN,
  },
  cardWrapper: {
    flex: 1,
    padding: CARD_MARGIN / 2,
  },
  card: {
    height: CARD_SIZE,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e6e6e6',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  title: {
    fontSize: 16,
    color: '#222',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  overlayText: {
    color: '#fff',
    fontWeight: '600',
  },
});

export default TemplateGrid;
