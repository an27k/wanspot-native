import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg'

export const DOG_FACE_YELLOW = '#FDCB2E'
export const DOG_FACE_OUTLINE = '#1A1A1A'

/**
 * かわいい犬の顔マーク（アイコン・ロード用 SVG）。
 * 白顔＋黄色い耳＋黒目鼻口。viewBox 0 0 100 100。
 */
export function DogFaceMark({
  size = 64,
  showSparkles = false,
  sparkleOpacity = 1,
  muted = false,
}: {
  size?: number
  /** ロード演出用のオレンジきらめき */
  showSparkles?: boolean
  sparkleOpacity?: number
  /** 空状態などグレー表示 */
  muted?: boolean
}) {
  const sw = 4.2
  const ear = muted ? '#D8D8D8' : DOG_FACE_YELLOW
  const face = muted ? '#F4F4F4' : '#FFFFFF'
  const ink = muted ? '#B0B0B0' : DOG_FACE_OUTLINE
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" accessibilityLabel="wanspot">
      <G>
        {/* 左耳 */}
        <Ellipse cx={26} cy={30} rx={14} ry={18} fill={ear} stroke={ink} strokeWidth={sw} />
        {/* 右耳 */}
        <Ellipse cx={74} cy={30} rx={14} ry={18} fill={ear} stroke={ink} strokeWidth={sw} />
        {/* 顔 */}
        <Circle cx={50} cy={54} r={30} fill={face} stroke={ink} strokeWidth={sw} />
        {/* 目 */}
        <Circle cx={40} cy={50} r={4.2} fill={ink} />
        <Circle cx={60} cy={50} r={4.2} fill={ink} />
        {/* 鼻＋口 */}
        <Path
          d="M50 56 L46.5 60.5 Q50 63 53.5 60.5 Z"
          fill={ink}
        />
        <Path
          d="M46.5 60.5 Q50 66 53.5 60.5"
          fill="none"
          stroke={ink}
          strokeWidth={2.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </G>
      {showSparkles ? (
        <G opacity={sparkleOpacity}>
          <Circle cx={78} cy={18} r={4.5} fill="#FF8A1F" />
          <Circle cx={88} cy={28} r={3} fill="#FFC94A" />
          <Circle cx={70} cy={10} r={2.5} fill="#FFB347" />
        </G>
      ) : null}
    </Svg>
  )
}
