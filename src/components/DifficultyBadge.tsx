import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const COLORS: Record<string, string> = {
  Easy: '#2ecc71',
  Medium: '#f39c12',
  Hard: '#e74c3c',
};

type Props = { difficulty: 'Easy' | 'Medium' | 'Hard' };

const DifficultyBadge: React.FC<Props> = ({ difficulty }) => (
  <View style={[styles.pill, { backgroundColor: COLORS[difficulty] ?? '#888' }]}>
    <Text style={styles.text}>{difficulty}</Text>
  </View>
);

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  text: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
});

export default DifficultyBadge;
