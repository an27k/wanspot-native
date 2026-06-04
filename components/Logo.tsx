import Svg, { Defs, G, LinearGradient, Rect, Stop } from 'react-native-svg'
import { DogGhost, DogGhostShape } from '@/components/common/DogGhost'

/**
 * wanspot ロゴ。Snapchat のアプリアイコンに倣い、
 * 黄→オレンジのグラデ角丸スクエア背景 ＋ 黒淵・白塗りの犬マーク（目鼻なしのデフォルメ）。
 */
type LogoProps = {
  size?: number
  /** 背景なしでマークのみ（白地に置く用、オレンジの犬） */
  bare?: boolean
}

export function Logo({ size = 32, bare = false }: LogoProps) {
  if (bare) {
    return <DogGhost size={size} fill="#FF8A1F" outline="#2b2a28" />
  }
  const radius = 26
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" accessibilityLabel="wanspot">
      <Defs>
        <LinearGradient id="wanspotLogoBg" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FFD84D" />
          <Stop offset="0.5" stopColor="#FF9E2C" />
          <Stop offset="1" stopColor="#FF7A00" />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width={100} height={100} rx={radius} fill="url(#wanspotLogoBg)" />
      {/* 中央に 66% スケールで配置 */}
      <G transform="translate(17 17) scale(0.66)">
        <DogGhostShape fill="#ffffff" outline="#2b2a28" strokeWidth={7} />
      </G>
    </Svg>
  )
}
