import { useEffect, useMemo, useState } from 'react'
import { FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { TOKENS } from '@/constants/color-tokens'
import { listMunicipalities, listPrefectures } from '@/constants/municipality-centers'
import { formatAiPlanDogDisplayName } from '@/lib/ai-plan/formatters'

export type DurationPick = 'half_day' | 'full_day'
export type TravelPick = 'walking' | 'driving'
export type MoodPick = 'active' | 'relaxed'
export type DogSize = 'XS' | 'S' | 'M' | 'L' | 'XL'

const SIZE_LABEL: Record<DogSize, string> = {
  XS: '超小型犬（〜3kg）',
  S: '小型犬（3〜10kg）',
  M: '中型犬（10〜25kg）',
  L: '大型犬（25〜40kg）',
  XL: '超大型犬（40kg〜）',
}

const SIZE_LABEL_SHORT: Record<DogSize, string> = {
  XS: '超小型犬',
  S: '小型犬',
  M: '中型犬',
  L: '大型犬',
  XL: '超大型犬',
}

function SelectorRow({
  label,
  selected,
  onPress,
  disabled,
}: {
  label: string
  selected: boolean
  onPress: () => void
  disabled?: boolean
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={[styles.selector, selected ? styles.selectorOn : styles.selectorOff, disabled && styles.selectorDisabled]}
      activeOpacity={0.85}
    >
      <Text style={[styles.selectorTxt, selected ? styles.selectorTxtOn : styles.selectorTxtOff]} numberOfLines={1}>
        {label || '選択'}
      </Text>
      <Text style={styles.selectorChevron}>▼</Text>
    </TouchableOpacity>
  )
}

function PickerModal({
  visible,
  title,
  items,
  onClose,
  onPick,
}: {
  visible: boolean
  title: string
  items: string[]
  onClose: () => void
  onPick: (item: string) => void
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBg} onPress={onClose}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>{title}</Text>
          <FlatList
            data={items}
            keyExtractor={(item) => item}
            style={styles.modalList}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <Pressable
                style={styles.modalRow}
                onPress={() => {
                  onPick(item)
                  onClose()
                }}
              >
                <Text style={styles.modalRowTxt}>{item}</Text>
              </Pressable>
            )}
          />
        </View>
      </Pressable>
    </Modal>
  )
}

function MoodCard({
  type,
  selected,
  onPress,
}: {
  type: 'active' | 'relaxed'
  selected: boolean
  onPress: () => void
}) {
  const main = type === 'active' ? 'アクティブ' : 'のんびり'
  const sub = type === 'active' ? 'しっかり運動' : 'カフェ中心'
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.moodCard, selected ? styles.moodCardOn : styles.moodCardOff]}
      activeOpacity={0.88}
    >
      <Text style={[styles.moodMain, selected ? styles.moodMainOn : styles.moodMainOff]}>{main}</Text>
      <Text style={[styles.moodSub, selected ? styles.moodSubOn : styles.moodSubOff]}>{sub}</Text>
    </TouchableOpacity>
  )
}

export function AiPlanInputForm({
  initialDogName,
  dbDogSize,
  onSubmit,
  onCancel,
  areaPreset,
}: {
  initialDogName: string
  dbDogSize: DogSize | null
  onSubmit: (v: {
    prefecture: string
    municipality: string
    duration: DurationPick
    travel_mode: TravelPick
    mood: MoodPick
    dogSize: DogSize
  }) => void
  onCancel: () => void
  areaPreset?: { prefecture: string; municipality: string } | null
}) {
  const prefs = useMemo(() => listPrefectures(), [])
  const [pref, setPref] = useState<string>('')
  const [muni, setMuni] = useState<string>('')

  const munis = useMemo(() => (pref ? listMunicipalities(pref) : []), [pref])

  const [duration, setDuration] = useState<DurationPick | null>(null)
  const [travel, setTravel] = useState<TravelPick | null>(null)
  const [mood, setMood] = useState<MoodPick | null>(null)

  const [overrideSize, setOverrideSize] = useState<DogSize | null>(null)
  const [sizePickerOpen, setSizePickerOpen] = useState(false)
  const [prefOpen, setPrefOpen] = useState(false)
  const [muniOpen, setMuniOpen] = useState(false)

  useEffect(() => {
    if (!areaPreset) return
    if (areaPreset.prefecture) setPref(areaPreset.prefecture)
    if (areaPreset.municipality) setMuni(areaPreset.municipality)
  }, [areaPreset])

  useEffect(() => {
    if (!pref) return
    if (munis.length > 0 && !munis.includes(muni)) {
      setMuni('')
    }
  }, [pref, munis, muni])

  const effectiveSize = overrideSize ?? dbDogSize
  const canSubmit = !!pref && !!muni && !!duration && !!travel && !!mood && !!effectiveSize

  const dogDisplay = formatAiPlanDogDisplayName(initialDogName)
  const sizeShort = effectiveSize ? SIZE_LABEL_SHORT[effectiveSize] : ''

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.scroll}>
      <View style={styles.areaCard}>
        <View style={styles.areaHead}>
          <Text style={styles.areaTitle}>エリア</Text>
          <Text style={styles.areaMeta}>全国対応</Text>
        </View>
        <View style={styles.areaRow}>
          <View style={styles.areaCol}>
            <SelectorRow
              label={pref || '都道府県'}
              selected={!!pref}
              onPress={() => setPrefOpen(true)}
            />
          </View>
          <View style={styles.areaCol}>
            <SelectorRow
              label={muni ? muni.replace(pref, '').trim() || muni : '市区町村'}
              selected={!!muni}
              disabled={!pref}
              onPress={() => {
                if (pref) setMuniOpen(true)
              }}
            />
          </View>
        </View>
      </View>

      <View style={styles.row2}>
        <View style={styles.halfCard}>
          <Text style={styles.cardLabel}>所要時間</Text>
          <View style={styles.segRow}>
            <TouchableOpacity
              onPress={() => setDuration('half_day')}
              style={[styles.seg, duration === 'half_day' ? styles.segOn : styles.segOff]}
            >
              <Text style={[styles.segTxt, duration === 'half_day' ? styles.segTxtOn : styles.segTxtOff]}>半日</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setDuration('full_day')}
              style={[styles.seg, duration === 'full_day' ? styles.segOn : styles.segOff]}
            >
              <Text style={[styles.segTxt, duration === 'full_day' ? styles.segTxtOn : styles.segTxtOff]}>1日</Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.halfCard}>
          <Text style={styles.cardLabel}>移動手段</Text>
          <View style={styles.segRow}>
            <TouchableOpacity
              onPress={() => setTravel('walking')}
              style={[styles.seg, travel === 'walking' ? styles.segOn : styles.segOff]}
            >
              <Text style={[styles.segTxt, travel === 'walking' ? styles.segTxtOn : styles.segTxtOff]}>🚶 徒歩</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setTravel('driving')}
              style={[styles.seg, travel === 'driving' ? styles.segOn : styles.segOff]}
            >
              <Text style={[styles.segTxt, travel === 'driving' ? styles.segTxtOn : styles.segTxtOff]}>🚗 車</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={styles.moodWrap}>
        <Text style={styles.cardLabel}>ムード</Text>
        <View style={styles.moodRow}>
          <MoodCard type="active" selected={mood === 'active'} onPress={() => setMood('active')} />
          <MoodCard type="relaxed" selected={mood === 'relaxed'} onPress={() => setMood('relaxed')} />
        </View>
      </View>

      <View style={styles.dogBadge}>
        <View style={styles.dogIcon}>
          <Text style={styles.dogEmoji}>🐕</Text>
        </View>
        <View style={styles.dogTextCol}>
          <Text style={styles.dogLine}>
            {effectiveSize ? `${dogDisplay}（${sizeShort}）でプラン作成` : `${dogDisplay}でプラン作成（サイズ未設定）`}
          </Text>
        </View>
        <TouchableOpacity onPress={() => setSizePickerOpen(true)} hitSlop={8}>
          <Text style={styles.dogEdit}>{effectiveSize ? '変更' : 'サイズを選ぶ'}</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.submit, !canSubmit && styles.submitOff]}
        disabled={!canSubmit}
        onPress={() => {
          if (!duration || !travel || !mood || !effectiveSize) return
          onSubmit({ prefecture: pref, municipality: muni, duration, travel_mode: travel, mood, dogSize: effectiveSize })
        }}
      >
        <Text style={[styles.submitTxt, !canSubmit && styles.submitTxtOff]}>この内容でプランを作る →</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
        <Text style={styles.cancelTxt}>戻る</Text>
      </TouchableOpacity>

      <PickerModal
        visible={prefOpen}
        title="都道府県"
        items={prefs}
        onClose={() => setPrefOpen(false)}
        onPick={(p) => {
          setPref(p)
          setMuni('')
        }}
      />
      <PickerModal
        visible={muniOpen}
        title="市区町村"
        items={munis}
        onClose={() => setMuniOpen(false)}
        onPick={setMuni}
      />

      <Modal visible={sizePickerOpen} transparent animationType="fade" onRequestClose={() => setSizePickerOpen(false)}>
        <Pressable style={styles.modalBg} onPress={() => setSizePickerOpen(false)}>
          <View style={styles.sizeModalCard}>
            <Text style={styles.sizeModalTitle}>サイズを選択</Text>
            <View style={{ gap: 10 }}>
              {(Object.keys(SIZE_LABEL) as DogSize[]).map((k) => (
                <Pressable
                  key={k}
                  style={[styles.sizeRow, (overrideSize ?? dbDogSize) === k && styles.sizeRowOn]}
                  onPress={() => {
                    setOverrideSize(k)
                    setSizePickerOpen(false)
                  }}
                >
                  <Text style={styles.sizeRowTxt}>
                    {k} {SIZE_LABEL[k]}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </Pressable>
      </Modal>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: TOKENS.surface.secondary },
  scroll: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 10,
    paddingBottom: 32,
  },
  areaCard: {
    backgroundColor: TOKENS.surface.primary,
    borderWidth: 1,
    borderColor: TOKENS.border.default,
    borderRadius: 14,
    padding: 13,
    paddingHorizontal: 14,
  },
  areaHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  areaTitle: { fontSize: 12, fontWeight: '700', color: TOKENS.text.primary },
  areaMeta: { fontSize: 10, color: TOKENS.text.meta },
  areaRow: { flexDirection: 'row', gap: 6 },
  areaCol: { flex: 1 },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    gap: 6,
  },
  selectorDisabled: { opacity: 0.45 },
  selectorOff: {
    backgroundColor: TOKENS.surface.secondary,
    borderColor: TOKENS.border.default,
  },
  selectorOn: {
    backgroundColor: TOKENS.surface.primary,
    borderWidth: 2,
    borderColor: TOKENS.text.primary,
  },
  selectorTxt: { fontSize: 11, flex: 1 },
  selectorTxtOn: { color: TOKENS.text.primary, fontWeight: '600' },
  selectorTxtOff: { color: TOKENS.text.secondary },
  selectorChevron: { fontSize: 9, color: TOKENS.text.meta },
  row2: { flexDirection: 'row', gap: 10 },
  halfCard: {
    flex: 1,
    backgroundColor: TOKENS.surface.primary,
    borderWidth: 1,
    borderColor: TOKENS.border.default,
    borderRadius: 14,
    padding: 13,
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: TOKENS.text.primary,
    marginBottom: 8,
  },
  segRow: { flexDirection: 'row', gap: 5 },
  seg: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segOn: { backgroundColor: TOKENS.brand.yellow },
  segOff: { backgroundColor: TOKENS.surface.alt },
  segTxt: { fontSize: 11, textAlign: 'center' },
  segTxtOn: { fontWeight: '700', color: TOKENS.text.primary },
  segTxtOff: { color: TOKENS.text.secondary },
  moodWrap: {
    backgroundColor: TOKENS.surface.primary,
    borderWidth: 1,
    borderColor: TOKENS.border.default,
    borderRadius: 14,
    padding: 13,
    paddingHorizontal: 14,
  },
  moodRow: { flexDirection: 'row', gap: 6 },
  moodCard: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    alignItems: 'center',
  },
  moodCardOn: { backgroundColor: TOKENS.brand.yellow },
  moodCardOff: {
    backgroundColor: TOKENS.surface.secondary,
    borderWidth: 1,
    borderColor: TOKENS.border.default,
  },
  moodMain: { fontSize: 11, fontWeight: '700', textAlign: 'center' },
  moodMainOn: { color: TOKENS.text.primary },
  moodMainOff: { color: TOKENS.text.secondary },
  moodSub: { fontSize: 9, marginTop: 2, textAlign: 'center' },
  moodSubOn: { color: TOKENS.text.secondary },
  moodSubOff: { color: TOKENS.text.tertiary },
  dogBadge: {
    backgroundColor: TOKENS.brand.yellowLight,
    borderWidth: 1,
    borderColor: TOKENS.brand.yellow,
    borderRadius: 12,
    padding: 9,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dogIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: TOKENS.brand.yellow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dogEmoji: { fontSize: 12 },
  dogTextCol: { flex: 1 },
  dogLine: { fontSize: 11, color: TOKENS.text.primary, fontWeight: '600' },
  dogEdit: { fontSize: 10, color: TOKENS.text.secondary, fontWeight: '600' },
  submit: {
    marginTop: 4,
    backgroundColor: TOKENS.brand.yellow,
    borderRadius: 14,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitOff: { backgroundColor: TOKENS.surface.alt },
  submitTxt: { fontSize: 14, fontWeight: '700', color: TOKENS.text.primary },
  submitTxtOff: { color: TOKENS.text.hint },
  cancelBtn: { paddingVertical: 12, alignItems: 'center' },
  cancelTxt: { fontSize: 13, fontWeight: '600', color: TOKENS.text.secondary },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', padding: 16 },
  modalCard: {
    borderRadius: 16,
    backgroundColor: TOKENS.surface.primary,
    borderWidth: 1,
    borderColor: TOKENS.border.default,
    padding: 14,
    maxHeight: '70%',
  },
  modalTitle: { fontSize: 14, fontWeight: '700', color: TOKENS.text.primary, marginBottom: 10 },
  modalList: { flexGrow: 0 },
  modalRow: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: TOKENS.border.default,
  },
  modalRowTxt: { fontSize: 13, color: TOKENS.text.primary },
  sizeModalCard: {
    borderRadius: 16,
    backgroundColor: TOKENS.surface.primary,
    borderWidth: 1,
    borderColor: TOKENS.border.default,
    padding: 14,
  },
  sizeModalTitle: { fontSize: 14, fontWeight: '700', color: TOKENS.text.primary, marginBottom: 10 },
  sizeRow: {
    borderRadius: 12,
    backgroundColor: TOKENS.surface.tertiary,
    borderWidth: 1,
    borderColor: TOKENS.border.default,
    padding: 12,
  },
  sizeRowOn: { backgroundColor: TOKENS.brand.yellowLight, borderColor: TOKENS.brand.yellow },
  sizeRowTxt: { fontSize: 12, fontWeight: '700', color: TOKENS.text.primary },
})
