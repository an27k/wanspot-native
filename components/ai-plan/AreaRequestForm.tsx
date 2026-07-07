import { useEffect, useState } from 'react'
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LoadingDogSvg } from '@/components/common/LoadingDog'
import { colors } from '@/constants/colors'
import { TOKENS } from '@/constants/color-tokens'
import { sendAreaRequest } from '@/lib/wanspot-api'

type AreaRequestFormProps = {
  prefecture: string
  municipality: string
  /** 親（モーダル等）でトーストを出す場合 */
  onToast?: (message: string) => void
}

export function AreaRequestForm({ prefecture, municipality, onToast }: AreaRequestFormProps) {
  const insets = useSafeAreaInsets()
  const [requestText, setRequestText] = useState('')
  const [sending, setSending] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const showToast = (message: string) => {
    if (onToast) {
      onToast(message)
      return
    }
    setToast(message)
  }

  useEffect(() => {
    if (onToast || !toast) return
    const t = setTimeout(() => setToast(null), 2800)
    return () => clearTimeout(t)
  }, [toast, onToast])

  const handleSendRequest = async () => {
    const trimmed = requestText.trim()
    if (!trimmed || !prefecture || !municipality || sending) return
    setSending(true)
    const result = await sendAreaRequest(prefecture, municipality, trimmed)
    setSending(false)
    if (result.ok) {
      showToast('リクエストありがとうございます！整備でき次第お知らせします')
      setRequestText('')
    } else {
      showToast('送信に失敗しました。時間をおいて再試行してください')
    }
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.areaLabel}>
        {prefecture} {municipality.replace(prefecture, '').trim() || municipality}
      </Text>
      <Text style={styles.requestLabel}>行きたいスポットを教えてください</Text>
      <TextInput
        value={requestText}
        onChangeText={setRequestText}
        placeholder="お店の名前、エリア、ご希望をお聞かせください"
        placeholderTextColor={TOKENS.text.tertiary}
        multiline
        maxLength={500}
        textAlignVertical="top"
        style={styles.textarea}
        editable={!sending}
      />
      <Pressable
        onPress={() => void handleSendRequest()}
        disabled={sending || !requestText.trim()}
        style={({ pressed }) => [
          styles.sendButton,
          (sending || !requestText.trim()) && styles.sendButtonDisabled,
          pressed && !sending && !!requestText.trim() && styles.sendButtonPressed,
        ]}
      >
        {sending ? (
          <View style={styles.sendingRow}>
            <LoadingDogSvg size={20} />
            <Text style={styles.sendButtonTxt}>送信中...</Text>
          </View>
        ) : (
          <Text style={[styles.sendButtonTxt, !requestText.trim() && styles.sendButtonTxtDisabled]}>
            リクエストを送信
          </Text>
        )}
      </Pressable>

      {toast && !onToast ? (
        <View style={[styles.toast, { bottom: Math.max(16, insets.bottom + 8) }]} pointerEvents="none">
          <Text style={styles.toastTxt}>{toast}</Text>
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: TOKENS.surface.primary,
    borderWidth: 1,
    borderColor: TOKENS.border.default,
    borderRadius: 12,
    padding: 14,
  },
  areaLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: TOKENS.text.secondary,
    marginBottom: 8,
  },
  requestLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: TOKENS.text.primary,
    marginBottom: 8,
  },
  textarea: {
    minHeight: 100,
    borderWidth: 1,
    borderColor: TOKENS.border.default,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: TOKENS.text.primary,
    backgroundColor: TOKENS.surface.secondary,
    marginBottom: 12,
  },
  sendButton: {
    backgroundColor: TOKENS.brand.yellow,
    borderRadius: 12,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.98 }],
  },
  sendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sendButtonTxt: {
    fontSize: 15,
    fontWeight: '700',
    color: TOKENS.text.primary,
  },
  sendButtonTxtDisabled: {
    color: TOKENS.text.tertiary,
  },
  toast: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 55,
    backgroundColor: colors.textPrimary,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  toastTxt: {
    color: '#fff',
    fontWeight: '700',
    textAlign: 'center',
    fontSize: 14,
  },
})
