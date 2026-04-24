import { Alert } from 'react-native'
import { router } from 'expo-router'
import { useAuth } from '@/context/AuthContext'

/**
 * 書き込み操作前に認証を要求する
 * 認証済みなら true、未認証ならログイン誘導ダイアログ → false
 */
export function useRequireAuth() {
  const { session } = useAuth()

  return function requireAuth(message?: string): boolean {
    if (session) return true

    Alert.alert('ログインが必要です', message || 'この機能を使うにはログインしてください。', [
      { text: 'キャンセル', style: 'cancel' },
      { text: 'ログインする', onPress: () => router.push('/(auth)/login') },
    ])
    return false
  }
}

