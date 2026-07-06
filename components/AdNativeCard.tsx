import { useEffect, useMemo, useRef, useState, type ComponentType } from 'react'
import { InteractionManager, StyleSheet, Text, View } from 'react-native'
import { sharedNativeAdStyles } from '@/lib/ads/nativeAdCardStyles'
import { adsEnabledForDevice } from '@/lib/ads-policy'

type NativeAdHandle = {
  destroy: () => void
}

type Props = {
  /** ATT + SDK 初期化が完了してから true（それまでネイティブ広告をロードしない） */
  adsReady: boolean
}

type NativeAdCardComponent = ComponentType<{
  nativeAd: NativeAdHandle
}>

const NATIVE_LOAD_MAX_ATTEMPTS = 4

export function AdNativeCard({ adsReady }: Props) {
  const [nativeAd, setNativeAd] = useState<NativeAdHandle | null>(null)
  const [NativeAdCard, setNativeAdCard] = useState<NativeAdCardComponent | null>(null)
  const [loadExhausted, setLoadExhausted] = useState(false)
  const loadInFlightRef = useRef(false)
  const adsEnabled = useMemo(() => adsEnabledForDevice(), [])

  useEffect(() => {
    if (!adsReady) return
    if (!adsEnabled) return

    let cancelled = false
    setLoadExhausted(false)
    setNativeAd(null)
    loadInFlightRef.current = true

    const attemptLoad = (attemptIdx: number) => {
      if (cancelled) return
      loadInFlightRef.current = true

      void (async () => {
        try {
          const [
            { NativeAdStandardCard },
            { getNativeAdUnitId },
            { buildNativeAdRequestOptions, enqueueNativeAdRequest },
            { NativeMediaAspectRatio },
          ] = await Promise.all([
            import('@/components/ads/NativeAdStandardCard'),
            import('@/lib/ads/adUnitIds'),
            import('@/lib/native-ad-request-queue'),
            import('react-native-google-mobile-ads'),
          ])
          if (cancelled) {
            loadInFlightRef.current = false
            return
          }
          setNativeAdCard(() => NativeAdStandardCard as NativeAdCardComponent)
          const unitId = getNativeAdUnitId()
          const requestOptions = await buildNativeAdRequestOptions(attemptIdx, {
            aspectRatio: NativeMediaAspectRatio.LANDSCAPE,
          })
          if (cancelled) {
            loadInFlightRef.current = false
            return
          }
          const ad = await enqueueNativeAdRequest(unitId, requestOptions)
          if (cancelled) {
            ad.destroy()
            return
          }
          setNativeAd(ad)
          loadInFlightRef.current = false
        } catch (e) {
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
        }
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
  }, [adsReady, adsEnabled])

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
  if (!nativeAd || NativeAdCard == null) {
    return (
      <View style={[sharedNativeAdStyles.adCard, sharedNativeAdStyles.placeholder, loadExhausted && styles.placeholderMuted]}>
        <Text style={sharedNativeAdStyles.placeholderHint}>{loadExhausted ? '広告を表示できませんでした' : '広告を読み込み中…'}</Text>
      </View>
    )
  }

  return <NativeAdCard nativeAd={nativeAd} />
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
