import { View } from 'react-native'
import type { WalkAlertKey } from '@/lib/weather/walk-alert'

/**
 * お散歩アラート用インジケータ（リスク段階の単色塗りつぶし円）。
 */
export function DogAlertFace({
  size = 40,
  level: _level = 'comfortable',
  ringColor = '#34A853',
}: {
  size?: number
  level?: WalkAlertKey
  ringColor?: string
}) {
  const inner = Math.round(size * 0.72)
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: '#fff',
        borderWidth: Math.max(2, Math.round(size * 0.06)),
        borderColor: ringColor,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View
        style={{
          width: inner,
          height: inner,
          borderRadius: inner / 2,
          backgroundColor: ringColor,
        }}
      />
    </View>
  )
}
