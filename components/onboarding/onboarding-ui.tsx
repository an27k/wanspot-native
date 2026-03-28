import Svg, { Circle, Path } from 'react-native-svg'

export function OnboardingBrand({ width = 20, height = 23 }: { width?: number; height?: number }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 64 74" fill="none" aria-hidden>
      <Path
        d="M32 2C18.7 2 8 12.7 8 26C8 43 32 72 32 72C32 72 56 43 56 26C56 12.7 45.3 2 32 2Z"
        fill="#FFD84D"
      />
      <Circle cx="32" cy="25" r="16" fill="#fff" />
    </Svg>
  )
}
