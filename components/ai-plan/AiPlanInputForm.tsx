import { useEffect, useMemo, useState } from 'react'
import { Ionicons } from '@expo/vector-icons'
import { FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { sortMunicipalityNames } from '@/constants/municipality-sort'
import { listMunicipalities, listPrefectures } from '@/constants/municipality-centers'
import { sortPrefecturesJis } from '@/constants/prefectures'
import { formatAiPlanDogDisplayName } from '@/lib/ai-plan/formatters'
import { checkAiPlanFeasibility } from '@/lib/wanspot-api'
import { SegmentedControl } from '@/components/common/SegmentedControl'
import { MoodCard } from '@/components/common/MoodCard'

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
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.selector,
        selected ? styles.selectorOn : styles.selectorOff,
        disabled && styles.selectorDisabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <Text style={[styles.selectorTxt, selected ? styles.selectorTxtOn : styles.selectorTxtOff]} numberOfLines={1}>
        {label || '選択'}
      </Text>
      <Text style={styles.selectorChevron}>▼</Text>
    </Pressable>
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
            initialNumToRender={12}
            maxToRenderPerBatch={10}
            windowSize={10}
            removeClippedSubviews
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
  const prefs = useMemo(() => sortPrefecturesJis(listPrefectures()), [])
  const [pref, setPref] = useState<string>('')
  const [muni, setMuni] = useState<string>('')

  const munis = useMemo(
    () => (pref ? sortMunicipalityNames(listMunicipalities(pref)) : []),
    [pref]
  )

  const [duration, setDuration] = useState<DurationPick | null>(null)
  const [travel, setTravel] = useState<TravelPick | null>(null)
  const [mood, setMood] = useState<MoodPick | null>(null)

  const [overrideSize, setOverrideSize] = useState<DogSize | null>(null)
  const [sizePickerOpen, setSizePickerOpen] = useState(false)
  const [prefOpen, setPrefOpen] = useState(false)
  const [muniOpen, setMuniOpen] = useState(false)

  const [feasibility, setFeasibility] = useState<{
    walking_feasible: boolean
    driving_feasible: boolean
    loading: boolean
  }>({ walking_feasible: true, driving_feasible: true, loading: false })

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

  useEffect(() => {
    if (!pref || !muni) {
      setFeasibility({ walking_feasible: true, driving_feasible: true, loading: false })
      return
    }
    setFeasibility((prev) => ({ ...prev, loading: true }))
    let cancelled = false
    void checkAiPlanFeasibility(pref, muni).then((result) => {
      if (cancelled) return
      setFeasibility({
        walking_feasible: result.walking_feasible,
        driving_feasible: result.driving_feasible,
        loading: false,
      })
      setTravel((prevPick) => {
        if (result.walking_feasible && result.driving_feasible) return prevPick
        if (result.walking_feasible) return 'walking'
        if (result.driving_feasible) return 'driving'
        return null
      })
    })
    return () => {
      cancelled = true
    }
  }, [pref, muni])

  const effectiveSize = overrideSize ?? dbDogSize
  const isFormValid = !!pref && !!muni && !!duration && !!travel && !!mood && !!effectiveSize

  const dogDisplay = formatAiPlanDogDisplayName(initialDogName)
  const sizeShort = effectiveSize ? SIZE_LABEL_SHORT[effectiveSize] : ''

  return (
    <View style={styles.screen}>
      <ScrollView style={styles.root} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>エリア</Text>
          <View style={styles.row}>
            <View style={styles.flex1}>
              <SelectorRow label={pref || '都道府県'} selected={!!pref} onPress={() => setPrefOpen(true)} />
            </View>
            <View style={styles.flex1}>
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

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>所要時間</Text>
          <SegmentedControl
            options={[
              { label: '半日', value: 'half_day' },
              { label: '1日', value: 'full_day' },
            ]}
            value={duration ?? ''}
            onChange={(v) => setDuration(v === 'full_day' ? 'full_day' : 'half_day')}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>移動手段</Text>
          <SegmentedControl
            options={[
              {
                label: '徒歩',
                value: 'walking',
                icon: 'walk-outline',
                disabled: !feasibility.loading && !feasibility.walking_feasible,
              },
              {
                label: '車',
                value: 'driving',
                icon: 'car-outline',
                disabled: !feasibility.loading && !feasibility.driving_feasible,
              },
            ]}
            value={travel ?? ''}
            onChange={(v) => setTravel(v === 'driving' ? 'driving' : 'walking')}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ムード</Text>
          <View style={styles.moodGrid}>
            <MoodCard title="アクティブ" subtitle="しっかり運動" selected={mood === 'active'} onPress={() => setMood('active')} />
            <MoodCard title="のんびり" subtitle="カフェ中心" selected={mood === 'relaxed'} onPress={() => setMood('relaxed')} />
          </View>
        </View>

        <Pressable
          style={({ pressed }) => [styles.dogSelectRow, pressed && styles.dogSelectRowPressed]}
          onPress={() => setSizePickerOpen(true)}
        >
          <View style={styles.dogSelectLeft}>
            <Text style={styles.dogSelectIcon}>🐾</Text>
            <Text style={styles.dogSelectText} numberOfLines={1} ellipsizeMode="tail">
              {effectiveSize ? `${dogDisplay}（${sizeShort}）でプラン作成` : `${dogDisplay}でプラン作成（サイズ未設定）`}
            </Text>
          </View>
          <Text style={styles.dogSelectChange}>{effectiveSize ? '変更' : '選択'}</Text>
        </Pressable>

        <Pressable style={styles.cancelBtn} onPress={onCancel}>
          <Text style={styles.cancelTxt}>戻る</Text>
        </Pressable>

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
              <View style={{ gap: 12 }}>
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

      <View style={styles.ctaContainer}>
        <Pressable
          disabled={!isFormValid}
          style={({ pressed }) => [
            styles.ctaButton,
            !isFormValid && styles.ctaButtonDisabled,
            pressed && isFormValid && styles.ctaButtonPressed,
          ]}
          onPress={() => {
            if (!duration || !travel || !mood || !effectiveSize) return
            onSubmit({ prefecture: pref, municipality: muni, duration, travel_mode: travel, mood, dogSize: effectiveSize })
          }}
        >
          <Text style={[styles.ctaText, !isFormValid && styles.ctaTextDisabled]}>この内容でプランを作る</Text>
          {isFormValid ? <Ionicons name="arrow-forward" size={18} color="#1A1A1A" /> : null}
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FAFAF8' },
  root: { flex: 1, backgroundColor: '#FAFAF8' },
  scroll: {
    paddingTop: 16,
    paddingBottom: 140,
    gap: 16,
  },
  pressed: { transform: [{ scale: 0.97 }], opacity: 0.9 },
  section: { paddingHorizontal: 16 },
  sectionTitle: { fontSize: 12, color: '#999', marginBottom: 8, fontWeight: '500' },
  row: { flexDirection: 'row', gap: 12 },
  flex1: { flex: 1 },
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
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E5E5',
  },
  selectorOn: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E5E5',
  },
  selectorTxt: { fontSize: 14, flex: 1 },
  selectorTxtOn: { color: '#1A1A1A', fontWeight: '600' },
  selectorTxtOff: { color: '#666' },
  selectorChevron: { fontSize: 9, color: '#999' },
  moodGrid: { flexDirection: 'row', gap: 12 },
  dogSelectRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginVertical: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  dogSelectRowPressed: { opacity: 0.6 },
  dogSelectLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  dogSelectIcon: { fontSize: 18 },
  dogSelectText: { flex: 1, fontSize: 13, color: '#666' },
  dogSelectChange: { fontSize: 13, color: '#999', fontWeight: '600' },
  cancelBtn: { paddingVertical: 12, alignItems: 'center' },
  cancelTxt: { fontSize: 13, fontWeight: '600', color: '#666' },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', padding: 16 },
  modalCard: {
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F0F0F0',
    padding: 14,
    maxHeight: '70%',
  },
  modalTitle: { fontSize: 14, fontWeight: '700', color: '#1A1A1A', marginBottom: 10 },
  modalList: { flexGrow: 0 },
  modalRow: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F0F0F0',
  },
  modalRowTxt: { fontSize: 13, color: '#1A1A1A' },
  sizeModalCard: {
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F0F0F0',
    padding: 14,
  },
  sizeModalTitle: { fontSize: 14, fontWeight: '700', color: '#1A1A1A', marginBottom: 10 },
  sizeRow: {
    borderRadius: 12,
    backgroundColor: '#F5F4F0',
    borderWidth: 1,
    borderColor: '#F0F0F0',
    padding: 12,
  },
  sizeRowOn: { backgroundColor: '#FFD84D', borderColor: '#e8c44a' },
  sizeRowTxt: { fontSize: 12, fontWeight: '700', color: '#1A1A1A' },
  ctaContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
    backgroundColor: '#FAFAF8',
    borderTopWidth: 1,
    borderTopColor: '#EEE',
  },
  ctaButton: {
    backgroundColor: '#FFC107',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  ctaButtonDisabled: { backgroundColor: '#E5E5E5' },
  ctaButtonPressed: { backgroundColor: '#FFB300', transform: [{ scale: 0.98 }] },
  ctaText: { fontSize: 16, fontWeight: '700', color: '#1A1A1A' },
  ctaTextDisabled: { color: '#999' },
})
