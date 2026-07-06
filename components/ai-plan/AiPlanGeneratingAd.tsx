import { useEffect, useMemo, useRef, useState, type ComponentType } from 'react'
import { InteractionManager, StyleSheet, type StyleProp, type ViewStyle } from 'react-native'
import { adsEnabledForDevice } from '@/lib/ads-policy'
import { prepareSearchTabAdsOnce } from '@/lib/prepare-search-ads'
import type { NativeAd } from 'react-native-google-mobile-ads'

const LOAD_MAX_ATTEMPTS = 3
type NativeAdCardComponent = ComponentType<{ nativeAd: NativeAd; adViewStyle?: StyleProp<ViewStyle> }>

export function AiPlanGeneratingAd() {
  const [nativeAd, setNativeAd] = useState<NativeAd | null>(null)
  const [NativeAdCard, setNativeAdCard] = useState<NativeAdCardComponent | null>(null)
  const nativeAdRef = useRef<NativeAd | null>(null)
  const loadInFlightRef = useRef(false)

  const adsEnabled = useMemo(() => adsEnabledForDevice(), [])

  useEffect(() => {
    if (!adsEnabled) return

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
          const [
            { NativeAdStandardCard },
            { resolveAiPlanVideoNativeAdUnitId },
            { buildNativeAdRequestOptions, enqueueNativeAdRequest },
            { NativeMediaAspectRatio },
          ] = await Promise.all([
            import('@/components/ads/NativeAdStandardCard'),
            import('@/constants/admob'),
            import('@/lib/native-ad-request-queue'),
            import('react-native-google-mobile-ads'),
          ])
          if (cancelled) {
            loadInFlightRef.current = false
            return
          }
          setNativeAdCard(() => NativeAdStandardCard)
          const unitId = resolveAiPlanVideoNativeAdUnitId()
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
  }, [adsEnabled])

  useEffect(() => {
    return () => {
      nativeAdRef.current?.destroy()
      nativeAdRef.current = null
    }
  }, [])

  if (!adsEnabled) return null
  if (!nativeAd || NativeAdCard == null) return null

  return <NativeAdCard nativeAd={nativeAd} adViewStyle={styles.narrow} />
}

const styles = StyleSheet.create({
  narrow: {
    maxWidth: 400,
    width: '100%',
    alignSelf: 'center',
  },
})
