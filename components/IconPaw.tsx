import { Text } from 'react-native'

/** メインアプリで共通の肉球マーク（絵文字） */
export function IconPaw({ size = 14, color = '#FFD84D' }: { size?: number; color?: string }) {
  return (
    <Text style={{ fontSize: size, color, lineHeight: size * 1.05 }} accessible={false}>
      🐾
    </Text>
  )
}
