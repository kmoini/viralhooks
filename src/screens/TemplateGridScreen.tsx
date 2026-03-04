import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  SafeAreaView,
  ViewToken,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { DANCE_TEMPLATES, DanceTemplate } from '../templates/templates';
import TemplateCard from '../components/TemplateCard';

const CARD_GAP = 12;

type NavProp = NativeStackNavigationProp<RootStackParamList, 'TemplateGrid'>;

const TemplateGridScreen: React.FC = () => {
  const navigation = useNavigation<NavProp>();
  const [visibleIds, setVisibleIds] = useState<Set<string>>(new Set());

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const ids = new Set(viewableItems.map((v) => v.item.id as string));
      setVisibleIds(ids);
    },
  ).current;

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 30 }).current;

  const handlePress = useCallback(
    (template: DanceTemplate) => {
      navigation.navigate('MusicPicker', { templateId: template.id });
    },
    [navigation],
  );

  const renderItem = useCallback(
    ({ item }: { item: DanceTemplate }) => (
      <TemplateCard
        template={item}
        isVisible={visibleIds.has(item.id)}
        onPress={handlePress}
      />
    ),
    [visibleIds, handlePress],
  );

  const keyExtractor = useCallback((item: DanceTemplate) => item.id, []);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>SnapDance</Text>
        <Text style={styles.subtitle}>Pick a move</Text>
      </View>
      <FlatList
        data={DANCE_TEMPLATES}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#111' },
  header: { paddingHorizontal: CARD_GAP, paddingTop: 16, paddingBottom: 8 },
  title: { color: '#fff', fontSize: 28, fontWeight: '800' },
  subtitle: { color: '#888', fontSize: 14, marginTop: 2 },
  list: { paddingHorizontal: CARD_GAP, paddingTop: 12, paddingBottom: 40 },
  row: { justifyContent: 'space-between' },
});

export default TemplateGridScreen;
