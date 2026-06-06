/**
 * no-hands-tvos — Milestone 2
 * Validates: a declarative JSON layout renders through PrimitiveRenderer,
 * focus navigation works on tvOS, and each primitive is screen-visible.
 */

import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { PrimitiveRenderer } from './src/renderer/PrimitiveRenderer';
import type { LayoutDefinition } from './src/renderer/types';
import sampleLayout from './src/fixtures/sample-layout.json';

// The fixture is authored to satisfy the LayoutDefinition contract. The JSON
// import is typed as a plain object by TypeScript, so we narrow once here
// rather than every place we use it.
const layout = sampleLayout as LayoutDefinition;

/**
 * Marker line the smoke test grep's for. If the JS bundle loads but the
 * renderer never mounts we'd see "Running \"app\"" without this — that's the
 * exact "looks blank" failure scenario M2 is supposed to catch.
 */
const RENDERER_MOUNTED_MARKER = 'M2: PrimitiveRenderer mounted';

function App() {
  useEffect(() => {
    console.log(RENDERER_MOUNTED_MARKER);
  }, []);

  return (
    <SafeAreaProvider>
      <View style={styles.container}>
        <PrimitiveRenderer definition={layout} />
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b1020',
  },
});

export default App;
