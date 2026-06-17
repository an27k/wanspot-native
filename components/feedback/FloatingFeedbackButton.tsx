import { useState } from 'react'
import Constants from 'expo-constants'
import { Ionicons } from '@expo/vector-icons'
import { usePathname } from 'expo-router'
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors } from '@/constants/colors'
import { supabase } from '@/lib/supabase'

export function FloatingFeedbackButton() {
  const insets = useSafeAreaInsets()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [comment, setComment] = useState('')
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const submit = async () => {
    const text = comment.trim()
    if (!text || sending) return
    setSending(true)
    setMessage(null)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        setMessage('ログイン後に送信できます。')
        return
      }
      const { error } = await supabase.from('app_feedback').insert({
        user_id: user.id,
        comment: text,
        route: pathname,
        app_version: Constants.expoConfig?.version ?? null,
        platform: Platform.OS,
        device_info: {
          osVersion: String(Platform.Version),
          appOwnership: Constants.appOwnership ?? null,
        },
      })
      if (error) {
        setMessage('送信できませんでした。少し時間をおいてもう一度お願いします。')
        return
      }
      setComment('')
      setMessage('送信しました。ありがとうございます。')
      setTimeout(() => {
        setOpen(false)
        setMessage(null)
      }, 900)
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <Pressable
        style={[styles.fab, { bottom: insets.bottom + 76 }]}
        onPress={() => setOpen(true)}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="フィードバックを送る"
      >
        <Ionicons name="chatbubble-ellipses" size={20} color="#fff" />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.backdrop}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} />
          <View style={styles.card}>
            <View style={styles.head}>
              <View>
                <Text style={styles.title}>フィードバック</Text>
                <Text style={styles.sub}>不具合・違和感・改善案をそのまま送れます。</Text>
              </View>
              <Pressable onPress={() => setOpen(false)} hitSlop={10}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </Pressable>
            </View>
            <TextInput
              style={styles.input}
              value={comment}
              onChangeText={setComment}
              placeholder="例: 価格帯が出ない / 表示が遅い / この文言が気になる"
              placeholderTextColor={colors.textMuted}
              multiline
              maxLength={2000}
              textAlignVertical="top"
              editable={!sending}
              autoFocus
            />
            {message ? <Text style={styles.message}>{message}</Text> : null}
            <Pressable
              style={[styles.submit, (!comment.trim() || sending) && styles.submitDisabled]}
              onPress={() => void submit()}
              disabled={!comment.trim() || sending}
            >
              <Text style={styles.submitTxt}>{sending ? '送信中...' : '送信する'}</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 18,
    zIndex: 100,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 12,
  },
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(43,42,40,0.38)',
    padding: 18,
  },
  card: {
    borderRadius: 24,
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    gap: 12,
  },
  head: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  title: { fontSize: 18, fontWeight: '800', color: colors.text },
  sub: { marginTop: 4, fontSize: 12, lineHeight: 18, color: colors.textMuted },
  input: {
    minHeight: 126,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    lineHeight: 22,
    color: colors.text,
  },
  message: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  submit: {
    alignItems: 'center',
    borderRadius: 999,
    backgroundColor: colors.primary,
    paddingVertical: 14,
  },
  submitDisabled: { opacity: 0.45 },
  submitTxt: { fontSize: 14, fontWeight: '800', color: '#fff' },
})
