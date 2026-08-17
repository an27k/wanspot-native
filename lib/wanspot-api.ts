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

export type WanspotFetchInit = RequestInit & {
  json?: unknown
  auth?: boolean
  /** この呼び出しだけ待ち時間を変える。省略時は DEFAULT_TIMEOUT_MS */
  timeoutMs?: number
}

/**
 * 応答が返らないときに諦めるまでの時間。
 *
 * これまで一切の上限が無く、圏外や電波の弱い場所では fetch が返らないまま
 * ローディングが回り続けていた。犬の散歩中に使うアプリなので、地下や山間部で
 * 電波が切れるのは例外ではなく日常のほう。待たせ続けるより、切って再試行の
 * 余地を返すほうがいい。
 *
 * 12秒は「遅いが生きている回線」を切らない下限として置いている。3G相当でも
 * スポット一覧は返ってくる。
 */
const DEFAULT_TIMEOUT_MS = 12_000

/** AI 生成は Web 検索を挟むと実測で10〜25秒かかる。同じ上限では必ず切れる */
const SLOW_PATH_TIMEOUT_MS = 40_000
const SLOW_PATHS = ['/api/ai-summary', '/api/vlog/render', '/api/vlog/quality', '/api/walk-line']

function timeoutForPath(path: string, override?: number): number {
  if (typeof override === 'number' && override > 0) return override
  return SLOW_PATHS.some((p) => path.startsWith(p)) ? SLOW_PATH_TIMEOUT_MS : DEFAULT_TIMEOUT_MS
}

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
  /*
    呼び出し側の signal も尊重する。AbortSignal.any は Hermes に無いので、
    こちらの controller に手で中継する。どちらが先でも中断される。
  */
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutForPath(path, init.timeoutMs))
  const caller = init.signal
  const relay = () => controller.abort()
  if (caller) {
    if (caller.aborted) controller.abort()
    else caller.addEventListener('abort', relay)
  }

  try {
    return await fetch(url, { ...init, headers, body, signal: controller.signal })
  } catch (e) {
    /*
      中断や通信断で例外を投げると、49箇所ある呼び出し側のうち try で囲っていない
      ものが落ちる。従来は「返らない」だったので、そこは誰も守っていない。
      上限を入れたことで画面が落ちるようになるのは本末転倒なので、応答として返す。

      呼び出し側は既に !r.ok を見て諦める作りになっているため、そのまま乗る。
      呼び出し側が自分の signal で中断した場合だけは、その意図を尊重して投げ直す。
    */
    if (caller?.aborted) throw e
    const timedOut = (e as { name?: string })?.name === 'AbortError'
    return new Response(JSON.stringify({ error: timedOut ? 'timeout' : 'network' }), {
      status: 504,
      headers: { 'Content-Type': 'application/json' },
    })
  } finally {
    clearTimeout(timer)
    caller?.removeEventListener('abort', relay)
  }
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
