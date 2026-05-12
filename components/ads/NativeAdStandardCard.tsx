import { useCallback, useEffect, useState } from 'react'
import { Image, LayoutChangeEvent, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native'
import { formatNativeAdStarString } from '@/lib/ads/nativeAdStar'
import { sharedNativeAdStyles } from '@/lib/ads/nativeAdCardStyles'
import {
  NativeAd,
  NativeAdView,
  NativeAsset,
  NativeAssetType,
  NativeMediaView,
} from 'react-native-google-mobile-ads'

type Props = {
  nativeAd: NativeAd
  /** 例: AI プラン作成中の `maxWidth` など */
  adViewStyle?: StyleProp<ViewStyle>
}

const iconPh = { width: 0, height: 0 }

export function NativeAdStandardCard({ nativeAd, adViewStyle }: Props) {
  const starLine = formatNativeAdStarString(nativeAd.starRating)
  const [mediaH, setMediaH] = useState(120)

  const onMediaRowLayout = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width
    const floored = Math.floor(w)
    if (floored <= 0) return
    const h16_9 = Math.floor((floored * 9) / 16)
    setMediaH((prev) => (prev === Math.max(120, h16_9) ? prev : Math.max(120, h16_9)))
  }, [])

  useEffect(() => {
    setMediaH(120)
  }, [nativeAd])

  return (
    <NativeAdView nativeAd={nativeAd} style={[sharedNativeAdStyles.adCard, adViewStyle]} collapsable={false}>
      <View style={sharedNativeAdStyles.adLabelRow}>
        <Text style={sharedNativeAdStyles.adLabel}>広告</Text>
        <Text style={sharedNativeAdStyles.adInfo} accessibilityLabel="Ad info">ⓘ</Text>
      </View>

      <View style={sharedNativeAdStyles.mediaRow} onLayout={onMediaRowLayout}>
        <NativeMediaView resizeMode="cover" style={[sharedNativeAdStyles.mediaView, { height: mediaH, minWidth: 120, minHeight: 120 }]} />
      </View>

      <View style={sharedNativeAdStyles.adContent}>
        <View style={sharedNativeAdStyles.headBodyRow}>
          <NativeAsset assetType={NativeAssetType.ICON}>
            {nativeAd.icon?.url ? (
              <Image
                source={{ uri: nativeAd.icon.url }}
                style={sharedNativeAdStyles.icon}
                resizeMode="cover"
                accessibilityIgnoresInvertColors
              />
            ) : (
              <View style={iconPh} />
            )}
          </NativeAsset>

          <View style={sharedNativeAdStyles.headBodyStack}>
            <NativeAsset assetType={NativeAssetType.HEADLINE}>
              <Text style={sharedNativeAdStyles.headline} numberOfLines={2} ellipsizeMode="tail">
                {nativeAd.headline || '\u00a0'}
              </Text>
            </NativeAsset>
            <NativeAsset assetType={NativeAssetType.BODY}>
              <Text style={sharedNativeAdStyles.body} numberOfLines={2} ellipsizeMode="tail">
                {nativeAd.body || '\u00a0'}
              </Text>
            </NativeAsset>
          </View>
        </View>

        <NativeAsset assetType={NativeAssetType.STAR_RATING}>
          <View style={styles.starWrap} pointerEvents="none">
            {starLine == null ? null : <Text style={sharedNativeAdStyles.starText} numberOfLines={1}>{starLine}</Text>}
          </View>
        </NativeAsset>

        <View style={sharedNativeAdStyles.footer}>
          <NativeAsset assetType={NativeAssetType.ADVERTISER}>
            <Text style={sharedNativeAdStyles.advertiser} numberOfLines={1}>
              {nativeAd.advertiser?.trim() || '\u00a0'}
            </Text>
          </NativeAsset>
          <NativeAsset assetType={NativeAssetType.CALL_TO_ACTION}>
            <View style={sharedNativeAdStyles.ctaButton} accessibilityRole="button">
              <Text style={sharedNativeAdStyles.ctaText}>{nativeAd.callToAction || ' '}</Text>
            </View>
          </NativeAsset>
        </View>
      </View>
    </NativeAdView>
  )
}

const styles = StyleSheet.create({
  starWrap: {
    minHeight: 0,
  },
})
