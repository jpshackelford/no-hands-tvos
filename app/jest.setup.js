/* eslint-env jest, node */
// Inline mock of react-native-safe-area-context.
// The real package defers rendering until native inset measurements come back,
// which never happens under react-test-renderer. The package ships a
// jest mock at react-native-safe-area-context/jest/mock but it's ESM and the
// RN Jest preset doesn't transform it. So we ship our own equivalent.
jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const { View } = require('react-native');
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  const frame = { x: 0, y: 0, width: 0, height: 0 };
  const passthrough = (props) => React.createElement(View, props, props.children);
  return {
    SafeAreaProvider: passthrough,
    SafeAreaView: passthrough,
    SafeAreaInsetsContext: React.createContext(insets),
    SafeAreaFrameContext: React.createContext(frame),
    useSafeAreaInsets: () => insets,
    useSafeAreaFrame: () => frame,
    initialWindowMetrics: { insets, frame },
    withSafeAreaInsets: (Comp) => (props) =>
      React.createElement(Comp, { ...props, insets }),
  };
});
