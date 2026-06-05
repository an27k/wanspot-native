import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { DogAlertFace } from '@/components/map/DogAlertFace'
import {
  WALK_ALERT_LEVELS,
  walkAlertFromTemp,
  type WalkAlertLevel,
} from '@/lib/weather/walk-alert'

export function WalkAlertModal({
  visible,
  tempC,
  loading = false,
  needsLocation = false,
  onRequestLocation,
  onClose,
}: {
  visible: boolean
  tempC: number | null
  loading?: boolean
  needsLocation?: boolean
  onRequestLocation?: () => void
  onClose: () => void
}) {
  const level: WalkAlertLevel | null = tempC == null ? null : walkAlertFromTemp(tempC)

  const emptyMessage = needsLocation
    ? 'お散歩予報は「位置情報」の許可で現在地の気温を取得します（別の許可項目はありません）。下のボタンで許可を確認してください。'
    : loading
      ? '気温を取得しています…'
      : '気温を取得できませんでした。通信環境を確認して、しばらくお待ちください。'

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => {}}>
          <Text style={styles.kicker}>お散歩アラート</Text>

          {level ? (
            <>
              <View style={styles.hero}>
                <DogAlertFace size={104} level={level.key} ringColor={level.color} />
                <View style={styles.heroText}>
                  <Text style={[styles.levelLabel, { color: level.color }]}>{level.label}</Text>
                  {tempC != null ? <Text style={styles.temp}>現在 {tempC}℃</Text> : null}
                </View>
              </View>

              <Text style={styles.advice}>{level.advice}</Text>

              <View style={styles.scale}>
                {WALK_ALERT_LEVELS.map((lv) => {
                  const active = lv.key === level.key
                  return (
                    <View key={lv.key} style={[styles.scaleRow, active && styles.scaleRowOn]}>
                      <DogAlertFace size={30} level={lv.key} ringColor={lv.color} />
                      <Text style={[styles.scaleLabel, active && { color: lv.color }]}>{lv.label}</Text>
                      <Text style={styles.scaleRange}>{lv.rangeLabel}</Text>
                    </View>
                  )
                })}
              </View>
            </>
          ) : (
            <>
              <Text style={styles.noData}>{emptyMessage}</Text>
              {needsLocation && onRequestLocation ? (
                <Pressable style={styles.locationBtn} onPress={onRequestLocation}>
                  <Text style={styles.locationBtnTxt}>位置情報を許可する</Text>
                </Pressable>
              ) : null}
            </>
          )}

          <Pressable style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeTxt}>閉じる</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#fff',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#ebebeb',
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  kicker: { fontSize: 12, fontWeight: '800', color: '#aaa', letterSpacing: 1 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 12 },
  heroText: { flex: 1, gap: 2 },
  levelLabel: { fontSize: 28, fontWeight: '900' },
  temp: { fontSize: 15, fontWeight: '700', color: '#6b6a66' },
  advice: {
    marginTop: 14,
    fontSize: 14,
    lineHeight: 22,
    color: '#2b2a28',
    backgroundColor: '#f7f6f3',
    borderRadius: 14,
    padding: 14,
  },
  scale: { marginTop: 16, gap: 4 },
  scaleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  scaleRowOn: { backgroundColor: '#FFFBEC' },
  scaleLabel: { fontSize: 14, fontWeight: '800', color: '#888', width: 64 },
  scaleRange: { fontSize: 13, color: '#aaa' },
  noData: { marginTop: 16, fontSize: 14, color: '#888', lineHeight: 22 },
  locationBtn: {
    marginTop: 14,
    alignSelf: 'stretch',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#FF8A1F',
    alignItems: 'center',
  },
  locationBtnTxt: { fontSize: 14, fontWeight: '700', color: '#fff' },
  closeBtn: {
    marginTop: 18,
    alignSelf: 'center',
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 999,
    backgroundColor: '#2b2a28',
  },
  closeTxt: { fontSize: 14, fontWeight: '700', color: '#fff' },
})
