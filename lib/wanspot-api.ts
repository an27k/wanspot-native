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
