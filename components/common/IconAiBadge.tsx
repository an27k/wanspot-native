import Svg, {
  Circle,
  G,
  Path,
  Text as SvgText,
} from 'react-native-svg'
import { colors } from '@/constants/colors'

/** 4点スパークル（円の切れ目右上） */
function SparklePath({ fill, scale = 1, x = 0, y = 0 }: { fill: string; scale?: number; x?: number; y?: number }) {
  return (
    <G transform={`translate(${x} ${y}) scale(${scale})`}>
      <Path
        fill={fill}
        d="M12 2.2 13.8 9.2 20.8 11 13.8 12.8 12 19.8 10.2 12.8 3.2 11 10.2 9.2Z"
      />
    </G>
  )
}

/**
 * 現在地タブ「AIおすすめ」用アイコン。
 * restraint v8: 単色 primary ＋欠けた円＋右上スパークル。
 */
export function IconAiBadge({
  size = 22,
  monochrome,
}: {
  size?: number
  /** 未選択時など単色表示 */
  monochrome?: string
}) {
  const fill = monochrome ?? colors.primary
  const stroke = monochrome ?? colors.primary
  const vb = 48
  const cx = 24
  const cy = 24
  const r = 17.2
  const sw = 3.6
  // 円周の右上に切れ目（スパークル用）
  const circumference = 2 * Math.PI * r
  const gapLen = circumference * 0.19
  const dashLen = circumference - gapLen

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${vb} ${vb}`} accessibilityLabel="AIおすすめ">
      <Circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={stroke}
        strokeWidth={sw}
        strokeLinecap="round"
        strokeDasharray={`${dashLen} ${gapLen}`}
        strokeDashoffset={dashLen * 0.12}
        transform={`rotate(-32 ${cx} ${cy})`}
      />

      <SparklePath fill={fill} scale={0.42} x={30.5} y={5.5} />

      <SvgText
        x={cx}
        y={29}
        textAnchor="middle"
        fontSize={15}
        fontWeight="800"
        fill={fill}
        letterSpacing={-0.5}
      >
        AI
      </SvgText>
    </Svg>
  )
}
