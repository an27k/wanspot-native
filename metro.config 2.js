const path = require('path')
const { getDefaultConfig } = require('expo/metro-config')

const projectRoot = __dirname
const config = getDefaultConfig(projectRoot)

function adsEnabledEnv() {
  const raw = process.env.EXPO_PUBLIC_ADS_ENABLED
  return raw === 'true' || raw === '1'
}

/*
  広告が無効なときに、本物の代わりに読ませるスタブ。

  **extraNodeModules は使わない。** あれは「node_modules で解決できなかったとき」の
  代替でしかなく、パッケージが実在する限り無視される。実際 2026-08-12 のビルド245で、
  expo-tracking-transparency の本物が読み込まれ

      import { requireNativeModule } from 'expo-modules-core'
      export default requireNativeModule('ExpoTrackingTransparency')  // ← 例外

  が import の瞬間に throw した（autolinking から外してネイティブ側を消したため）。
  結果 prepare-search-ads → ArticlesTabScreen / NearbyListScreen の評価が失敗し、
  まとめ記事と近くのスポット一覧が真っ白になった。

  resolveRequest は解決処理そのものを差し替えるので、node_modules に実体があっても
  必ずスタブが勝つ。
*/
const ADS_ONLY_STUBS = {
  'react-native-google-mobile-ads': path.resolve(projectRoot, 'lib/ads/google-mobile-ads-stub.ts'),
  'expo-tracking-transparency': path.resolve(projectRoot, 'lib/ads/tracking-transparency-stub.ts'),
}

if (!adsEnabledEnv()) {
  config.resolver.resolveRequest = (context, moduleName, platform) => {
    const stub = ADS_ONLY_STUBS[moduleName]
    if (stub) return { type: 'sourceFile', filePath: stub }
    return context.resolveRequest(context, moduleName, platform)
  }
}

module.exports = config
