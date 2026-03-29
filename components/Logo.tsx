import { Image, type ImageStyle, type StyleProp } from 'react-native'

type LogoProps = {
  width: number
  height: number
  style?: StyleProp<ImageStyle>
}

export function Logo({ width, height, style }: LogoProps) {
  return (
    <Image
      source={require('../assets/images/wanspot_icon.png')}
      style={[{ width, height }, style]}
      resizeMode="contain"
    />
  )
}
