import { useCallback, useState } from 'react'
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { type } from '@/constants/typography'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { wanspotFetch } from '@/lib/wanspot-api'

const DELETE_CONFIRM = 'DELETE'

export default function AccountDeleteScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { signOut } = useAuth()
  const [confirmText, setConfirmText] = useState('')
  const [busy, setBusy] = useState(false)

  const canSubmit = confirmText === DELETE_CONFIRM && !busy

  const exitToLogin = useCallback(async () => {
    try {
      await supabase.auth.signOut({ scope: 'local' })
    } catch {
      /* サーバー側で既に削除済みでもローカルセッションは消す */
    }
    try {
      await signOut()
    } catch {
      /* ignore */
    }
    router.replace('/(auth)/login')
  }, [router, signOut])

  const onDelete = useCallback(async () => {
    if (confirmText !== DELETE_CONFIRM || busy) return
    setBusy(true)
    try {
      const res = await wanspotFetch('/api/account/delete', { method: 'POST' })
      let body: { error?: string; success?: boolean } = {}
      try {
        body = (await res.json()) as typeof body
      } catch {
        /* ignore */
      }
      if (!res.ok) {
        Alert.alert(
          '削除に失敗しました',
          typeof body.error === 'string' ? body.error : 'しばらくしてから再度お試しください。',
          [{ text: 'OK' }]
        )
        setBusy(false)
        return
      }
      await exitToLogin()
    } catch (e) {
      Alert.alert('削除に失敗しました', e instanceof Error ? e.message : '通信エラーが発生しました。', [{ text: 'OK' }])
      setBusy(false)
    }
  }, [confirmText, busy, exitToLogin])

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <View style={styles.topBar}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="戻る"
        >
          <Ionicons name="chevron-back" size={28} color="#1A1A1A" />
        </Pressable>
        <Text style={styles.topTitle}>アカウントを削除</Text>
        <View style={styles.topBarSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.warnTitle}>以下のデータが削除されます：</Text>
        <Text style={styles.warnBody}>
          ・プロフィール情報{'\n'}
          ・ワンちゃんの情報{'\n'}
          ・お気に入りしたスポット{'\n'}
          ・イベント参加履歴{'\n'}
          ・送信したエリアリクエスト{'\n'}
          {'\n'}
          この操作は取り消せません。
        </Text>

        <Text style={styles.inputLabel}>確認のため「{DELETE_CONFIRM}」と入力してください</Text>
        <TextInput
          style={styles.input}
          value={confirmText}
          onChangeText={setConfirmText}
          placeholder={DELETE_CONFIRM}
          placeholderTextColor="#BBB"
          autoCapitalize="characters"
          autoCorrect={false}
          editable={!busy}
        />

        <Pressable
          style={[styles.dangerBtn, !canSubmit && styles.dangerBtnOff]}
          onPress={() => void onDelete()}
          disabled={!canSubmit}
        >
          {busy ? <Text style={styles.dangerBtnTxt}>削除中...</Text> : <Text style={styles.dangerBtnTxt}>アカウントを削除する</Text>}
        </Pressable>

        <Pressable
          style={styles.ghostBtn}
          onPress={() => router.back()}
          disabled={busy}
        >
          <Text style={styles.ghostBtnTxt}>キャンセル</Text>
        </Pressable>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FAFAF8' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  topTitle: { flex: 1, textAlign: 'center', ...type.button, color: '#1A1A1A' },
  topBarSpacer: { width: 28 },
  scroll: { paddingHorizontal: 24, paddingTop: 24, gap: 16 },
  warnTitle: { ...type.heading, color: '#1A1A1A' },
  warnBody: { ...type.body, color: '#555' },
  inputLabel: { ...type.body, color: '#333', marginTop: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#fff',
    color: '#1A1A1A',
  },
  dangerBtn: {
    marginTop: 8,
    backgroundColor: '#E84335',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  dangerBtnOff: { opacity: 0.45 },
  dangerBtnTxt: { ...type.button, color: '#fff' },
  ghostBtn: { paddingVertical: 14, alignItems: 'center' },
  ghostBtnTxt: { ...type.button, color: '#666' },
})
