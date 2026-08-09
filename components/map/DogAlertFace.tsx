import { WalkAlertGauge } from '@/components/map/WalkAlertGauge'
import { useAppTheme } from '@/context/ThemeContext'
import type { WalkAlertKey } from '@/lib/weather/walk-alert'

/** お散歩アラート用インジケータ（温度ゲージ・段階色） */
export function DogAlertFace({
  size = 40,
  level = 'comfortable',
  ringColor,
  tempC,
}: {
  size?: number
  level?: WalkAlertKey
  ringColor?: string
  tempC?: number | null
}) {
  const { colors } = useAppTheme()
  const resolvedRingColor = ringColor ?? colors.success

  return (
    <WalkAlertGauge
      size={size}
      color={resolvedRingColor}
      iconColor="#fff"
      tempC={tempC}
      level={level}
      filled
    />
  )
}
