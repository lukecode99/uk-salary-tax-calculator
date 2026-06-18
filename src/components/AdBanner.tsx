import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

// AdMob is enabled in production builds only (EAS Build with react-native-google-mobile-ads).
// In Expo Go this renders a placeholder slot.
export function AdBanner() {
  return <View style={styles.container}><Text style={styles.text}>Ad</Text></View>;
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 1,
    borderTopColor: '#2A2A2A',
    height: 50,
  },
  text: { color: '#333', fontSize: 11, letterSpacing: 0.08, textTransform: 'uppercase' },
});
