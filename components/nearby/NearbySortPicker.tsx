import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import Svg, { Path, Rect } from 'react-native-svg'
import { HEART_ICON } from '@/lib/constants'

export type NearbySortKey = 'score' | 'like' | 'visited'

const IconGoogleG = ({ size = 22 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <Path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <Path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
    <Path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </Svg>
)

const IconHeart = ({ size = 20 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={HEART_ICON.filled}>
    <Path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </Svg>
)

const IconCheck = ({ size = 20, color = '#2b2a28' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Rect x={3} y={3} width={18} height={18} rx={6} stroke={color} strokeWidth={2} />
    <Path d="M7.6 12.4l2.9 2.9 6-6.6" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
)

const OPTIONS: { key: NearbySortKey; label: string; sub: string }[] = [
  { key: 'score', label: 'おすすめ順', sub: 'Google評価などから総合スコア順' },
  { key: 'like', label: 'いいね', sub: 'お気に入りに登録したスポット' },
  { key: 'visited', label: '行った', sub: 'チェックインしたスポット' },
]

function SortIcon({ k, active }: { k: NearbySortKey; active: boolean }) {
  if (k === 'score') return <IconGoogleG />
  if (k === 'like') return <IconHeart />
  return <IconCheck color={active ? '#2b2a28' : '#9a9a96'} />
}

/** 並び替え（おすすめ / いいね / 行った）の選択ポップアップ。ジャンル選択と同系のUI。 */
export function NearbySortPicker({
  visible,
  value,
  onSelect,
  onClose,
}: {
  visible: boolean
  value: NearbySortKey
  onSelect: (k: NearbySortKey) => void
  onClose: () => void
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => {}}>
          <Text style={styles.title}>並び替え</Text>
          {OPTIONS.map((o) => {
            const active = o.key === value
            return (
              <Pressable
                key={o.key}
                style={[styles.row, active && styles.rowOn]}
                onPress={() => {
                  onSelect(o.key)
                  onClose()
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <View style={[styles.iconCircle, active && styles.iconCircleOn]}>
                  <SortIcon k={o.key} active={active} />
                </View>
                <View style={styles.rowText}>
                  <Text style={[styles.rowLabel, active && styles.rowLabelOn]}>{o.label}</Text>
                  <Text style={styles.rowSub}>{o.sub}</Text>
                </View>
              </Pressable>
            )
          })}
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.25)', justifyContent: 'center', alignItems: 'center' },
  card: {
    width: '92%',
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ebebeb',
    padding: 16,
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  title: { fontSize: 14, fontWeight: '800', color: '#2b2a28', marginBottom: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: 14,
    backgroundColor: '#f7f6f3',
    borderWidth: 1,
    borderColor: '#efefef',
  },
  rowOn: { backgroundColor: '#FFF1E3', borderColor: '#FF8A1F' },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ececec',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleOn: { borderColor: '#FF8A1F' },
  rowText: { flex: 1 },
  rowLabel: { fontSize: 14, fontWeight: '800', color: '#888' },
  rowLabelOn: { color: '#2b2a28' },
  rowSub: { fontSize: 11, color: '#aaa', marginTop: 2 },
})
