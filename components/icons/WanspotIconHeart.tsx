import { View } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { HEART_ICON } from '@/lib/constants'

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
 * いいねのハート。
 *
 * デザインハンドオフの clip-path 多角形を座標変換したもの。
 *   polygon(50% 100%, 4% 40%, 4% 18%, 26% 6%, 50% 22%, 74% 6%, 96% 18%, 96% 40%)
 *
 * 汎用の丸いハート（Feather 系）ではなくこの形を使う。肩が角張っていて谷が浅く、
 * 横に広い。既存の WanspotIconPaw と同じ手触りになり、ブランドの顔になる。
 *
 * 導入前は SpotListCard / SpotDetailScreen / NearbySpotCard の3ファイルに
 * 同じ汎用ハートが個別定義されていた。ここに集約している。
 */
export function WanspotIconHeart({
  size = 20,
  filled = false,
  color = HEART_ICON.filled,
  strokeColor = HEART_ICON.strokeEmpty,
}: Props) {
  // 100基準の多角形を 24 の viewBox へ。頂点の順序はハンドオフのまま
  const d = 'M12 24 L0.96 9.6 L0.96 4.32 L6.24 1.44 L12 5.28 L17.76 1.44 L23.04 4.32 L23.04 9.6 Z'

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path
          d={d}
          fill={filled ? color : 'none'}
          stroke={filled ? color : strokeColor}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </Svg>
    </View>
  )
}
