function adsEnabledEnv() {
  const raw = process.env.EXPO_PUBLIC_ADS_ENABLED
  return raw === 'true' || raw === '1'
}

/** ADS_ENABLED=false 時は AdMob ネイティブ SDK を autolink しない */
module.exports = {
  dependencies: adsEnabledEnv()
    ? {}
    : {
        'react-native-google-mobile-ads': {
          platforms: {
            ios: null,
            android: null,
          },
        },
      },
}
