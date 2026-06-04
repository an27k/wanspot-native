import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from '@react-native-google-signin/google-signin'
import { Platform } from 'react-native'
import {
  getGoogleWebClientId,
  GOOGLE_IOS_CLIENT_ID,
  isGoogleSignInConfigured,
} from '@/lib/google-signin-config'
import { supabase } from './supabase'

let isConfigured = false

export type GoogleSignInResult =
  | { success: true }
  | {
      success: false
      reason: 'cancelled' | 'in_progress' | 'play_services_unavailable' | 'configuration' | 'error'
      message?: string
    }

function getGoogleConfigurationError(): string | null {
  if (Platform.OS !== 'ios') {
    return 'Google Sign-In は現在 iOS のみ対応しています'
  }

  if (!GOOGLE_IOS_CLIENT_ID.trim()) {
    return 'Google Sign-In の iOS Client ID が未設定です。'
  }

  if (!getGoogleWebClientId()) {
    return 'Google Sign-In の設定が未完了です。.env.local に EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID（Google Cloud の Web クライアント ID）を設定してください。'
  }

  return null
}

function configureGoogleSignIn() {
  if (isConfigured) return

  const webClientId = getGoogleWebClientId()
  GoogleSignin.configure({
    iosClientId: GOOGLE_IOS_CLIENT_ID,
    webClientId,
    scopes: ['profile', 'email', 'openid'],
  })

  isConfigured = true
}

export { isGoogleSignInConfigured } from '@/lib/google-signin-config'

export async function signInWithGoogle(): Promise<GoogleSignInResult> {
  const configurationError = getGoogleConfigurationError()
  if (configurationError) {
    return { success: false, reason: 'configuration', message: configurationError }
  }

  try {
    configureGoogleSignIn()

    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: false })

    const response = await GoogleSignin.signIn()

    if (!isSuccessResponse(response)) {
      return { success: false, reason: 'cancelled' }
    }

    const idToken = response.data.idToken
    if (!idToken) {
      return {
        success: false,
        reason: 'error',
        message:
          'Google の id_token が取得できませんでした。EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID が Supabase の Google プロバイダ設定と一致しているか確認してください。',
      }
    }

    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: idToken,
    })

    if (error) {
      return { success: false, reason: 'error', message: error.message }
    }

    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session) {
      return {
        success: false,
        reason: 'error',
        message: 'Googleログイン後のセッション確認に失敗しました',
      }
    }

    const { user: googleUser } = response.data
    if (googleUser?.name) {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) {
        await supabase
          .from('users')
          .update({ name: googleUser.name })
          .eq('id', user.id)
          .or('name.is.null,name.eq.')
      }
    }

    return { success: true }
  } catch (error: unknown) {
    if (isErrorWithCode(error)) {
      switch (error.code) {
        case statusCodes.SIGN_IN_CANCELLED:
          return { success: false, reason: 'cancelled' }
        case statusCodes.IN_PROGRESS:
          return { success: false, reason: 'in_progress' }
        case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
          return {
            success: false,
            reason: 'play_services_unavailable',
            message: 'Google Play Services が利用できません',
          }
        default:
          return {
            success: false,
            reason: 'error',
            message: error.message ?? 'Googleサインインに失敗しました',
          }
      }
    }

    const message = error instanceof Error ? error.message : 'Googleサインインに失敗しました'
    return { success: false, reason: 'error', message }
  }
}

export async function signOutGoogle(): Promise<void> {
  if (!isGoogleSignInConfigured()) return
  try {
    configureGoogleSignIn()
    const isSignedIn = await GoogleSignin.hasPreviousSignIn()
    if (isSignedIn) {
      await GoogleSignin.signOut()
    }
  } catch (error) {
    console.warn('[GoogleSignIn] signOut error:', error)
  }
}
