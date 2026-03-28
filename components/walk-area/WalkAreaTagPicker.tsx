import { useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { colors } from '@/constants/colors'
import { catalogEntryByLabel, searchWalkAreaCatalog, suggestedWalkAreasNear } from '@/lib/walk-area-catalog'
import { MAX_WALK_AREA_TAGS } from '@/lib/walk-area-tags'

export type WalkAreaTagPickerProps = {
  anchor: { lat: number; lng: number } | null
  value: string[]
  onChange: (tags: string[]) => void
  maxTags?: number
}

export function WalkAreaTagPicker({ anchor, value, onChange, maxTags = MAX_WALK_AREA_TAGS }: WalkAreaTagPickerProps) {
  const [search, setSearch] = useState('')
  const max = maxTags

  const suggested = useMemo(() => {
    if (!anchor) return []
    return suggestedWalkAreasNear(anchor.lat, anchor.lng, 10_000, 48)
  }, [anchor])

  const searchHits = useMemo(() => {
    return searchWalkAreaCatalog(search, 80)
  }, [search])

  const toggleLabel = (label: string) => {
    const t = label.trim()
    if (!t) return
    if (value.includes(t)) {
      onChange(value.filter((x) => x !== t))
      return
    }
    if (value.length >= max) return
    onChange([...value, t])
  }

  const removeLabel = (label: string) => {
    onChange(value.filter((x) => x !== label))
  }

  const suggestedToShow = suggested.filter((e) => !value.includes(e.label))
  const searchToShow = searchHits.filter((e) => !value.includes(e.label))

  return (
    <View style={styles.wrap}>
      <Text style={styles.sectionLbl}>選択中（最大{max}つ）</Text>
      {value.length === 0 ? (
        <Text style={styles.emptySel}>まだありません。下のエリアをタップして追加してください。</Text>
      ) : (
        <View style={styles.chipRow}>
          {value.map((lbl) => (
            <Pressable key={lbl} style={styles.chipOn} onPress={() => removeLabel(lbl)} accessibilityRole="button">
              <Text style={styles.chipOnTxt}>{lbl}</Text>
              <Text style={styles.chipRemove}>×</Text>
            </Pressable>
          ))}
        </View>
      )}

      <Text style={[styles.sectionLbl, styles.mt]}>エリアを検索</Text>
      <TextInput
        style={styles.searchInp}
        value={search}
        onChangeText={setSearch}
        placeholder="例：世田谷、横浜、大阪"
        placeholderTextColor={colors.textMuted}
        autoCorrect={false}
        autoCapitalize="none"
      />

      {search.trim().length > 0 ? (
        <>
          <Text style={styles.hintSub}>検索結果（タップで追加）</Text>
          {searchToShow.length === 0 ? (
            <Text style={styles.emptySel}>一致する主要エリアがありません。</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
              {searchToShow.map((e) => (
                <Pressable
                  key={e.id}
                  style={[styles.chipOff, value.length >= max && styles.chipDis]}
                  disabled={value.length >= max}
                  onPress={() => toggleLabel(e.label)}
                >
                  <Text style={styles.chipOffTxt}>{e.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
          )}
        </>
      ) : null}

      <Text style={[styles.sectionLbl, styles.mt]}>
        {anchor ? '近くの主要エリア（現在地から約10km以内）' : '近くの主要エリア'}
      </Text>
      {!anchor ? (
        <Text style={styles.hintSub}>位置情報を許可すると、現在地周辺の候補を表示します。検索からも選べます。</Text>
      ) : null}
      {anchor && suggestedToShow.length === 0 ? (
        <Text style={styles.emptySel}>10km以内の登録エリアが見つかりませんでした。検索をお試しください。</Text>
      ) : null}
      {suggestedToShow.length > 0 ? (
        <View style={styles.chipGrid}>
          {suggestedToShow.map((e) => (
            <Pressable
              key={e.id}
              style={[styles.chipOff, value.length >= max && styles.chipDis]}
              disabled={value.length >= max}
              onPress={() => toggleLabel(e.label)}
            >
              <Text style={styles.chipOffTxt}>{e.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  )
}

/** 保存済みタグのうちカタログに無いもの（旧データ用）を先頭に並べ替えた表示用配列 */
export function mergeUnknownWalkTags(saved: string[]): string[] {
  const known: string[] = []
  const unknown: string[] = []
  for (const s of saved) {
    const t = s.trim()
    if (!t) continue
    if (catalogEntryByLabel(t)) known.push(t)
    else unknown.push(t)
  }
  return [...unknown, ...known]
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'stretch' },
  sectionLbl: { fontSize: 13, fontWeight: '700', color: colors.text },
  mt: { marginTop: 14 },
  hintSub: { fontSize: 12, color: colors.textMuted, marginTop: 6, lineHeight: 17 },
  emptySel: { fontSize: 13, color: colors.textMuted, marginTop: 8, lineHeight: 19 },
  searchInp: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.cardBg,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  chipScroll: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingVertical: 8 },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  chipOn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.brandButton,
    borderWidth: 1,
    borderColor: colors.brandDark,
  },
  chipOnTxt: { fontSize: 13, fontWeight: '700', color: colors.text },
  chipRemove: { fontSize: 16, fontWeight: '700', color: colors.textMuted, marginLeft: 2 },
  chipOff: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardBg,
  },
  chipDis: { opacity: 0.45 },
  chipOffTxt: { fontSize: 13, fontWeight: '600', color: colors.text },
})
