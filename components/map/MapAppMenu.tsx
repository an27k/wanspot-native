import { useState } from 'react'
import { StyleSheet, TouchableOpacity, View, type ViewStyle } from 'react-native'
import { WalkAlertModal } from '@/components/map/WalkAlertModal'
import { walkAlertFromTemp } from '@/lib/weather/walk-alert'

/**
 * 地図右下フローティング列のお散歩予報ボタン（並び替えの上）。
 * リスク段階は色付き円のみで表現。
 */
export function WalkAlertFab({
  tempC,
  loading = false,
  needsLocation = false,
  onRequestLocation,
  buttonStyle,
}: {
  tempC: number | null
  loading?: boolean
  needsLocation?: boolean
  onRequestLocation?: () => void
  buttonStyle?: ViewStyle
}) {
  const [open, setOpen] = useState(false)
  const alert = tempC != null ? walkAlertFromTemp(tempC) : null
  const color = alert?.color ?? '#9a9a96'

  const handlePress = () => {
    if (needsLocation) {
      onRequestLocation?.()
      setOpen(true)
      return
    }
    setOpen(true)
  }

  return (
    <>
      <TouchableOpacity
        style={[styles.btn, buttonStyle]}
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel="お散歩予報を見る"
        activeOpacity={0.85}
      >
        <View style={[styles.dot, { backgroundColor: color }]} />
      </TouchableOpacity>

      <WalkAlertModal
        visible={open}
        tempC={tempC}
        loading={loading}
        needsLocation={needsLocation}
        onRequestLocation={onRequestLocation}
        onClose={() => setOpen(false)}
      />
    </>
  )
}

const styles = StyleSheet.create({
  btn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ebebeb',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 7,
  },
  dot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: '#fff',
  },
})
