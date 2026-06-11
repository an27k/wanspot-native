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
    width: 32,
    alignItems: 'center',
    flexShrink: 0,
    alignSelf: 'stretch',
    position: 'relative',
  },
  badge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: TOKENS.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    shadowColor: TOKENS.brand.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 3,
  },
  badgeNum: {
    fontSize: 15,
    fontWeight: '800',
    color: '#ffffff',
  },
  vline: {
    position: 'absolute',
    left: 15,
    top: 32,
    bottom: 0,
    width: 2,
    backgroundColor: TOKENS.brand.tintStrong,
    zIndex: 1,
  },
  rightCol: {
    flex: 1,
    marginBottom: 8,
  },
})
