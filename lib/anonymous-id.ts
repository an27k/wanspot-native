import AsyncStorage from '@react-native-async-storage/async-storage'

const ANONYMOUS_ID_KEY = 'analytics:anonymous_id'

let cachedId: string | null = null

function createAnonymousId(): string {
  const cryptoObj = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto
  if (typeof cryptoObj?.randomUUID === 'function') return cryptoObj.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}

/** 端末に残る匿名ID。ログイン前後の行動を同じ人としてつなぐ */
export async function getAnonymousId(): Promise<string> {
  if (cachedId) return cachedId
  const existing = await AsyncStorage.getItem(ANONYMOUS_ID_KEY)
  if (existing) {
    cachedId = existing
    return existing
  }
  const next = createAnonymousId()
  cachedId = next
  await AsyncStorage.setItem(ANONYMOUS_ID_KEY, next)
  return next
}
