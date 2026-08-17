import { useEffect, useState } from 'react'
import { fetchWalkLine, shouldShowWalkLine, type WalkLine } from '@/lib/weather/walk-line'
import type { WalkAlertKey } from '@/lib/weather/walk-alert'

/**
 * 今日の一言を取りに行く。出ない日が通常なので、loading は返さない。
 * 「作成中…」のような繰り返し出る空白を作らないため、出るときだけ静かに現れる。
 */
export function useWalkLine(
  location: { lat: number; lng: number } | null,
  currentLevel: WalkAlertKey | null | undefined
): string | null {
  const [line, setLine] = useState<WalkLine | null>(null)

  useEffect(() => {
    if (!location) {
      setLine(null)
      return
    }
    let cancelled = false
    void fetchWalkLine(location.lat, location.lng).then((v) => {
      if (!cancelled) setLine(v)
    })
    return () => {
      cancelled = true
    }
  }, [location?.lat, location?.lng])

  if (!line) return null
  return shouldShowWalkLine(line, currentLevel) ? line.text : null
}
