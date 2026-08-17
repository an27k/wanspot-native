import { type ReactNode } from 'react'
import { Platform, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { BlurView } from 'expo-blur'
import { GOOGLE_HOME } from '@/constants/google-home-tokens'

type Props = {
  children: ReactNode
  style?: StyleProp<ViewStyle>
  onPress?: () => void
  /** 角丸（デフォルト 22） */
  radius?: number
}

/**
 * Google Chrome 新規タブ風のダーク半透明ガラスパネル。
 * BlurView + 暗色オーバーレイで質感を出す。
 */
export function GoogleGlassPanel({ children, style, onPress, radius = GOOGLE_HOME.radiusPanel }: Props) {
  const shell = (
    <View style={[styles.shell, { borderRadius: radius }, style]}>
      {Platform.OS === 'ios' ? (
        <BlurView
          intensity={GOOGLE_HOME.blurIntensity}
          tint={GOOGLE_HOME.blurTint}
          style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
        />
      ) : null}
      <View style={[styles.tint, { borderRadius: radius }]} />
      <View style={styles.content}>{children}</View>
    </View>
  )

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [pressed && styles.pressed]}
        accessibilityRole="button"
      >
        {shell}
      </Pressable>
    )
  }
  return shell
}

const styles = StyleSheet.create({
  shell: {
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GOOGLE_HOME.panelBorder,
  },
  tint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: GOOGLE_HOME.panelBg,
  },
  content: { position: 'relative' },
  pressed: { opacity: 0.88 },
})
