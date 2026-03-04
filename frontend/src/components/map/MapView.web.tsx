// Web fallback for react-native-maps (not supported on web)
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

// Stub MapView for web — renders a placeholder box
const MapView = React.forwardRef<any, any>(({ style, children, ...props }, ref) => (
  <View style={[styles.container, style]}>
    <Text style={styles.text}>🗺️ Map not available on web</Text>
    {children}
  </View>
));
MapView.displayName = 'MapView';

// Stub Marker
const Marker = ({ children }: any) => <>{children}</>;

// Stub Circle
const Circle = (_props: any) => null;

// Stub Region type (just a TS helper)
export type Region = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
  },
  text: {
    color: '#aaa',
    fontSize: 14,
  },
});

export default MapView;
export { Marker, Circle };
