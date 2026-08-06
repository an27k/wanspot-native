import { View } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { colors } from '@/constants/colors'

type Props = {
  size?: number
  color?: string
  /** filled = いいね済み、outline = 未いいね */
  filled?: boolean
}

/**
 * いいねのハート。
 *
 * デザインハンドオフの clip-path 多角形をそのまま座標変換したもの。
 *   polygon(50% 100%, 4% 40%, 4% 18%, 26% 6%, 50% 22%, 74% 6%, 96% 18%, 96% 40%)
 *
 * SF Symbols の heart ではなくこの形を使う。肩が角張っていて谷が浅く、
 * 一般的なハートより横に広い。既存の WanspotIconPaw と同じ手触りになる。
 */
export function WanspotIconHeart({ size = 20, color = colors.primary, filled = true }: Props) {
  // 100 基準の多角形を 24 の viewBox へ。頂点の順序はハンドオフのまま
  const d = 'M12 24 L0.96 9.6 L0.96 4.32 L6.24 1.44 L12 5.28 L17.76 1.44 L23.04 4.32 L23.04 9.6 Z'

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path
          d={d}
          fill={filled ? color : 'none'}
          stroke={filled ? undefined : color}
          strokeWidth={filled ? 0 : 1.8}
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  )
}
