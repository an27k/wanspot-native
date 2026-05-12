import { useEffect, useMemo, useRef, useState } from 'react'
import { InteractionManager, StyleSheet } from 'react-native'
import { NativeAdStandardCard } from '@/components/ads/NativeAdStandardCard'
import { resolveAiPlanVideoNativeAdUnitId } from '@/constants/admob'
import { adsEnabledForDevice } from '@/lib/ads-policy'
import { buildNativeAdRequestOptions, enqueueNativeAdRequest } from '@/lib/native-ad-request-queue'
import { prepareSearchTabAdsOnce } from '@/lib/prepare-search-ads'
import { NativeAd, NativeMediaAspectRatio } from 'react-native-google-mobile-ads'

const LOAD_MAX_ATTEMPTS = 3

export function AiPlanGeneratingAd() {
  const [nativeAd, setNativeAd] = useState<NativeAd | null>(null)
  const nativeAdRef = useRef<NativeAd | null>(null)
  const loadInFlightRef = useRef(false)

  const adsEnabled = useMemo(() => adsEnabledForDevice(), [])
  const unitId = useMemo(() => (adsEnabled ? resolveAiPlanVideoNativeAdUnitId() : null), [adsEnabled])

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

  if (!adsEnabled || unitId == null) return null
  if (!nativeAd) return null

  return <NativeAdStandardCard nativeAd={nativeAd} adViewStyle={styles.narrow} />
}

const styles = StyleSheet.create({
  narrow: {
    maxWidth: 400,
    width: '100%',
    alignSelf: 'center',
  },
})
