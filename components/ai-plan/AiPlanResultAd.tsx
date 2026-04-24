import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Image, InteractionManager, StyleSheet, Text, View } from 'react-native'
import { resolveAiPlanResultNativeAdUnitId } from '@/constants/admob'
import { adsEnabledForDevice } from '@/lib/ads-policy'
import { buildNativeAdRequestOptions, enqueueNativeAdRequest } from '@/lib/native-ad-request-queue'
import { prepareSearchTabAdsOnce } from '@/lib/prepare-search-ads'
import {
  NativeAd,
  NativeAdView,
  NativeAsset,
  NativeAssetType,
  NativeMediaAspectRatio,
  NativeMediaView,
} from 'react-native-google-mobile-ads'

const LOAD_MAX_ATTEMPTS = 3

export function AiPlanResultAd() {
  const [nativeAd, setNativeAd] = useState<NativeAd | null>(null)
  const nativeAdRef = useRef<NativeAd | null>(null)
  const loadInFlightRef = useRef(false)

  const adsEnabled = useMemo(() => adsEnabledForDevice(), [])
  const unitId = useMemo(() => (adsEnabled ? resolveAiPlanResultNativeAdUnitId() : null), [adsEnabled])

  useEffect(() => {
    if (!adsEnabled) return
    if (unitId == null) return

    let cancelled = false
    setNativeAd(null)
    loadInFlightRef.current = true

    const attemptLoad = (attemptIdx: number) => {
      if (cancelled) return
      loadInFlightRef.current = true

      void (async () => {
        try {
          await prepareSearchTabAdsOnce()
        } catch {
          if (!cancelled) loadInFlightRef.current = false
          return
        }
        if (cancelled) {
          loadInFlightRef.current = false
          return
        }

        try {
          const requestOptions = await buildNativeAdRequestOptions(attemptIdx, {
            aspectRatio: NativeMediaAspectRatio.SQUARE,
          })
          const ad = await enqueueNativeAdRequest(unitId, requestOptions)
          if (cancelled) {
            ad.destroy()
            loadInFlightRef.current = false
            return
          }
          nativeAdRef.current?.destroy()
          nativeAdRef.current = ad
          setNativeAd(ad)
          loadInFlightRef.current = false
        } catch (e) {
          console.warn(`AiPlanResultAd load failed (${attemptIdx + 1}/${LOAD_MAX_ATTEMPTS}): ${String((e as unknown) ?? '')}`)
          if (cancelled) {
            loadInFlightRef.current = false
            return
          }
          if (attemptIdx + 1 < LOAD_MAX_ATTEMPTS) {
            loadInFlightRef.current = false
            const backoff = 300 + attemptIdx * 350
            setTimeout(() => attemptLoad(attemptIdx + 1), backoff)
          } else {
            loadInFlightRef.current = false
          }
        }
      })()
    }

    const task = InteractionManager.runAfterInteractions(() => {
      const t = setTimeout(() => attemptLoad(0), 200)
      return () => clearTimeout(t)
    })

    return () => {
      cancelled = true
      loadInFlightRef.current = false
      task.cancel()
    }
  }, [adsEnabled, unitId])

  useEffect(() => {
    return () => {
      nativeAdRef.current?.destroy()
      nativeAdRef.current = null
    }
  }, [])

  const renderLeftVisual = useCallback(() => {
    if (!nativeAd) return null
    if (nativeAd.icon?.url) {
      return (
        <NativeAsset assetType={NativeAssetType.ICON}>
          <Image
            source={{ uri: nativeAd.icon.url }}
            style={styles.icon}
            resizeMode="cover"
            accessibilityIgnoresInvertColors
          />
        </NativeAsset>
      )
    }
    return <NativeMediaView resizeMode="cover" style={styles.mediaSmall} />
  }, [nativeAd])

  if (!adsEnabled || unitId == null) return null
  if (!nativeAd) return null

  return (
    <View style={styles.container} collapsable={false}>
      <NativeAdView nativeAd={nativeAd} style={styles.adView} collapsable={false}>
        <View style={styles.prLabel}>
          <Text style={styles.prLabelText}>広告</Text>
        </View>

        <View style={styles.row}>
          {renderLeftVisual()}

          <View style={styles.textContainer}>
            {nativeAd.headline ? (
              <NativeAsset assetType={NativeAssetType.HEADLINE}>
                <Text style={styles.headline} numberOfLines={2}>
                  {nativeAd.headline}
                </Text>
              </NativeAsset>
            ) : null}
            {nativeAd.body ? (
              <NativeAsset assetType={NativeAssetType.BODY}>
                <Text style={styles.body} numberOfLines={2}>
                  {nativeAd.body}
                </Text>
              </NativeAsset>
            ) : null}
          </View>

          {nativeAd.callToAction ? (
            <NativeAsset assetType={NativeAssetType.CALL_TO_ACTION}>
              <View style={styles.ctaButton} accessibilityRole="button">
                <Text style={styles.ctaText}>{nativeAd.callToAction}</Text>
              </View>
            </NativeAsset>
          ) : null}
        </View>
      </NativeAdView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginVertical: 12,
  },
  adView: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0DED8',
    padding: 12,
    position: 'relative',
    overflow: 'hidden',
  },
  prLabel: {
    position: 'absolute',
    top: 6,
    right: 8,
    backgroundColor: '#999',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    zIndex: 10,
  },
  prLabelText: {
    fontSize: 9,
    color: '#fff',
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 4,
  },
  icon: {
    width: 48,
    height: 48,
    borderRadius: 8,
    marginRight: 10,
  },
  mediaSmall: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    marginRight: 10,
  },
  textContainer: {
    flex: 1,
    marginRight: 8,
  },
  headline: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2b2a28',
    marginBottom: 2,
  },
  body: {
    fontSize: 12,
    color: '#666',
  },
  ctaButton: {
    backgroundColor: '#FFD400',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  ctaText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2b2a28',
  },
})
