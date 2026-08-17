import { View } from 'react-native'
import Svg, { G, Line, Rect } from 'react-native-svg'
import { useAppTheme } from '@/context/ThemeContext'

type Props = {
  size?: number
  color?: string
}

/** wanspot_icon_syringe.svg 準拠（設定タブ・ワクチン行） */
export function WanspotIconSyringe({ size = 20, color }: Props) {
  const { colors } = useAppTheme()
  const stroke = color ?? colors.text
  const sw = 1.8
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <G rotation={-45} origin="12, 12">
          <Line x1={2.5} y1={12} x2={6} y2={12} stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
          <Line x1={4.2} y1={10.4} x2={5.6} y2={13.6} stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
          <Rect x={6} y={9.2} width={9.5} height={5.6} rx={1.4} stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
          <Line x1={9} y1={9.2} x2={9} y2={11.2} stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
          <Line x1={11} y1={9.2} x2={11} y2={11.2} stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
          <Line x1={13} y1={9.2} x2={13} y2={11.2} stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
          <Line x1={15.5} y1={7.6} x2={15.5} y2={16.4} stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
          <Line x1={15.5} y1={12} x2={19} y2={12} stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
          <Line x1={19} y1={9.5} x2={19} y2={14.5} stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
        </G>
      </Svg>
    </View>
  )
}
