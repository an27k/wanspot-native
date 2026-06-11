import { Image } from 'expo-image'

const ICON = require('@/assets/images/wanspot_icon_orange.png')

/** wanspot ロゴ（アプリアイコン PNG） */
export function Logo({ size = 32 }: { size?: number; bare?: boolean }) {
  return (
    <Image
      source={ICON}
      style={{ width: size, height: size, borderRadius: size * 0.22 }}
      contentFit="cover"
      accessibilityLabel="wanspot"
    />
  )
}
