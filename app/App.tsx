/**
 * no-hands-tvos — Milestone 4
 *
 * Loads a component bundle from a remote URL, evaluates it in the M4
 * sandbox, and mounts the resulting component through `ComponentHost`.
 * The end-to-end markers visible to the smoke probe are:
 *
 *   1. RN's own `Running "app"` line — JS bundle started executing.
 *   2. `M4: bundle loaded id=calendar-remote …` — loader resolved.
 *   3. `M3: calendar-remote setup resolved` — ComponentHost ran setup().
 *   4. `M3: calendar-remote layout=["card","countdown","list"]` — first
 *      non-empty render.
 *
 * The in-tree Calendar component (`./src/components/Calendar.ts`) is
 * kept for now as the M4 PR description's open question: whether to
 * delete it post-merge or retain it as a fallback. Smoke is sufficient
 * to answer that during PR review.
 */

import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { CALENDAR_ICAL_URL } from './src/components/calendar-config';
import { CALENDAR_BUNDLE_URL } from './src/components/remote-config';
import { RemoteComponent } from './src/components/RemoteComponent';

function App() {
  return (
    <SafeAreaProvider>
      <View style={styles.container}>
        <RemoteComponent
          bundleUrl={CALENDAR_BUNDLE_URL}
          config={{ icalUrl: CALENDAR_ICAL_URL }}
        />
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
