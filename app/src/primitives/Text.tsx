import { Text as RNText, StyleSheet, type TextProps } from 'react-native';

/**
 * Styled text primitive. A thin wrapper over RN's <Text> so that all primitive
 * text shares a consistent default colour/size on the dark background. Callers
 * can still pass a `style` to override.
 */
export type PrimitiveTextProps = TextProps & {
  children?: React.ReactNode;
};

export function Text({ style, children, ...rest }: PrimitiveTextProps) {
  return (
    <RNText style={[styles.text, style]} {...rest}>
      {children}
    </RNText>
  );
}

const styles = StyleSheet.create({
  text: {
    color: '#ffffff',
    fontSize: 28,
  },
});
