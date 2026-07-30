/**
 * Every ad import in the app goes through this module.
 *
 * `react-native-google-mobile-ads` reaches into react-native internals
 * (`Libraries/Utilities/codegenNativeComponent`), which Metro refuses to bundle
 * for web — so importing it anywhere in the tree kills `expo export --platform
 * web` outright, wherever it sits. Metro resolves `ads.web.ts` ahead of this
 * file when building for web, so native gets the real SDK and web gets inert
 * stubs, and neither side needs a `Platform.OS` check at the call site.
 */
export {
  default as mobileAds,
  BannerAd,
  BannerAdSize,
  TestIds,
} from 'react-native-google-mobile-ads';
