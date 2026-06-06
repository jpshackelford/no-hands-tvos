import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from './Text';

export type CardProps = {
  title: string;
  subtitle?: string;
  content?: string;
  /** Default true on tvOS — pass false to render a non-interactive card. */
  focusable?: boolean;
  onPress?: () => void;
  /** Causes this Card to grab initial focus on mount (tvOS only). */
  hasTVPreferredFocus?: boolean;
};

/**
 * A focusable container with a title + optional subtitle/content body.
 *
 * On tvOS, `Pressable` is the lowest-overhead focusable primitive — see
 * AGENTS.md "React Native tvOS focus engine reminders". We drive the focus
 * visual from `onFocus`/`onBlur` rather than reaching for reanimated.
 */
export function Card({
  title,
  subtitle,
  content,
  focusable = true,
  onPress,
  hasTVPreferredFocus,
}: CardProps) {
  const [focused, setFocused] = useState(false);

  if (!focusable) {
    return (
      <View
        testID="card"
        accessibilityLabel={title}
        style={[styles.card, styles.cardStatic]}>
        <CardBody title={title} subtitle={subtitle} content={content} />
      </View>
    );
  }

  return (
    <Pressable
      testID="card"
      accessibilityRole="button"
      accessibilityLabel={title}
      hasTVPreferredFocus={hasTVPreferredFocus}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[styles.card, focused && styles.cardFocused]}>
      <CardBody title={title} subtitle={subtitle} content={content} />
    </Pressable>
  );
}

function CardBody({
  title,
  subtitle,
  content,
}: Pick<CardProps, 'title' | 'subtitle' | 'content'>) {
  return (
    <>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {content ? <Text style={styles.content}>{content}</Text> : null}
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1b2340',
    borderRadius: 18,
    paddingHorizontal: 36,
    paddingVertical: 28,
    marginVertical: 12,
    borderWidth: 3,
    borderColor: 'transparent',
  },
  cardStatic: {
    opacity: 0.85,
  },
  cardFocused: {
    borderColor: '#7aa2ff',
    transform: [{ scale: 1.04 }],
  },
  title: {
    fontSize: 40,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 26,
    color: '#a3b3d4',
  },
  content: {
    fontSize: 22,
    color: '#cfd8ef',
    marginTop: 8,
  },
});
