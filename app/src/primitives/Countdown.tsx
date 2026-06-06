import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from './Text';

export type CountdownProps = {
  /** ISO-8601 timestamp the countdown is targeting. */
  target: string;
  label?: string;
};

/**
 * Live countdown to an ISO timestamp. Shown as `Dd HHh MMm SSs` once we're
 * more than a day out, then collapses to `HH:MM:SS`, and finally to a
 * 'Starts now' / 'Started Xs ago' message once the target passes.
 */
export function Countdown({ target, label }: CountdownProps) {
  const targetMs = Date.parse(target);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (Number.isNaN(targetMs)) {
      return;
    }
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [targetMs]);

  if (Number.isNaN(targetMs)) {
    return (
      <View testID="countdown" style={styles.container}>
        {label ? <Text style={styles.label}>{label}</Text> : null}
        <Text style={styles.value}>invalid target</Text>
      </View>
    );
  }

  const diffMs = targetMs - now;
  const display = formatDiff(diffMs);

  return (
    <View testID="countdown" style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Text style={styles.value}>{display}</Text>
    </View>
  );
}

export function formatDiff(diffMs: number): string {
  if (diffMs <= 0) {
    const elapsed = Math.floor(-diffMs / 1000);
    if (elapsed < 5) return 'Starts now';
    return `Started ${elapsed}s ago`;
  }
  const totalSecs = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSecs / 86400);
  const hours = Math.floor((totalSecs % 86400) / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;

  if (days > 0) {
    return `${days}d ${pad(hours)}h ${pad(mins)}m ${pad(secs)}s`;
  }
  return `${pad(hours)}:${pad(mins)}:${pad(secs)}`;
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 12,
    paddingHorizontal: 36,
    paddingVertical: 24,
    borderRadius: 18,
    backgroundColor: '#10182f',
    alignItems: 'center',
  },
  label: {
    fontSize: 22,
    color: '#a3b3d4',
    marginBottom: 6,
  },
  value: {
    fontSize: 56,
    fontWeight: '700',
    color: '#ffffff',
    fontVariant: ['tabular-nums'],
  },
});
