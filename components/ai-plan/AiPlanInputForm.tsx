import { useEffect, useMemo, useState } from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { listMunicipalities, listPrefectures } from '@/constants/municipality-centers'

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

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.chip, active ? styles.chipOn : styles.chipOff]} onPress={onPress}>
      <Text style={[styles.chipTxt, active ? styles.chipTxtOn : styles.chipTxtOff]}>{label}</Text>
    </Pressable>
  )
}

export function AiPlanInputForm({
  initialDogName,
  dbDogSize,
  onSubmit,
  onCancel,
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

  useEffect(() => {
    if (!pref) return
    if (munis.length > 0 && !munis.includes(muni)) {
      setMuni('')
    }
  }, [pref, munis, muni])

  const effectiveSize = overrideSize ?? dbDogSize
  const canSubmit = !!pref && !!muni && !!duration && !!travel && !!mood && !!effectiveSize

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 28 }}>
      <View style={styles.card}>
        <Text style={styles.h}>エリア</Text>
        <Text style={styles.hint}>対応エリアから選択してください。</Text>
        <View style={{ gap: 10, marginTop: 10 }}>
          <View style={styles.pickerWrap}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {prefs.map((p) => (
                <Chip key={p} label={p} active={pref === p} onPress={() => setPref(p)} />
              ))}
            </ScrollView>
          </View>
          {pref ? (
            <View style={styles.pickerWrap}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {munis.map((m) => (
                  <Chip key={m} label={m.replace(`${pref}`, '').trim() || m} active={muni === m} onPress={() => setMuni(m)} />
                ))}
              </ScrollView>
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.h}>所要時間</Text>
        <View style={styles.row}>
          <Chip label="半日" active={duration === 'half_day'} onPress={() => setDuration('half_day')} />
          <Chip label="1日" active={duration === 'full_day'} onPress={() => setDuration('full_day')} />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.h}>移動手段</Text>
        <View style={styles.row}>
          <Chip label="徒歩" active={travel === 'walking'} onPress={() => setTravel('walking')} />
          <Chip label="車" active={travel === 'driving'} onPress={() => setTravel('driving')} />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.h}>ムード</Text>
        <View style={styles.row}>
          <Chip label="アクティブ" active={mood === 'active'} onPress={() => setMood('active')} />
          <Chip label="のんびり" active={mood === 'relaxed'} onPress={() => setMood('relaxed')} />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.h}>サイズ</Text>
        <Text style={styles.hint}>
          {effectiveSize
            ? `${initialDogName}（${SIZE_LABEL[effectiveSize]}）でプランを作ります`
            : `${initialDogName}（サイズ未設定）でプランを作ります`}
        </Text>
        <Pressable style={styles.sizeBtn} onPress={() => setSizePickerOpen(true)}>
          <Text style={styles.sizeBtnTxt}>{effectiveSize ? '変更' : 'サイズを選ぶ'}</Text>
        </Pressable>
      </View>

      <View style={{ gap: 10 }}>
        <Pressable
          style={[styles.submit, !canSubmit && styles.submitOff]}
          disabled={!canSubmit}
          onPress={() => {
            if (!duration || !travel || !mood || !effectiveSize) return
            onSubmit({ prefecture: pref, municipality: muni, duration, travel_mode: travel, mood, dogSize: effectiveSize })
          }}
        >
          <Text style={[styles.submitTxt, !canSubmit && { color: '#ccc' }]}>この内容でプランを作る</Text>
        </Pressable>
        <Pressable style={styles.cancel} onPress={onCancel}>
          <Text style={styles.cancelTxt}>戻る</Text>
        </Pressable>
      </View>

      <Modal visible={sizePickerOpen} transparent animationType="fade" onRequestClose={() => setSizePickerOpen(false)}>
        <Pressable style={styles.modalBg} onPress={() => setSizePickerOpen(false)}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>サイズを選択</Text>
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
                  <Text style={styles.sizeRowTxt}>{k}  {SIZE_LABEL[k]}</Text>
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
  root: { flex: 1, backgroundColor: '#f7f6f3' },
  card: { borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ebebeb', padding: 14, gap: 6 },
  h: { fontSize: 14, fontWeight: '900', color: '#2b2a28' },
  hint: { fontSize: 12, color: '#888', lineHeight: 18 },
  row: { flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' },
  chip: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12 },
  chipOn: { backgroundColor: '#FFD84D' },
  chipOff: { backgroundColor: '#f5f5f5' },
  chipTxt: { fontSize: 12, fontWeight: '900' },
  chipTxtOn: { color: '#2b2a28' },
  chipTxtOff: { color: '#888' },
  pickerWrap: { borderRadius: 12, backgroundColor: '#fafafa', borderWidth: 1, borderColor: '#ebebeb', padding: 8 },
  sizeBtn: { marginTop: 8, alignSelf: 'flex-start', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14, backgroundColor: '#f5f5f5', borderWidth: 1, borderColor: '#ebebeb' },
  sizeBtnTxt: { fontSize: 12, fontWeight: '900', color: '#2b2a28' },
  submit: { borderRadius: 16, backgroundColor: '#FFD84D', paddingVertical: 14, alignItems: 'center' },
  submitOff: { backgroundColor: '#f5f5f5' },
  submitTxt: { fontSize: 14, fontWeight: '900', color: '#2b2a28' },
  cancel: { borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ebebeb', paddingVertical: 12, alignItems: 'center' },
  cancelTxt: { fontSize: 13, fontWeight: '800', color: '#888' },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', padding: 16 },
  modalCard: { borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ebebeb', padding: 14 },
  modalTitle: { fontSize: 14, fontWeight: '900', color: '#2b2a28', marginBottom: 10 },
  sizeRow: { borderRadius: 12, backgroundColor: '#fafafa', borderWidth: 1, borderColor: '#ebebeb', padding: 12 },
  sizeRowOn: { backgroundColor: '#FFF9E0', borderColor: '#FFD84D' },
  sizeRowTxt: { fontSize: 12, fontWeight: '800', color: '#2b2a28' },
})
