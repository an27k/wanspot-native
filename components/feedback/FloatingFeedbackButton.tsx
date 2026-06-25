import { useState } from 'react'
import Constants from 'expo-constants'
import { LinearGradient } from 'expo-linear-gradient'
import * as ImagePicker from 'expo-image-picker'
import { Ionicons } from '@expo/vector-icons'
import { usePathname } from 'expo-router'
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
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
import { compressImageToJpeg } from '@/lib/images/compress-image'
import { supabase } from '@/lib/supabase'

const SCREENSHOT_BUCKET = 'app-feedback-screenshots'

type ScreenshotAttachment = {
  uri: string
  width: number
  height: number
  size: number
  mimeType: 'image/jpeg'
}

function createFeedbackId(): string {
  const runtimeCrypto = globalThis.crypto as { randomUUID?: () => string } | undefined
  if (runtimeCrypto?.randomUUID) {
    return runtimeCrypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16)
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export function FloatingFeedbackButton() {
  const insets = useSafeAreaInsets()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [comment, setComment] = useState('')
  const [screenshot, setScreenshot] = useState<ScreenshotAttachment | null>(null)
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const pickScreenshot = async () => {
    if (sending) return
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('権限が必要です', 'スクショ画像を選択するため、写真ライブラリへのアクセスを許可してください。', [
        { text: 'キャンセル', style: 'cancel' },
        { text: '設定を開く', onPress: () => Linking.openSettings() },
      ])
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 1,
      exif: false,
    })
    if (result.canceled || result.assets.length === 0) return

    const compressed = await compressImageToJpeg(result.assets[0].uri, 1200)
    if (!compressed) {
      setMessage('スクショ画像を読み込めませんでした。別の画像でお試しください。')
      return
    }
    setScreenshot({ ...compressed, mimeType: 'image/jpeg' })
    setMessage(null)
  }

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
      const feedbackId = createFeedbackId()
      const { error } = await supabase.from('app_feedback').insert({
        id: feedbackId,
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

      if (screenshot) {
        const storagePath = `${user.id}/${feedbackId}.jpg`
        const res = await fetch(screenshot.uri)
        const buf = await res.arrayBuffer()
        const { error: uploadError } = await supabase.storage
          .from(SCREENSHOT_BUCKET)
          .upload(storagePath, buf, { contentType: screenshot.mimeType, upsert: false })

        if (uploadError) {
          setComment('')
          setScreenshot(null)
          setMessage('コメントは送信されましたが、スクショを添付できませんでした。')
          return
        }

        const { error: updateError } = await supabase
          .from('app_feedback')
          .update({
            screenshot_path: storagePath,
            screenshot_mime_type: screenshot.mimeType,
            screenshot_size_bytes: screenshot.size,
            screenshot_width: screenshot.width,
            screenshot_height: screenshot.height,
            screenshot_uploaded_at: new Date().toISOString(),
          })
          .eq('id', feedbackId)
          .eq('user_id', user.id)

        if (updateError) {
          await supabase.storage.from(SCREENSHOT_BUCKET).remove([storagePath])
          setComment('')
          setScreenshot(null)
          setMessage('コメントは送信されましたが、スクショ情報を保存できませんでした。')
          return
        }
      }

      setComment('')
      setScreenshot(null)
      setMessage('送信しました。ありがとうございます。')
      setTimeout(() => {
        setOpen(false)
        setMessage(null)
      }, 900)
    } catch {
      setMessage('送信できませんでした。通信環境を確認してもう一度お願いします。')
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
        <LinearGradient
          pointerEvents="none"
          colors={['#55E0B4', '#7F5CFF', '#F27AD7']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
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
            <View style={styles.attachmentBox}>
              <View style={styles.attachmentTextWrap}>
                <Text style={styles.attachmentTitle}>スクショを添付</Text>
                <Text style={styles.attachmentSub}>写真ライブラリからスクショ画像を1枚選べます。</Text>
              </View>
              <Pressable
                style={[styles.attachButton, sending && styles.attachButtonDisabled]}
                onPress={() => void pickScreenshot()}
                disabled={sending}
              >
                <Ionicons name="image-outline" size={16} color={colors.text} />
                <Text style={styles.attachButtonText}>{screenshot ? '変更' : '選択'}</Text>
              </Pressable>
            </View>
            {screenshot ? (
              <View style={styles.previewRow}>
                <Image source={{ uri: screenshot.uri }} style={styles.preview} />
                <View style={styles.previewMeta}>
                  <Text style={styles.previewText}>
                    {screenshot.width}×{screenshot.height} / {Math.ceil(screenshot.size / 1024)}KB
                  </Text>
                  <Pressable onPress={() => setScreenshot(null)} disabled={sending} hitSlop={8}>
                    <Text style={styles.removeText}>添付を外す</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}
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
    overflow: 'hidden',
    backgroundColor: '#7F5CFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#7F5CFF',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.28,
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
  attachmentBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    padding: 12,
  },
  attachmentTextWrap: { flex: 1 },
  attachmentTitle: { fontSize: 13, fontWeight: '800', color: colors.text },
  attachmentSub: { marginTop: 2, fontSize: 11, lineHeight: 16, color: colors.textMuted },
  attachButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  attachButtonDisabled: { opacity: 0.5 },
  attachButtonText: { fontSize: 12, fontWeight: '800', color: colors.text },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  preview: { width: 64, height: 64, borderRadius: 12, backgroundColor: colors.background },
  previewMeta: { flex: 1, gap: 6 },
  previewText: { fontSize: 11, color: colors.textMuted },
  removeText: { fontSize: 12, fontWeight: '800', color: colors.primary },
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
