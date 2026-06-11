import { View } from 'react-native'
import Svg, { Line, Path, Rect } from 'react-native-svg'

type Props = {
  size?: number
  color?: string
}

/** VLOGカード用クリップボード+再生マーク */
export function VlogClipboardIcon({ size = 22, color = '#fff' }: Props) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Rect x={3} y={8.4} width={18} height={11.6} rx={2.2} stroke={color} strokeWidth={1.7} />
        <Rect x={3} y={4} width={18} height={3.4} rx={1} stroke={color} strokeWidth={1.7} />
        <Line x1={6.2} y1={4} x2={4.6} y2={7.4} stroke={color} strokeWidth={1.5} />
        <Line x1={10.2} y1={4} x2={8.6} y2={7.4} stroke={color} strokeWidth={1.5} />
        <Line x1={14.2} y1={4} x2={12.6} y2={7.4} stroke={color} strokeWidth={1.5} />
        <Line x1={18.2} y1={4} x2={16.6} y2={7.4} stroke={color} strokeWidth={1.5} />
        <Path d="M10.4 11.8 L15 14.2 L10.4 16.6 Z" fill={color} />
      </Svg>
    </View>
  )
}
