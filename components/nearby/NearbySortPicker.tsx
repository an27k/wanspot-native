import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import Svg, { Path, Rect } from 'react-native-svg'
import { IconAiBadge } from '@/components/common/IconAiBadge'
import { HEART_ICON } from '@/lib/constants'
import { MAP_VISITED_CHECK_COLOR } from '@/lib/nearby/constants'
import { colors } from '@/constants/colors'

export type NearbySortKey = 'score' | 'like' | 'visited'

const IconHeart = ({ size = 20 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={HEART_ICON.filled}>
    <Path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </Svg>
)

const IconCheck = ({ size = 20, color = colors.textPrimary }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Rect x={3} y={3} width={18} height={18} rx={6} stroke={color} strokeWidth={2} />
    <Path d="M7.6 12.4l2.9 2.9 6-6.6" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
)

const OPTIONS: { key: NearbySortKey; label: string; sub: string }[] = [
  { key: 'score', label: 'AIおすすめ', sub: 'AIが総合的にスコアリングした順' },
  { key: 'like', label: 'いいね', sub: 'お気に入りに登録したスポット' },
  { key: 'visited', label: '行った', sub: 'チェックインしたスポット' },
]

function SortIcon({ k, active }: { k: NearbySortKey; active: boolean }) {
  if (k === 'score') return <IconAiBadge size={22} monochrome={active ? undefined : '#9a9a96'} />
  if (k === 'like') return <IconHeart />
  return <IconCheck color={MAP_VISITED_CHECK_COLOR} />
}

/** 並び替え（AIおすすめ / いいね / 行った）の選択ポップアップ。ジャンル選択と同系のUI。 */
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
    borderColor: colors.border,
    padding: 16,
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  title: { fontSize: 14, fontWeight: '800', color: colors.textPrimary, marginBottom: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: 14,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: '#efefef',
  },
  rowOn: { backgroundColor: colors.tintStrong, borderColor: colors.primary },
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
  iconCircleOn: { borderColor: colors.primary },
  rowText: { flex: 1 },
  rowLabel: { fontSize: 14, fontWeight: '800', color: '#888' },
  rowLabelOn: { color: colors.textPrimary },
  rowSub: { fontSize: 11, color: '#aaa', marginTop: 2 },
})
