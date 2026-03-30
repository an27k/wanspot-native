import { StyleSheet, Text, View } from 'react-native'
import { colors } from '@/constants/colors'
import { CenterSnapPicker } from '@/components/CenterSnapPicker'

const currentYear = new Date().getFullYear()

/** 愛犬の生年月日用（今年まで・過去に十分な年幅） */
export function dogBirthdayYearBounds(): { min: number; max: number } {
  return { min: currentYear - 35, max: currentYear }
}

export function ownerBirthdayToYmd(year: string, month: string, day: string): string | null {
  const y = year.trim()
  const m = month.trim()
  const d = day.trim()
  if (!y || !m || !d) return null
  const yi = parseInt(y, 10)
  const mi = parseInt(m, 10)
  const di = parseInt(d, 10)
  if (!Number.isFinite(yi) || !Number.isFinite(mi) || !Number.isFinite(di)) return null
  const dt = new Date(yi, mi - 1, di, 12, 0, 0)
  if (dt.getFullYear() !== yi || dt.getMonth() !== mi - 1 || dt.getDate() !== di) return null
  return `${yi}-${String(mi).padStart(2, '0')}-${String(di).padStart(2, '0')}`
}

export function isOwnerBirthdayComplete(year: string, month: string, day: string): boolean {
  return ownerBirthdayToYmd(year, month, day) !== null
}

export function splitYmdToParts(ymd: string | null | undefined): { y: string; m: string; d: string } {
  const t = typeof ymd === 'string' ? ymd.trim() : ''
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return { y: '', m: '', d: '' }
  const [y, m, d] = t.split('-')
  return { y: y ?? '', m: m ? String(parseInt(m, 10)) : '', d: d ? String(parseInt(d, 10)) : '' }
}

function daysInMonth(y: number, m: number): number {
  return new Date(y, m, 0).getDate()
}

const DEFAULT_FIELD_LABEL = '生年月日（必須）'
const DEFAULT_HINT = '年・月・日をすべて選択してください。'

type Props = {
  year: string
  month: string
  day: string
  onChangeYear: (v: string) => void
  onChangeMonth: (v: string) => void
  onChangeDay: (v: string) => void
  yearMin?: number
  yearMax?: number
  compact?: boolean
  fieldLabel?: string
  hint?: string | null
}

export function OwnerBirthdayPickers({
  year,
  month,
  day,
  onChangeYear,
  onChangeMonth,
  onChangeDay,
  yearMin = 1970,
  yearMax = currentYear,
  compact: _compact = false,
  fieldLabel,
  hint,
}: Props) {
  const resolvedLabel = fieldLabel === undefined ? DEFAULT_FIELD_LABEL : fieldLabel
  const resolvedHint = hint === undefined ? DEFAULT_HINT : hint
  const yi = year ? parseInt(year, 10) : NaN
  const mi = month ? parseInt(month, 10) : NaN
  const maxDay =
    Number.isFinite(yi) && Number.isFinite(mi) && mi >= 1 && mi <= 12 ? daysInMonth(yi, mi) : 31
  const years: number[] = []
  for (let y = yearMax; y >= yearMin; y--) years.push(y)
  const months = Array.from({ length: 12 }, (_, i) => i + 1)
  const days = Array.from({ length: maxDay }, (_, i) => i + 1)

  const yearRows = [{ value: '', label: '—' }, ...years.map((y) => ({ value: String(y), label: `${y}年` }))]
  const monthRows = [{ value: '', label: '—' }, ...months.map((m) => ({ value: String(m), label: `${m}月` }))]
  const dayRows = [{ value: '', label: '—' }, ...days.map((d) => ({ value: String(d), label: `${d}日` }))]

  const onPickYear = (v: string) => {
    onChangeYear(v)
    if (!v) {
      onChangeDay('')
      return
    }
    const yNum = parseInt(v, 10)
    const mNum = month ? parseInt(month, 10) : NaN
    const dNum = day ? parseInt(day, 10) : NaN
    if (Number.isFinite(mNum) && Number.isFinite(dNum)) {
      const cap = daysInMonth(yNum, mNum)
      if (dNum > cap) onChangeDay(String(cap))
    }
  }

  const onPickMonth = (v: string) => {
    onChangeMonth(v)
    if (!v) {
      onChangeDay('')
      return
    }
    const mNum = parseInt(v, 10)
    const yNum = year ? parseInt(year, 10) : NaN
    const dNum = day ? parseInt(day, 10) : NaN
    if (Number.isFinite(yNum) && Number.isFinite(dNum)) {
      const cap = daysInMonth(yNum, mNum)
      if (dNum > cap) onChangeDay(String(cap))
    }
  }

  return (
    <View>
      {resolvedLabel.length > 0 ? <Text style={styles.label}>{resolvedLabel}</Text> : null}
      {resolvedHint ? <Text style={styles.hint}>{resolvedHint}</Text> : null}
      <View style={styles.grid3}>
        <View style={styles.col}>
          <Text style={styles.colLbl}>年</Text>
          <CenterSnapPicker listKey="y" data={yearRows} value={year} onChange={onPickYear} />
        </View>
        <View style={styles.col}>
          <Text style={styles.colLbl}>月</Text>
          <CenterSnapPicker listKey="m" data={monthRows} value={month} onChange={onPickMonth} />
        </View>
        <View style={styles.col}>
          <Text style={styles.colLbl}>日</Text>
          <CenterSnapPicker listKey="d" data={dayRows} value={day} onChange={onChangeDay} />
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  label: { fontSize: 12, color: colors.textMuted, marginBottom: 4 },
  hint: { fontSize: 11, color: colors.textMuted, lineHeight: 16, marginBottom: 8 },
  grid3: { flexDirection: 'row', gap: 10, marginTop: 2 },
  col: { flex: 1 },
  colLbl: { fontSize: 11, color: colors.textMuted, marginBottom: 8, textAlign: 'center' },
})
