import AsyncStorage from '@react-native-async-storage/async-storage'

/**
 * いつものお散歩時間（時のみ・JST前提）。オンボーディングで質問し、設定のお散歩予報からも変更できる。
 * null = 未設定（通知はデフォルトの朝5:00に「きょうのおすすめ時間」を届ける）。
 * 数値 = その時刻に散歩予定（通知は2時間前に、予定時刻の環境予測とより良い時間の助言を届ける）。
 */
const WALK_TIME_HOUR_KEY = 'walk_time_hour_v1'

/** オンボーディング・設定で提示する選択肢（時刻はその帯の代表時） */
export const WALK_TIME_CHOICES: { label: string; hour: number | null }[] = [
  { label: '早朝（5〜6時）', hour: 6 },
  { label: '朝（7〜9時）', hour: 8 },
  { label: '夕方（16〜18時）', hour: 17 },
  { label: '夜（19〜21時）', hour: 20 },
  { label: 'きめていない', hour: null },
]

export function walkTimeChoiceLabel(hour: number | null): string {
  return WALK_TIME_CHOICES.find((c) => c.hour === hour)?.label ?? (hour != null ? `${hour}時ごろ` : 'きめていない')
}

export async function getWalkTimeHour(): Promise<number | null> {
  try {
    const raw = await AsyncStorage.getItem(WALK_TIME_HOUR_KEY)
    if (raw == null || raw === '') return null
    const n = Number(raw)
    return Number.isInteger(n) && n >= 0 && n <= 23 ? n : null
  } catch {
    return null
  }
}

export async function setWalkTimeHour(hour: number | null): Promise<void> {
  try {
    if (hour == null) await AsyncStorage.setItem(WALK_TIME_HOUR_KEY, '')
    else await AsyncStorage.setItem(WALK_TIME_HOUR_KEY, String(hour))
  } catch {
    /* ベストエフォート */
  }
}
