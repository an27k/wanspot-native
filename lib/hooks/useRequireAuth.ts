import { Alert } from 'react-native'
import { router } from 'expo-router'
import { useAuth } from '@/context/AuthContext'
import { logUserEvent } from '@/lib/user-events'

/**
 * アカウント必須操作の前に認証を要求する。
 * 未認証ならログイン誘導 → false。地図・イベント一覧の閲覧には使わない。
 */
export function useRequireAuth() {
  const { session } = useAuth()

  return function requireAuth(message?: string, feature?: string): boolean {
    if (session) return true

    logUserEvent({
      eventType: 'login_prompt',
      props: { feature: feature ?? 'generic', message: message ?? null },
    })

    Alert.alert(
      'アカウントに保存します',
      message || 'この操作の結果はアカウントに残ります。地図とイベント一覧はそのまま見られます。',
      [
        { text: '閉じる', style: 'cancel' },
        { text: 'ログイン', onPress: () => router.push('/(auth)/login') },
      ]
    )
    return false
  }
}

