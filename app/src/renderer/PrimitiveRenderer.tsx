import { StyleSheet, View } from 'react-native';
import { Card } from '../primitives/Card';
import { Countdown } from '../primitives/Countdown';
import { List } from '../primitives/List';
import { Text } from '../primitives/Text';
import type { LayoutDefinition, PrimitiveDefinition } from './types';

export type PrimitiveRendererProps = {
  definition: PrimitiveDefinition | LayoutDefinition;
};

/**
 * Render a primitive definition (or a top-level `{ layout: [...] }`) into
 * actual RN components. Unknown `type` values render a fallback Text so
 * authoring mistakes surface visibly rather than silently producing a
 * blank screen.
 */
export function PrimitiveRenderer({ definition }: PrimitiveRendererProps) {
  if ('layout' in definition) {
    return (
      <View testID="primitive-layout" style={styles.layout}>
        {definition.layout.map((node, idx) => (
          <PrimitiveRenderer key={idx} definition={node} />
        ))}
      </View>
    );
  }

  switch (definition.type) {
    case 'card':
      return (
        <Card
          title={definition.title}
          subtitle={definition.subtitle}
          content={definition.content}
          focusable={definition.focusable}
        />
      );
    case 'list':
      return <List items={definition.items} />;
    case 'countdown':
      return (
        <Countdown target={definition.target} label={definition.label} />
      );
    case 'text':
      return <Text>{definition.text}</Text>;
    default: {
      // Exhaustiveness check at compile time; runtime fallback at runtime.
      const unknown = definition as { type: string };
      return <Text testID="unknown-primitive">Unknown: {unknown.type}</Text>;
    }
  }
}

const styles = StyleSheet.create({
  layout: {
    paddingHorizontal: 80,
    paddingVertical: 40,
  },
});
