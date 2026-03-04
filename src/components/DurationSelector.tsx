import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

// Server only accepts 5s for now
const OPTIONS = [5];

type Props = {
  selected: number;
  onChange: (val: number) => void;
};

const DurationSelector: React.FC<Props> = ({ selected, onChange }) => (
  <View style={styles.row}>
    {OPTIONS.map((s) => (
      <TouchableOpacity
        key={s}
        style={[styles.pill, selected === s && styles.pillActive]}
        onPress={() => onChange(s)}
      >
        <Text style={[styles.text, selected === s && styles.textActive]}>{s}s</Text>
      </TouchableOpacity>
    ))}
  </View>
);

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10 },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#2a2a2a',
  },
  pillActive: {
    backgroundColor: '#fff',
  },
  text: {
    color: '#999',
    fontSize: 14,
    fontWeight: '600',
  },
  textActive: {
    color: '#111',
  },
});

export default DurationSelector;
