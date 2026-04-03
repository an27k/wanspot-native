import { useEffect, useRef } from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import * as Linking from 'expo-linking'
import { useRouter } from 'expo-router'
import { colors } from '@/constants/colors'
import { applyOAuthCallbackUrl } from '@/lib/oauth-supabase'
import { completeLoginNavigation } from '@/lib/complete-login-navigation'

function isNonEmptyCallbackUrl(url: unknown): url is string {
  return typeof url === 'string' && url.trim().length > 0
}

/**
 * ディープリンク wanspot://auth/callback でアプリが起動／復帰したときの処理。
 */
export default function AuthOAuthCallbackScreen() {
  const router = useRouter()
  const handledRef = useRef(false)
  const urlFromHook = Linking.useURL()

  useEffect(() => {
    const run = async (url: string | null | undefined) => {
      if (handledRef.current) return
      if (!isNonEmptyCallbackUrl(url)) return
      const safe = url.trim()
      if (!safe.includes('auth/callback')) return
      handledRef.current = true
      const { error } = await applyOAuthCallbackUrl(safe)
      if (error) {
        router.replace('/(auth)/login')
        return
      }
      await completeLoginNavigation(router)
    }

    const failTimer = setTimeout(() => {
      if (!handledRef.current) router.replace('/(auth)/login')
    }, 12000)

    void run(urlFromHook ?? undefined)
    void Linking.getInitialURL().then((u) => {
      if (u == null) return
      void run(u)
    })

    const sub = Linking.addEventListener('url', (event) => {
      const u = event?.url
      if (u == null || typeof u !== 'string') return
      void run(u)
    })
    return () => {
      clearTimeout(failTimer)
      sub.remove()
    }
  }, [router, urlFromHook])

  return (
    <View style={styles.root}>
      <ActivityIndicator size="large" color={colors.text} />
      <Text style={styles.txt}>ログイン処理中...</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', gap: 16 },
  txt: { fontSize: 14, color: colors.textMuted, paddingHorizontal: 24, textAlign: 'center' },
})
