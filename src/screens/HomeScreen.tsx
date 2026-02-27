import React from 'react';
import { SafeAreaView, View, StyleSheet } from 'react-native';
import TemplateGrid from '../components/TemplateGrid';

const HomeScreen: React.FC = () => {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.inner}>
        <TemplateGrid />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  inner: { flex: 1 },
});

export default HomeScreen;
