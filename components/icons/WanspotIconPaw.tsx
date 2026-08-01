import { View } from 'react-native'
import Svg, { Ellipse, Path } from 'react-native-svg'
import { SETTINGS_ICON_COLOR } from '@/components/settings/settings-icon-color'

type Props = {
  size?: number
  color?: string
  /** solid = 塗りつぶし（ブランドアクセント用）、outline = 線画（設定リスト用） */
  variant?: 'solid' | 'outline'
}

/** wanspot_icon_paw.svg 準拠（設定タブ・散歩エリア行） */
export function WanspotIconPaw({
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
        <Ellipse
          cx={6.4}
          cy={11}
          rx={1.95}
          ry={2.5}
          fill={fill}
          stroke={strokeColor}
          strokeWidth={stroke}
        />
        <Ellipse
          cx={9.9}
          cy={7.9}
          rx={2.05}
          ry={2.7}
          fill={fill}
          stroke={strokeColor}
          strokeWidth={stroke}
        />
        <Ellipse
          cx={14.1}
          cy={7.9}
          rx={2.05}
          ry={2.7}
          fill={fill}
          stroke={strokeColor}
          strokeWidth={stroke}
        />
        <Ellipse
          cx={17.6}
          cy={11}
          rx={1.95}
          ry={2.5}
          fill={fill}
          stroke={strokeColor}
          strokeWidth={stroke}
        />
        <Path
          d="M12 12.1c2.7 0 5 1.85 5 4.15 0 2.0-1.85 2.95-3.45 3.5-0.55 0.2-1.05 0.45-1.55 0.45s-1.0-0.25-1.55-0.45C7.85 19.2 6 18.25 6 16.25c0-2.3 2.3-4.15 5-4.15z"
          fill={fill}
          stroke={strokeColor}
          strokeWidth={stroke}
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  )
}
