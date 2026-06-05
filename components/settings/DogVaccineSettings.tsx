import { useCallback, useState } from 'react'
import { Alert, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import {
  OwnerBirthdayPickers,
  ownerBirthdayToYmd,
  splitYmdToParts,
} from '@/components/OwnerBirthdayPickers'
import { colors } from '@/constants/colors'
import {
  computeVaccineStamp,
  formatDateJaGregorian,
  type DogProfile,
  ymdFromDogField,
} from '@/lib/dog-display'
import { supabase } from '@/lib/supabase'

const IconSyringe = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={colors.textMuted} strokeWidth={2} strokeLinecap="round">
    <Path d="M18 2l4 4M17 7l1-1M3 21l6-6M9 15l2-2M12 12l2-2M6 21c0-2 2-4 4-4M15 3l-6 6M15 3l3 3-7 7-3-3 7-7z" />
  </Svg>
)

function VaccineStampMark() {
  return (
    <View style={styles.stamp}>
      <Text style={styles.stampTxt}>接種済</Text>
    </View>
  )
}

type Props = {
  dog: DogProfile
  onUpdated: (dog: DogProfile) => void
}

type VaccineKind = 'rabies' | 'mixed'

/** 設定タブ用ワクチン行（旧マイページのワクチンUIを移設） */
export function DogVaccineSettings({ dog, onUpdated }: Props) {
  const [pickerKind, setPickerKind] = useState<VaccineKind | null>(null)
  const [pickerYear, setPickerYear] = useState('')
  const [pickerMonth, setPickerMonth] = useState('')
  const [pickerDay, setPickerDay] = useState('')
  const [saving, setSaving] = useState(false)

  const openPicker = useCallback(
    (kind: VaccineKind) => {
      const stored = kind === 'rabies' ? dog.rabies_vaccinated_at : dog.vaccine_vaccinated_at
      const ymd = ymdFromDogField(stored ?? '')
      const p = splitYmdToParts(ymd || null)
      setPickerYear(p.y)
      setPickerMonth(p.m)
      setPickerDay(p.d)
      setPickerKind(kind)
    },
    [dog]
  )

  const confirmPicker = async () => {
    if (!pickerKind) return
    const ymd = ownerBirthdayToYmd(pickerYear, pickerMonth, pickerDay) ?? ''
    setSaving(true)
    try {
      const patch =
        pickerKind === 'rabies'
          ? { rabies_vaccinated_at: ymd || null }
          : { vaccine_vaccinated_at: ymd || null }
      const { error } = await supabase.from('dogs').update(patch).eq('id', dog.id)
      if (error) {
        Alert.alert('保存に失敗しました', error.message)
        return
      }
      onUpdated({ ...dog, ...patch })
      setPickerKind(null)
    } finally {
      setSaving(false)
    }
  }

  const renderRow = (opts: {
    label: string
    kind: VaccineKind
    storedAt: string | null
    vaccinatedFlag: boolean | null
    showRabiesExpiry: boolean
  }) => {
    const ymd = ymdFromDogField(opts.storedAt ?? '')
    const hasDate = !!ymd
    const stampKind = computeVaccineStamp(ymd, opts.showRabiesExpiry)
    const primaryText = hasDate
      ? formatDateJaGregorian(ymd)
      : opts.vaccinatedFlag
        ? '接種日を登録してください'
        : '未登録'

    return (
      <Pressable
        key={opts.kind}
        style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
        onPress={() => openPicker(opts.kind)}
        accessibilityRole="button"
        accessibilityLabel={opts.label}
      >
        <IconSyringe />
        <View style={styles.rowTextCol}>
          <Text style={styles.rowTitle}>{opts.label}</Text>
          <Text style={[styles.rowSub, !hasDate && styles.rowSubMuted]} numberOfLines={1}>
            {primaryText}
          </Text>
        </View>
        {stampKind ? <VaccineStampMark /> : null}
        <Text style={styles.chevron}>›</Text>
      </Pressable>
    )
  }

  return (
    <>
      {renderRow({
        label: '混合ワクチン',
        kind: 'mixed',
        storedAt: dog.vaccine_vaccinated_at,
        vaccinatedFlag: dog.vaccine_vaccinated,
        showRabiesExpiry: false,
      })}
      <View style={styles.divider} />
      {renderRow({
        label: '狂犬病ワクチン',
        kind: 'rabies',
        storedAt: dog.rabies_vaccinated_at,
        vaccinatedFlag: dog.rabies_vaccinated,
        showRabiesExpiry: true,
      })}

      {pickerKind !== null ? (
        <Modal visible transparent animationType="fade" onRequestClose={() => setPickerKind(null)}>
          <View style={styles.overlay}>
            <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setPickerKind(null)} />
            <View style={styles.pickerCard}>
              <Text style={styles.pickerTitle}>
                {pickerKind === 'rabies' ? '狂犬病ワクチン接種日' : '混合ワクチン接種日'}
              </Text>
              <View style={styles.birthdayCard}>
                <OwnerBirthdayPickers
                  fieldLabel=""
                  hint={null}
                  year={pickerYear}
                  month={pickerMonth}
                  day={pickerDay}
                  onChangeYear={setPickerYear}
                  onChangeMonth={setPickerMonth}
                  onChangeDay={setPickerDay}
                />
              </View>
              <View style={styles.pickerActions}>
                <Pressable style={styles.pickerGhost} onPress={() => setPickerKind(null)}>
                  <Text style={styles.pickerGhostTxt}>キャンセル</Text>
                </Pressable>
                <Pressable style={styles.pickerPri} onPress={() => void confirmPicker()} disabled={saving}>
                  <Text style={styles.pickerPriTxt}>{saving ? '保存中...' : '決定'}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      ) : null}
    </>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  rowTextCol: { flex: 1 },
  rowTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  rowSub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  rowSubMuted: { color: colors.textLight },
  divider: { height: 1, backgroundColor: colors.border, marginLeft: 46 },
  chevron: { fontSize: 20, color: '#CCC', fontWeight: '300' },
  stamp: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: colors.successMutedBg,
  },
  stampTxt: { fontSize: 10, fontWeight: '800', color: colors.success },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 24 },
  pickerCard: {
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pickerTitle: { fontSize: 14, fontWeight: '800', color: colors.text, marginBottom: 10, textAlign: 'center' },
  birthdayCard: {
    marginTop: 4,
    padding: 16,
    backgroundColor: colors.background,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 10 },
      android: { elevation: 4 },
    }),
  },
  pickerActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  pickerGhost: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: '#f5f5f5', alignItems: 'center' },
  pickerGhostTxt: { fontSize: 14, fontWeight: '800', color: colors.textLight },
  pickerPri: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: colors.brandButton, alignItems: 'center' },
  pickerPriTxt: { fontSize: 14, fontWeight: '800', color: colors.text },
})
