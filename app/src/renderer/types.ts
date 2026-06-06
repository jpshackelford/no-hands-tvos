/**
 * Discriminated union of UI primitives the renderer knows how to draw.
 *
 * Adding a new primitive: extend `PrimitiveDefinition`, implement the
 * component under `primitives/`, and add a `case` to `PrimitiveRenderer`.
 */

export type CardDefinition = {
  type: 'card';
  title: string;
  subtitle?: string;
  content?: string;
  focusable?: boolean;
};

export type ListItem = {
  title: string;
  subtitle?: string;
};

export type ListDefinition = {
  type: 'list';
  items: ListItem[];
};

export type CountdownDefinition = {
  type: 'countdown';
  /** ISO-8601 timestamp the countdown is targeting. */
  target: string;
  label?: string;
};

export type TextDefinition = {
  type: 'text';
  text: string;
};

export type PrimitiveDefinition =
  | CardDefinition
  | ListDefinition
  | CountdownDefinition
  | TextDefinition;

export type LayoutDefinition = {
  layout: PrimitiveDefinition[];
};
