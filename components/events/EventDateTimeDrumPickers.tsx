import { useMemo } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { CenterSnapPicker } from '@/components/CenterSnapPicker'
import { colors } from '@/constants/colors'

function daysInMonth(y: number, m: number): number {
  return new Date(y, m, 0).getDate()
}

/** ピッカーの年レンジ内に収め、日を月の上限に合わせる（モーダルを開くときに利用） */
export function clampEventPickerDate(d: Date): Date {
  const y0 = new Date().getFullYear()
  const ymin = y0 - 1
  const ymax = y0 + 5
  const x = new Date(d.getTime())
  if (Number.isNaN(x.getTime())) {
    const fb = new Date()
    fb.setDate(fb.getDate() + 1)
    fb.setHours(10, 0, 0, 0)
    return fb
  }
  if (x.getFullYear() < ymin) x.setFullYear(ymin)
  if (x.getFullYear() > ymax) x.setFullYear(ymax)
  const cap = daysInMonth(x.getFullYear(), x.getMonth() + 1)
  if (x.getDate() > cap) x.setDate(cap)
  return x
}

type Props = {
  value: Date
  onChange: (next: Date) => void
}

/**
 * 生年月日（OwnerBirthdayPickers）と同じ CenterSnapPicker 方式の開催日時ドラム UI。
 */
export function EventDateTimeDrumPickers({ value, onChange }: Props) {
  const yi = value.getFullYear()
  const mi = value.getMonth() + 1
  const di = value.getDate()
  const hi = value.getHours()
  const mini = value.getMinutes()

  const { yearMin, yearMax } = useMemo(() => {
    const y0 = new Date().getFullYear()
    return { yearMin: y0 - 1, yearMax: y0 + 5 }
  }, [])

  const maxDay = daysInMonth(yi, mi)

  const yearRows = useMemo(() => {
    const rows: { value: string; label: string }[] = []
    for (let y = yearMin; y <= yearMax; y++) rows.push({ value: String(y), label: `${y}年` })
    return rows
  }, [yearMin, yearMax])

  const monthRows = useMemo(
    () => Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: `${i + 1}月` })),
    []
  )

  const dayRows = useMemo(
    () => Array.from({ length: maxDay }, (_, i) => ({ value: String(i + 1), label: `${i + 1}日` })),
    [maxDay]
  )

  const hourRows = useMemo(
    () => Array.from({ length: 24 }, (_, i) => ({ value: String(i), label: `${i}時` })),
    []
  )

  const minuteRows = useMemo(
    () => Array.from({ length: 60 }, (_, i) => ({ value: String(i), label: `${i}分` })),
    []
  )

  const patch = (next: Date) => {
    if (Number.isNaN(next.getTime())) return
    onChange(next)
  }

  const setY = (v: string) => {
    const y = parseInt(v, 10)
    if (!Number.isFinite(y)) return
    const d = new Date(value)
    d.setFullYear(y)
    const cap = daysInMonth(d.getFullYear(), d.getMonth() + 1)
    if (d.getDate() > cap) d.setDate(cap)
    patch(d)
  }

  const setM = (v: string) => {
    const m = parseInt(v, 10)
    if (!Number.isFinite(m) || m < 1 || m > 12) return
    const d = new Date(value)
    d.setMonth(m - 1)
    const cap = daysInMonth(d.getFullYear(), m)
    if (d.getDate() > cap) d.setDate(cap)
    patch(d)
  }

  const setD = (v: string) => {
    const day = parseInt(v, 10)
    if (!Number.isFinite(day) || day < 1) return
    const d = new Date(value)
    const cap = daysInMonth(d.getFullYear(), d.getMonth() + 1)
    d.setDate(Math.min(day, cap))
    patch(d)
  }

  const setH = (v: string) => {
    const h = parseInt(v, 10)
    if (!Number.isFinite(h) || h < 0 || h > 23) return
    const d = new Date(value)
    d.setHours(h)
    patch(d)
  }

  const setMin = (v: string) => {
    const m = parseInt(v, 10)
    if (!Number.isFinite(m) || m < 0 || m > 59) return
    const d = new Date(value)
    d.setMinutes(m)
    patch(d)
  }

  const yStr = String(yi)
  const mStr = String(mi)
  const dStr = String(Math.min(di, maxDay))
  const hStr = String(hi)
  const minStr = String(mini)

  return (
    <View>
      <Text style={styles.hint}>年・月・日・時・分を選択してください</Text>
      <View style={styles.grid3}>
        <View style={styles.col}>
          <Text style={styles.colLbl}>年</Text>
          <CenterSnapPicker listKey="ev-y" data={yearRows} value={yStr} onChange={setY} />
        </View>
        <View style={styles.col}>
          <Text style={styles.colLbl}>月</Text>
          <CenterSnapPicker listKey="ev-m" data={monthRows} value={mStr} onChange={setM} />
        </View>
        <View style={styles.col}>
          <Text style={styles.colLbl}>日</Text>
          <CenterSnapPicker listKey="ev-d" data={dayRows} value={dStr} onChange={setD} />
        </View>
      </View>
      <View style={styles.grid2}>
        <View style={styles.col}>
          <Text style={styles.colLbl}>時</Text>
          <CenterSnapPicker listKey="ev-h" data={hourRows} value={hStr} onChange={setH} />
        </View>
        <View style={styles.col}>
          <Text style={styles.colLbl}>分</Text>
          <CenterSnapPicker listKey="ev-min" data={minuteRows} value={minStr} onChange={setMin} />
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  hint: { fontSize: 11, color: colors.textMuted, lineHeight: 16, marginBottom: 8, textAlign: 'center' },
  grid3: { flexDirection: 'row', gap: 8, marginTop: 2 },
  grid2: { flexDirection: 'row', gap: 8, marginTop: 12 },
  col: { flex: 1 },
  colLbl: { fontSize: 11, color: colors.textMuted, marginBottom: 8, textAlign: 'center' },
})
