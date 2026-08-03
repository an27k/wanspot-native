import { useId } from 'react'
import Svg, { Circle, Defs, LinearGradient, Stop, Rect } from 'react-native-svg'

type Props = {
  size?: number
}

/** Instagram 公式グリフ相当（グラデーション）。巨大 PNG に依存しない。 */
export function IconInstagram({ size = 24 }: Props) {
  const uid = useId().replace(/:/g, '')
  const id = `igGrad-${uid}`
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityLabel="Instagram">
      <Defs>
        <LinearGradient id={id} x1="0%" y1="100%" x2="100%" y2="0%">
          <Stop offset="0%" stopColor="#FCAF45" />
          <Stop offset="25%" stopColor="#F77737" />
          <Stop offset="50%" stopColor="#E1306C" />
          <Stop offset="75%" stopColor="#C13584" />
          <Stop offset="100%" stopColor="#833AB4" />
        </LinearGradient>
      </Defs>
      <Rect
        x={2.5}
        y={2.5}
        width={19}
        height={19}
        rx={5.5}
        fill="none"
        stroke={`url(#${id})`}
        strokeWidth={2}
      />
      <Circle cx={12} cy={12} r={4.75} fill="none" stroke={`url(#${id})`} strokeWidth={2} />
      <Circle cx={17.25} cy={6.75} r={1.35} fill={`url(#${id})`} />
    </Svg>
  )
}
