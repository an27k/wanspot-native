import Svg, { Ellipse, Path } from 'react-native-svg'

/** メインアプリで共通の肉球マーク（viewBox 100×100） */
export function IconPaw({ size = 14, color = '#FFD84D' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" aria-hidden>
      <Ellipse cx="20" cy="28" rx="10" ry="13" fill={color} />
      <Ellipse cx="40" cy="16" rx="10" ry="13" fill={color} />
      <Ellipse cx="60" cy="16" rx="10" ry="13" fill={color} />
      <Ellipse cx="80" cy="28" rx="10" ry="13" fill={color} />
      <Path
        d="M50 33 C26 33 14 54 17 70 C20 86 35 92 50 92 C65 92 80 86 83 70 C86 54 74 33 50 33Z"
        fill={color}
      />
    </Svg>
  )
}
