export type DogProfile = {
  id: string
  name: string
  breed: string | null
  birthday: string | null
  gender?: 'male' | 'female' | null
  size?: 'XS' | 'S' | 'M' | 'L' | 'XL' | null
  rabies_vaccinated_at: string | null
  vaccine_vaccinated_at: string | null
  photo_url: string | null
  rabies_vaccinated: boolean | null
  vaccine_vaccinated: boolean | null
}

export const DOG_SIZE_LABEL: Record<'XS' | 'S' | 'M' | 'L' | 'XL', string> = {
  XS: '超小型犬（〜3kg）',
  S: '小型犬（3〜10kg）',
  M: '中型犬（10〜25kg）',
  L: '大型犬（25〜40kg）',
  XL: '超大型犬（40kg〜）',
}

export function formatYmd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function parseYmd(s: string): Date {
  if (typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, mo, da] = s.split('-').map(Number)
    const dt = new Date(y, mo - 1, da, 12, 0, 0)
    if (!Number.isNaN(dt.getTime())) return dt
  }
  return new Date()
}

export function formatDateJaGregorian(ymd: string): string {
  if (!ymd) return ''
  const d = parseYmd(ymd)
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
}

export function ymdFromDogField(s: string | null | undefined): string {
  if (!s) return ''
  const t = typeof s === 'string' ? s.trim() : ''
  if (!t) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t
  return formatYmd(new Date(t))
}

export function calcDogAge(birthday: string): string {
  const birth = new Date(birthday)
  const now = new Date()
  const years = now.getFullYear() - birth.getFullYear()
  const months = now.getMonth() - birth.getMonth()
  if (months < 0 || (months === 0 && now.getDate() < birth.getDate())) return `${years - 1}歳${months + 12}ヶ月`
  return years === 0 ? `${months}ヶ月` : `${years}歳${months}ヶ月`
}

export function isVaccineYearExpired(ymd: string): boolean {
  if (!ymd) return false
  const d = parseYmd(ymd)
  const next = new Date(d.getFullYear() + 1, d.getMonth(), d.getDate())
  return new Date() > next
}

export type VaccineStampKind = 'vaccinated' | 'due'

export function computeVaccineStamp(ymd: string, showRabiesExpiry: boolean): VaccineStampKind | null {
  const hasDate = !!ymd
  if (!hasDate) return null
  if (showRabiesExpiry) return isVaccineYearExpired(ymd) ? 'due' : 'vaccinated'
  return 'vaccinated'
}
