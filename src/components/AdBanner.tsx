import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { colors } from '../theme';

// AdMob unit IDs — replace with real IDs before publishing
// Use test IDs during development
const AD_UNIT_ID = Platform.select({
  ios: 'ca-app-pub-3940256099942544/2934735716',     // test ID
  android: 'ca-app-pub-3940256099942544/6300978111', // test ID
  default: '',
});

let BannerAd: React.ComponentType<any> | null = null;
let BannerAdSize: any = null;

try {
  const admob = require('react-native-google-mobile-ads');
  BannerAd = admob.BannerAd;
  BannerAdSize = admob.BannerAdSize;
} catch {
  // AdMob not available in Expo Go — renders empty slot
}

export function AdBanner() {
  return (
    <View style={styles.container}>
      {BannerAd && BannerAdSize ? (
        <BannerAd
          unitId={AD_UNIT_ID}
          size={BannerAdSize.BANNER}
          requestOptions={{ requestNonPersonalizedAdsOnly: false }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    minHeight: 50,
  },
});
