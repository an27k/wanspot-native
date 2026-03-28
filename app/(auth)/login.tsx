import { useState } from 'react'
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { Link, useRouter } from 'expo-router'
import { colors } from '@/constants/colors'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'

const LOGO = require('@/assets/images/wanspot_icon.png')

export default function LoginScreen() {
  const router = useRouter()
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    setLoading(true)
    setError('')
    const { error: e } = await signIn(email.trim(), password)
    if (e) {
      setError(e.message)
      setLoading(false)
      return
    }
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase.from('users').select('id').eq('id', user!.id).maybeSingle()
    setLoading(false)
    if (!profile) router.replace('/onboarding/dog')
    else router.replace('/(tabs)')
  }

  return (
    <View style={styles.root}>
      <Image source={LOGO} style={styles.logo} resizeMode="contain" />
      <Text style={styles.title}>wanspot</Text>
      <Text style={styles.sub}>ログイン</Text>
      <TextInput
        style={styles.input}
        placeholder="メールアドレス"
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="パスワード"
        placeholderTextColor={colors.textMuted}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      {error ? <Text style={styles.err}>{error}</Text> : null}
      <Pressable
        style={[styles.btn, (!email || !password) && styles.btnDis]}
        disabled={loading || !email || !password}
        onPress={submit}
      >
        {loading ? <ActivityIndicator color={colors.text} /> : <Text style={styles.btnTxt}>ログイン</Text>}
      </Pressable>
      <Link href="/(auth)/signup" asChild>
        <Pressable style={styles.link}>
          <Text style={styles.linkTxt}>新規登録はこちら</Text>
        </Pressable>
      </Link>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  logo: { width: 72, height: 72, alignSelf: 'center' },
  title: { fontSize: 28, fontWeight: '900', textAlign: 'center', color: colors.text, marginTop: 12 },
  sub: { textAlign: 'center', color: colors.textMuted, marginBottom: 24 },
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
})
