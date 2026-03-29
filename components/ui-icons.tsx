import { Text, View } from 'react-native'
import FontAwesome6 from '@expo/vector-icons/FontAwesome6'
import { Ionicons } from '@expo/vector-icons'
import { HEART_ICON } from '@/lib/constants'

export function UiIconHeart({ filled, size = 16 }: { filled: boolean; size?: number }) {
  return (
    <Ionicons
      name={filled ? 'heart' : 'heart-outline'}
      size={size}
      color={filled ? HEART_ICON.filled : HEART_ICON.strokeEmpty}
    />
  )
}

export function UiIconStar({ filled = true, size = 11 }: { filled?: boolean; size?: number }) {
  return <Ionicons name={filled ? 'star' : 'star-outline'} size={size} color={filled ? '#FFD84D' : '#ddd'} />
}

export function UiIconMoneyDot({ filled, size = 10 }: { filled: boolean; size?: number }) {
  const r = size / 2
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: r,
        backgroundColor: filled ? '#FFD84D' : '#e8e8e8',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        style={{
          fontSize: Math.max(6, size * 0.55),
          fontWeight: '700',
          color: filled ? '#1a1a1a' : '#bbb',
          lineHeight: Math.max(8, size * 0.7),
        }}
      >
        ¥
      </Text>
    </View>
  )
}

export function UiPriceLevelYen({ level, dotSize = 10 }: { level: number; dotSize?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2, alignItems: 'center' }}>
      {[1, 2, 3, 4].map((i) => (
        <UiIconMoneyDot key={i} filled={i <= level} size={dotSize} />
      ))}
    </View>
  )
}

export function UiIconSort({ color = '#fff', size = 13 }: { color?: string; size?: number }) {
  return <Ionicons name="swap-vertical" size={size} color={color} />
}

export function UiIconGoogle({ size = 12 }: { size?: number }) {
  return <Ionicons name="logo-google" size={size} color="#4285F4" />
}

export function UiIconChevronLeft({ color = '#1a1a1a', size = 18 }: { color?: string; size?: number }) {
  return <Ionicons name="chevron-back" size={size} color={color} />
}

export function UiIconSearch({ size = 14, color = '#aaa' }: { size?: number; color?: string }) {
  return <Ionicons name="search" size={size} color={color} />
}

export function UiIconClose({ size = 12, color = '#aaa' }: { size?: number; color?: string }) {
  return <Ionicons name="close" size={size} color={color} />
}

export function UiIconBulb({ fill, size = 17 }: { fill: string; size?: number }) {
  return <Ionicons name="bulb" size={size} color={fill} />
}

export function UiIconThumbUp({ fill, size = 13 }: { fill: string; size?: number }) {
  return <Ionicons name="thumbs-up" size={size} color={fill} />
}

export function UiIconFlame({ fill, size = 17 }: { fill: string; size?: number }) {
  return <Ionicons name="flame" size={size} color={fill} />
}

export function UiIconShare({ color = '#1a1a1a', size = 18 }: { color?: string; size?: number }) {
  return <Ionicons name="share-social-outline" size={size} color={color} />
}

export function UiIconCopy({ color = '#1a1a1a', size = 20 }: { color?: string; size?: number }) {
  return <Ionicons name="copy-outline" size={size} color={color} />
}

/** シェアモーダル等の X（旧 Twitter）ブランドマーク */
export function UiIconBrandX({ size = 18, color = '#fff' }: { size?: number; color?: string }) {
  return <FontAwesome6 name="x-twitter" size={size} color={color} />
}

export function UiIconCalendar({ size = 13, color = '#888' }: { size?: number; color?: string }) {
  return <Ionicons name="calendar-outline" size={size} color={color} />
}

export function UiIconPin({ size = 13, color = '#888' }: { size?: number; color?: string }) {
  return <Ionicons name="location-outline" size={size} color={color} />
}

export function UiIconUsers({ size = 15, color = '#888' }: { size?: number; color?: string }) {
  return <Ionicons name="people-outline" size={size} color={color} />
}

export function UiIconPlus({ size = 26, color = '#1a1a1a' }: { size?: number; color?: string }) {
  return <Ionicons name="add" size={size} color={color} />
}

export function UiIconExternalLink({ size = 11, color = '#1a1a1a' }: { size?: number; color?: string }) {
  return <Ionicons name="open-outline" size={size} color={color} />
}

export function UiIconCamera({ size = 18, color = '#fff' }: { size?: number; color?: string }) {
  return <Ionicons name="camera-outline" size={size} color={color} />
}

export function UiIconPencil({ size = 11, color }: { size?: number; color: string }) {
  return <Ionicons name="create-outline" size={size} color={color} />
}

export function UiIconSyringe({ size = 12 }: { size?: number }) {
  return <Text style={{ fontSize: size + 4, lineHeight: size + 6 }}>💉</Text>
}
