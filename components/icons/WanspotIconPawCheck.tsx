import { View } from 'react-native'
import Svg, { Ellipse, Path } from 'react-native-svg'
import { SETTINGS_ICON_COLOR } from '@/components/settings/settings-icon-color'

type Props = {
  size?: number
  color?: string
  /** solid = 塗りつぶし（ブランドアクセント用）、outline = 線画（設定リスト用） */
  variant?: 'solid' | 'outline'
}

/**
 * 「行った」用のオリジナルアイコン。
 * 肉球（[[WanspotIconPaw]] と同じ骨格）を左上に寄せ、右下にチェックを重ねて
 * 「うちの子の足あとが残った ＝ 訪問済み」を表す。
 * 肉球は縮尺 0.78 で描き、チェックが載る右下を空ける。
 */
export function WanspotIconPawCheck({
  size = 20,
  color = SETTINGS_ICON_COLOR,
  variant = 'solid',
}: Props) {
  const outline = variant === 'outline'
  const stroke = outline ? 1.5 : 0
  const fill = outline ? 'none' : color
  const strokeColor = outline ? color : undefined

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        {/* 肉球本体: WanspotIconPaw を 0.78 倍して左上へ寄せた座標 */}
        <Ellipse cx={4.6} cy={8.3} rx={1.5} ry={1.95} fill={fill} stroke={strokeColor} strokeWidth={stroke} />
        <Ellipse cx={7.3} cy={5.9} rx={1.6} ry={2.1} fill={fill} stroke={strokeColor} strokeWidth={stroke} />
        <Ellipse cx={10.6} cy={5.9} rx={1.6} ry={2.1} fill={fill} stroke={strokeColor} strokeWidth={stroke} />
        <Ellipse cx={13.3} cy={8.3} rx={1.5} ry={1.95} fill={fill} stroke={strokeColor} strokeWidth={stroke} />
        <Path
          d="M9 9.15c2.1 0 3.9 1.45 3.9 3.24 0 1.56-1.44 2.3-2.69 2.73-.43.16-.82.35-1.21.35s-.78-.19-1.21-.35C6.54 14.69 5.1 13.95 5.1 12.39c0-1.79 1.8-3.24 3.9-3.24z"
          fill={fill}
          stroke={strokeColor}
          strokeWidth={stroke}
          strokeLinejoin="round"
        />
        {/* チェック: 線画で統一（solid でも塗り潰さずストロークで描く） */}
        <Path
          d="M14.4 17.5l2.5 2.6 4.6-5.4"
          fill="none"
          stroke={color}
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  )
}
