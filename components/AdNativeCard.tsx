import { useEffect, useMemo, useRef, useState } from 'react'
import { InteractionManager, StyleSheet, Text, View } from 'react-native'
import { NativeAdStandardCard } from '@/components/ads/NativeAdStandardCard'
import { getNativeAdUnitId } from '@/lib/ads/adUnitIds'
import { sharedNativeAdStyles } from '@/lib/ads/nativeAdCardStyles'
import { adsEnabledForDevice } from '@/lib/ads-policy'
import { buildNativeAdRequestOptions, enqueueNativeAdRequest } from '@/lib/native-ad-request-queue'
import { NativeAd, NativeMediaAspectRatio } from 'react-native-google-mobile-ads'

type Props = {
  /** ATT + SDK 初期化が完了してから true（それまでネイティブ広告をロードしない） */
  adsReady: boolean
}

const NATIVE_LOAD_MAX_ATTEMPTS = 4

export function AdNativeCard({ adsReady }: Props) {
  const [nativeAd, setNativeAd] = useState<NativeAd | null>(null)
  const [loadExhausted, setLoadExhausted] = useState(false)
  const loadInFlightRef = useRef(false)
  const adsEnabled = useMemo(() => adsEnabledForDevice(), [])
  const unitId = useMemo(() => (adsEnabled ? getNativeAdUnitId() : null), [adsEnabled])

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
        const requestOptions = await buildNativeAdRequestOptions(attemptIdx, {
          aspectRatio: NativeMediaAspectRatio.LANDSCAPE,
        })
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

  if (!adsEnabled) {
    return null
  }
  if (!adsReady) {
    return <View style={[sharedNativeAdStyles.adCard, styles.emptyCard]} />
  }
  if (unitId == null) {
    return null
  }
  if (!nativeAd) {
    return (
      <View style={[sharedNativeAdStyles.adCard, sharedNativeAdStyles.placeholder, loadExhausted && styles.placeholderMuted]}>
        <Text style={sharedNativeAdStyles.placeholderHint}>{loadExhausted ? '広告を表示できませんでした' : '広告を読み込み中…'}</Text>
      </View>
    )
  }

  return <NativeAdStandardCard nativeAd={nativeAd} />
}

const styles = StyleSheet.create({
  emptyCard: {
    minHeight: 32,
    backgroundColor: '#f5f5f5',
  },
  placeholderMuted: {
    opacity: 0.72,
  },
})
