import { supabase } from '@/lib/supabase'
import { signInWithGoogle } from '@/lib/google-signin'

/** Supabase Dashboard の Redirect URLs に登録すること */
export const OAUTH_REDIRECT_TO = 'wanspot://auth/callback'

function parseOAuthParams(url: string | null | undefined): Record<string, string> {
  const out: Record<string, string> = {}
  if (url == null || typeof url !== 'string') return out
  const s = url.trim()
  if (!s) return out

  const addPairs = (raw: string | null | undefined) => {
    if (raw == null || typeof raw !== 'string' || !raw.trim()) return
    const trimmed = raw.trim()
    for (const pair of trimmed.split('&')) {
      if (!pair) continue
      try {
        const eq = pair.indexOf('=')
        const k = decodeURIComponent(eq >= 0 ? pair.slice(0, eq) : pair)
        const v = decodeURIComponent(eq >= 0 ? pair.slice(eq + 1) : '')
        if (k) out[k] = v
      } catch {
        /* decodeURIComponent 失敗時は当該ペアのみスキップ */
      }
    }
  }

  const q = s.indexOf('?')
  const h = s.indexOf('#')
  if (h >= 0) addPairs(s.slice(h + 1))
  if (q >= 0) {
    const end = h > q ? h : s.length
    addPairs(s.slice(q + 1, end))
  }
  return out
}

export type OAuthSignInResult = { error: Error | null; cancelled?: boolean }

/**
 * コールバック URL（wanspot://auth/callback?... / #...）からセッションを確立する。
 */
export async function applyOAuthCallbackUrl(url: string | null | undefined): Promise<OAuthSignInResult> {
  try {
    if (url == null || typeof url !== 'string' || !url.trim()) {
      return { error: new Error('認証 URL が無効です') }
    }

    const params = parseOAuthParams(url)
    const errParam = params.error?.trim()
    if (errParam) {
      const msg = (params.error_description?.trim() || errParam).trim() || errParam
      return { error: new Error(msg) }
    }

    const accessToken = params.access_token?.trim() ?? ''
    const refreshToken = params.refresh_token?.trim() ?? ''
    if (accessToken.length > 0 && refreshToken.length > 0) {
      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      })
      return { error: error ? new Error(error.message) : null }
    }

    const code = params.code?.trim() ?? ''
    if (code.length > 0) {
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      return { error: error ? new Error(error.message) : null }
    }

    return { error: new Error('認証情報が URL に含まれていません') }
  } catch (e) {
    return { error: e instanceof Error ? e : new Error(String(e)) }
  }
}

export async function signInWithOAuthProvider(
  provider: 'google' | 'apple'
): Promise<OAuthSignInResult> {
  if (provider === 'google') {
    const result = await signInWithGoogle()
    if (!result.success) {
      if (result.error === 'cancelled') return { error: null, cancelled: true }
      return { error: new Error(result.error ?? 'Googleサインインに失敗しました') }
    }
    return { error: null }
  }

  // Apple はネイティブ実装（lib/apple-signin.ts）を利用する想定
  console.warn('[oauth-supabase] Apple is now handled by lib/apple-signin.ts')
  return { error: new Error('Apple Sign-In はネイティブ方式をご利用ください') }
}
