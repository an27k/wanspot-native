import { Image, type ImageStyle, type StyleProp } from 'react-native'

const SRC = require('@/assets/Instagram_Glyph_Gradient.png')

type Props = {
  size?: number
  style?: StyleProp<ImageStyle>
}

export function IconInstagram({ size = 24, style }: Props) {
  return (
    <Image
      source={SRC}
      accessibilityLabel="Instagram"
      style={[{ width: size, height: size, opacity: 0.8 }, style]}
      resizeMode="contain"
    />
  )
}
