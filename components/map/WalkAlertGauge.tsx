import Svg, { Circle, Line, Text as SvgText } from 'react-native-svg'
import type { WalkAlertKey } from '@/lib/weather/walk-alert'

const TICK_ANGLES = [215, 233, 251, 270, 289, 307, 325]

const LEVEL_ANGLE: Record<WalkAlertKey, number> = {
  numb: 215,
  sting: 233,
  chilly: 251,
  comfortable: 270,
  caution: 289,
  danger: 307,
  stop: 325,
}

function needleAngle(tempC: number | null | undefined, level?: WalkAlertKey): number {
  if (tempC != null && Number.isFinite(tempC)) {
    const min = -5
    const max = 50
    const t = (Math.max(min, Math.min(max, tempC)) - min) / (max - min)
    return 215 + t * 110
  }
  if (level) return LEVEL_ANGLE[level]
  return 270
}

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

/**
 * お散歩アラート用の温度ゲージアイコン（円＋目盛り＋針＋C°）。
 * `filled` 時は円内を `color` で塗り、目盛り・針は `iconColor`（既定は白）。
 */
export function WalkAlertGauge({
  size = 24,
  color = '#34A853',
  iconColor = '#fff',
  ringColor,
  tempC,
  level,
  filled = true,
}: {
  size?: number
  /** 円の塗りつぶし色 */
  color?: string
  /** 目盛り・針・文字色 */
  iconColor?: string
  /** 円の輪郭色（未指定時は color） */
  ringColor?: string
  tempC?: number | null
  level?: WalkAlertKey
  filled?: boolean
}) {
  const ring = ringColor ?? color
  const cx = 12
  const cy = 12
  const angle = needleAngle(tempC, level)
  const needleEnd = polar(cx, cy + 0.5, 6.2, angle)
  const sw = 1.35

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityLabel="お散歩アラート">
      <Circle
        cx={cx}
        cy={cy}
        r={10}
        fill={filled ? color : 'transparent'}
        stroke={filled ? ring : iconColor}
        strokeWidth={sw}
      />
      {TICK_ANGLES.map((deg) => {
        const a = polar(cx, cy, 8.4, deg)
        const b = polar(cx, cy, 10.2, deg)
        return (
          <Line
            key={deg}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            stroke={iconColor}
            strokeWidth={sw}
            strokeLinecap="round"
          />
        )
      })}
      <Circle cx={cx} cy={cy + 0.5} r={1.1} fill="none" stroke={iconColor} strokeWidth={sw * 0.9} />
      <Line
        x1={cx}
        y1={cy + 0.5}
        x2={needleEnd.x}
        y2={needleEnd.y}
        stroke={iconColor}
        strokeWidth={sw}
        strokeLinecap="round"
      />
      <SvgText
        x={cx}
        y={19.2}
        fill={iconColor}
        fontSize={5.2}
        fontWeight="700"
        textAnchor="middle"
      >
        C°
      </SvgText>
    </Svg>
  )
}
