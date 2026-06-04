import Svg, { Path } from 'react-native-svg'

/** デフォルメした犬の顔シルエット（目鼻なし・輪郭のみ）。viewBox 0 0 100 100 前提。 */
const DOG_PATH =
  'M50 12 ' +
  'C63 12 72 18 76 28 ' +
  'C90 24 99 40 92 60 ' +
  'C89 71 78 75 70 67 ' +
  'C69 81 61 90 50 90 ' +
  'C39 90 31 81 30 67 ' +
  'C22 75 11 71 8 60 ' +
  'C1 40 10 24 24 28 ' +
  'C28 18 37 12 50 12 Z'

/**
 * 犬シルエットのパス本体（自前の <Svg> を持たない）。
 * 親の <Svg>/<G> 内に埋め込んで使える。
 */
export function DogGhostShape({
  fill = '#ffffff',
  outline = '#2b2a28',
  strokeWidth = 5,
}: {
  fill?: string
  outline?: string
  strokeWidth?: number
}) {
  return <Path d={DOG_PATH} fill={fill} stroke={outline} strokeWidth={strokeWidth} strokeLinejoin="round" />
}

/**
 * Snapchat のお化けマークに倣った、犬の顔シルエット。
 * 枠（黒淵）と白塗りのみのデフォルメ形（目鼻なし）。
 */
export function DogGhost({
  size = 64,
  fill = '#ffffff',
  outline = '#2b2a28',
  strokeWidth = 5,
}: {
  size?: number
  fill?: string
  outline?: string
  strokeWidth?: number
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" fill="none" accessibilityLabel="wanspot dog">
      <DogGhostShape fill={fill} outline={outline} strokeWidth={strokeWidth} />
    </Svg>
  )
}
