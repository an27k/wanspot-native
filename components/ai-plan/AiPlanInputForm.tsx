import { useEffect, useMemo, useState } from 'react'
import { Ionicons } from '@expo/vector-icons'
import { FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { TAB_BAR_HEIGHT } from '@/constants/layout'
import { sortMunicipalityNames } from '@/constants/municipality-sort'
import { listMunicipalities, listPrefectures } from '@/constants/municipality-centers'
import { sortPrefecturesJis } from '@/constants/prefectures'
import { formatAiPlanDogDisplayName } from '@/lib/ai-plan/formatters'
import { checkAiPlanFeasibility, fetchAiPlanStations, type AiPlanStationItem } from '@/lib/wanspot-api'
import { AreaRequestForm } from '@/components/ai-plan/AreaRequestForm'
import { SegmentedControl } from '@/components/common/SegmentedControl'
import { MoodCard } from '@/components/common/MoodCard'
import { WanspotIconPaw } from '@/components/icons/WanspotIconPaw'
import { colors } from '@/constants/colors'

export type DurationHoursPick = 2 | 3 | 4 | 6 | 8
export type DeparturePick = 'now' | 'morning' | 'noon' | 'evening'
export type TravelPick = 'walking' | 'driving'
export type MoodPick = 'active' | 'relaxed'
export type DogSize = 'XS' | 'S' | 'M' | 'L' | 'XL'

const DURATION_OPTIONS: { label: string; value: DurationHoursPick }[] = [
  { label: '2時間', value: 2 },
  { label: '3時間', value: 3 },
  { label: '4時間', value: 4 },
  { label: '6時間', value: 6 },
  { label: '8時間', value: 8 },
]

const DEPARTURE_OPTIONS: { label: string; value: DeparturePick }[] = [
  { label: 'いまから', value: 'now' },
  { label: '朝 9:00', value: 'morning' },
  { label: '昼 12:00', value: 'noon' },
  { label: '夕方 16:00', value: 'evening' },
]

export function resolveDepartureIso(pick: DeparturePick): string {
  if (pick === 'now') return new Date().toISOString()
  const hour = pick === 'morning' ? 9 : pick === 'noon' ? 12 : 16
  const d = new Date()
  d.setHours(hour, 0, 0, 0)
  if (d.getTime() <= Date.now()) {
    d.setDate(d.getDate() + 1)
  }
  return d.toISOString()
}

function OptionChip({
  label,
  selected,
  onPress,
}: {
  label: string
  selected: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.optionChip,
        selected && styles.optionChipSelected,
        pressed && styles.optionChipPressed,
      ]}
    >
      <Text style={[styles.optionChipTxt, selected && styles.optionChipTxtSelected]}>{label}</Text>
    </Pressable>
  )
}

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
      <Ionicons name="chevron-down" size={14} color={selected ? colors.primary : '#999'} />
    </Pressable>
  )
}

/** Instagram 系のボトムシート型ピッカー */
function PickerSheet({
  visible,
  title,
  items,
  selectedItem,
  onClose,
  onPick,
}: {
  visible: boolean
  title: string
  items: string[]
  selectedItem?: string
  onClose: () => void
  onPick: (item: string) => void
}) {
  const insets = useSafeAreaInsets()
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetBg} onPress={onClose}>
        <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + 8 }]} onPress={(e) => e.stopPropagation()}>
          <View style={styles.sheetGrabber} />
          <Text style={styles.sheetTitle}>{title}</Text>
          <FlatList
            data={items}
            keyExtractor={(item) => item}
            style={styles.sheetList}
            keyboardShouldPersistTaps="handled"
            initialNumToRender={14}
            maxToRenderPerBatch={10}
            windowSize={10}
            removeClippedSubviews
            renderItem={({ item }) => {
              const isSelected = item === selectedItem
              return (
                <Pressable
                  style={({ pressed }) => [styles.sheetRow, pressed && styles.sheetRowPressed]}
                  onPress={() => {
                    onPick(item)
                    onClose()
                  }}
                >
                  <Text style={[styles.sheetRowTxt, isSelected && styles.sheetRowTxtOn]}>{item}</Text>
                  {isSelected ? <Ionicons name="checkmark" size={18} color={colors.primary} /> : null}
                </Pressable>
              )
            }}
          />
        </Pressable>
      </Pressable>
    </Modal>
  )
}

/** 駅ピッカー（任意選択） */
function StationPickerSheet({
  visible,
  stations,
  selectedId,
  onClose,
  onPick,
}: {
  visible: boolean
  stations: AiPlanStationItem[]
  selectedId?: string
  onClose: () => void
  onPick: (station: AiPlanStationItem | null) => void
}) {
  const insets = useSafeAreaInsets()
  const items = useMemo(
    () => [{ id: '', name: '指定なし（エリア中心）', lat: 0, lng: 0, distance_km: 0 }, ...stations],
    [stations]
  )
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetBg} onPress={onClose}>
        <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + 8 }]} onPress={(e) => e.stopPropagation()}>
          <View style={styles.sheetGrabber} />
          <Text style={styles.sheetTitle}>最寄り駅（任意）</Text>
          <FlatList
            data={items}
            keyExtractor={(item) => item.id || '__none__'}
            style={styles.sheetList}
            keyboardShouldPersistTaps="handled"
            initialNumToRender={14}
            maxToRenderPerBatch={10}
            windowSize={10}
            removeClippedSubviews
            renderItem={({ item }) => {
              const isNone = !item.id
              const isSelected = isNone ? !selectedId : item.id === selectedId
              return (
                <Pressable
                  style={({ pressed }) => [styles.sheetRow, pressed && styles.sheetRowPressed]}
                  onPress={() => {
                    onPick(isNone ? null : item)
                    onClose()
                  }}
                >
                  <View style={styles.stationRowMain}>
                    <Text style={[styles.sheetRowTxt, isSelected && styles.sheetRowTxtOn]}>{item.name}</Text>
                    {!isNone ? (
                      <Text style={styles.stationDistanceTxt}>{item.distance_km.toFixed(1)} km</Text>
                    ) : null}
                  </View>
                  {isSelected ? <Ionicons name="checkmark" size={18} color={colors.primary} /> : null}
                </Pressable>
              )
            }}
          />
        </Pressable>
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
    durationHours: DurationHoursPick
    departureTime: string
    travel_mode: TravelPick
    mood: MoodPick
    dogSize: DogSize
    station_id?: string
    station_name?: string
  }) => void
  onCancel: () => void
  areaPreset?: { prefecture: string; municipality: string } | null
}) {
  const insets = useSafeAreaInsets()
  const prefs = useMemo(() => sortPrefecturesJis(listPrefectures()), [])
  const [pref, setPref] = useState<string>('')
  const [muni, setMuni] = useState<string>('')

  const munis = useMemo(
    () => (pref ? sortMunicipalityNames(listMunicipalities(pref)) : []),
    [pref]
  )

  const [durationHours, setDurationHours] = useState<DurationHoursPick>(4)
  const [departurePick, setDeparturePick] = useState<DeparturePick>('now')
  const [travel, setTravel] = useState<TravelPick | null>(null)
  const [mood, setMood] = useState<MoodPick | null>(null)

  const [overrideSize, setOverrideSize] = useState<DogSize | null>(null)
  const [sizePickerOpen, setSizePickerOpen] = useState(false)
  const [prefOpen, setPrefOpen] = useState(false)
  const [muniOpen, setMuniOpen] = useState(false)
  const [stationOpen, setStationOpen] = useState(false)
  const [stations, setStations] = useState<AiPlanStationItem[]>([])
  const [stationsLoading, setStationsLoading] = useState(false)
  const [selectedStation, setSelectedStation] = useState<AiPlanStationItem | null>(null)
  const [areaRequestOpen, setAreaRequestOpen] = useState(false)
  const [areaRequestToast, setAreaRequestToast] = useState<string | null>(null)

  const [feasibility, setFeasibility] = useState<{
    walking_feasible: boolean
    driving_feasible: boolean
    loading: boolean
  }>({ walking_feasible: true, driving_feasible: true, loading: false })

  useEffect(() => {
    if (!areaRequestToast) return
    const t = setTimeout(() => setAreaRequestToast(null), 2800)
    return () => clearTimeout(t)
  }, [areaRequestToast])

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
    setSelectedStation(null)
  }, [pref, munis, muni])

  useEffect(() => {
    if (!pref || !muni) {
      setStations([])
      setSelectedStation(null)
      setStationsLoading(false)
      return
    }
    setSelectedStation(null)
    setStationsLoading(true)
    let cancelled = false
    void fetchAiPlanStations(pref, muni).then((rows) => {
      if (cancelled) return
      setStations(rows)
      setStationsLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [pref, muni])

  useEffect(() => {
    if (!pref || !muni) {
      setFeasibility({ walking_feasible: true, driving_feasible: true, loading: false })
      return
    }
    setFeasibility((prev) => ({ ...prev, loading: true }))
    let cancelled = false
    void checkAiPlanFeasibility(pref, muni, selectedStation?.id).then((result) => {
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
  }, [pref, muni, selectedStation?.id])

  const stationLabel = selectedStation
    ? selectedStation.name
    : stationsLoading
      ? '駅を読み込み中…'
      : stations.length > 0
        ? '指定なし（エリア中心）'
        : '最寄り駅（任意）'

  const effectiveSize = overrideSize ?? dbDogSize
  const bothInfeasible =
    !!pref && !!muni && !feasibility.loading && !feasibility.walking_feasible && !feasibility.driving_feasible
  const isFormValid = !!pref && !!muni && !!travel && !!mood && !!effectiveSize && !bothInfeasible

  const dogDisplay = formatAiPlanDogDisplayName(initialDogName)
  const sizeShort = effectiveSize ? SIZE_LABEL_SHORT[effectiveSize] : ''

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.root}
        contentContainerStyle={[styles.scroll, { paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
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
          {muni ? (
            <View style={styles.stationPickerWrap}>
              <SelectorRow
                label={stationLabel}
                selected={!!selectedStation}
                disabled={stationsLoading || stations.length === 0}
                onPress={() => {
                  if (stations.length > 0) setStationOpen(true)
                }}
              />
            </View>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>所要時間</Text>
          <View style={styles.chipRow}>
            {DURATION_OPTIONS.map((opt) => (
              <OptionChip
                key={opt.value}
                label={opt.label}
                selected={durationHours === opt.value}
                onPress={() => setDurationHours(opt.value)}
              />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>出発</Text>
          <View style={styles.chipRowWrap}>
            {DEPARTURE_OPTIONS.map((opt) => (
              <OptionChip
                key={opt.value}
                label={opt.label}
                selected={departurePick === opt.value}
                onPress={() => setDeparturePick(opt.value)}
              />
            ))}
          </View>
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
          {bothInfeasible ? (
            <View style={styles.feasibilityBlock}>
              <Text style={styles.feasibilityHint}>このエリアはまだスポットデータが不足しています</Text>
              <Pressable
                onPress={() => setAreaRequestOpen(true)}
                style={({ pressed }) => [styles.areaRequestBtn, pressed && styles.areaRequestBtnPressed]}
              >
                <Text style={styles.areaRequestBtnTxt}>このエリアのデータ追加をリクエストする</Text>
              </Pressable>
            </View>
          ) : null}
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
            <WanspotIconPaw size={18} color={colors.primary} />
            <Text style={styles.dogSelectText} numberOfLines={1} ellipsizeMode="tail">
              {effectiveSize ? `${dogDisplay}（${sizeShort}）でプラン作成` : `${dogDisplay}でプラン作成（サイズ未設定）`}
            </Text>
          </View>
          <Text style={styles.dogSelectChange}>{effectiveSize ? '変更' : '選択'}</Text>
        </Pressable>

        <View style={styles.ctaInline}>
          <Pressable
            disabled={!isFormValid}
            style={({ pressed }) => [
              styles.ctaButton,
              !isFormValid && styles.ctaButtonDisabled,
              pressed && isFormValid && styles.ctaButtonPressed,
            ]}
            onPress={() => {
              if (!travel || !mood || !effectiveSize) return
              onSubmit({
                prefecture: pref,
                municipality: muni,
                durationHours,
                departureTime: resolveDepartureIso(departurePick),
                travel_mode: travel,
                mood,
                dogSize: effectiveSize,
                ...(selectedStation ? { station_id: selectedStation.id, station_name: selectedStation.name } : {}),
              })
            }}
          >
            <Text style={[styles.ctaText, !isFormValid && styles.ctaTextDisabled]}>この内容でプランを作る</Text>
            {isFormValid ? <Ionicons name="arrow-forward" size={18} color="#FFFFFF" /> : null}
          </Pressable>
        </View>

        <Pressable style={styles.cancelBtn} onPress={onCancel}>
          <Text style={styles.cancelTxt}>戻る</Text>
        </Pressable>

        <PickerSheet
          visible={prefOpen}
          title="都道府県"
          items={prefs}
          selectedItem={pref || undefined}
          onClose={() => setPrefOpen(false)}
          onPick={(p) => {
            setPref(p)
            setMuni('')
          }}
        />
        <PickerSheet
          visible={muniOpen}
          title="市区町村"
          items={munis}
          selectedItem={muni || undefined}
          onClose={() => setMuniOpen(false)}
          onPick={setMuni}
        />
        <StationPickerSheet
          visible={stationOpen}
          stations={stations}
          selectedId={selectedStation?.id}
          onClose={() => setStationOpen(false)}
          onPick={setSelectedStation}
        />

        <Modal visible={areaRequestOpen} transparent animationType="slide" onRequestClose={() => setAreaRequestOpen(false)}>
          <Pressable style={styles.sheetBg} onPress={() => setAreaRequestOpen(false)}>
            <Pressable
              style={[styles.sheet, styles.areaRequestSheet, { paddingBottom: insets.bottom + 16 }]}
              onPress={(e) => e.stopPropagation()}
            >
              <View style={styles.sheetGrabber} />
              <Text style={styles.sheetTitle}>エリアデータの追加リクエスト</Text>
              <AreaRequestForm
                prefecture={pref}
                municipality={muni}
                onToast={setAreaRequestToast}
              />
            </Pressable>
          </Pressable>
          {areaRequestToast ? (
            <View
              style={[styles.areaRequestToast, { bottom: Math.max(16, insets.bottom + 8) }]}
              pointerEvents="none"
            >
              <Text style={styles.areaRequestToastTxt}>{areaRequestToast}</Text>
            </View>
          ) : null}
        </Modal>

        <Modal visible={sizePickerOpen} transparent animationType="slide" onRequestClose={() => setSizePickerOpen(false)}>
          <Pressable style={styles.sheetBg} onPress={() => setSizePickerOpen(false)}>
            <Pressable
              style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}
              onPress={(e) => e.stopPropagation()}
            >
              <View style={styles.sheetGrabber} />
              <Text style={styles.sheetTitle}>サイズを選択</Text>
              <View style={{ gap: 10 }}>
                {(Object.keys(SIZE_LABEL) as DogSize[]).map((k) => {
                  const on = (overrideSize ?? dbDogSize) === k
                  return (
                    <Pressable
                      key={k}
                      style={[styles.sizeRow, on && styles.sizeRowOn]}
                      onPress={() => {
                        setOverrideSize(k)
                        setSizePickerOpen(false)
                      }}
                    >
                      <Text style={[styles.sizeRowTxt, on && styles.sizeRowTxtOn]}>{SIZE_LABEL[k]}</Text>
                      {on ? <Ionicons name="checkmark" size={18} color="#fff" /> : null}
                    </Pressable>
                  )
                })}
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FAFAF8' },
  root: { flex: 1, backgroundColor: '#FAFAF8' },
  scroll: {
    paddingTop: 16,
    gap: 16,
  },
  pressed: { transform: [{ scale: 0.97 }], opacity: 0.9 },
  section: { paddingHorizontal: 16 },
  sectionTitle: { fontSize: 12, color: '#999', marginBottom: 8, fontWeight: '500' },
  feasibilityBlock: {
    marginTop: 8,
    gap: 10,
  },
  feasibilityHint: {
    fontSize: 12,
    color: '#c62828',
    lineHeight: 17,
  },
  areaRequestBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.tintWeak,
  },
  areaRequestBtnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  areaRequestBtnTxt: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  areaRequestSheet: {
    maxHeight: '85%',
  },
  areaRequestToast: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 55,
    backgroundColor: colors.textPrimary,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  areaRequestToastTxt: {
    color: '#fff',
    fontWeight: '700',
    textAlign: 'center',
    fontSize: 14,
  },
  row: { flexDirection: 'row', gap: 12 },
  flex1: { flex: 1 },
  stationPickerWrap: { marginTop: 10 },
  stationRowMain: { flex: 1, gap: 2 },
  stationDistanceTxt: { fontSize: 11, color: '#999' },
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
    backgroundColor: colors.tintWeak,
    borderColor: colors.primary,
  },
  selectorTxt: { fontSize: 14, flex: 1 },
  selectorTxtOn: { color: '#1A1A1A', fontWeight: '600' },
  selectorTxtOff: { color: '#666' },
  moodGrid: { flexDirection: 'row', gap: 12 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chipRowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optionChip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#F5F4F0',
  },
  optionChipSelected: {
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 2,
  },
  optionChipPressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  optionChipTxt: { fontSize: 13, fontWeight: '700', color: '#1A1A1A' },
  optionChipTxtSelected: { color: '#fff' },
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
  sheetBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 8,
    maxHeight: '72%',
  },
  sheetGrabber: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E0DDD8',
    marginBottom: 12,
  },
  sheetTitle: { fontSize: 15, fontWeight: '800', color: '#1A1A1A', marginBottom: 10, textAlign: 'center' },
  sheetList: { flexGrow: 0 },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F0F0F0',
  },
  sheetRowPressed: { backgroundColor: '#FAFAF8' },
  sheetRowTxt: { fontSize: 14, color: '#1A1A1A' },
  sheetRowTxtOn: { fontWeight: '700', color: colors.primary },
  sizeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    backgroundColor: '#F5F4F0',
    paddingVertical: 13,
    paddingHorizontal: 14,
  },
  sizeRowOn: { backgroundColor: colors.primary },
  sizeRowTxt: { fontSize: 13, fontWeight: '700', color: '#1A1A1A' },
  sizeRowTxtOn: { color: '#fff' },
  ctaInline: { paddingHorizontal: 16, marginTop: 4 },
  ctaButton: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  ctaButtonDisabled: {
    backgroundColor: '#E5E5E5',
    shadowOpacity: 0,
    elevation: 0,
  },
  ctaButtonPressed: { backgroundColor: colors.brandDark, transform: [{ scale: 0.98 }] },
  ctaText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  ctaTextDisabled: { color: '#999' },
})
