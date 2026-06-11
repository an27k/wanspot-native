import { WalkAlertGauge } from '@/components/map/WalkAlertGauge'
import type { WalkAlertKey } from '@/lib/weather/walk-alert'

/** お散歩アラート用インジケータ（温度ゲージ・段階色） */
export function DogAlertFace({
  size = 40,
  level = 'comfortable',
  ringColor = '#34A853',
  tempC,
}: {
  size?: number
  level?: WalkAlertKey
  ringColor?: string
  tempC?: number | null
}) {
  return (
    <WalkAlertGauge
      size={size}
      color={ringColor}
      iconColor="#fff"
      tempC={tempC}
      level={level}
      filled
    />
  )
}
