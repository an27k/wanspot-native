const path = require('path')
const { getDefaultConfig } = require('expo/metro-config')

const projectRoot = __dirname
const config = getDefaultConfig(projectRoot)

function adsEnabledEnv() {
  const raw = process.env.EXPO_PUBLIC_ADS_ENABLED
  return raw === 'true' || raw === '1'
}

if (!adsEnabledEnv()) {
  config.resolver.extraNodeModules = {
    ...(config.resolver.extraNodeModules ?? {}),
    'react-native-google-mobile-ads': path.resolve(projectRoot, 'lib/ads/google-mobile-ads-stub.ts'),
    // ATT は広告のためだけに使う。広告が無効ならダイアログは一度も出ないので、
    // フレームワークごと外す。残すと「ATT を使っているのに許可を求めない」
    // として審査で 2.1 の差し戻しになる（2026-08-12 実際に指摘を受けた）。
    'expo-tracking-transparency': path.resolve(projectRoot, 'lib/ads/tracking-transparency-stub.ts'),
  }
}

module.exports = config
