import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Image,
  InteractionManager,
  LayoutChangeEvent,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { resolveAiPlanVideoNativeAdUnitId } from '@/constants/admob'
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

export function AiPlanGeneratingAd() {
  const [nativeAd, setNativeAd] = useState<NativeAd | null>(null)
  const nativeAdRef = useRef<NativeAd | null>(null)
  const loadInFlightRef = useRef(false)
  const [mediaInnerWidth, setMediaInnerWidth] = useState(0)

  const adsEnabled = useMemo(() => adsEnabledForDevice(), [])
  const unitId = useMemo(() => (adsEnabled ? resolveAiPlanVideoNativeAdUnitId() : null), [adsEnabled])

  const aspectRatio = useMemo(() => {
    const r = nativeAd?.mediaContent?.aspectRatio
    if (typeof r === 'number' && r > 0.2 && r < 5) return r
    return 16 / 9
  }, [nativeAd])

  const mediaPixelHeight = useMemo(() => {
    // 作成中画面では「下部にさりげなく」を優先し、横長で高さを抑える
    if (mediaInnerWidth <= 0) return 120
    const effectiveRatio = Math.max(1.9, aspectRatio)
    const raw = Math.ceil(mediaInnerWidth / effectiveRatio)
    return Math.max(96, Math.min(raw, 140))
  }, [mediaInnerWidth, aspectRatio])

  const onMediaRowLayout = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width
    const floored = Math.floor(w)
    if (floored <= 0) return
    setMediaInnerWidth((prev) => (prev === floored ? prev : floored))
  }, [])

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
            aspectRatio: NativeMediaAspectRatio.LANDSCAPE,
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
          console.warn(`AiPlanGeneratingAd load failed (${attemptIdx + 1}/${LOAD_MAX_ATTEMPTS}): ${String((e as unknown) ?? '')}`)
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

  useEffect(() => {
    setMediaInnerWidth(0)
  }, [nativeAd])

  if (!adsEnabled || unitId == null) return null
  if (!nativeAd) return null

  return (
    <View style={styles.container} collapsable={false}>
      <NativeAdView nativeAd={nativeAd} style={styles.adView} collapsable={false}>
        <View style={styles.prLabel}>
          <Text style={styles.prLabelText}>広告</Text>
        </View>

        <View style={styles.mediaRow} onLayout={onMediaRowLayout}>
          <NativeMediaView resizeMode="cover" style={[styles.media, { height: mediaPixelHeight }]} />
        </View>

        <View style={styles.content}>
          {nativeAd.icon?.url ? (
            <NativeAsset assetType={NativeAssetType.ICON}>
              <Image
                source={{ uri: nativeAd.icon.url }}
                style={styles.icon}
                resizeMode="cover"
                accessibilityIgnoresInvertColors
              />
            </NativeAsset>
          ) : null}

          <View style={[styles.textContainer, !nativeAd.icon?.url && styles.textContainerFlush]}>
            {nativeAd.headline ? (
              <NativeAsset assetType={NativeAssetType.HEADLINE}>
                <Text style={styles.headline} numberOfLines={2}>
                  {nativeAd.headline}
                </Text>
              </NativeAsset>
            ) : null}
            {nativeAd.advertiser ? (
              <NativeAsset assetType={NativeAssetType.ADVERTISER}>
                <Text style={styles.advertiser} numberOfLines={1}>
                  {nativeAd.advertiser}
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
    marginTop: 20,
    marginBottom: 16,
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  adView: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EDEDED',
    overflow: 'hidden',
    position: 'relative',
    shadowColor: 'transparent',
    elevation: 0,
  },
  prLabel: {
    position: 'absolute',
    top: 6,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    zIndex: 10,
  },
  prLabelText: {
    fontSize: 9,
    color: '#fff',
    fontWeight: '500',
  },
  mediaRow: {
    width: '100%',
    backgroundColor: '#f5f5f5',
    overflow: 'hidden',
  },
  media: {
    width: '100%',
    backgroundColor: '#f5f5f5',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 6,
    marginRight: 10,
  },
  textContainer: {
    flex: 1,
    marginRight: 8,
  },
  textContainerFlush: {
    marginLeft: 0,
  },
  headline: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2b2a28',
    marginBottom: 2,
  },
  advertiser: {
    fontSize: 11,
    color: '#888',
  },
  ctaButton: {
    backgroundColor: '#F0F0F0',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  ctaText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
  },
})
