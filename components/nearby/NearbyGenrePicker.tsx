import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { GenreIcon } from '@/components/nearby/GenreIcon'
import { MAP_GENRE_CHIPS, type MapGenreKey } from '@/lib/nearby/constants'
import { colors } from '@/constants/colors'

export function NearbyGenrePicker({
  visible,
  genre,
  onSelect,
  onClose,
  topOffset,
}: {
  visible: boolean
  genre: MapGenreKey
  onSelect: (g: MapGenreKey) => void
  onClose: () => void
  topOffset: number
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.card, { marginTop: topOffset }]} onPress={() => {}}>
          <Text style={styles.title}>ジャンルを選ぶ</Text>
          <View style={styles.grid}>
            {MAP_GENRE_CHIPS.map((g) => {
              const active = g.key === genre
              return (
                <Pressable
                  key={g.key}
                  style={[styles.tile, active && styles.tileOn]}
                  onPress={() => {
                    onSelect(g.key)
                    onClose()
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <View style={[styles.iconCircle, active && styles.iconCircleOn]}>
                    <GenreIcon genre={g.key} size={22} color={active ? colors.textPrimary : '#777'} />
                  </View>
                  <Text style={[styles.tileTxt, active && styles.tileTxtOn]}>{g.label}</Text>
                </Pressable>
              )
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center',
  },
  card: {
    width: '92%',
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  title: { fontSize: 14, fontWeight: '800', color: colors.textPrimary, marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: {
    width: '31%',
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: '#efefef',
    gap: 6,
  },
  tileOn: { backgroundColor: colors.tintStrong, borderColor: colors.primary },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ececec',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  tileTxt: { fontSize: 12, fontWeight: '700', color: '#888' },
  tileTxtOn: { color: colors.textPrimary },
})
