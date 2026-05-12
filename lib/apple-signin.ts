import * as AppleAuthentication from 'expo-apple-authentication'
import { Platform } from 'react-native'
import { supabase } from '@/lib/supabase'

export async function isAppleSignInAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false
  return await AppleAuthentication.isAvailableAsync()
}

function isUserCanceled(error: unknown): boolean {
  if (error == null || typeof error !== 'object') return false
  const c = (error as { code?: string }).code
  return c === 'ERR_REQUEST_CANCELED' || c === 'ERR_CANCELED'
}

export async function signInWithApple(): Promise<{
  success: boolean
  error?: string
}> {
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
    })

    if (!credential.identityToken) {
      return { success: false, error: 'Apple認証情報が取得できませんでした' }
    }

    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
    })
    if (error) {
      return { success: false, error: error.message }
    }

    if (credential.fullName) {
      const { givenName, familyName } = credential.fullName
      const displayName = [familyName, givenName]
        .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
        .join(' ')
        .trim()
      if (displayName) {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (user) {
          const { data: row } = await supabase.from('users').select('name').eq('id', user.id).maybeSingle()
          const current = typeof row?.name === 'string' ? row.name.trim() : ''
          if (!current) {
            await supabase.from('users').update({ name: displayName }).eq('id', user.id)
          }
        }
      }
    }

    return { success: true }
  } catch (error) {
    if (isUserCanceled(error)) {
      return { success: false, error: 'cancelled' }
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Appleサインインに失敗しました',
    }
  }
}
