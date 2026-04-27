import { useEffect, useState } from 'react'
import { Ionicons } from '@expo/vector-icons'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { TOKENS } from '@/constants/color-tokens'
import { sendAreaRequest } from '@/lib/wanspot-api'

export type SuggestedArea = { prefecture: string; municipality: string; spotCount: number }

const SUGGESTED_AREAS: SuggestedArea[] = [
  { prefecture: '東京都', municipality: '渋谷区', spotCount: 42 },
  { prefecture: '東京都', municipality: '世田谷区', spotCount: 6 },
  { prefecture: '京都府', municipality: '京都市東山区', spotCount: 3 },
]

const ERROR_MESSAGES: Record<string, { title: string; message: string }> = {
  unsupported_area: {
    title: 'このエリアはまだ準備中です',
    message: 'ペット可スポットを随時追加しています。\n別のエリアで試してみませんか？',
  },
  no_candidates: {
    title: 'このエリアはまだ準備中です',
    message: 'ペット可スポットを随時追加しています。\n別のエリアで試してみませんか？',
  },
  llm_failed: {
    title: 'プラン作成に失敗しました',
    message: '一時的な問題が発生しました。\nもう一度お試しください。',
  },
  auth_required: {
    title: 'ログインが必要です',
    message: 'マイページからログインしてください。',
  },
  internal_error: {
    title: 'エラーが発生しました',
    message: '一時的な問題です。しばらくしてからお試しください。',
  },
  generation_timeout: {
    title: 'プラン生成に時間がかかっています',
    message: 'もう一度お試しください。',
  },
  walking_not_feasible: {
    title: '徒歩でのプランが組みにくいエリアです',
    message:
      'スポット同士の距離の都合で、徒歩での周遊プランが組みにくい場合があります。\n車でのプランなら、ワンちゃんと行けるペット可スポットをまとめてご提案できることがあります。',
  },
  driving_not_feasible: {
    title: '車でのプランが組みにくいエリアです',
    message:
      'スポット同士の距離の都合で、車での周遊プランが組みにくい場合があります。\n徒歩でのプランをお試しください。',
  },
}

function resolveError(code: string | undefined): { title: string; message: string } {
  const c = code && ERROR_MESSAGES[code] ? code : 'internal_error'
  return ERROR_MESSAGES[c] ?? ERROR_MESSAGES.internal_error
}

export function AiPlanError({
  code,
  onBack,
  onSelectArea,
  requestArea,
}: {
  code?: string
  onBack: () => void
  onSelectArea?: (area: SuggestedArea) => void
  /** プラン生成に使った都道府県・市区町村（リクエスト送信用） */
  requestArea?: { prefecture: string; municipality: string } | null
}) {
  const insets = useSafeAreaInsets()
  const { title, message } = resolveError(code)
  const showSuggestions =
    (code === 'unsupported_area' || code === 'no_candidates') && typeof onSelectArea === 'function'

  const [requestText, setRequestText] = useState('')
  const [sending, setSending] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2800)
    return () => clearTimeout(t)
  }, [toast])

  const handleSendRequest = async () => {
    const trimmed = requestText.trim()
    if (!trimmed || !requestArea?.prefecture || !requestArea.municipality) return
    setSending(true)
    const result = await sendAreaRequest(requestArea.prefecture, requestArea.municipality, trimmed)
    setSending(false)
    if (result.ok) {
      setToast('リクエストありがとうございます！整備でき次第お知らせします')
      setRequestText('')
    } else {
      setToast('送信に失敗しました。時間をおいて再試行してください')
    }
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.root}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons name="search-outline" size={36} color={TOKENS.text.secondary} />
          </View>
          <Text style={styles.heroTitle}>{title}</Text>
          <Text style={styles.heroMsg}>{message}</Text>
        </View>

        {showSuggestions && requestArea?.prefecture && requestArea.municipality ? (
          <View style={styles.requestCard}>
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
                  <ActivityIndicator color={TOKENS.text.primary} />
                  <Text style={styles.sendButtonTxt}>送信中...</Text>
                </View>
              ) : (
                <Text
                  style={[
                    styles.sendButtonTxt,
                    !requestText.trim() && styles.sendButtonTxtDisabled,
                  ]}
                >
                  リクエストを送信
                </Text>
              )}
            </Pressable>
          </View>
        ) : null}

        {showSuggestions ? (
          <View style={styles.suggestCard}>
            <Text style={styles.suggestLabel}>おすすめのエリア</Text>
            <View style={styles.suggestList}>
              {SUGGESTED_AREAS.map((area) => (
                <Pressable
                  key={`${area.prefecture}-${area.municipality}`}
                  onPress={() => onSelectArea!(area)}
                  style={styles.suggestRow}
                >
                  <Text style={styles.suggestRowMain}>
                    {area.prefecture} {area.municipality}
                  </Text>
                  <Text style={styles.suggestRowMeta}>{area.spotCount}件</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        <Pressable style={styles.cta} onPress={onBack}>
          <Text style={styles.ctaTxt}>条件を変更する</Text>
        </Pressable>
      </ScrollView>

      {toast ? (
        <View style={[styles.toast, { bottom: Math.max(16, insets.bottom + 8) }]} pointerEvents="none">
          <Text style={styles.toastTxt}>{toast}</Text>
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: TOKENS.surface.secondary,
  },
  root: {
    flex: 1,
    backgroundColor: TOKENS.surface.secondary,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingBottom: 80,
    paddingTop: 24,
  },
  hero: {
    alignItems: 'center',
    marginBottom: 20,
  },
  heroIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: TOKENS.brand.yellowLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  heroTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: TOKENS.text.primary,
    marginBottom: 4,
    textAlign: 'center',
  },
  heroMsg: {
    fontSize: 13,
    color: TOKENS.text.secondary,
    textAlign: 'center',
    lineHeight: 19,
  },
  requestCard: {
    backgroundColor: TOKENS.surface.primary,
    borderWidth: 1,
    borderColor: TOKENS.border.default,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
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
  suggestCard: {
    backgroundColor: TOKENS.surface.primary,
    borderWidth: 1,
    borderColor: TOKENS.border.default,
    borderRadius: 12,
    padding: 14,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  suggestLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: TOKENS.text.tertiary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  suggestList: { gap: 6 },
  suggestRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 10,
    backgroundColor: TOKENS.surface.secondary,
    borderRadius: 9,
  },
  suggestRowMain: {
    fontSize: 14,
    color: TOKENS.text.primary,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  suggestRowMeta: {
    fontSize: 12,
    color: TOKENS.text.tertiary,
  },
  cta: {
    backgroundColor: TOKENS.brand.yellow,
    borderRadius: 14,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaTxt: {
    fontSize: 16,
    fontWeight: '700',
    color: TOKENS.text.primary,
  },
  toast: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 55,
    backgroundColor: '#2b2a28',
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
