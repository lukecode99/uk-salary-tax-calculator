/**
 * Web stubs for the ad SDK — see ./ads.ts for why these exist.
 *
 * Types are deliberately not imported from the real package: pulling its types
 * in would pull its module graph in with them, which is the exact thing this
 * file exists to avoid.
 */
import type { ComponentType } from 'react';

/** Resolves immediately; there is no web SDK to initialise. */
export const mobileAds = () => ({
  initialize: () => Promise.resolve([]),
});

/** Renders nothing. No height is reserved for the banner in the layout, so its
 * absence leaves no gap on web. */
export const BannerAd: ComponentType<Record<string, unknown>> = () => null;

export const BannerAdSize = {
  ANCHORED_ADAPTIVE_BANNER: 'ANCHORED_ADAPTIVE_BANNER',
} as const;

export const TestIds = {
  BANNER: '',
} as const;
