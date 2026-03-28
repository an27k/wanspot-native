import Constants from 'expo-constants'
import { supabase } from '@/lib/supabase'

type Extra = {
  wanspotApiUrl?: string
}

function firstNonEmpty(...vals: (string | undefined)[]): string {
  for (const v of vals) {
    const t = typeof v === 'string' ? v.trim() : ''
    if (t) return t
  }
  return ''
}

/** Next.js wanspot のオリジン（末尾スラッシュなし）。実機では localhost ではなく本番 or LAN の URL を .env に。 */
export function getWanspotApiBase(): string {
  const extra = Constants.expoConfig?.extra as Extra | undefined
  const raw = firstNonEmpty(process.env.EXPO_PUBLIC_WANSPOT_API_URL, extra?.wanspotApiUrl)
  return raw.replace(/\/$/, '')
}

/** シェア用の公開ページURL（API と同一オリジン想定） */
export function wanspotPublicUrl(path: string): string {
  const base = getWanspotApiBase()
  const p = path.startsWith('/') ? path : `/${path}`
  return `${base}${p}`
}

export type WanspotFetchInit = RequestInit & { json?: unknown }

/**
 * Next.js wanspot の API を呼ぶ。セッションがあれば Authorization: Bearer を付与。
 */
export async function wanspotFetch(path: string, init: WanspotFetchInit = {}): Promise<Response> {
  const base = getWanspotApiBase()
  if (!base) {
    return new Response(
      JSON.stringify({
        error:
          'API のベース URL が未設定です。.env.local に EXPO_PUBLIC_WANSPOT_API_URL（推奨）または NEXT_PUBLIC_APP_URL を書き、npx expo start を再起動してください。',
      }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
  const url = `${base}${path.startsWith('/') ? path : `/${path}`}`
  const { data: { session } } = await supabase.auth.getSession()
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(init.headers as Record<string, string>),
  }
  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`
  }
  let body = init.body
  if (init.json !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(init.json)
  }
  return fetch(url, { ...init, headers, body })
}

export function spotPhotoUrl(photoRef: string | null, maxWidth = 320): string | null {
  if (!photoRef) return null
  const base = getWanspotApiBase()
  if (!base) return null
  return `${base}/api/spots/photo?ref=${encodeURIComponent(photoRef)}&w=${maxWidth}`
}

export async function wanspotFetchJson<T>(path: string, init?: WanspotFetchInit): Promise<T> {
  const res = await wanspotFetch(path, init)
  const text = await res.text()
  if (!text) return {} as T
  try {
    return JSON.parse(text) as T
  } catch {
    return {} as T
  }
}
