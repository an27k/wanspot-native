import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { colors } from '@/constants/colors'

const currentYear = new Date().getFullYear()

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

export function splitYmdToParts(ymd: string | null | undefined): { y: string; m: string; d: string } {
  const t = typeof ymd === 'string' ? ymd.trim() : ''
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return { y: '', m: '', d: '' }
  const [y, m, d] = t.split('-')
  return { y: y ?? '', m: m ? String(parseInt(m, 10)) : '', d: d ? String(parseInt(d, 10)) : '' }
}

function daysInMonth(y: number, m: number): number {
  return new Date(y, m, 0).getDate()
}

const DEFAULT_FIELD_LABEL = '生年月日（任意）'
const DEFAULT_HINT = '未選択の項目は「-」です。未記載のままにできます。'

type Props = {
  year: string
  month: string
  day: string
  onChangeYear: (v: string) => void
  onChangeMonth: (v: string) => void
  onChangeDay: (v: string) => void
  yearMin?: number
  yearMax?: number
  /** コンパクト（オンボーディング） */
  compact?: boolean
  /** 未指定時は「生年月日（任意）」。空文字でラベル行を出さない */
  fieldLabel?: string
  /** null でヒント非表示。未指定時はデフォルト文言 */
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
  compact = false,
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

  const boxH = compact ? 120 : 100

  return (
    <View>
      {resolvedLabel.length > 0 ? <Text style={styles.label}>{resolvedLabel}</Text> : null}
      {resolvedHint ? <Text style={styles.hint}>{resolvedHint}</Text> : null}
      <View style={styles.grid3}>
        <View style={styles.col}>
          <Text style={styles.colLbl}>年</Text>
          <ScrollView style={[styles.selectBox, { maxHeight: boxH }]} nestedScrollEnabled showsVerticalScrollIndicator={false}>
            <TouchableOpacity
              onPress={() => {
                onChangeYear('')
                onChangeDay('')
              }}
              style={[styles.opt, !year && styles.optOn]}
            >
              <Text style={styles.optTxt}>-</Text>
            </TouchableOpacity>
            {years.map((y) => (
              <TouchableOpacity
                key={y}
                onPress={() => {
                  onChangeYear(String(y))
                  const mNum = month ? parseInt(month, 10) : NaN
                  const dNum = day ? parseInt(day, 10) : NaN
                  if (Number.isFinite(mNum) && Number.isFinite(dNum)) {
                    const cap = daysInMonth(y, mNum)
                    if (dNum > cap) onChangeDay(String(cap))
                  }
                }}
                style={[styles.opt, year === String(y) && styles.optOn]}
              >
                <Text style={styles.optTxt}>{y}年</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
        <View style={styles.col}>
          <Text style={styles.colLbl}>月</Text>
          <ScrollView style={[styles.selectBox, { maxHeight: boxH }]} nestedScrollEnabled showsVerticalScrollIndicator={false}>
            <TouchableOpacity
              onPress={() => {
                onChangeMonth('')
                onChangeDay('')
              }}
              style={[styles.opt, !month && styles.optOn]}
            >
              <Text style={styles.optTxt}>-</Text>
            </TouchableOpacity>
            {months.map((m) => (
              <TouchableOpacity
                key={m}
                onPress={() => {
                  onChangeMonth(String(m))
                  const yNum = year ? parseInt(year, 10) : NaN
                  const dNum = day ? parseInt(day, 10) : NaN
                  if (Number.isFinite(yNum) && Number.isFinite(dNum)) {
                    const cap = daysInMonth(yNum, m)
                    if (dNum > cap) onChangeDay(String(cap))
                  }
                }}
                style={[styles.opt, month === String(m) && styles.optOn]}
              >
                <Text style={styles.optTxt}>{m}月</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
        <View style={styles.col}>
          <Text style={styles.colLbl}>日</Text>
          <ScrollView style={[styles.selectBox, { maxHeight: boxH }]} nestedScrollEnabled showsVerticalScrollIndicator={false}>
            <TouchableOpacity onPress={() => onChangeDay('')} style={[styles.opt, !day && styles.optOn]}>
              <Text style={styles.optTxt}>-</Text>
            </TouchableOpacity>
            {days.map((d) => (
              <TouchableOpacity
                key={d}
                onPress={() => onChangeDay(String(d))}
                style={[styles.opt, day === String(d) && styles.optOn]}
              >
                <Text style={styles.optTxt}>{d}日</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  label: { fontSize: 12, color: colors.textMuted, marginBottom: 4 },
  hint: { fontSize: 11, color: colors.textMuted, lineHeight: 16, marginBottom: 8 },
  grid3: { flexDirection: 'row', gap: 8 },
  col: { flex: 1 },
  colLbl: { fontSize: 11, color: colors.textMuted, marginBottom: 4, textAlign: 'center' },
  selectBox: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardBg,
  },
  opt: { paddingVertical: 8, paddingHorizontal: 8, alignItems: 'center' },
  optOn: { backgroundColor: '#FFF9E0' },
  optTxt: { fontSize: 13, color: colors.text, fontWeight: '600' },
})
