import { View } from 'react-native'
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg'
import { useAppTheme } from '@/context/ThemeContext'

type Props = {
  size?: number
  color?: string
}

/** アルバムタブ用（カレンダー + チェック） */
export function AlbumTabIcon({ size = 24, color }: Props) {
  const { colors } = useAppTheme()
  const resolvedColor = color ?? colors.textMuted

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Rect x={3} y={5} width={18} height={16} rx={3.2} stroke={resolvedColor} strokeWidth={2} />
        <Line x1={3} y1={9.2} x2={21} y2={9.2} stroke={resolvedColor} strokeWidth={2} />
        <Line x1={7.5} y1={3} x2={7.5} y2={6} stroke={resolvedColor} strokeWidth={2} strokeLinecap="round" />
        <Line x1={12} y1={3} x2={12} y2={6} stroke={resolvedColor} strokeWidth={2} strokeLinecap="round" />
        <Line x1={16.5} y1={3} x2={16.5} y2={6} stroke={resolvedColor} strokeWidth={2} strokeLinecap="round" />
        <Circle cx={12} cy={15.3} r={3.9} stroke={resolvedColor} strokeWidth={2} />
        <Path
          d="M10.2 15.3 L11.5 16.6 L13.9 13.9"
          stroke={resolvedColor}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  )
}
