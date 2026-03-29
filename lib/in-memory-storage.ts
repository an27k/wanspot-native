const memoryStorage: Record<string, string> = {}

/** AsyncStorage 互換（プロセス内のみ。アプリ終了で消える） */
export const inMemoryStorage = {
  getItem: async (key: string) => memoryStorage[key] ?? null,
  setItem: async (key: string, value: string) => {
    memoryStorage[key] = value
  },
  removeItem: async (key: string) => {
    delete memoryStorage[key]
  },
  multiSet: async (pairs: [string, string][]) => {
    for (const [k, v] of pairs) {
      memoryStorage[k] = v
    }
  },
  multiRemove: async (keys: string[]) => {
    for (const k of keys) {
      delete memoryStorage[k]
    }
  },
}
