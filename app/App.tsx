/**
 * no-hands-tvos — Milestone 3
 *
 * Mounts the Calendar component through ComponentHost: setup() fetches an
 * iCal feed over HTTPS, parses it on Hermes, and feeds the resulting state
 * into the M2 PrimitiveRenderer. ComponentHost logs `M3: calendar setup
 * resolved` once setup() resolves — the smoke test greps for that marker.
 */

import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { calendarComponent } from './src/components/Calendar';
import { CALENDAR_ICAL_URL } from './src/components/calendar-config';
import { ComponentHost } from './src/runtime/ComponentHost';

function App() {
  return (
    <SafeAreaProvider>
      <View style={styles.container}>
        <ComponentHost
          component={calendarComponent}
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
