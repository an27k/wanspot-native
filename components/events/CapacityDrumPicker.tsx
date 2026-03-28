import { useCallback, useEffect, useMemo, useRef } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'

const ITEM_H = 44

export type CapacityDrumPickerProps = {
  value: number | null
  onChange: (v: number | null) => void
  allowEmpty?: boolean
  min?: number
  max?: number
}

export function CapacityDrumPicker({
  value,
  onChange,
  allowEmpty = true,
  min = 3,
  max = 20,
}: CapacityDrumPickerProps) {
  const scrollRef = useRef<ScrollView>(null)
  const items = useMemo(() => {
    const lo = Math.min(min, max)
    const hi = Math.max(min, max)
    const nums: { label: string; v: number | null }[] = []
    for (let n = lo; n <= hi; n++) nums.push({ label: String(n), v: n })
    if (allowEmpty) return [{ label: '-', v: null }, ...nums]
    return nums
  }, [allowEmpty, min, max])

  const indexOfValue = useCallback(
    (v: number | null) => {
      const i = items.findIndex((it) => it.v === v)
      return i >= 0 ? i : 0
    },
    [items]
  )

  const scrollToIndex = useCallback(
    (i: number, animated: boolean) => {
      const clamped = Math.max(0, Math.min(i, items.length - 1))
      scrollRef.current?.scrollTo({ y: clamped * ITEM_H, animated })
    },
    [items.length]
  )

  useEffect(() => {
    const i = indexOfValue(value)
    requestAnimationFrame(() => scrollToIndex(i, false))
  }, [value, indexOfValue, scrollToIndex])

  const settle = useCallback(
    (y: number) => {
      const i = Math.round(y / ITEM_H)
      const clamped = Math.max(0, Math.min(i, items.length - 1))
      scrollToIndex(clamped, true)
      const next = items[clamped]?.v ?? null
      if (next !== value) onChange(next)
    },
    [items, onChange, scrollToIndex, value]
  )

  return (
    <View style={styles.wrap}>
      <View style={styles.hl} pointerEvents="none" />
      <ScrollView
        ref={scrollRef}
        style={styles.sc}
        contentContainerStyle={{ paddingVertical: ITEM_H }}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        onMomentumScrollEnd={(e) => settle(e.nativeEvent.contentOffset.y)}
        onScrollEndDrag={(e) => settle(e.nativeEvent.contentOffset.y)}
      >
        {items.map((it, idx) => {
          const sel = it.v === value
          return (
            <Pressable
              key={`${it.label}-${idx}`}
              style={[styles.item, { height: ITEM_H }]}
              onPress={() => {
                onChange(it.v)
                scrollToIndex(idx, true)
              }}
            >
              <Text style={[styles.itemTxt, sel && styles.itemTxtSel]}>{it.label}</Text>
            </Pressable>
          )
        })}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    height: ITEM_H * 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ebebeb',
    backgroundColor: '#f7f6f3',
    overflow: 'hidden',
    position: 'relative',
  },
  hl: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: ITEM_H,
    height: ITEM_H,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#e8c84a',
    zIndex: 1,
    backgroundColor: 'rgba(255, 216, 77, 0.12)',
  },
  sc: { flex: 1 },
  item: { justifyContent: 'center', alignItems: 'center' },
  itemTxt: { fontSize: 16, fontWeight: '700', color: '#888' },
  itemTxtSel: { color: '#1a1a1a', fontSize: 17 },
})
