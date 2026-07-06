const path = require('path')
const { getDefaultConfig } = require('expo/metro-config')

const projectRoot = __dirname
const config = getDefaultConfig(projectRoot)

function adsEnabledEnv(): boolean {
  const raw = process.env.EXPO_PUBLIC_ADS_ENABLED
  return raw === 'true' || raw === '1'
}

if (!adsEnabledEnv()) {
  config.resolver.extraNodeModules = {
    ...(config.resolver.extraNodeModules ?? {}),
    'react-native-google-mobile-ads': path.resolve(projectRoot, 'lib/ads/google-mobile-ads-stub.ts'),
  }
}

module.exports = config
