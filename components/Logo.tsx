import Svg, { Circle, Ellipse, Path } from 'react-native-svg'

/** Web `wanspot/src/components/Logo.tsx` を react-native-svg で移植 */
type LogoProps = {
  variant?: 'white' | 'yellow'
  width?: number
  height?: number
}

export function Logo({ variant = 'white', width = 32, height = 37 }: LogoProps) {
  const pinFill = variant === 'white' ? '#FFD84D' : '#1a1a1a'
  const circleFill = variant === 'white' ? '#fff' : '#FFD84D'
  const pawFill = '#1a1a1a'
  const noseFill = variant === 'white' ? '#fff' : '#FFD84D'

  return (
    <Svg width={width} height={height} viewBox="0 0 64 74" fill="none" accessibilityLabel="wanspot">
      <Path
        d="M32 2C18.7 2 8 12.7 8 26C8 43 32 72 32 72C32 72 56 43 56 26C56 12.7 45.3 2 32 2Z"
        fill={pinFill}
      />
      <Circle cx={32} cy={25} r={16} fill={circleFill} />
      <Ellipse
        cx={20.5}
        cy={17.5}
        rx={3.2}
        ry={3.8}
        fill={pawFill}
        transform="rotate(-18 20.5 17.5)"
      />
      <Ellipse cx={27.5} cy={15} rx={3.8} ry={4.5} fill={pawFill} transform="rotate(-6 27.5 15)" />
      <Ellipse cx={36.5} cy={15} rx={3.8} ry={4.5} fill={pawFill} transform="rotate(6 36.5 15)" />
      <Ellipse
        cx={43.5}
        cy={17.5}
        rx={3.2}
        ry={3.8}
        fill={pawFill}
        transform="rotate(18 43.5 17.5)"
      />
      <Path
        d="M32 20C26.8 20 23 23.5 23 27.5C23 32 27 35 32 35C37 35 41 32 41 27.5C41 23.5 37.2 20 32 20Z"
        fill={pawFill}
      />
      <Ellipse cx={32} cy={28} rx={4.5} ry={3.2} fill={noseFill} />
    </Svg>
  )
}
