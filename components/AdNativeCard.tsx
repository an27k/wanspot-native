import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Image,
  InteractionManager,
  LayoutChangeEvent,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { ANDROID_NATIVE_AD_UNIT_ID, getIosReleaseNativeAdUnitId } from '@/constants/admob'
import { adsEnabledForDevice } from '@/lib/ads-policy'
import { buildNativeAdRequestOptions, enqueueNativeAdRequest } from '@/lib/native-ad-request-queue'
import {
  NativeAd,
  NativeAdView,
  NativeAsset,
  NativeAssetType,
  NativeMediaView,
  TestIds,
} from 'react-native-google-mobile-ads'

function resolveNativeAdUnitId(): string | null {
  if (__DEV__) return TestIds.NATIVE
  if (Platform.OS === 'ios') {
    return getIosReleaseNativeAdUnitId()
  }
  const id = ANDROID_NATIVE_AD_UNIT_ID.trim()
  return id.length > 0 ? id : null
}

type Props = {
  /** ATT + SDK 初期化が完了してから true（それまでネイティブ広告をロードしない） */
  adsReady: boolean
}

const NATIVE_LOAD_MAX_ATTEMPTS = 4

export function AdNativeCard({ adsReady }: Props) {
  const [nativeAd, setNativeAd] = useState<NativeAd | null>(null)
  /** true = 全リトライ失敗（枠はプレースホルダのまま残す。null 返しで「消えた」ように見せない） */
  const [loadExhausted, setLoadExhausted] = useState(false)
  const loadInFlightRef = useRef(false)
  const [mediaInnerWidth, setMediaInnerWidth] = useState(0)
  const adsEnabled = useMemo(() => adsEnabledForDevice(), [])
  const unitId = useMemo(() => (adsEnabled ? resolveNativeAdUnitId() : null), [adsEnabled])

  const aspectRatio = useMemo(() => {
    const r = nativeAd?.mediaContent?.aspectRatio
    if (typeof r === 'number' && r > 0.2 && r < 5) return r
    return 16 / 9
  }, [nativeAd])

  /** Integer media height + max cap; resizeMode cover fills row width */
  const mediaPixelHeight = useMemo(() => {
    if (mediaInnerWidth <= 0) return 200
    const raw = Math.ceil(mediaInnerWidth / aspectRatio)
    return Math.max(140, Math.min(raw, 360))
  }, [mediaInnerWidth, aspectRatio])

  const onMediaRowLayout = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width
    const floored = Math.floor(w)
    if (floored <= 0) return
    setMediaInnerWidth((prev) => (prev === floored ? prev : floored))
  }, [])

  useEffect(() => {
    if (!adsReady) return
    if (!adsEnabled) return
    if (unitId == null) return

    let cancelled = false
    setLoadExhausted(false)
    setNativeAd(null)
    loadInFlightRef.current = true

    const attemptLoad = (attemptIdx: number) => {
      if (cancelled) return
      loadInFlightRef.current = true

      void (async () => {
        const requestOptions = await buildNativeAdRequestOptions(attemptIdx)
        if (cancelled) {
          loadInFlightRef.current = false
          return
        }
        enqueueNativeAdRequest(unitId, requestOptions)
          .then((ad) => {
            if (cancelled) {
              ad.destroy()
              return
            }
            setNativeAd(ad)
            loadInFlightRef.current = false
          })
          .catch((e) => {
            // Error オブジェクトをそのまま console に渡すと stack 文字列生成で Hermes が不安定になり得るため、
            // ここでは文字列のみ出す（stack を触らない）。
            console.warn(
              `NativeAd failed (attempt ${attemptIdx + 1}/${NATIVE_LOAD_MAX_ATTEMPTS}): ${String((e as unknown) ?? '')}`
            )
            if (cancelled) {
              loadInFlightRef.current = false
              return
            }
            if (attemptIdx + 1 < NATIVE_LOAD_MAX_ATTEMPTS) {
              loadInFlightRef.current = false
              const backoff = 350 + (attemptIdx + 1) * 400
              setTimeout(() => attemptLoad(attemptIdx + 1), backoff)
            } else {
              setLoadExhausted(true)
              loadInFlightRef.current = false
            }
          })
      })()
    }

    // 初回描画/遷移直後は Hermes/GC と競合しやすいので、UIが落ち着いてからロードする
    const task = InteractionManager.runAfterInteractions(() => {
      const t = setTimeout(() => attemptLoad(0), 250)
      return () => clearTimeout(t)
    })

    return () => {
      cancelled = true
      loadInFlightRef.current = false
      task.cancel()
    }
  }, [adsReady, adsEnabled, unitId])

  useEffect(() => {
    return () => {
      nativeAd?.destroy()
    }
  }, [nativeAd])

  useEffect(() => {
    setMediaInnerWidth(0)
  }, [nativeAd])

  if (!adsEnabled) {
    return null
  }
  if (!adsReady) {
    return <View style={[styles.card, styles.placeholder]} />
  }
  if (unitId == null) {
    return (
      <View style={[styles.card, styles.placeholder]}>
        <Text style={styles.placeholderHint}>広告枠（ユニット未設定）</Text>
      </View>
    )
  }
  if (!nativeAd) {
    return (
      <View style={[styles.card, styles.placeholder, loadExhausted && styles.placeholderMuted]}>
        <Text style={styles.placeholderHint}>{loadExhausted ? '広告を表示できませんでした' : '広告を読み込み中…'}</Text>
      </View>
    )
  }

  return (
    <View style={styles.cardShell} collapsable={false}>
      <NativeAdView nativeAd={nativeAd} style={styles.nativeAdRoot} collapsable={false}>
        <View style={styles.clip}>
          <View style={styles.headerRow}>
            <Text style={styles.adLabel}>広告</Text>
          </View>

          <View style={styles.mediaRow} onLayout={onMediaRowLayout}>
            <NativeMediaView
              resizeMode="cover"
              style={[styles.media, { height: mediaPixelHeight }]}
            />
          </View>

          <View style={styles.body}>
            <View style={styles.titleRow}>
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

              <View style={[styles.titleTextCol, !nativeAd.icon?.url && styles.titleTextColFlush]}>
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
            </View>

            {nativeAd.body ? (
              <NativeAsset assetType={NativeAssetType.BODY}>
                <Text style={styles.bodyText} numberOfLines={3}>
                  {nativeAd.body}
                </Text>
              </NativeAsset>
            ) : null}

            {nativeAd.callToAction ? (
              <NativeAsset assetType={NativeAssetType.CALL_TO_ACTION}>
                <View style={styles.cta} accessibilityRole="button">
                  <Text style={styles.ctaText}>{nativeAd.callToAction}</Text>
                </View>
              </NativeAsset>
            ) : null}
          </View>
        </View>
      </NativeAdView>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ebebeb',
    marginBottom: 12,
  },
  /** Border/margin on outer shell; overflow hidden clips native paint bleeding into next list row */
  cardShell: {
    marginBottom: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ebebeb',
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  nativeAdRoot: {
    width: '100%',
    backgroundColor: '#fff',
  },
  clip: {
    width: '100%',
    overflow: 'hidden',
  },
  headerRow: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 6,
    backgroundColor: '#fff',
  },
  adLabel: { fontSize: 10, fontWeight: '800', color: '#999' },
  mediaRow: {
    width: '100%',
    backgroundColor: '#f0f0f0',
    overflow: 'hidden',
  },
  media: {
    width: '100%',
    backgroundColor: '#f0f0f0',
  },
  body: { padding: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  titleTextCol: { flex: 1, marginLeft: 10 },
  titleTextColFlush: { marginLeft: 0 },
  icon: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#f5f5f5' },
  headline: { fontSize: 14, fontWeight: '900', color: '#2b2a28' },
  advertiser: { fontSize: 11, fontWeight: '700', color: '#888', marginTop: 2 },
  bodyText: { fontSize: 12, color: '#666', lineHeight: 18, marginBottom: 10 },
  cta: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#FFD84D',
  },
  ctaText: { fontSize: 12, fontWeight: '900', color: '#2b2a28' },
  placeholder: {
    height: 220,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderMuted: {
    opacity: 0.72,
  },
  placeholderHint: {
    paddingHorizontal: 16,
    fontSize: 12,
    fontWeight: '600',
    color: '#aaa',
    textAlign: 'center',
  },
})

