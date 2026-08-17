import Svg, { Circle, Defs, Line, LinearGradient, Stop, Text as SvgText } from 'react-native-svg'
import { useAppTheme } from '@/context/ThemeContext'
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

/** グロス（光沢）オーバーレイは全インスタンス共通の白系定義なので id 衝突は無害 */
const GLOSS_ID = 'walkGaugeGloss'

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
 * `filled` 時は円内を `color` で塗り、上部に光沢グラデと外周ハローを重ねてモダンに見せる。
 * 目盛り・針は `iconColor`（既定は白）。
 */
export function WalkAlertGauge({
  size = 24,
  color,
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
  /** 円の輪郭色（未指定時は白い光沢輪郭） */
  ringColor?: string
  tempC?: number | null
  level?: WalkAlertKey
  filled?: boolean
}) {
  const { colors } = useAppTheme()
  const resolvedColor = color ?? colors.success
  const ring = ringColor ?? 'rgba(255,255,255,0.55)'
  const cx = 12
  const cy = 12
  const angle = needleAngle(tempC, level)
  const needleEnd = polar(cx, cy + 0.4, 6, angle)
  const sw = 1.2

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityLabel="お散歩アラート">
      <Defs>
        <LinearGradient id={GLOSS_ID} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.32} />
          <Stop offset="0.55" stopColor="#FFFFFF" stopOpacity={0.08} />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
        </LinearGradient>
      </Defs>

      {/* 外周のソフトなハロー（原色感を和らげる） */}
      {filled ? <Circle cx={cx} cy={cy} r={11.2} fill={resolvedColor} opacity={0.16} /> : null}

      {/* ベースの円 */}
      <Circle
        cx={cx}
        cy={cy}
        r={9.7}
        fill={filled ? resolvedColor : 'transparent'}
        stroke={filled ? ring : ringColor ?? iconColor}
        strokeWidth={filled ? 1 : sw}
      />

      {/* 上部の光沢オーバーレイ */}
      {filled ? <Circle cx={cx} cy={cy} r={9.7} fill={`url(#${GLOSS_ID})`} /> : null}

      {/* 目盛り（細め・ややインセット） */}
      {TICK_ANGLES.map((deg) => {
        const a = polar(cx, cy, 7.9, deg)
        const b = polar(cx, cy, 9.4, deg)
        return (
          <Line
            key={deg}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            stroke={iconColor}
            strokeWidth={1}
            strokeLinecap="round"
            opacity={0.9}
          />
        )
      })}

      {/* 針 */}
      <Line
        x1={cx}
        y1={cy + 0.4}
        x2={needleEnd.x}
        y2={needleEnd.y}
        stroke={iconColor}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      {/* 中心ハブ */}
      <Circle cx={cx} cy={cy + 0.4} r={1.5} fill={iconColor} />

      <SvgText x={cx} y={19.4} fill={iconColor} fontSize={5} fontWeight="700" textAnchor="middle">
        C°
      </SvgText>
    </Svg>
  )
}
