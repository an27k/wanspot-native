import { View } from 'react-native'
import { Image } from 'expo-image'
import type { WalkAlertKey } from '@/lib/weather/walk-alert'

// お散歩アラートの表情（共通マスコットの顔・透過PNG）
const FACE: Record<WalkAlertKey, ReturnType<typeof require>> = {
  numb: require('@/assets/images/walk-alert/dog-face-numb.png'),
  sting: require('@/assets/images/walk-alert/dog-face-sting.png'),
  chilly: require('@/assets/images/walk-alert/dog-face-chilly.png'),
  comfortable: require('@/assets/images/walk-alert/dog-face-comfortable.png'),
  caution: require('@/assets/images/walk-alert/dog-face-caution.png'),
  danger: require('@/assets/images/walk-alert/dog-face-danger.png'),
  stop: require('@/assets/images/walk-alert/dog-face-stop.png'),
}

/**
 * お散歩アラートの犬顔（共通マスコットの表情画像）。
 * ringColor を渡すと外周に段階カラーのリングを描画する。
 */
export function DogAlertFace({
  size = 40,
  level = 'comfortable',
  ringColor,
}: {
  size?: number
  level?: WalkAlertKey
  ringColor?: string
}) {
  const border = ringColor ? Math.max(2, Math.round(size * 0.08)) : 0
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: '#fff',
        borderWidth: border,
        borderColor: ringColor ?? 'transparent',
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Image
        source={FACE[level]}
        style={{ width: '100%', height: '100%' }}
        contentFit="cover"
        transition={120}
      />
    </View>
  )
}
