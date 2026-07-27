import { useState } from 'react'
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { Ionicons } from '@expo/vector-icons'
import { GenreIcon } from '@/components/nearby/GenreIcon'
import {
  MAP_GENRE_CHIPS,
  MAP_GENRE_COLOR,
  MAP_LIKE_COLOR,
  type MapGenreKey,
} from '@/lib/nearby/constants'
import { colors } from '@/constants/colors'
import { GOOGLE_HOME } from '@/constants/google-home-tokens'
import { activeConditionCount, type MapConditionFilter } from '@/lib/nearby/map-filter'
import { INDOOR_OK_FILTER_LABEL, TERRACE_OK_FILTER_LABEL } from '@/lib/nearby/pet-policy'

const HeartIcon = ({ color, size = 14 }: { color: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <Path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </Svg>
)

/**
 * 地図フィルタバー。
 * - 最左: じょうご（条件フィルタの格納ボタン）。タップで「店内OK・テラスOK・いいね」の条件行を開閉
 * - 以降: ジャンルチップ（単独トグル。もう一度タップで解除＝全ジャンル表示）
 * - 条件とジャンルは直交して重ね掛けできる
 */
export function MapFilterBar({
  genre,
  conditions,
  onSelectGenre,
  onToggleCondition,
  topInset,
}: {
  genre: MapGenreKey | null
  conditions: MapConditionFilter
  onSelectGenre: (genre: MapGenreKey | null) => void
  onToggleCondition: (key: keyof MapConditionFilter) => void
  topInset: number
}) {
  const [conditionsOpen, setConditionsOpen] = useState(false)
  const conditionCount = activeConditionCount(conditions)

  const conditionChip = (key: keyof MapConditionFilter, icon: React.ReactNode, label: string) => {
    const on = conditions[key]
    return (
      <TouchableOpacity
        key={key}
        style={[styles.chip, on && styles.chipOn, on && { borderColor: colors.brand }]}
        onPress={() => onToggleCondition(key)}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityState={{ selected: on }}
        accessibilityLabel={`${label}で絞り込み`}
      >
        {icon}
        <Text style={[styles.chipTxt, on && styles.chipTxtOn, on && { color: colors.brand }]}>{label}</Text>
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
        {/* じょうご: 条件フィルタ（店内OK・テラスOK・いいね）の格納ボタン */}
        <TouchableOpacity
          style={[styles.funnelBtn, (conditionsOpen || conditionCount > 0) && styles.funnelBtnOn]}
          onPress={() => setConditionsOpen((v) => !v)}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityState={{ expanded: conditionsOpen }}
          accessibilityLabel="条件フィルタを開く"
        >
          <Ionicons
            name="filter"
            size={18}
            color={conditionCount > 0 ? colors.brand : GOOGLE_HOME.mapChipText}
          />
          {conditionCount > 0 ? (
            <View style={styles.funnelBadge}>
              <Text style={styles.funnelBadgeTxt}>{conditionCount}</Text>
            </View>
          ) : null}
        </TouchableOpacity>

        {MAP_GENRE_CHIPS.map((g) => {
          const key = g.key as MapGenreKey
          const on = genre === key
          return (
            <TouchableOpacity
              key={key}
              style={[styles.chip, on && styles.chipOn, on && { borderColor: MAP_GENRE_COLOR[key] }]}
              onPress={() => onSelectGenre(on ? null : key)}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
            >
              <GenreIcon genre={g.key} size={16} color={MAP_GENRE_COLOR[key]} />
              <Text style={[styles.chipTxt, on && styles.chipTxtOn]}>{g.label}</Text>
            </TouchableOpacity>
          )
        })}
      </ScrollView>

      {conditionsOpen ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.row}
          style={styles.scroll}
        >
          {conditionChip('indoorOnly', <Ionicons name="home" size={15} color={colors.brand} />, INDOOR_OK_FILTER_LABEL)}
          {conditionChip('terraceOnly', <Ionicons name="sunny" size={15} color={colors.brand} />, TERRACE_OK_FILTER_LABEL)}
          {conditionChip('likedOnly', <HeartIcon color={MAP_LIKE_COLOR} />, 'いいね')}
        </ScrollView>
      ) : null}
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
  funnelBtn: {
    width: 40,
    height: 36,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GOOGLE_HOME.mapChipBg,
    borderWidth: 1.5,
    borderColor: GOOGLE_HOME.mapChipBorder,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  funnelBtnOn: {
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderColor: colors.brand,
  },
  funnelBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  funnelBadgeTxt: { fontSize: 10, fontWeight: '800', color: '#fff' },
})
