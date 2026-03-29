import Constants from 'expo-constants'
import { createClient } from '@supabase/supabase-js'

import { inMemoryStorage } from '@/lib/in-memory-storage'

function firstNonEmpty(...vals: (string | undefined)[]): string {
  for (const v of vals) {
    const t = typeof v === 'string' ? v.trim() : ''
    if (t) return t
  }
  return ''
}

const extra = Constants.expoConfig?.extra as
  | { supabaseUrl?: string; supabaseAnonKey?: string }
  | undefined

const url = firstNonEmpty(process.env.EXPO_PUBLIC_SUPABASE_URL, extra?.supabaseUrl)
const key = firstNonEmpty(process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY, extra?.supabaseAnonKey)

if (!url || !key) {
  throw new Error(
    'Supabase が未設定です。.env.local に Web と同じ NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY（または EXPO_PUBLIC_*）を追加し、npx expo start を一度止めて再起動してください。',
  )
}

export const supabase = createClient(url, key, {
  auth: {
    storage: inMemoryStorage,
    autoRefreshToken: true,
    persistSession: false,
    detectSessionInUrl: false,
  },
})
