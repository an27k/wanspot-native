import { AppState } from 'react-native'
import { useEffect, useState } from 'react'
import { useIsFocused } from '@react-navigation/native'
import { VlogLiquidGauge } from '@/components/album/VlogLiquidGauge'

type Props = {
  dogName?: string | null
  count: number
  max?: number
  onHelpPress?: () => void
}

/** VLOG進捗 — Skia液体ゲージのみ（説明文なし） */
export function VlogProgressCard({ dogName, count, max = 5, onHelpPress }: Props) {
  const isFocused = useIsFocused()
  const [appActive, setAppActive] = useState(AppState.currentState === 'active')

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      setAppActive(state === 'active')
    })
    return () => sub.remove()
  }, [])

  return (
    <VlogLiquidGauge
      count={count}
      max={max}
      dogName={dogName}
      animating={isFocused && appActive}
      onHelpPress={onHelpPress}
    />
  )
}
