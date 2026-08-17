import { useEffect, useRef, useState } from 'react'
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from 'react-native'
import type { TextInput as RNTextInput } from 'react-native'
import { Link, useRouter } from 'expo-router'
import { LoadingDogSvg } from '@/components/common/LoadingDog'
import { Logo } from '@/components/Logo'
import { AppleOAuthLabel, GoogleOAuthLabel } from '@/components/auth/OAuthButtonLabels'
import { oauthApplePressableBase, oauthGooglePressableBase } from '@/components/auth/oauthButtonStyles'
import type { AppColors } from '@/constants/colors'
import { type } from '@/constants/typography'
import { useAuth } from '@/context/AuthContext'
import { useAppTheme } from '@/context/ThemeContext'
import { useThemedStyles } from '@/hooks/use-themed-styles'
import { isAppleSignInAvailable, signInWithApple } from '@/lib/apple-signin'
import { completeLoginNavigation } from '@/lib/complete-login-navigation'
import { continueAsGuest } from '@/lib/continue-as-guest'
import { isSupabaseOAuthReady, signInWithGoogleOAuth } from '@/lib/oauth-supabase'
import { track } from '@/lib/analytics'

export default function SignupScreen() {
  const router = useRouter()
  const { signUp } = useAuth()
  const { colors, isDark } = useAppTheme()
  const styles = useThemedStyles(createStyles)
  const passwordRef = useRef<RNTextInput | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [oauthLoading, setOauthLoading] = useState<'google' | 'apple' | null>(null)
  const [error, setError] = useState('')
  const [appleNativeAvailable, setAppleNativeAvailable] = useState(false)
  const googleOAuthReady = isSupabaseOAuthReady()
  const showOAuthSection = googleOAuthReady || appleNativeAvailable

  useEffect(() => {
    void isAppleSignInAvailable().then(setAppleNativeAvailable)
  }, [])

  const submit = async () => {
    setLoading(true)
    setError('')
    const { error: e } = await signUp(email.trim(), password)
    setLoading(false)
    if (e) {
      setError(e.message)
      return
    }
    track('signup_completed')
    router.replace('/onboarding/dog')
  }

  const handleGoogleOAuth = async () => {
    if (oauthLoading !== null || loading || !googleOAuthReady) return

    setOauthLoading('google')
    setError('')
    try {
      const { error, cancelled } = await signInWithGoogleOAuth()
      if (cancelled) return
      if (error) {
        Alert.alert('エラー', error.message)
        return
      }
      track('signup_completed')
      await completeLoginNavigation(router)
    } catch (error) {
      Alert.alert('エラー', error instanceof Error ? error.message : 'Google登録に失敗しました')
    } finally {
      setOauthLoading(null)
    }
  }

  const handleAppleNativeSignIn = async () => {
    if (oauthLoading !== null || loading || !appleNativeAvailable) return

    setOauthLoading('apple')
    setError('')
    try {
      const res = await signInWithApple()
      if (res.success) {
        await completeLoginNavigation(router)
        return
      }
      if (res.error === 'cancelled') return
      if (res.error) Alert.alert('エラー', res.error)
    } catch (error) {
      Alert.alert('エラー', error instanceof Error ? error.message : 'Appleサインインに失敗しました')
    } finally {
      setOauthLoading(null)
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <View style={styles.inner}>
            <View style={styles.logo}>
              <Logo size={72} />
            </View>
            <Text style={styles.title}>Wanspot</Text>
            <TextInput
              style={styles.input}
              placeholder="メールアドレス"
              placeholderTextColor={colors.textMuted}
              keyboardAppearance={isDark ? 'dark' : 'light'}
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => passwordRef.current?.focus()}
            />
            <TextInput
              ref={passwordRef}
              style={styles.input}
              placeholder="パスワード（6文字以上）"
              placeholderTextColor={colors.textMuted}
              keyboardAppearance={isDark ? 'dark' : 'light'}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              returnKeyType="done"
              onSubmitEditing={() => {
                Keyboard.dismiss()
                if (email.trim() && password && !loading) void submit()
              }}
            />
            {error ? <Text style={styles.err}>{error}</Text> : null}
            <Pressable
              style={[styles.btn, (!email || !password) && styles.btnDis]}
              disabled={loading || !email || !password}
              onPress={() => {
                Keyboard.dismiss()
                void submit()
              }}
            >
              {loading ? <LoadingDogSvg size={24} /> : <Text style={styles.btnTxt}>新規登録</Text>}
            </Pressable>

            {showOAuthSection ? (
              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerTxt}>または</Text>
                <View style={styles.dividerLine} />
              </View>
            ) : null}

            {googleOAuthReady ? (
              <Pressable
                style={[styles.btnGoogle, oauthLoading !== null && styles.oauthDis]}
                disabled={oauthLoading !== null || loading}
                onPress={() => void handleGoogleOAuth()}
              >
                {oauthLoading === 'google' ? (
                  <LoadingDogSvg size={24} />
                ) : (
                  <GoogleOAuthLabel text="Googleで登録" textStyle={styles.btnGoogleTxt} />
                )}
              </Pressable>
            ) : null}

            {appleNativeAvailable ? (
              <Pressable
                style={[styles.btnApple, oauthLoading !== null && styles.oauthDis]}
                disabled={oauthLoading !== null || loading}
                onPress={() => void handleAppleNativeSignIn()}
              >
                {oauthLoading === 'apple' ? (
                  <LoadingDogSvg size={24} />
                ) : (
                  <AppleOAuthLabel text="Appleで登録" textStyle={styles.btnAppleTxt} />
                )}
              </Pressable>
            ) : null}

            <Link href="/(auth)/login" asChild>
              <Pressable style={styles.link}>
                <Text style={styles.linkTxt}>すでにアカウントをお持ちの方</Text>
              </Pressable>
            </Link>
            <Pressable
              style={styles.guestLink}
              onPress={continueAsGuest}
              accessibilityRole="button"
              accessibilityLabel="登録せずに地図とイベントを見る"
            >
              <Text style={styles.guestLinkTxt}>登録しないで使う</Text>
            </Pressable>
          </View>
        </TouchableWithoutFeedback>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  scrollContent: { flexGrow: 1, padding: 24, justifyContent: 'center' },
  inner: { width: '100%', flexGrow: 1, justifyContent: 'center' },
  logo: { alignSelf: 'center', marginBottom: 4 },
  // ワードマークは型スケールの外。ロゴと対で置くブランド資産であって画面タイトルではない。
  // largeTitle は日本語の見出し用に letterSpacing を詰めてあるので、欧文のロゴには当てない
  title: { fontSize: 28, fontWeight: '800', textAlign: 'center', color: colors.text, marginTop: 12, marginBottom: 24 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    backgroundColor: colors.input,
    color: colors.text,
  },
  err: { ...type.caption, color: colors.error, textAlign: 'center', marginBottom: 8 },
  btn: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  btnDis: { opacity: 0.4 },
  btnTxt: { ...type.button, color: colors.onPrimary },
  link: { marginTop: 20, alignItems: 'center' },
  linkTxt: { ...type.body, color: colors.textMuted },
  guestLink: { marginTop: 20, alignItems: 'center', paddingVertical: 10 },
  // 「細く小さく」。出口としては必要だが、主役は新規登録なので目線を奪わない
  guestLinkTxt: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
    textDecorationLine: 'underline' as const,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 22,
    marginBottom: 4,
  },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  dividerTxt: { ...type.label, color: colors.textMuted },
  btnGoogle: {
    ...oauthGooglePressableBase,
    borderColor: colors.borderEmphasis,
    marginTop: 14,
  },
  btnGoogleTxt: { fontWeight: '800', fontSize: 16, color: '#fff' },
  btnApple: {
    ...oauthApplePressableBase,
    borderColor: colors.borderEmphasis,
    marginTop: 10,
  },
  btnAppleTxt: { fontWeight: '800', fontSize: 16, color: '#fff' },
  oauthDis: { opacity: 0.55 },
})
