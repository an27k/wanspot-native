import { StyleSheet, Text, View } from 'react-native'
import { TOKENS } from '@/constants/color-tokens'
import type { ReactNode } from 'react'

export function AiPlanTimelineNode({
  index,
  isLast,
  children,
}: {
  index: number
  isLast: boolean
  children: ReactNode
}) {
  return (
    <View style={styles.row}>
      <View style={styles.leftCol}>
        <View style={styles.badge}>
          <Text style={styles.badgeNum}>{index + 1}</Text>
        </View>
        {!isLast ? <View style={styles.vline} /> : null}
      </View>
      <View style={styles.rightCol}>{children}</View>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 12,
    position: 'relative',
  },
  leftCol: {
    width: 28,
    alignItems: 'center',
    flexShrink: 0,
    alignSelf: 'stretch',
    position: 'relative',
  },
  badge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: TOKENS.brand.yellow,
    borderWidth: 2.5,
    borderColor: TOKENS.text.primary,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  badgeNum: {
    fontSize: 13,
    fontWeight: '800',
    color: TOKENS.text.primary,
  },
  vline: {
    position: 'absolute',
    left: 13,
    top: 28,
    bottom: 0,
    width: 2,
    backgroundColor: TOKENS.border.default,
    zIndex: 1,
  },
  rightCol: {
    flex: 1,
    marginBottom: 8,
  },
})
