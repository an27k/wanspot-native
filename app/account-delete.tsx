import { useCallback, useState } from 'react'
import {
  ActivityIndicator,
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
import { useAuth } from '@/context/AuthContext'
import { colors } from '@/constants/colors'
import { wanspotFetch } from '@/lib/wanspot-api'

const DELETE_CONFIRM = 'DELETE'

export default function AccountDeleteScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { signOut } = useAuth()
  const [confirmText, setConfirmText] = useState('')
  const [busy, setBusy] = useState(false)
  const [success, setSuccess] = useState(false)

  const canSubmit = confirmText === DELETE_CONFIRM && !busy && !success

  const onDelete = useCallback(async () => {
    if (confirmText !== DELETE_CONFIRM || busy || success) return
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
        return
      }
      setSuccess(true)
      setTimeout(() => {
        void (async () => {
          try {
            await signOut()
          } catch {
            /* ignore */
          }
          router.replace('/(auth)/login')
        })()
      }, 3000)
    } catch (e) {
      Alert.alert('削除に失敗しました', e instanceof Error ? e.message : '通信エラーが発生しました。', [{ text: 'OK' }])
    } finally {
      setBusy(false)
    }
  }, [confirmText, busy, success, router, signOut])

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
          editable={!busy && !success}
        />

        {success ? (
          <View style={styles.successBox}>
            <Text style={styles.successTxt}>アカウントを削除しました</Text>
            <ActivityIndicator color={colors.brand} style={{ marginTop: 12 }} />
          </View>
        ) : null}

        <Pressable
          style={[styles.dangerBtn, (!canSubmit || success) && styles.dangerBtnOff]}
          onPress={() => void onDelete()}
          disabled={!canSubmit || success}
        >
          {busy ? <Text style={styles.dangerBtnTxt}>削除中...</Text> : <Text style={styles.dangerBtnTxt}>アカウントを削除する</Text>}
        </Pressable>

        <Pressable
          style={styles.ghostBtn}
          onPress={() => router.back()}
          disabled={busy || success}
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
  topTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: '#1A1A1A' },
  topBarSpacer: { width: 28 },
  scroll: { paddingHorizontal: 24, paddingTop: 24, gap: 16 },
  warnTitle: { fontSize: 15, fontWeight: '700', color: '#1A1A1A' },
  warnBody: { fontSize: 14, color: '#555', lineHeight: 22 },
  inputLabel: { fontSize: 13, fontWeight: '600', color: '#333', marginTop: 8 },
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
  dangerBtnTxt: { fontSize: 16, fontWeight: '700', color: '#fff' },
  ghostBtn: { paddingVertical: 14, alignItems: 'center' },
  ghostBtnTxt: { fontSize: 15, fontWeight: '600', color: '#666' },
  successBox: { alignItems: 'center', paddingVertical: 8 },
  successTxt: { fontSize: 15, fontWeight: '700', color: '#2b7a4b', textAlign: 'center' },
})
