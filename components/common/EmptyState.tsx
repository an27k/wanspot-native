import type { ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { colors } from '@/constants/colors'
import { type } from '@/constants/typography'

/**
 * 保存済みリストの空状態。
 *
 * 変更前は「グレーの1行」だけで、なぜ空なのか・何をすれば埋まるのかが分からなかった。
 * 新規ユーザーが最初に見る画面がこれなので、次の一手まで置く。
 *
 * いいねと行ったで形はまったく同じなので、アイコンとコピーだけ差し替える。
 */
export function EmptyState({
  icon,
  title,
  body,
  actionLabel,
  onAction,
}: {
  icon: ReactNode
  title: string
  /** なぜ空なのかを説明する。責める書き方にしない */
  body: string
  actionLabel?: string
  onAction?: () => void
}) {
  return (
    <View style={styles.wrap}>
      <View style={styles.circle}>{icon}</View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
      {actionLabel && onAction ? (
        <Pressable
          style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
          onPress={onAction}
          accessibilityRole="button"
        >
          <Text style={styles.ctaTxt}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  // 左右を広めに空けて中央に集める。リストと同じ幅で組むと空きが目立たない
  wrap: { alignItems: 'center', paddingHorizontal: 44, paddingVertical: 48, gap: 12 },
  circle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#EFE8DE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: { ...type.heading, fontSize: 19, color: colors.textSecondary, textAlign: 'center' },
  body: { ...type.caption, fontSize: 14.5, lineHeight: 23, color: colors.textMuted, textAlign: 'center' },
  cta: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 22,
    backgroundColor: colors.primary,
  },
  ctaPressed: { opacity: 0.85 },
  ctaTxt: { ...type.button, fontSize: 16, color: '#FFFFFF' },
})
