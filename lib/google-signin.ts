import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from '@react-native-google-signin/google-signin'
import { Platform } from 'react-native'
import { supabase } from './supabase'

const IOS_CLIENT_ID = '573139399424-cgqe3u58m724rpjsm5uu0u1t69qor80m.apps.googleusercontent.com'

let isConfigured = false

function configureGoogleSignIn() {
  if (isConfigured) return

  GoogleSignin.configure({
    iosClientId: IOS_CLIENT_ID,
    scopes: ['profile', 'email', 'openid'],
  })

  isConfigured = true
}

export async function signInWithGoogle(): Promise<{
  success: boolean
  error?: string
}> {
  if (Platform.OS !== 'ios') {
    return { success: false, error: 'Google Sign-In は現在 iOS のみ対応しています' }
  }

  try {
    configureGoogleSignIn()

    // Android のみ実行される想定だが、呼んでも害はない
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: false })

    const response = await GoogleSignin.signIn()

    if (!isSuccessResponse(response)) {
      return { success: false, error: 'cancelled' }
    }

    const idToken = response.data.idToken
    if (!idToken) {
      return { success: false, error: 'Google認証情報が取得できませんでした' }
    }

    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: idToken,
    })

    if (error) {
      return { success: false, error: error.message }
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
  } catch (error: any) {
    if (isErrorWithCode(error)) {
      switch (error.code) {
        case statusCodes.SIGN_IN_CANCELLED:
        case statusCodes.IN_PROGRESS:
          return { success: false, error: 'cancelled' }
        case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
          return { success: false, error: 'Google Play Services が利用できません' }
        default:
          return {
            success: false,
            error: error.message ?? 'Googleサインインに失敗しました',
          }
      }
    }

    return {
      success: false,
      error: error?.message ?? 'Googleサインインに失敗しました',
    }
  }
}

export async function signOutGoogle(): Promise<void> {
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

