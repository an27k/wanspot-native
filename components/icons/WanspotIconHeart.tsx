import { View } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { useAppTheme } from '@/context/ThemeContext'

type Props = {
  size?: number
  /** いいね済みなら塗り、未いいねなら線だけ */
  filled?: boolean
  /** 塗りの色。既定はアプリ共通の赤 */
  color?: string
  /** 未いいねの線の色 */
  strokeColor?: string
}

/**
 * いいねのハート（Feather 系の丸い形）。
 *
 * ハンドオフの角張った多角形から戻した。各画面で同じ形を使う。
 */
export function WanspotIconHeart({
  size = 20,
  filled = false,
  color,
  strokeColor,
}: Props) {
  const { colors } = useAppTheme()
  const resolvedColor = color ?? colors.error
  const resolvedStrokeColor = strokeColor ?? colors.textHint
  const d =
    'M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z'

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
          d={d}
          fill={filled ? resolvedColor : 'none'}
          stroke={filled ? resolvedColor : resolvedStrokeColor}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </Svg>
    </View>
  )
}
