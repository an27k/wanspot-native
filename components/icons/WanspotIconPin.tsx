import { View } from 'react-native'
import Svg, { Circle, Path } from 'react-native-svg'
import { colors } from '@/constants/colors'

type Props = {
  /** ピンの幅。高さは 28/22 の比率で決まる */
  size?: number
  color?: string
  /** 中央の白丸。地図ピンでは出し、リスト内の小アイコンでは消す */
  dot?: boolean
}

/**
 * 地図ピン。
 *
 * デザインハンドオフの clip-path 多角形をそのまま座標変換したもの。
 *   polygon(50% 100%, 12% 46%, 4% 30%, 12% 12%, 32% 2%, 68% 2%, 88% 12%, 96% 30%, 88% 46%)
 *
 * 涙滴ではなく、肩が張って先端が細く落ちる形。小さい表示でも
 * 頭とテールが分離して見えるので、地図上で重なっても数が読める。
 * 選択中は呼び出し側で size を 34 に上げ、影を足す。
 */
export function WanspotIconPin({ size = 22, color = colors.primary, dot = true }: Props) {
  const height = (size * 28) / 22

  // 幅22 × 高さ28 の viewBox。多角形の頂点をそのまま座標に写している
  const d = 'M11 28 L2.64 12.88 L0.88 8.4 L2.64 3.36 L7.04 0.56 L14.96 0.56 L19.36 3.36 L21.12 8.4 L19.36 12.88 Z'

  return (
    <View style={{ width: size, height, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={height} viewBox="0 0 22 28">
        <Path d={d} fill={color} />
        {dot ? <Circle cx={11} cy={8.5} r={4} fill="#FFFFFF" /> : null}
      </Svg>
    </View>
  )
}
