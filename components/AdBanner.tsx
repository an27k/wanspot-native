import { BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads'
import { View, Text, Platform, StyleSheet } from 'react-native'

const adUnitId = __DEV__
  ? TestIds.ADAPTIVE_BANNER
  : Platform.select({
      ios: 'ca-app-pub-4709188613454491/3597218434',
      android: 'ca-app-pub-xxxxxxxx/xxxxxxxx',
    }) ?? TestIds.ADAPTIVE_BANNER

export function AdBannerCard() {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>広告</Text>
      <BannerAd
        unitId={adUnitId}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        onAdFailedToLoad={(e) => console.warn('AdBanner failed', e)}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    overflow: 'hidden',
    marginHorizontal: 16,
    marginVertical: 8,
    backgroundColor: '#f5f5f5',
  },
  label: {
    fontSize: 10,
    color: '#999',
    paddingHorizontal: 8,
    paddingTop: 4,
  },
})
