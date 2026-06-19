import Constants from 'expo-constants'
import type { Session } from '@supabase/supabase-js'
import { resizePlacesImageUrl, widthForImageSize, type ImageSize } from '@/lib/images/placesImage'
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

export type WanspotFetchInit = RequestInit & { json?: unknown; auth?: boolean }

let cachedAccessToken: string | null = null
let cachedExpiresAtMs = 0

export function setWanspotSessionCache(session: Session | null): void {
  cachedAccessToken = session?.access_token ?? null
  cachedExpiresAtMs = session?.expires_at ? session.expires_at * 1000 : 0
}

async function getCachedAccessToken(): Promise<string | null> {
  if (cachedAccessToken && (!cachedExpiresAtMs || cachedExpiresAtMs - Date.now() > 30_000)) {
    return cachedAccessToken
  }
  const {
    data: { session },
  } = await supabase.auth.getSession()
  setWanspotSessionCache(session)
  return session?.access_token ?? null
}

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
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(init.headers as Record<string, string>),
  }
  if (init.auth !== false) {
    const accessToken = await getCachedAccessToken()
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`
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

/** DB の photo_ref → プラン SSE の photo_url → 生 URL / ref 文字列の順で解決 */
export function resolveSpotPhotoUri(
  photoRef: string | null | undefined,
  fallbackUrl?: string | null,
  size: ImageSize = 'card'
): string | null {
  const fromRef = spotPhotoUrl(photoRef ?? null, size)
  if (fromRef) return fromRef
  const raw = typeof fallbackUrl === 'string' ? fallbackUrl.trim() : ''
  if (!raw) return null
  if (/^https?:\/\//i.test(raw)) return resizePlacesImageUrl(raw, size)
  return spotPhotoUrl(raw, size)
}

/** Google Places Detail から最新の photo_reference を取得（DB の ref は期限切れになりやすい） */
export async function fetchSpotPhotoRefFromDetail(placeId: string): Promise<string | null> {
  const pid = placeId.trim()
  if (!pid) return null
  try {
    const res = await wanspotFetch(`/api/spots/detail?place_id=${encodeURIComponent(pid)}`)
    if (!res.ok) return null
    const json = (await res.json()) as Record<string, unknown>
    const body =
      json.result && typeof json.result === 'object' && json.result !== null
        ? (json.result as Record<string, unknown>)
        : json
    const photos = body.photos
    if (!Array.isArray(photos) || photos.length === 0) return null
    const first = photos[0] as { photo_reference?: unknown }
    const ref = first?.photo_reference
    return typeof ref === 'string' && ref.trim().length > 0 ? ref.trim() : null
  } catch {
    return null
  }
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

export type AiPlanFeasibilityResult = {
  feasible: boolean
  walking_feasible: boolean
  driving_feasible: boolean
  spot_count: number
  is_major_area: boolean
}

const FEASIBILITY_FAIL_OPEN: AiPlanFeasibilityResult = {
  feasible: true,
  walking_feasible: true,
  driving_feasible: true,
  spot_count: 0,
  is_major_area: false,
}

/** エリアのプラン組み可否（徒歩・車）。失敗時はオプティミスティックに許可（生成 API で再チェック）。 */
export async function checkAiPlanFeasibility(
  prefecture: string,
  municipality?: string
): Promise<AiPlanFeasibilityResult> {
  try {
    const res = await wanspotFetch('/api/ai-plan/feasibility', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefecture, municipality }),
    })
    if (!res.ok) return FEASIBILITY_FAIL_OPEN
    const json = (await res.json()) as Record<string, unknown>
    return {
      feasible: (json.feasible as boolean | undefined) ?? true,
      walking_feasible: (json.walking_feasible as boolean | undefined) ?? true,
      driving_feasible: (json.driving_feasible as boolean | undefined) ?? true,
      spot_count: (json.spot_count as number | undefined) ?? 0,
      is_major_area: (json.is_major_area as boolean | undefined) ?? false,
    }
  } catch (e) {
    console.warn('checkAiPlanFeasibility failed:', e)
    return FEASIBILITY_FAIL_OPEN
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
