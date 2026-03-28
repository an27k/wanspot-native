import { useCallback, useEffect, useRef } from 'react'
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { colors } from '@/constants/colors'

const ITEM_H = 40
const VISIBLE_ROWS = 5
export const CENTER_PICKER_HEIGHT = ITEM_H * VISIBLE_ROWS

type Row = { value: string; label: string }

type Props = {
  data: Row[]
  value: string
  onChange: (value: string) => void
  /** 複数列で value が重複しうるときの React key 用 */
  listKey?: string
}

function indexForValue(data: Row[], value: string): number {
  const i = data.findIndex((r) => r.value === value)
  return i >= 0 ? i : 0
}

/**
 * 中央に選択行が来るスクロール（ドラム型ではなく、ハイライト帯固定）
 */
export function CenterSnapPicker({ data, value, onChange, listKey = 'col' }: Props) {
  const ref = useRef<ScrollView>(null)
  const pad = ((VISIBLE_ROWS - 1) / 2) * ITEM_H

  const scrollToIndex = useCallback(
    (i: number, animated: boolean) => {
      const y = Math.min(Math.max(0, i), data.length - 1) * ITEM_H
      ref.current?.scrollTo({ y, animated })
    },
    [data.length]
  )

  useEffect(() => {
    const i = indexForValue(data, value)
    const t = setTimeout(() => scrollToIndex(i, false), 0)
    return () => clearTimeout(t)
  }, [data, value, scrollToIndex])

  const snapEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e.nativeEvent.contentOffset.y
      const i = Math.round(y / ITEM_H)
      const clamped = Math.min(Math.max(0, i), data.length - 1)
      scrollToIndex(clamped, true)
      const next = data[clamped]?.value
      if (next !== undefined && next !== value) {
        onChange(next)
      }
    },
    [data, onChange, scrollToIndex, value]
  )

  if (data.length === 0) return null

  return (
    <View style={styles.wrap}>
      <ScrollView
        ref={ref}
        style={styles.scroll}
        contentContainerStyle={{ paddingTop: pad, paddingBottom: pad }}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        nestedScrollEnabled
        onMomentumScrollEnd={snapEnd}
        onScrollEndDrag={Platform.OS === 'android' ? snapEnd : undefined}
      >
        {data.map((row, idx) => {
          const selected = row.value === value
          return (
            <Pressable
              key={`${listKey}-${idx}-${row.label}`}
              style={[styles.item, { height: ITEM_H }]}
              onPress={() => {
                const i = data.findIndex((r) => r.value === row.value)
                if (i >= 0) {
                  scrollToIndex(i, true)
                  onChange(row.value)
                }
              }}
            >
              <Text
                style={[styles.itemTxt, selected && styles.itemTxtOn]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {row.label}
              </Text>
            </Pressable>
          )
        })}
      </ScrollView>
      <View style={styles.highlight} pointerEvents="none" />
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    height: CENTER_PICKER_HEIGHT,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardBg,
    overflow: 'hidden',
  },
  scroll: { flex: 1 },
  highlight: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: (CENTER_PICKER_HEIGHT - ITEM_H) / 2,
    height: ITEM_H,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.brand,
    backgroundColor: 'rgba(255, 216, 77, 0.12)',
    zIndex: 2,
  },
  item: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 10,
    width: '100%',
  },
  itemTxt: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
    width: '100%',
    textAlign: 'center',
  },
  itemTxtOn: { color: colors.text, fontWeight: '800' },
})
