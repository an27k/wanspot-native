import { useState } from 'react'
import { StyleSheet, TouchableOpacity, View } from 'react-native'
import { WalkAlertModal } from '@/components/map/WalkAlertModal'
import { walkAlertFromTemp } from '@/lib/weather/walk-alert'

/**
 * 地図タブ右上のお散歩予報ボタン。
 * 犬キャラは外し、お散歩リスク段階の「色」だけを塗りつぶした円で表現する。
 * リスト表示時は非表示（index 側で出し分け）。
 */
export function MapAppMenu({ topOffset, tempC }: { topOffset: number; tempC: number | null }) {
  const [open, setOpen] = useState(false)
  const alert = tempC != null ? walkAlertFromTemp(tempC) : null
  const color = alert?.color ?? '#34A853'

  return (
    <>
      <TouchableOpacity
        style={[styles.fab, { top: topOffset }]}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="お散歩予報を見る"
        activeOpacity={0.85}
      >
        <View style={[styles.dot, { backgroundColor: color }]} />
      </TouchableOpacity>

      <WalkAlertModal visible={open} tempC={tempC} onClose={() => setOpen(false)} />
    </>
  )
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 16,
    zIndex: 4,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  dot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: '#fff',
  },
})
