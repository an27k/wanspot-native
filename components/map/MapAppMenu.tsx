import { useState } from 'react'
import { StyleSheet, TouchableOpacity, type ViewStyle } from 'react-native'
import { WalkAlertGauge } from '@/components/map/WalkAlertGauge'
import { WalkAlertModal } from '@/components/map/WalkAlertModal'
import { useWalkDailyAdvice } from '@/lib/weather/use-walk-daily-advice'
import { walkAlertFromTemp } from '@/lib/weather/walk-alert'

/**
 * 地図左上のお散歩アラートボタン。
 * 白ボタン＋温度段階色のゲージアイコン。
 */
export function WalkAlertFab({
  tempC,
  loading = false,
  needsLocation = false,
  onRequestLocation,
  buttonStyle,
  location,
  dogName,
}: {
  tempC: number | null
  loading?: boolean
  needsLocation?: boolean
  onRequestLocation?: () => void
  buttonStyle?: ViewStyle
  location?: { lat: number; lng: number } | null
  dogName?: string | null
}) {
  const [open, setOpen] = useState(false)
  const alert = tempC != null ? walkAlertFromTemp(tempC) : null
  const color = alert?.color ?? '#9a9a96'

  const { advice: dailyAdvice, loading: adviceLoading } = useWalkDailyAdvice(
    location ?? null,
    tempC,
    dogName,
    open && !!location && !needsLocation
  )

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
        <WalkAlertGauge
          size={30}
          color="#FFFFFF"
          ringColor={color}
          iconColor={color}
          tempC={tempC}
          filled
        />
      </TouchableOpacity>

      <WalkAlertModal
        visible={open}
        tempC={tempC}
        loading={loading}
        needsLocation={needsLocation}
        onRequestLocation={onRequestLocation}
        onClose={() => setOpen(false)}
        dailyAdvice={dailyAdvice}
        adviceLoading={adviceLoading}
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
})
