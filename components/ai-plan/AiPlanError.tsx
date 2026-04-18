import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { TOKENS } from '@/constants/color-tokens'

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
}

function resolveError(code: string | undefined): { title: string; message: string } {
  const c = code && ERROR_MESSAGES[code] ? code : 'internal_error'
  return ERROR_MESSAGES[c] ?? ERROR_MESSAGES.internal_error
}

export function AiPlanError({
  code,
  onBack,
  onSelectArea,
}: {
  code?: string
  onBack: () => void
  onSelectArea?: (area: SuggestedArea) => void
}) {
  const { title, message } = resolveError(code)
  const showSuggestions =
    (code === 'unsupported_area' || code === 'no_candidates') && typeof onSelectArea === 'function'

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <Text style={styles.heroEmoji}>🔍</Text>
        </View>
        <Text style={styles.heroTitle}>{title}</Text>
        <Text style={styles.heroMsg}>{message}</Text>
      </View>

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
  )
}

const styles = StyleSheet.create({
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
  heroEmoji: {
    fontSize: 36,
  },
  heroTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: TOKENS.text.primary,
    marginBottom: 4,
    textAlign: 'center',
  },
  heroMsg: {
    fontSize: 11,
    color: TOKENS.text.secondary,
    textAlign: 'center',
    lineHeight: 17,
  },
  suggestCard: {
    backgroundColor: TOKENS.surface.primary,
    borderWidth: 1,
    borderColor: TOKENS.border.default,
    borderRadius: 12,
    padding: 13,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  suggestLabel: {
    fontSize: 10,
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
    fontSize: 12,
    color: TOKENS.text.primary,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  suggestRowMeta: {
    fontSize: 10,
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
    fontSize: 14,
    fontWeight: '700',
    color: TOKENS.text.primary,
  },
})
