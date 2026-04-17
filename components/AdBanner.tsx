import { BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads'
import { View, Text, Platform, StyleSheet } from 'react-native'

const adUnitId = __DEV__
  ? TestIds.BANNER
  : Platform.select({
      ios: 'ca-app-pub-4709188613454491/3597218434',
      android: 'ca-app-pub-xxxxxxxx/xxxxxxxx',
    }) ?? TestIds.BANNER

type Props = {
  /** 検索タブ側で ATT + SDK 初期化が終わってから true（それまでネイティブ Banner をマウントしない） */
  adsReady: boolean
  /** 画面下部の単一枠用（余白を詰める） */
  footer?: boolean
}

/** 320×50 の標準バナー（一覧に複数挟まないこと） */
export function AdBannerCard({ adsReady, footer }: Props) {
  return (
    <View style={[styles.card, footer && styles.cardFooter]}>
      <Text style={styles.label}>広告</Text>
      {adsReady ? (
        <BannerAd
          unitId={adUnitId}
          size={BannerAdSize.BANNER}
          onAdFailedToLoad={(e) => console.warn(`AdBanner failed: ${String((e as unknown) ?? '')}`)}
        />
      ) : (
        <View style={styles.placeholder} />
      )}
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
    alignItems: 'center',
    paddingBottom: 8,
  },
  cardFooter: {
    marginTop: 4,
    marginBottom: 4,
  },
  label: {
    fontSize: 10,
    color: '#999',
    paddingHorizontal: 8,
    paddingTop: 4,
    alignSelf: 'stretch',
  },
  placeholder: {
    height: 50,
    backgroundColor: '#ebebeb',
  },
})
