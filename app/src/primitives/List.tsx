import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from './Text';
import type { ListItem } from '../renderer/types';

export type ListProps = {
  items: ListItem[];
  onItemPress?: (item: ListItem, index: number) => void;
};

/**
 * Vertical list of focusable rows. Each row is its own `Pressable` so the
 * tvOS focus engine can move between them naturally (up/down on the Siri
 * Remote). We use a plain `View` container rather than `FlatList` because
 * focus interactions with virtualised lists on tvOS have rough edges and the
 * list lengths in this milestone are tiny.
 */
export function List({ items, onItemPress }: ListProps) {
  return (
    <View testID="list" style={styles.list}>
      {items.map((item, idx) => (
        <ListRow
          key={`${idx}-${item.title}`}
          item={item}
          onPress={onItemPress ? () => onItemPress(item, idx) : undefined}
        />
      ))}
    </View>
  );
}

function ListRow({
  item,
  onPress,
}: {
  item: ListItem;
  onPress?: () => void;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      testID="list-row"
      accessibilityRole="button"
      accessibilityLabel={item.title}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[styles.row, focused && styles.rowFocused]}>
      <Text style={styles.rowTitle}>{item.title}</Text>
      {item.subtitle ? (
        <Text style={styles.rowSubtitle}>{item.subtitle}</Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: {
    marginVertical: 12,
  },
  row: {
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 12,
    marginVertical: 4,
    backgroundColor: '#141a30',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  rowFocused: {
    borderColor: '#7aa2ff',
    backgroundColor: '#1f2a52',
    transform: [{ scale: 1.02 }],
  },
  rowTitle: {
    fontSize: 28,
  },
  rowSubtitle: {
    fontSize: 20,
    color: '#a3b3d4',
  },
});
