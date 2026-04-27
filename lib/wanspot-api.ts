import Constants from 'expo-constants'
import { widthForImageSize, type ImageSize } from '@/lib/images/placesImage'
import { supabase } from '@/lib/supabase'

type Extra = {
  wanspotApiUrl?: string
  wanspotSiteUrl?: string
}

/** EAS 等で env 未設定でも本番 API に届くようにする（app.config の extra と二重化） */
const DEFAULT_WANSPOT_ORIGIN = 'https://www.wanspot.app'

function firstNonEmpty(...vals: (string | undefined)[]): string {
  for (const v of vals) {
    const t = typeof v === 'string' ? v.trim() : ''
    if (t) return t
  }
  return ''
}

/** Next.js wanspot の API オリジン（末尾スラッシュなし）。実機では localhost ではなく本番 or LAN の URL を .env に。 */
export function getWanspotApiBase(): string {
  const extra = Constants.expoConfig?.extra as Extra | undefined
  const raw = firstNonEmpty(
    process.env.EXPO_PUBLIC_WANSPOT_API_URL,
    extra?.wanspotApiUrl,
    DEFAULT_WANSPOT_ORIGIN
  )
  return raw.replace(/\/$/, '')
}

/**
 * シェア・コピー用の公開サイトオリジン（末尾スラッシュなし）。
 * EXPO_PUBLIC_WANSPOT_SITE_URL でシェア用の公開オリジンを API オリジンと別にできる（既定は本番 https://www.wanspot.app 想定）。
 */
export function getWanspotPublicBase(): string {
  const extra = Constants.expoConfig?.extra as Extra | undefined
  const raw = firstNonEmpty(
    process.env.EXPO_PUBLIC_WANSPOT_SITE_URL,
    extra?.wanspotSiteUrl,
    process.env.EXPO_PUBLIC_WANSPOT_API_URL,
    extra?.wanspotApiUrl,
    DEFAULT_WANSPOT_ORIGIN
  )
  return raw.replace(/\/$/, '')
}

/** シェア用の公開ページ URL（getWanspotPublicBase を使用） */
export function wanspotPublicUrl(path: string): string {
  const base = getWanspotPublicBase()
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
          'API のベース URL が未設定です。.env.local に EXPO_PUBLIC_WANSPOT_API_URL（例: https://www.wanspot.app）を書き、npx expo start を再起動してください。',
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

export type { ImageSize } from '@/lib/images/placesImage'

export function spotPhotoUrl(photoRef: string | null, size: ImageSize | number = 'card'): string | null {
  if (!photoRef) return null
  const base = getWanspotApiBase()
  if (!base) return null
  const w = typeof size === 'number' ? size : widthForImageSize(size)
  return `${base}/api/spots/photo?ref=${encodeURIComponent(photoRef)}&w=${w}`
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

/** 準備中エリア向け: スポット整備リクエストを Supabase `area_requests` に保存（Bearer 必須） */
export async function sendAreaRequest(
  prefecture: string,
  municipality: string,
  message: string
): Promise<{ ok: boolean }> {
  const res = await wanspotFetch('/api/area-requests', {
    method: 'POST',
    json: { prefecture, municipality, message },
  })
  return { ok: res.ok }
}
