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
import { colors } from '@/constants/colors'
import { useAuth } from '@/context/AuthContext'
import { isAppleSignInAvailable, signInWithApple } from '@/lib/apple-signin'
import { completeLoginNavigation } from '@/lib/complete-login-navigation'
import { isGoogleSignInConfigured, signInWithGoogle } from '@/lib/google-signin'

import { LoadingDogSvg } from '@/components/common/LoadingDog'
import { Logo } from '@/components/Logo'
import { AppleOAuthLabel, GoogleOAuthLabel } from '@/components/auth/OAuthButtonLabels'
import { oauthApplePressableBase, oauthGooglePressableBase } from '@/components/auth/oauthButtonStyles'

export default function LoginScreen() {
  const router = useRouter()
  const { signIn } = useAuth()
  const passwordRef = useRef<RNTextInput | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [oauthLoading, setOauthLoading] = useState<'google' | 'apple' | null>(null)
  const [error, setError] = useState('')
  const [appleNativeAvailable, setAppleNativeAvailable] = useState(false)
  const googleSignInReady = isGoogleSignInConfigured()
  const showOAuthSection = googleSignInReady || appleNativeAvailable

  useEffect(() => {
    void isAppleSignInAvailable().then(setAppleNativeAvailable)
  }, [])

  const submit = async () => {
    setLoading(true)
    setError('')
    const { error: e } = await signIn(email.trim(), password)
    if (e) {
      setError(e.message)
      setLoading(false)
      return
    }
    setLoading(false)
    await completeLoginNavigation(router)
  }

  const handleGoogleSignIn = async () => {
    if (oauthLoading !== null || loading || !googleSignInReady) return

    setOauthLoading('google')
    setError('')
    try {
      const res = await signInWithGoogle()
      if (res.success) {
        await completeLoginNavigation(router)
        return
      }
      if (res.reason === 'cancelled' || res.reason === 'in_progress') return
      Alert.alert('エラー', res.message ?? 'Googleサインインに失敗しました')
    } catch (error) {
      Alert.alert('エラー', error instanceof Error ? error.message : 'Googleサインインに失敗しました')
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
            <Text style={styles.title}>wanspot</Text>
            <TextInput
              style={styles.input}
              placeholder="メールアドレス"
              placeholderTextColor={colors.textMuted}
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
              placeholder="パスワード"
              placeholderTextColor={colors.textMuted}
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
              {loading ? <LoadingDogSvg size={24} /> : <Text style={styles.btnTxt}>ログイン</Text>}
            </Pressable>

            {showOAuthSection ? (
              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerTxt}>または</Text>
                <View style={styles.dividerLine} />
              </View>
            ) : null}

            {googleSignInReady ? (
              <Pressable
                style={[styles.btnGoogle, oauthLoading !== null && styles.oauthDis]}
                disabled={oauthLoading !== null || loading}
                onPress={() => void handleGoogleSignIn()}
              >
                {oauthLoading === 'google' ? (
                  <LoadingDogSvg size={24} />
                ) : (
                  <GoogleOAuthLabel text="Googleでログイン" textStyle={styles.btnGoogleTxt} />
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
                  <AppleOAuthLabel text="Appleでログイン" textStyle={styles.btnAppleTxt} />
                )}
              </Pressable>
            ) : null}

            <Link href="/(auth)/signup" asChild>
              <Pressable style={styles.link}>
                <Text style={styles.linkTxt}>新規登録はこちら</Text>
              </Pressable>
            </Link>
          </View>
        </TouchableWithoutFeedback>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  scrollContent: { flexGrow: 1, padding: 24, justifyContent: 'center' },
  inner: { width: '100%', flexGrow: 1, justifyContent: 'center' },
  logo: { alignSelf: 'center', marginBottom: 4 },
  title: {
    fontSize: 28,
    fontWeight: '900',
    textAlign: 'center',
    color: colors.text,
    marginTop: 12,
    marginBottom: 24,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    backgroundColor: colors.cardBg,
    color: colors.text,
  },
  err: { color: colors.error, textAlign: 'center', marginBottom: 8, fontSize: 13 },
  btn: {
    backgroundColor: colors.brand,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  btnDis: { opacity: 0.4 },
  btnTxt: { fontWeight: '800', fontSize: 16, color: colors.text },
  link: { marginTop: 20, alignItems: 'center' },
  linkTxt: { color: colors.textMuted, fontSize: 14 },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 22,
    marginBottom: 4,
  },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  dividerTxt: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  btnGoogle: {
    ...oauthGooglePressableBase,
    marginTop: 14,
  },
  btnGoogleTxt: { fontWeight: '800', fontSize: 16, color: '#2b2a28' },
  btnApple: {
    ...oauthApplePressableBase,
    marginTop: 10,
  },
  btnAppleTxt: { fontWeight: '800', fontSize: 16, color: '#fff' },
  oauthDis: { opacity: 0.55 },
})
