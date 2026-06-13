import type { ReactNode } from 'react'
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { GenreIcon } from '@/components/nearby/GenreIcon'
import {
  MAP_GENRE_CHIPS,
  MAP_GENRE_COLOR,
  MAP_LIKE_COLOR,
  type MapGenreKey,
} from '@/lib/nearby/constants'
import { GOOGLE_HOME } from '@/constants/google-home-tokens'
import { isSameMapFilter, type MapFilter } from '@/lib/nearby/map-filter'

const HeartIcon = ({ color, size = 14 }: { color: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <Path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </Svg>
)

export function MapFilterBar({
  active,
  onSelect,
  topInset,
}: {
  active: MapFilter | null
  onSelect: (filter: MapFilter) => void
  topInset: number
}) {
  const chip = (f: MapFilter, icon: ReactNode, label: string, accent: string) => {
    const on = isSameMapFilter(active, f)
    return (
      <TouchableOpacity
        key={f.kind === 'genre' ? f.genre : f.kind}
        style={[styles.chip, on && styles.chipOn, on && { borderColor: accent }]}
        onPress={() => onSelect(f)}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityState={{ selected: on }}
      >
        {icon}
        <Text style={[styles.chipTxt, on && styles.chipTxtOn]}>{label}</Text>
      </TouchableOpacity>
    )
  }

  return (
    <View style={[styles.wrap, { paddingTop: topInset }]} pointerEvents="box-none">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        style={styles.scroll}
      >
        {chip(
          { kind: 'like' },
          <HeartIcon color={MAP_LIKE_COLOR} />,
          'いいね',
          MAP_LIKE_COLOR
        )}
        {MAP_GENRE_CHIPS.map((g) =>
          chip(
            { kind: 'genre', genre: g.key as MapGenreKey },
            <GenreIcon genre={g.key} size={16} color={MAP_GENRE_COLOR[g.key]} />,
            g.label,
            MAP_GENRE_COLOR[g.key]
          )
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    zIndex: 4,
    pointerEvents: 'box-none',
  },
  scroll: { flexGrow: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: GOOGLE_HOME.mapChipBg,
    borderWidth: 1.5,
    borderColor: GOOGLE_HOME.mapChipBorder,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  chipOn: {
    backgroundColor: 'rgba(255,255,255,0.94)',
    shadowOpacity: 0.18,
    shadowRadius: 11,
  },
  chipTxt: { fontSize: 13, fontWeight: '700', color: GOOGLE_HOME.mapChipText },
  chipTxtOn: { fontWeight: '800' },
})
