/**
 * no-hands-tvos — Milestone 1
 * Validates: React Native tvOS builds and runs on Apple TV simulator.
 */

import { Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

function App() {
  return (
    <SafeAreaProvider>
      <View style={styles.container}>
        <Text style={styles.title}>Hello from tvOS</Text>
        <Text style={styles.subtitle}>
          Platform.OS = {Platform.OS} {Platform.isTVOS ? '(tvOS)' : ''}
        </Text>
        <Text style={styles.subtitle}>
          Milestone 1: React Native tvOS works ✓
        </Text>
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b1020',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 80,
  },
  title: {
    color: '#ffffff',
    fontSize: 72,
    fontWeight: '700',
    marginBottom: 32,
  },
  subtitle: {
    color: '#a3b3d4',
    fontSize: 28,
    marginTop: 8,
  },
});

export default App;
